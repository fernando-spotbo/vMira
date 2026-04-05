"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Mic, MicOff } from "lucide-react";
import * as chatApi from "@/lib/api-chat";
import { getAccessToken } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import { PipecatClient } from "@pipecat-ai/client-js";
import {
  WebSocketTransport,
  ProtobufFrameSerializer,
} from "@pipecat-ai/websocket-transport";

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

// ── Voice WS base URL ──
const VOICE_WS_URL =
  process.env.NEXT_PUBLIC_VOICE_WS_URL || "wss://api.vmira.ai/api/v1/voice/ws";

export default function VoiceMode({ onClose }: VoiceModeProps) {
  const [phase, setPhase] = useState<Phase>("init");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [responsePreview, setResponsePreview] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { activeConversationId, selectedModel, addMessage, ensureConversation } =
    useChat();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef(Date.now());
  const phaseRef = useRef<Phase>("init");
  const convIdRef = useRef(activeConversationId);

  const clientRef = useRef<PipecatClient | null>(null);

  // Refs for latest values (avoids stale closures)
  const selectedModelRef = useRef(selectedModel);
  const addMessageRef = useRef(addMessage);
  const ensureConvRef = useRef(ensureConversation);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { convIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { addMessageRef.current = addMessage; }, [addMessage]);
  useEffect(() => { ensureConvRef.current = ensureConversation; }, [ensureConversation]);

  // Timer
  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  // ── Handle mute toggle ──
  const handleMuteToggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      clientRef.current?.enableMic(!next);
      return next;
    });
  }, []);

  // ── Main effect: canvas animation + PipecatClient ──
  useEffect(() => {
    let alive = true;
    let raf = 0;
    const sm = new Float32Array(48).fill(0);

    // Smooth phase blend targets
    const blendTarget = { listening: 0, thinking: 0, speaking: 0 };
    const blendCurrent = { listening: 0, thinking: 0, speaking: 0 };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const SIZE = 300;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx2d = canvas.getContext("2d")!;

    // No analyser — Pipecat handles audio; animation is phase-driven only
    const analyser: AnalyserNode | null = null;
    const dataArr: Uint8Array<ArrayBuffer> | null = null;

    // Draw loop with smooth blending
    const tick = () => {
      if (!alive) return;
      const ease = 0.08;
      blendCurrent.listening +=
        (blendTarget.listening - blendCurrent.listening) * ease;
      blendCurrent.thinking +=
        (blendTarget.thinking - blendCurrent.thinking) * ease;
      blendCurrent.speaking +=
        (blendTarget.speaking - blendCurrent.speaking) * ease;

      draw(
        ctx2d, SIZE, dpr, analyser, dataArr, sm, phaseRef.current,
        (Date.now() - startRef.current) / 1000, blendCurrent,
      );
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

    // ── Accumulated bot transcript for addMessage at end of turn ──
    let fullBotText = "";
    let lastUserText = "";

    // ── Setup PipecatClient and connect ──
    (async () => {
      try {
        const token = getAccessToken();
        if (!token) {
          setError(t("voice.loginRequired"));
          smoothSetPhase("error");
          return;
        }

        // Resolve or create conversation
        const m = selectedModelRef.current.toLowerCase().replace(/\s+/g, "-");
        const model = ["mira", "mira-thinking"].includes(m) ? m : "mira";

        let cid = convIdRef.current;
        if (!cid) {
          const c = await chatApi.createConversation("Voice call", model);
          if (!c || !alive) {
            if (alive) {
              smoothSetPhase("error");
              setError(t("voice.error"));
            }
            return;
          }
          cid = c.id;
          convIdRef.current = cid;
          ensureConvRef.current(cid, "Voice call");
        }

        // Build WS URL with query params
        const lang = navigator.language || "en-US";
        const params = new URLSearchParams({
          token,
          conversation_id: cid,
          lang,
          model,
        });
        const wsUrl = `${VOICE_WS_URL}?${params.toString()}`;

        // Create PipecatClient
        const client = new PipecatClient({
          transport: new WebSocketTransport({
            serializer: new ProtobufFrameSerializer(),
          }),
          enableMic: true,
          enableCam: false,
          callbacks: {
            onConnected: () => {
              if (!alive) return;
              // WebSocket connected — wait for onBotReady before going to listening
            },
            onDisconnected: () => {
              if (!alive) return;
              // Only show error if we didn't initiate the close
              if (phaseRef.current !== "init" && phaseRef.current !== "error") {
                setError("Connection lost");
                smoothSetPhase("error");
              }
            },
            onBotReady: () => {
              if (!alive) return;
              smoothSetPhase("listening");
            },
            onUserStartedSpeaking: () => {
              if (!alive) return;
              // Stay in listening — just means user is talking
            },
            onUserStoppedSpeaking: () => {
              if (!alive) return;
              smoothSetPhase("thinking");
            },
            onBotStartedSpeaking: () => {
              if (!alive) return;
              fullBotText = "";
              setResponsePreview("");
              smoothSetPhase("speaking");
            },
            onBotStoppedSpeaking: () => {
              if (!alive) return;
              // Add bot message to chat context
              const currentCid = convIdRef.current;
              if (currentCid && fullBotText) {
                addMessageRef.current(currentCid, {
                  id: `msg-${Date.now()}`,
                  role: "assistant",
                  content: fullBotText,
                });
              }
              smoothSetPhase("listening");
              setTranscript("");
            },
            onUserTranscript: (data) => {
              if (!alive) return;
              setTranscript(data.text);
              if (data.final && data.text) {
                lastUserText = data.text;
                // Add user message to chat context
                const currentCid = convIdRef.current;
                if (currentCid) {
                  addMessageRef.current(currentCid, {
                    id: `user-${Date.now()}`,
                    role: "user",
                    content: data.text,
                  });
                }
              }
            },
            onBotLlmText: (data) => {
              if (!alive) return;
              fullBotText += data.text;
              setResponsePreview(fullBotText);
            },
            onError: (error) => {
              if (!alive) return;
              const msg =
                typeof error.data === "string"
                  ? error.data
                  : t("voice.error");
              setError(msg);
              smoothSetPhase("error");
            },
          },
        });

        clientRef.current = client;
        await client.connect({ wsUrl });
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

      const client = clientRef.current;
      if (client) {
        client.disconnect().catch(() => {});
        clientRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-[#080808]">
      {/* Timer — top of screen */}
      <div className="absolute top-7 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/20" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white/25" />
        </span>
        <p className="text-[15px] text-white/25 tabular-nums font-mono">
          {fmt(elapsed)}
        </p>
      </div>

      <button
        onClick={() => onClose(convIdRef.current || undefined)}
        className="absolute top-6 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all"
      >
        <X size={22} strokeWidth={1.8} />
      </button>

      <canvas
        ref={canvasRef}
        style={{ width: 300, height: 300 }}
        className="mb-6"
      />

      {/* Status */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-[16px] text-white/30">
          {phase === "listening" && (
            <>
              {t("voice.listening")}
              <span className="mira-thinking-dots" />
            </>
          )}
          {phase === "thinking" && (
            <>
              {t("voice.thinking")}
              <span className="mira-thinking-dots" />
            </>
          )}
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
          <p className="text-[16px] text-white/15 line-clamp-2">
            {responsePreview}
          </p>
        )}
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={handleMuteToggle}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300 ${
            muted
              ? "bg-white/[0.06] text-white/25 border border-white/[0.08]"
              : "bg-white/[0.05] text-white/40 border border-white/[0.07] hover:bg-white/[0.08]"
          }`}
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button
          onClick={() => onClose(convIdRef.current || undefined)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.10] text-white/45 hover:bg-white/[0.12] active:scale-95 transition-all"
        >
          <X size={24} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
