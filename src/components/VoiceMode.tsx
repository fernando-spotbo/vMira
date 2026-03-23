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
// Supported languages for voice mode — user cycles through these
const VOICE_LANGS = [
  { code: "ru-RU", label: "RU", name: "Русский" },
  { code: "en-US", label: "EN", name: "English" },
  { code: "es-ES", label: "ES", name: "Español" },
  { code: "fr-FR", label: "FR", name: "Français" },
  { code: "de-DE", label: "DE", name: "Deutsch" },
  { code: "pt-BR", label: "PT", name: "Português" },
  { code: "zh-CN", label: "中", name: "中文" },
  { code: "ja-JP", label: "日", name: "日本語" },
  { code: "ko-KR", label: "한", name: "한국어" },
  { code: "ar-SA", label: "ع", name: "العربية" },
  { code: "hi-IN", label: "हि", name: "हिन्दी" },
  { code: "it-IT", label: "IT", name: "Italiano" },
  { code: "tr-TR", label: "TR", name: "Türkçe" },
];

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

// Whisper language name → BCP-47 locale code
const WHISPER_LANG_MAP: Record<string, string> = {
  russian: "ru-RU", english: "en-US", spanish: "es-ES",
  french: "fr-FR", german: "de-DE", portuguese: "pt-BR",
  chinese: "zh-CN", japanese: "ja-JP", korean: "ko-KR",
  arabic: "ar-SA", hindi: "hi-IN", italian: "it-IT", turkish: "tr-TR",
};

export default function VoiceMode({ onClose }: VoiceModeProps) {
  const [phase, setPhase] = useState<Phase>("init");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [responsePreview, setResponsePreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [langIndex, setLangIndex] = useState(0);

  const { activeConversationId, selectedModel, addMessage, ensureConversation } = useChat();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(Date.now());
  const phaseRef = useRef<Phase>("init");
  const convIdRef = useRef(activeConversationId);
  const mutedRef = useRef(false);
  const langIndexRef = useRef(0);
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

  // ── Combined effect: canvas + mic + MediaRecorder + Whisper STT + AI ──
  useEffect(() => {
    let alive = true;
    let raf = 0;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArr: Uint8Array<ArrayBuffer> | null = null;
    const sm = new Float32Array(48).fill(0);

    // MediaRecorder state (local to effect)
    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];
    let silenceCheckId: ReturnType<typeof setInterval> | null = null;

    // Silence detection thresholds
    let voiceDetected = false;
    let lastVoiceTime = 0;
    let recordingStartTime = 0;

    const SILENCE_THRESHOLD = 0.03;  // avg frequency level to count as speech
    const SILENCE_TIMEOUT = 1000;    // 1s silence after speech → send to Whisper
    const MIN_RECORDING = 400;       // minimum recording duration (ms)
    const INTERRUPT_THRESHOLD = 0.12; // louder threshold for interrupt during TTS

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

    // ── MediaRecorder helpers ──

    const startRecording = () => {
      if (!stream || !alive || mutedRef.current) return;
      audioChunks = [];
      try {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus" : "audio/webm";
        mediaRecorder = new MediaRecorder(stream, { mimeType });
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

    const stopAndTranscribe = () => {
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

          // Auto-switch language based on Whisper detection
          if (result.language) {
            const newCode = WHISPER_LANG_MAP[result.language];
            if (newCode) {
              const idx = VOICE_LANGS.findIndex(l => l.code === newCode);
              if (idx >= 0 && idx !== langIndexRef.current) {
                langIndexRef.current = idx;
                setLangIndex(idx);
              }
            }
          }

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

    // ── AI send ──

    // Clean text for TTS (strip markdown)
    const cleanForTTS = (t: string) => t
      .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s/g, "").replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1")
      .replace(/\[(\d+)\]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_~`#>]/g, "")
      .trim();

    // Play a single audio blob, returns when done
    const playBlob = (blob: Blob): Promise<void> => {
      if (blob.size < 100) return Promise.resolve();
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

        // Background playback — plays blobs in order as they resolve
        const runPlayback = async () => {
          let i = 0;
          while (alive && phaseRef.current === "speaking") {
            if (i >= ttsQueue.length) {
              // Wait a bit for more sentences
              await new Promise(r => setTimeout(r, 100));
              // If stream is done and we've played everything, stop
              if (i >= ttsQueue.length) break;
              continue;
            }
            const blob = await ttsQueue[i];
            i++;
            if (!alive || phaseRef.current !== "speaking") break;
            if (blob && blob.size >= 100) {
              await playBlob(blob);
            }
          }
        };

        for await (const ev of chatApi.streamMessage(cid, text, model, undefined, true)) {
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
                  // Start playback loop in background — don't await
                  runPlayback();
                }
              }
            }
          }
          if (ev.type === "error") { setError(ev.message); smoothSetPhase("error"); return; }
        }
        if (!alive) return;
        if (!full.trim()) { resumeListening(); return; }

        // Check for LANG:xx-XX response
        const langMatch = full.trim().match(/^LANG:([a-z]{2}-[A-Z]{2})$/);
        if (langMatch) {
          const newCode = langMatch[1];
          const idx = VOICE_LANGS.findIndex(l => l.code === newCode);
          if (idx >= 0) {
            langIndexRef.current = idx;
            setLangIndex(idx);
            const switchMsg = newCode.startsWith("en") ? "Switching language. Please repeat."
              : newCode.startsWith("ru") ? "Переключаю язык. Повторите, пожалуйста."
              : newCode.startsWith("es") ? "Cambiando idioma. Por favor repita."
              : newCode.startsWith("fr") ? "Changement de langue. Veuillez répéter."
              : newCode.startsWith("de") ? "Sprache wird gewechselt. Bitte wiederholen."
              : "Switching language. Please repeat.";
            smoothSetPhase("speaking");
            await speakFn(switchMsg);
            if (alive && phaseRef.current === "speaking") resumeListening();
          } else { resumeListening(); }
          return;
        }

        // TTS any remaining text
        if (pendingSentence.trim()) {
          const lastClean = cleanForTTS(pendingSentence);
          if (lastClean) {
            const lang = detectResponseLang(lastClean).split("-")[0];
            ttsQueue.push(synthesizeAudio(lastClean, lang).catch(() => null));
          }
        }

        addMessageRef.current(cid, { id: `msg-${Date.now()}`, role: "assistant", content: full });

        // If playback hasn't started yet (very short response, no sentence boundary)
        if (!playbackStarted && ttsQueue.length > 0) {
          smoothSetPhase("speaking");
          await runPlayback();
        } else if (playbackStarted) {
          // Wait for playback to finish all queued sentences
          for (const p of ttsQueue) await p;
          // Give playback loop time to finish the last blob
          await new Promise(r => setTimeout(r, 500));
        } else if (!full.trim()) {
          resumeListening(); return;
        } else {
          // No TTS queued at all — fallback to browser TTS
          smoothSetPhase("speaking");
          await speakFn(full);
        }

        if (alive && phaseRef.current === "speaking") resumeListening();
      } catch (e: unknown) {
        if (alive && !(e instanceof Error && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : t("voice.error"));
          smoothSetPhase("error");
        }
      }
    };

    const resumeListening = () => {
      setTranscript(""); setResponsePreview("");
      smoothSetPhase("listening");
      voiceDetected = false;
      lastVoiceTime = 0;
      setTimeout(() => {
        if (alive && !mutedRef.current) startRecording();
      }, 200);
    };

    // ── TTS voices preload ──
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    // ── Mic + MediaRecorder + Silence detection setup ──
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        audioCtx = new AudioContext();
        const src = audioCtx.createMediaStreamSource(s);
        const an = audioCtx.createAnalyser();
        an.fftSize = 128; an.smoothingTimeConstant = 0.65; an.minDecibels = -85; an.maxDecibels = -10;
        src.connect(an);
        analyser = an;
        dataArr = new Uint8Array(an.frequencyBinCount) as Uint8Array<ArrayBuffer>;

        smoothSetPhase("listening");
        startRecording();

        // ── Silence & interrupt detection loop ──
        silenceCheckId = setInterval(() => {
          if (!alive || !analyser || !dataArr) return;

          const ph = phaseRef.current;

          // Handle mute: stop recorder, discard chunks
          if (mutedRef.current) {
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
              audioChunks = [];
              try { mediaRecorder.stop(); } catch {}
              mediaRecorder = null;
            }
            voiceDetected = false;
            return;
          }

          // If listening but no recorder (after unmute or resume), start one
          if (ph === "listening" && !mediaRecorder) {
            startRecording();
          }

          // Read audio level
          analyser.getByteFrequencyData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
          const avg = sum / dataArr.length / 255;

          const now = Date.now();

          // Interrupt TTS when user speaks loudly
          if (ph === "speaking" && avg > INTERRUPT_THRESHOLD) {
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
            // Voice was detected, now silent for SILENCE_TIMEOUT → send
            if (voiceDetected && lastVoiceTime > 0 && now - lastVoiceTime > SILENCE_TIMEOUT) {
              if (now - recordingStartTime > MIN_RECORDING) {
                stopAndTranscribe();
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
      if (mediaRecorder?.state !== "inactive") try { mediaRecorder?.stop(); } catch {}
      stream?.getTracks().forEach(t => t.stop());
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      audioCtx?.close().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle language (just updates the hint sent to Whisper)
  const cycleLang = () => {
    const next = (langIndex + 1) % VOICE_LANGS.length;
    setLangIndex(next);
    langIndexRef.current = next;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-[#080808]">
      <button onClick={() => onClose(convIdRef.current || undefined)} className="absolute top-6 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all">
        <X size={22} strokeWidth={1.8} />
      </button>

      <canvas ref={canvasRef} style={{ width: 300, height: 300 }} className="mb-6" />

      {/* Status + language */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-[16px] text-white/30">
          {phase === "listening" && <>{t("voice.listening")}<span className="mira-thinking-dots" /></>}
          {phase === "thinking" && <>{t("voice.thinking")}<span className="mira-thinking-dots" /></>}
          {phase === "speaking" && t("voice.speaking")}
          {phase === "error" && (error || t("voice.error"))}
        </span>
        {phase !== "error" && phase !== "init" && (
          <button
            onClick={cycleLang}
            className="text-[12px] font-mono text-white/25 border border-white/[0.08] rounded-md px-2 py-0.5 hover:text-white/40 hover:border-white/[0.15] hover:bg-white/[0.04] transition-all active:scale-95"
            title={VOICE_LANGS[langIndex].name}
          >
            {VOICE_LANGS[langIndex].label}
          </button>
        )}
      </div>

      {/* Transcript — shown during listening (live preview) and thinking (what was said) */}
      <div className="max-w-sm mx-auto px-6 min-h-[20px] text-center mb-2">
        {(phase === "listening" || phase === "thinking") && transcript && (
          <p className="text-[16px] text-white/15 line-clamp-2">{transcript}</p>
        )}
      </div>
      <p className="text-[16px] text-white/10 tabular-nums font-mono mb-14">{fmt(elapsed)}</p>

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
