"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Mic, MicOff } from "lucide-react";
import * as chatApi from "@/lib/api-chat";
import { getAccessToken } from "@/lib/api-client";
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

// ── WebSocket voice endpoint ──
// Goes directly to the API backend (Next.js proxy doesn't handle WS upgrades).
const VOICE_WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL || "wss://api.vmira.ai/api/v1/voice/ws";

// ── AudioWorklet processor source (inline, turned into a Blob URL) ──
const WORKLET_SOURCE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0][0];
    if (input) {
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

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
  const wsRef = useRef<WebSocket | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  // Queue of PCM audio chunks to play in order
  const playQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

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

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Play PCM audio through AudioContext ──
  const playPCMAudio = useCallback(async (pcmBuffer: ArrayBuffer) => {
    let ctx = playCtxRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext({ sampleRate: 16000 });
      playCtxRef.current = ctx;
    }
    if (ctx.state === "suspended") await ctx.resume();

    // Decode base64 PCM16 → Float32 for Web Audio
    const pcm16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 16000);
    audioBuffer.getChannelData(0).set(float32);

    return new Promise<void>((resolve) => {
      const source = ctx!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx!.destination);
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      source.onended = finish;
      source.start(0);
      // Safety timeout
      setTimeout(finish, 30000);
    });
  }, []);

  // ── Drain the play queue sequentially ──
  const drainPlayQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    while (playQueueRef.current.length > 0) {
      const buf = playQueueRef.current.shift()!;
      await playPCMAudio(buf);
    }

    isPlayingRef.current = false;
  }, [playPCMAudio]);

  // ── Send mute state to server ──
  const sendMuteEvent = useCallback((isMuted: boolean) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "mute", muted: isMuted }));
    }
  }, []);

  // ── Handle mute toggle ──
  const handleMuteToggle = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      sendMuteEvent(next);
      return next;
    });
  }, [sendMuteEvent]);

  // ── Main effect: canvas animation + WebSocket + mic capture ──
  useEffect(() => {
    let alive = true;
    let raf = 0;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArr: Uint8Array<ArrayBuffer> | null = null;
    const sm = new Float32Array(48).fill(0);
    let workletNode: AudioWorkletNode | null = null;
    let ws: WebSocket | null = null;

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

    const smoothSetPhase = (ph: Phase) => {
      phaseRef.current = ph;
      setPhase(ph);
      updateBlend(ph);
    };

    // ── Build WebSocket URL ──
    const buildWsUrl = (): string => {
      // If the configured URL is absolute, use it directly
      if (VOICE_WS_URL.startsWith("ws://") || VOICE_WS_URL.startsWith("wss://")) {
        return VOICE_WS_URL;
      }
      // Otherwise build from current page location
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${window.location.host}${VOICE_WS_URL}`;
    };

    // ── WebSocket message handler ──
    const handleWsMessage = (ev: MessageEvent) => {
      if (!alive) return;

      // Binary frame = audio data from server
      if (ev.data instanceof ArrayBuffer) {
        playQueueRef.current.push(ev.data);
        drainPlayQueue();
        return;
      }
      if (ev.data instanceof Blob) {
        ev.data.arrayBuffer().then(buf => {
          if (!alive) return;
          playQueueRef.current.push(buf);
          drainPlayQueue();
        });
        return;
      }

      // Text frame = JSON event
      try {
        const msg = JSON.parse(ev.data as string);

        switch (msg.type) {
          case "transcript":
            // User's speech transcribed by server
            setTranscript(msg.text || "");
            if (phaseRef.current === "listening") {
              smoothSetPhase("thinking");
            }
            break;

          case "bot_started":
            smoothSetPhase("speaking");
            setResponsePreview("");
            break;

          case "bot_stopped":
            smoothSetPhase("listening");
            setTranscript("");
            break;

          case "bot_text":
            // Streaming AI response text
            setResponsePreview(prev => prev + (msg.text || ""));
            break;

          case "audio": {
            // Base64-encoded PCM audio from server
            const raw = atob(msg.data);
            const buf = new ArrayBuffer(raw.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
            playQueueRef.current.push(buf);
            drainPlayQueue();
            break;
          }

          case "user_message": {
            // Server confirms user message was saved — add to chat context
            const cid = convIdRef.current;
            if (cid && msg.text) {
              addMessageRef.current(cid, {
                id: msg.id || `user-${Date.now()}`,
                role: "user",
                content: msg.text,
              });
            }
            break;
          }

          case "bot_message": {
            // Server confirms bot message was saved — add to chat context
            const cid = convIdRef.current;
            if (cid && msg.text) {
              addMessageRef.current(cid, {
                id: msg.id || `msg-${Date.now()}`,
                role: "assistant",
                content: msg.text,
              });
            }
            break;
          }

          case "error":
            setError(msg.message || t("voice.error"));
            smoothSetPhase("error");
            break;

          default:
            break;
        }
      } catch {
        console.warn("[VoiceMode] Failed to parse WebSocket message");
      }
    };

    // ── Setup: mic → AudioWorklet → WebSocket ──
    (async () => {
      try {
        if (!getAccessToken()) {
          setError(t("voice.loginRequired"));
          smoothSetPhase("error");
          return;
        }

        // 1. Get mic stream
        let s: MediaStream;
        try {
          s = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch (micErr) {
          if (alive) {
            setError(t("voice.micDenied"));
            smoothSetPhase("error");
          }
          return;
        }
        if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;

        // 2. Set up AudioContext + analyser (for canvas visualisation)
        audioCtx = new AudioContext({ sampleRate: 16000 });
        if (audioCtx.state === "suspended") await audioCtx.resume();
        const src = audioCtx.createMediaStreamSource(s);
        const an = audioCtx.createAnalyser();
        an.fftSize = 128; an.smoothingTimeConstant = 0.65; an.minDecibels = -85; an.maxDecibels = -10;
        src.connect(an);
        analyser = an;
        dataArr = new Uint8Array(an.frequencyBinCount) as Uint8Array<ArrayBuffer>;

        // 3. Set up AudioWorklet for PCM capture
        const workletBlob = new Blob([WORKLET_SOURCE], { type: "application/javascript" });
        const workletUrl = URL.createObjectURL(workletBlob);
        await audioCtx.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
        src.connect(workletNode);

        // 4. Connect WebSocket
        // Prepare initial config to send after connection
        const m = selectedModelRef.current.toLowerCase().replace(/\s+/g, "-");
        const model = ["mira", "mira-thinking"].includes(m) ? m : "mira";

        // Resolve or create conversation
        let cid = convIdRef.current;
        if (!cid) {
          const c = await chatApi.createConversation("Voice call", model);
          if (!c || !alive) {
            if (alive) { smoothSetPhase("error"); setError(t("voice.error")); }
            return;
          }
          cid = c.id;
          convIdRef.current = cid;
          ensureConvRef.current(cid, "Voice call");
        }

        const wsUrl = buildWsUrl();
        const token = getAccessToken();
        // Pass auth token and config as query params
        const params = new URLSearchParams({
          token: token || "",
          conversation_id: cid,
          model,
          lang: navigator.language || "en-US",
        });
        ws = new WebSocket(`${wsUrl}?${params.toString()}`);
        wsRef.current = ws;

        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          if (!alive) return;
          smoothSetPhase("listening");
        };

        ws.onmessage = handleWsMessage;

        ws.onclose = (ev) => {
          if (!alive) return;
          if (ev.code !== 1000) {
            // Abnormal close
            setError(`Connection lost (${ev.code})`);
            smoothSetPhase("error");
          }
        };

        ws.onerror = () => {
          if (!alive) return;
          setError(t("voice.error"));
          smoothSetPhase("error");
        };

        // 5. Stream mic PCM frames to WebSocket
        workletNode.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
          if (!alive || mutedRef.current) return;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(ev.data);
          }
        };

      } catch (err) {
        if (alive) {
          const msg = err instanceof Error ? err.message : t("voice.error");
          console.error("[VoiceMode] Setup failed:", err);
          setError(msg);
          smoothSetPhase("error");
        }
      }
    })();

    // ── Cleanup ──
    return () => {
      alive = false;
      cancelAnimationFrame(raf);

      // Close WebSocket
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close(1000);
      }
      wsRef.current = null;

      // Stop worklet
      if (workletNode) {
        workletNode.port.close();
        workletNode.disconnect();
      }

      // Stop mic tracks
      stream?.getTracks().forEach(t => t.stop());

      // Clear play queue
      playQueueRef.current = [];

      // Close audio contexts
      audioCtx?.close().catch(() => {});
      playCtxRef.current?.close().catch(() => {});
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
        {phase === "speaking" && responsePreview && (
          <p className="text-[16px] text-white/15 line-clamp-2">{responsePreview}</p>
        )}
      </div>

      <div className="flex items-center gap-6">
        <button onClick={handleMuteToggle} className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ${muted ? "bg-white/[0.06] text-white/25 border border-white/[0.08]" : "bg-white/[0.05] text-white/40 border border-white/[0.07] hover:bg-white/[0.08]"}`}>
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button onClick={() => onClose(convIdRef.current || undefined)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.10] text-white/45 hover:bg-white/[0.12] active:scale-95 transition-all">
          <X size={24} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
