"use client";

import { useState, useEffect, useRef } from "react";
import { X, Mic, MicOff } from "lucide-react";
import * as chatApi from "@/lib/api-chat";
import { getAccessToken, transcribeAudio, synthesizeAudio } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";

interface VoiceModeProps {
  onClose: (createdConvId?: string) => void;
}

type Phase = "init" | "listening" | "thinking" | "speaking" | "error";

// Detect language from AI response text for correct TTS voice
function detectResponseLang(text: string): string {
  if (/[\u0400-\u04FF]/.test(text)) return "ru-RU";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN";
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja-JP";
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko-KR";
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  return "en-US"; // default
}

// ── Smooth canvas draw with phase interpolation ──
function draw(
  ctx: CanvasRenderingContext2D, S: number, dpr: number,
  analyser: AnalyserNode | null, data: Uint8Array<ArrayBuffer> | null,
  sm: Float32Array, phase: Phase, time: number,
  // Blend factor 0→1 for phase transitions (smooths visual changes)
  blend: { listening: number; thinking: number; speaking: number },
) {
  const N = 48, CX = S / 2, CY = S / 2, IR = S * 0.24;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, S, S);

  // Read mic
  if (analyser && data && phase === "listening") analyser.getByteFrequencyData(data);

  const bL = blend.listening, bT = blend.thinking, bS = blend.speaking;

  let avg = 0;
  for (let i = 0; i < N; i++) {
    // Blend raw values across phases
    const micV = (data && data.length > 0) ? data[Math.floor((i / N) * data.length)] / 255 : 0;
    const speakV = 0.35 + Math.sin(time * 4 + i * 0.4) * 0.22 + Math.sin(time * 6 + i * 0.7) * 0.12 + Math.sin(time * 2 + i * 0.15) * 0.1;
    const thinkV = 0.06 + Math.sin(time * 1.2 + i * 0.15) * 0.04;
    const idleV = 0.03;

    const raw = micV * bL + speakV * bS + thinkV * bT + idleV * (1 - bL - bT - bS);
    sm[i] = sm[i] * 0.4 + Math.max(0, Math.min(1, raw)) * 0.6;
    avg += sm[i];
  }
  avg /= N;

  // Glow — multi-stop for smooth falloff
  const glowR = IR * (2.5 + avg * 1.2);
  const grd = ctx.createRadialGradient(CX, CY, 0, CX, CY, glowR);
  grd.addColorStop(0, `rgba(255,255,255,${0.015 + avg * 0.04})`);
  grd.addColorStop(0.35, `rgba(255,255,255,${0.008 + avg * 0.02})`);
  grd.addColorStop(0.7, `rgba(255,255,255,${avg * 0.005})`);
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(CX, CY, glowR, 0, Math.PI * 2); ctx.fill();

  // Bars
  ctx.lineCap = "round";
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const v = sm[i];
    const len = 3 + v * S * (0.06 + bL * 0.14 + bS * 0.06);
    const alpha = 0.03 + v * (0.15 + bL * 0.5 + bS * 0.25 + bT * 0.07);
    ctx.lineWidth = 2 + v * 1.5;
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, alpha)})`;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * IR, CY + Math.sin(a) * IR);
    ctx.lineTo(CX + Math.cos(a) * (IR + len), CY + Math.sin(a) * (IR + len));
    ctx.stroke();
  }

  // Orb
  const orbBase = S * 0.2;
  const orbScale = 1 + avg * 0.15 * bL + (Math.sin(time * 1.5) * 0.03) * bT + 0.04 * bS;
  const oR = orbBase * orbScale;

  // Thinking pulsing rings (faded by blend)
  if (bT > 0.01) {
    const pulseA = bT * (0.04 + Math.sin(time * 2) * 0.03);
    ctx.strokeStyle = `rgba(255,255,255,${pulseA})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(CX, CY, oR * (1.1 + Math.sin(time * 2) * 0.15), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${pulseA * 0.5})`;
    ctx.beginPath(); ctx.arc(CX, CY, oR * (1.3 + Math.sin(time * 2 + 1) * 0.1), 0, Math.PI * 2); ctx.stroke();
  }

  // Speaking ripples (faded by blend)
  if (bS > 0.01) {
    for (let r = 1; r <= 3; r++) {
      ctx.strokeStyle = `rgba(255,255,255,${bS * (0.05 - r * 0.012)})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(CX, CY, oR * (1 + r * 0.3 + Math.sin(time * 3 + r) * 0.05), 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Listening glow (faded by blend)
  if (bL > 0.01 && avg > 0.08) {
    const og = ctx.createRadialGradient(CX, CY, oR, CX, CY, oR * 1.6);
    og.addColorStop(0, `rgba(255,255,255,${bL * avg * 0.06})`);
    og.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(CX, CY, oR * 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // Orb body
  const orbGrd = ctx.createRadialGradient(CX - oR * 0.2, CY - oR * 0.2, 0, CX, CY, oR);
  orbGrd.addColorStop(0, `rgba(255,255,255,${0.06 + avg * 0.1})`);
  orbGrd.addColorStop(1, "rgba(255,255,255,0.018)");
  ctx.fillStyle = orbGrd; ctx.beginPath(); ctx.arc(CX, CY, oR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.06 + avg * 0.04})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(CX, CY, oR, 0, Math.PI * 2); ctx.stroke();

  // Star
  const starA = 0.35 + avg * 0.3 + bL * 0.1;
  ctx.save(); ctx.translate(CX, CY);
  if (bT > 0.01) ctx.rotate(time * 0.4 * bT);
  if (bS > 0.01) { const p = 1 + Math.sin(time * 4) * 0.03 * bS; ctx.scale(p, p); }
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, starA)})`;
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(10, 0, 0, 18); ctx.quadraticCurveTo(-10, 0, 0, -18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(0, -10, 18, 0); ctx.quadraticCurveTo(0, 10, -18, 0); ctx.fill();
  ctx.restore();
}

export default function VoiceMode({ onClose }: VoiceModeProps) {
  const [phase, setPhase] = useState<Phase>("init");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [responsePreview, setResponsePreview] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { activeConversationId, selectedModel, addMessage, ensureConversation } = useChat();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(Date.now());
  const phaseRef = useRef<Phase>("init");
  const convIdRef = useRef(activeConversationId);
  const mutedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Refs for latest values (avoids stale closures)
  const selectedModelRef = useRef(selectedModel);
  const addMessageRef = useRef(addMessage);
  const ensureConvRef = useRef(ensureConversation);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { convIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { addMessageRef.current = addMessage; }, [addMessage]);
  useEffect(() => { ensureConvRef.current = ensureConversation; }, [ensureConversation]);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // TTS — server-side via Piper (natural voice, self-hosted)
  const speakFn = async (text: string): Promise<void> => {
    const clean = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s/g, "").replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1")
      .replace(/\[(\d+)\]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_~`#>-]/g, "")
      .trim().slice(0, 500);
    if (!clean) return;

    const langCode = detectResponseLang(clean).split("-")[0]; // "ru-RU" → "ru"

    try {
      const blob = await synthesizeAudio(clean, langCode);
      if (!blob || blob.size < 100) {
        console.warn("[TTS] Empty or tiny audio blob, falling back to browser TTS");
        throw new Error("Empty audio");
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          currentAudioRef.current = null;
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onended = finish;
        audio.onerror = (e) => { console.error("[TTS] Audio playback error:", e); finish(); };
        audio.play().catch((e) => { console.error("[TTS] Audio play() failed:", e); finish(); });
        setTimeout(finish, 30000);
      });
    } catch (e) {
      console.error("[TTS] Server TTS failed, using browser fallback:", e);
      // Fallback to browser SpeechSynthesis
      return new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window)) { resolve(); return; }
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(clean);
        utt.lang = detectResponseLang(clean);
        utt.rate = 1.0;
        utt.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const prefix = detectResponseLang(clean).split("-")[0];
        const matched = voices.find((v: SpeechSynthesisVoice) => v.lang.startsWith(prefix));
        if (matched) utt.voice = matched;
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        utt.onend = finish; utt.onerror = (e) => { console.error("[TTS] Browser TTS error:", e); finish(); };
        window.speechSynthesis.speak(utt);
        setTimeout(finish, 25000);
      });
    }
  };

  // ── Combined effect: canvas + mic + STT + AI ──
  useEffect(() => {
    let alive = true;
    let raf = 0;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArr: Uint8Array<ArrayBuffer> | null = null;
    const sm = new Float32Array(48).fill(0);

    // STT state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let recognition: any = null;
    let useNativeSTT = false;
    let sttTranscript = ""; // accumulated final transcript from SpeechRecognition
    let sttInterim = "";    // current interim result
    let silenceCheckId: ReturnType<typeof setInterval> | null = null;

    // Fallback: MediaRecorder + Whisper (when SpeechRecognition unavailable)
    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];
    let recordingStartTime = 0;

    // Silence detection thresholds
    let voiceDetected = false;
    let lastVoiceTime = 0;

    const SILENCE_THRESHOLD = 0.04;  // avg frequency level to count as speech
    const SILENCE_TIMEOUT = 2500;    // 2.5s silence after speech → send to AI
    const MIN_RECORDING = 400;       // minimum recording duration (ms)
    const INTERRUPT_THRESHOLD = 0.18; // must speak clearly to interrupt (avoids echo triggers)

    // Smooth phase blend targets
    const blendTarget = { listening: 0, thinking: 0, speaking: 0 };
    const blendCurrent = { listening: 0, thinking: 0, speaking: 0 };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const SIZE = 300;
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d")!;

    // Draw loop with smooth blending
    const tick = () => {
      if (!alive) return;
      const ease = 0.08;
      blendCurrent.listening += (blendTarget.listening - blendCurrent.listening) * ease;
      blendCurrent.thinking += (blendTarget.thinking - blendCurrent.thinking) * ease;
      blendCurrent.speaking += (blendTarget.speaking - blendCurrent.speaking) * ease;

      draw(ctx, SIZE, dpr, analyser, dataArr, sm, phaseRef.current,
        (Date.now() - startRef.current) / 1000, blendCurrent);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const updateBlend = (ph: Phase) => {
      blendTarget.listening = ph === "listening" ? 1 : 0;
      blendTarget.thinking = ph === "thinking" ? 1 : 0;
      blendTarget.speaking = ph === "speaking" ? 1 : 0;
    };

    const origSetPhase = setPhase;
    const smoothSetPhase = (ph: Phase) => {
      phaseRef.current = ph; // sync — so interval checks see it immediately
      origSetPhase(ph);
      updateBlend(ph);
    };

    // ── Native SpeechRecognition helpers ──

    const startNativeSTT = () => {
      if (!alive || mutedRef.current || !recognition) return;
      sttTranscript = "";
      sttInterim = "";
      try { recognition.start(); } catch { /* already started */ }
    };

    const stopNativeSTT = () => {
      if (!recognition) return;
      try { recognition.stop(); } catch { /* already stopped */ }
    };

    // ── MediaRecorder helpers (fallback) ──

    const startRecording = () => {
      if (!stream || !alive || mutedRef.current) return;
      audioChunks = [];
      try {
        // Pick a supported mime: webm (Chrome/Firefox), mp4 (Safari/iOS), or browser default
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : undefined;
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.start(500); // collect 500ms chunks
        recordingStartTime = Date.now();
        voiceDetected = false;
        lastVoiceTime = 0;
      } catch (e) {
        console.error("MediaRecorder error:", e);
      }
    };

    const stopAndTranscribeFallback = () => {
      if (!mediaRecorder || mediaRecorder.state === "inactive") return;
      voiceDetected = false;

      const recorder = mediaRecorder;
      mediaRecorder = null;

      recorder.onstop = async () => {
        if (!alive || audioChunks.length === 0) {
          if (alive && phaseRef.current !== "error") resumeListening();
          return;
        }
        const blob = new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" });
        audioChunks = [];

        // Too small — probably just noise
        if (blob.size < 1000) { if (alive) resumeListening(); return; }

        smoothSetPhase("thinking");

        try {
          const result = await transcribeAudio(blob);
          if (!alive) return;

          const text = result.text?.trim();
          if (!text) { resumeListening(); return; }

          setTranscript(text);
          sendToAI(text);
        } catch (e: unknown) {
          if (alive) {
            const msg = e instanceof Error ? e.message : t("voice.error");
            setError(msg);
            smoothSetPhase("error");
          }
        }
      };

      try { recorder.stop(); } catch {}
    };

    // ── Unified silence-end handler ──

    const handleSilenceEnd = () => {
      if (useNativeSTT) {
        // Native STT path: take accumulated transcript + interim
        const text = (sttTranscript + sttInterim).trim();
        sttTranscript = "";
        sttInterim = "";
        stopNativeSTT();

        if (!text) {
          resumeListening();
          return;
        }

        setTranscript(text);
        smoothSetPhase("thinking");
        sendToAI(text);
      } else {
        // Fallback: MediaRecorder + Whisper
        stopAndTranscribeFallback();
      }
    };

    // ── AI send ──

    // Clean text for TTS (strip markdown)
    const cleanForTTS = (t: string) => t
      .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s/g, "").replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1")
      .replace(/\[(\d+)\]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_~`#>]/g, "")
      .trim();

    // Play a single audio blob via Web Audio API (works on iOS Safari).
    // Falls back to HTML5 Audio if AudioContext is unavailable.
    let currentSource: AudioBufferSourceNode | null = null;
    const playBlob = (blob: Blob): Promise<void> => {
      if (blob.size < 100) return Promise.resolve();
      // Prefer Web Audio API — works on iOS after AudioContext is unlocked
      if (audioCtx && audioCtx.state === "running") {
        return blob.arrayBuffer()
          .then(buf => audioCtx!.decodeAudioData(buf))
          .then(decoded => new Promise<void>((resolve) => {
            const source = audioCtx!.createBufferSource();
            source.buffer = decoded;
            source.connect(audioCtx!.destination);
            currentSource = source;
            let done = false;
            const finish = () => { if (done) return; done = true; currentSource = null; resolve(); };
            source.onended = finish;
            source.start(0);
            setTimeout(finish, 20000);
          }))
          .catch(() => Promise.resolve());
      }
      // Fallback: HTML5 Audio (Chrome/desktop)
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (done) return; done = true; currentAudioRef.current = null; URL.revokeObjectURL(url); resolve(); };
        audio.onended = finish;
        audio.onerror = finish;
        audio.play().catch(finish);
        setTimeout(finish, 20000);
      });
    };

    const sendToAI = async (text: string) => {
      if (!text.trim() || !alive) return;
      if (!getAccessToken()) { setError(t("voice.loginRequired")); smoothSetPhase("error"); return; }

      // Include session duration so the AI is aware of call length
      const secs = Math.floor((Date.now() - startRef.current) / 1000);
      const mm = Math.floor(secs / 60);
      const ss = (secs % 60).toString().padStart(2, "0");
      const taggedText = `[Voice call · ${mm}:${ss}] ${text}`;

      setResponsePreview("");

      try {
        let cid = convIdRef.current;
        if (!cid) {
          const c = await chatApi.createConversation(text.slice(0, 60));
          if (!c || !alive) { if (alive) { smoothSetPhase("error"); setError(t("voice.error")); } return; }
          cid = c.id;
          convIdRef.current = cid;
          ensureConvRef.current(cid!, text.slice(0, 60));
        }

        addMessageRef.current(cid, { id: `user-${Date.now()}`, role: "user", content: text });

        const m = selectedModelRef.current.toLowerCase().replace(/\s+/g, "-");
        const model = ["mira", "mira-thinking"].includes(m) ? m : "mira";

        // Use taggedText (with session time) for the AI, plain text for display
        const aiContent = taggedText;

        // ── Sentence-streaming TTS ──
        // Fire TTS per sentence as AI streams. Play each immediately when ready.
        // Playback runs in a separate async chain so it doesn't block token processing.
        let full = "";
        let pendingSentence = "";
        const clauseBoundary = /[.!?,;:。！？，；]\s*$/;

        // Playback chain: each sentence's TTS promise is pushed here.
        // A background loop plays them in order as they resolve.
        const ttsQueue: Promise<Blob | null>[] = [];
        let playbackStarted = false;
        let playedAnyAudio = false;
        let streamDone = false;
        let playbackPromise: Promise<void> | null = null;

        // Background playback — plays blobs in order as they resolve
        const runPlayback = async () => {
          let i = 0;
          while (alive && phaseRef.current === "speaking") {
            if (i >= ttsQueue.length) {
              if (streamDone) break; // stream finished, no more entries coming
              await new Promise(r => setTimeout(r, 150));
              continue; // keep waiting for more sentences while stream is active
            }
            const blob = await ttsQueue[i];
            i++;
            if (!alive || phaseRef.current !== "speaking") break;
            if (blob && blob.size >= 100) {
              playedAnyAudio = true;
              await playBlob(blob);
            }
          }
        };

        for await (const ev of chatApi.streamMessage(cid, aiContent, model, undefined, true)) {
          if (!alive) return;
          if (ev.type === "token") {
            full += ev.content;
            pendingSentence += ev.content;
            setResponsePreview(full);

            // Sentence boundary → fire TTS immediately, start playback on first
            if (clauseBoundary.test(pendingSentence) && pendingSentence.trim().length > 3) {
              const sentence = cleanForTTS(pendingSentence);
              pendingSentence = "";
              if (sentence) {
                const lang = detectResponseLang(sentence).split("-")[0];
                ttsQueue.push(synthesizeAudio(sentence, lang).catch(() => null));

                if (!playbackStarted) {
                  playbackStarted = true;
                  smoothSetPhase("speaking");
                  playbackPromise = runPlayback();
                }
              }
            }
          }
          if (ev.type === "error") { setError(ev.message); smoothSetPhase("error"); return; }
        }
        if (!alive) return;
        if (!full.trim()) { resumeListening(); return; }

        // TTS any remaining text (final fragment without sentence punctuation)
        const remaining = cleanForTTS(pendingSentence);
        if (remaining) {
          const lang = detectResponseLang(remaining).split("-")[0];
          ttsQueue.push(synthesizeAudio(remaining, lang).catch(() => null));
        }

        // Signal playback loop that no more entries are coming
        streamDone = true;

        addMessageRef.current(cid, { id: `msg-${Date.now()}`, role: "assistant", content: full });

        if (playbackStarted && playbackPromise) {
          // Wait for the playback loop to finish playing ALL blobs,
          // not just for the TTS API calls to return.
          await playbackPromise;
        } else if (ttsQueue.length > 0) {
          // Short response — playback never started, drain now
          smoothSetPhase("speaking");
          playbackPromise = runPlayback();
          await playbackPromise;
        }

        // If server TTS failed entirely (all blobs null), use browser speech.
        // Go directly to SpeechSynthesis — don't retry the server.
        if (!playedAnyAudio && full.trim() && alive && phaseRef.current !== "error") {
          smoothSetPhase("speaking");
          const cleanText = cleanForTTS(full).slice(0, 500);
          if (cleanText && "speechSynthesis" in window) {
            await new Promise<void>((resolve) => {
              window.speechSynthesis.cancel();
              const utt = new SpeechSynthesisUtterance(cleanText);
              utt.lang = detectResponseLang(cleanText);
              utt.rate = 1.0;
              const voices = window.speechSynthesis.getVoices();
              const matched = voices.find((v: SpeechSynthesisVoice) => v.lang.startsWith(utt.lang.split("-")[0]));
              if (matched) utt.voice = matched;
              let done = false;
              const finish = () => { if (!done) { done = true; resolve(); } };
              utt.onend = finish;
              utt.onerror = () => { console.warn("[TTS] Browser speech failed"); finish(); };
              window.speechSynthesis.speak(utt);
              setTimeout(finish, 20000);
            });
          }
        }

        if (alive && phaseRef.current === "speaking") resumeListening();
      } catch (e: unknown) {
        if (alive && !(e instanceof Error && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : t("voice.error"));
          smoothSetPhase("error");
        }
      }
    };

    // Cooldown after speaking — ignore mic to avoid catching echo tail
    let echoCooldownUntil = 0;

    const resumeListening = () => {
      setTranscript(""); setResponsePreview("");
      smoothSetPhase("listening");
      voiceDetected = false;
      lastVoiceTime = 0;
      sttTranscript = "";
      sttInterim = "";
      // 600ms echo cooldown — mic levels are ignored during this window
      echoCooldownUntil = Date.now() + 600;
      setTimeout(() => {
        if (!alive || mutedRef.current) return;
        if (useNativeSTT) {
          startNativeSTT();
        } else {
          startRecording();
        }
      }, 300);
    };

    // ── TTS voices preload ──
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    // ── Mic + STT + Silence detection setup ──
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        audioCtx = new AudioContext();
        // iOS Safari: AudioContext starts suspended; resume after getUserMedia unlocks it
        if (audioCtx.state === "suspended") await audioCtx.resume();
        const src = audioCtx.createMediaStreamSource(s);
        const an = audioCtx.createAnalyser();
        an.fftSize = 128; an.smoothingTimeConstant = 0.65; an.minDecibels = -85; an.maxDecibels = -10;
        src.connect(an);
        analyser = an;
        dataArr = new Uint8Array(an.frequencyBinCount) as Uint8Array<ArrayBuffer>;

        // ── Detect native SpeechRecognition support ──
        const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognitionCtor) {
          useNativeSTT = true;
          recognition = new SpeechRecognitionCtor();
          recognition.continuous = true;
          recognition.interimResults = true;
          // Use browser language; echo cancellation prevents AI voice contamination
          recognition.lang = navigator.language || "en-US";

          recognition.onresult = (event: any) => {
            let finalText = "";
            let interimText = "";
            for (let i = 0; i < event.results.length; i++) {
              const result = event.results[i];
              if (result.isFinal) {
                finalText += result[0].transcript;
              } else {
                interimText += result[0].transcript;
              }
            }
            sttTranscript = finalText;
            sttInterim = interimText;

            // Show live transcript while listening
            if (phaseRef.current === "listening") {
              setTranscript((finalText + interimText).trim());
            }
          };

          recognition.onerror = (event: any) => {
            console.warn("[SpeechRecognition] error:", event.error);
            // "no-speech" and "aborted" are non-fatal — ignore
            if (event.error !== "no-speech" && event.error !== "aborted") {
              console.error("[SpeechRecognition] Fatal error:", event.error);
            }
          };

          recognition.onend = () => {
            // Auto-restart if still in listening phase and not muted
            if (alive && phaseRef.current === "listening" && !mutedRef.current) {
              try { recognition.start(); } catch { /* already started */ }
            }
          };
        }

        smoothSetPhase("listening");

        // Start STT (native or fallback)
        if (useNativeSTT) {
          startNativeSTT();
        } else {
          startRecording();
        }

        // ── Silence & interrupt detection loop ──
        silenceCheckId = setInterval(() => {
          if (!alive || !analyser || !dataArr) return;

          const ph = phaseRef.current;

          // Handle mute
          if (mutedRef.current) {
            if (useNativeSTT) {
              stopNativeSTT();
            } else {
              if (mediaRecorder && mediaRecorder.state !== "inactive") {
                audioChunks = [];
                try { mediaRecorder.stop(); } catch {}
                mediaRecorder = null;
              }
            }
            voiceDetected = false;
            sttTranscript = "";
            sttInterim = "";
            return;
          }

          // If listening but STT/recorder not active (after unmute or resume), restart
          if (ph === "listening") {
            if (useNativeSTT) {
              // Recognition auto-restarts via onend, but ensure it's running
              // (no-op if already started — caught by try/catch in startNativeSTT)
            } else if (!mediaRecorder) {
              startRecording();
            }
          }

          // Read audio level
          analyser.getByteFrequencyData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
          const avg = sum / dataArr.length / 255;

          const now = Date.now();

          // Echo cooldown — ignore all mic activity right after TTS ends
          if (now < echoCooldownUntil) return;

          // Interrupt TTS when user speaks clearly (high threshold avoids echo triggers)
          if (ph === "speaking" && avg > INTERRUPT_THRESHOLD) {
            if (currentSource) { try { currentSource.stop(); } catch {} currentSource = null; }
            if (currentAudioRef.current) {
              currentAudioRef.current.pause();
              currentAudioRef.current = null;
            }
            if ("speechSynthesis" in window) window.speechSynthesis.cancel();
            resumeListening();
            return;
          }

          // Silence detection during listening
          if (ph === "listening") {
            if (avg > SILENCE_THRESHOLD) {
              voiceDetected = true;
              lastVoiceTime = now;
            }
            // Voice was detected, now silent for timeout → send
            if (voiceDetected && lastVoiceTime > 0 && now - lastVoiceTime > SILENCE_TIMEOUT) {
              if (useNativeSTT || (now - recordingStartTime > MIN_RECORDING)) {
                handleSilenceEnd();
              }
            }
          }
        }, 100);

      } catch { setError(t("voice.micDenied")); smoothSetPhase("error"); }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (silenceCheckId) clearInterval(silenceCheckId);
      if (recognition) { try { recognition.stop(); } catch {} }
      if (mediaRecorder?.state !== "inactive") try { mediaRecorder?.stop(); } catch {}
      stream?.getTracks().forEach(t => t.stop());
      if (currentSource) { try { currentSource.stop(); } catch {} currentSource = null; }
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      audioCtx?.close().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-[#080808]">
      {/* Timer — top of screen */}
      <div className="absolute top-7 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/20" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white/25" />
        </span>
        <p className="text-[15px] text-white/25 tabular-nums font-mono">{fmt(elapsed)}</p>
      </div>

      <button onClick={() => onClose(convIdRef.current || undefined)} className="absolute top-6 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all">
        <X size={22} strokeWidth={1.8} />
      </button>

      <canvas ref={canvasRef} style={{ width: 300, height: 300 }} className="mb-6" />

      {/* Status */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-[16px] text-white/30">
          {phase === "listening" && <>{t("voice.listening")}<span className="mira-thinking-dots" /></>}
          {phase === "thinking" && <>{t("voice.thinking")}<span className="mira-thinking-dots" /></>}
          {phase === "speaking" && t("voice.speaking")}
          {phase === "error" && (error || t("voice.error"))}
        </span>
      </div>

      {/* Transcript — shown during listening (live preview) and thinking (what was said) */}
      <div className="max-w-sm mx-auto px-6 min-h-[20px] text-center mb-6">
        {(phase === "listening" || phase === "thinking") && transcript && (
          <p className="text-[16px] text-white/15 line-clamp-2">{transcript}</p>
        )}
      </div>

      <div className="flex items-center gap-6">
        <button onClick={() => setMuted(!muted)} className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ${muted ? "bg-white/[0.06] text-white/25 border border-white/[0.08]" : "bg-white/[0.05] text-white/40 border border-white/[0.07] hover:bg-white/[0.08]"}`}>
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button onClick={() => onClose(convIdRef.current || undefined)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.10] text-white/45 hover:bg-white/[0.12] active:scale-95 transition-all">
          <X size={24} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
