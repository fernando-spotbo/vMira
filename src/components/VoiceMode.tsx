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

// ── Detect language from AI response text for correct TTS voice ──
function detectResponseLang(text: string): string {
  if (/[\u0400-\u04FF]/.test(text)) return "ru-RU";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN";
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja-JP";
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko-KR";
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  return "en-US"; // default
}

// ══════════════════════════════════════════════════════════════════
//  Protobuf codec — manual, no library needed
// ══════════════════════════════════════════════════════════════════

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return new Uint8Array(bytes);
}

function decodeVarint(
  data: Uint8Array,
  pos: number,
): { value: number; bytesRead: number } {
  let value = 0,
    shift = 0,
    bytesRead = 0;
  while (pos < data.length) {
    const byte = data[pos++];
    bytesRead++;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value, bytesRead };
}

/** Encode PCM16 bytes into a Pipecat protobuf Frame(AudioFrame).
 *  Pipecat AudioFrame proto field numbers:
 *    1=id(uint64) 2=name(string) 3=audio(bytes) 4=sample_rate(uint32) 5=num_channels(uint32)
 */
function encodeAudioFrame(
  pcm16Bytes: ArrayBuffer,
  sampleRate = 16000,
  numChannels = 1,
): Uint8Array {
  // AudioFrame proto tags: (field_number << 3) | wire_type
  const audioTag = 0x1a; // field 3, wire type 2 (length-delimited)
  const srTag = 0x20; // field 4, wire type 0 (varint)
  const chTag = 0x28; // field 5, wire type 0 (varint)

  const audioLen = pcm16Bytes.byteLength;
  const srBytes = encodeVarint(sampleRate);
  const chBytes = encodeVarint(numChannels);
  const audioLenBytes = encodeVarint(audioLen);

  // Build AudioFrame message
  const audioFrameLen =
    1 +
    audioLenBytes.length +
    audioLen +
    1 +
    srBytes.length +
    1 +
    chBytes.length;
  const audioFrame = new Uint8Array(audioFrameLen);
  let offset = 0;
  audioFrame[offset++] = audioTag;
  audioFrame.set(audioLenBytes, offset);
  offset += audioLenBytes.length;
  audioFrame.set(new Uint8Array(pcm16Bytes), offset);
  offset += audioLen;
  audioFrame[offset++] = srTag;
  audioFrame.set(srBytes, offset);
  offset += srBytes.length;
  audioFrame[offset++] = chTag;
  audioFrame.set(chBytes, offset);

  // Wrap in Frame message: field 2 (audio), wire type 2 (length-delimited)
  const frameTag = 0x12;
  const frameLenBytes = encodeVarint(audioFrameLen);
  const frame = new Uint8Array(1 + frameLenBytes.length + audioFrameLen);
  frame[0] = frameTag;
  frame.set(frameLenBytes, 1);
  frame.set(audioFrame, 1 + frameLenBytes.length);
  return frame;
}

/** Parse an AudioFrame submessage, returning raw audio bytes + sample rate. */
function parseAudioFrame(
  data: Uint8Array,
): { audio: Uint8Array; sampleRate: number } | null {
  let pos = 0;
  let audio: Uint8Array | null = null;
  let sampleRate = 16000;

  while (pos < data.length) {
    const tag = data[pos++];
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNum === 3) {
      // field 3: audio bytes
      const { value: len, bytesRead } = decodeVarint(data, pos);
      pos += bytesRead;
      audio = data.slice(pos, pos + len);
      pos += len;
    } else if (wireType === 2) {
      // skip other length-delimited fields (name, etc.)
      const { value: len, bytesRead } = decodeVarint(data, pos);
      pos += bytesRead + len;
    } else if (wireType === 0) {
      // varint
      const { value, bytesRead } = decodeVarint(data, pos);
      pos += bytesRead;
      if (fieldNum === 4) sampleRate = value;
    } else {
      // skip unknown wire types
      break;
    }
  }

  return audio ? { audio, sampleRate } : null;
}

/** Decode a top-level Pipecat protobuf Frame, extracting the AudioFrame. */
function decodeAudioFromFrame(
  data: ArrayBuffer,
): { audio: Uint8Array; sampleRate: number } | null {
  const view = new Uint8Array(data);
  let pos = 0;

  while (pos < view.length) {
    const tag = view[pos++];
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2) {
      // length-delimited
      const { value: len, bytesRead } = decodeVarint(view, pos);
      pos += bytesRead;
      if (fieldNum === 2) {
        // Frame.audio (field 2)
        return parseAudioFrame(view.slice(pos, pos + len));
      }
      pos += len;
    } else if (wireType === 0) {
      // varint — skip
      const { bytesRead } = decodeVarint(view, pos);
      pos += bytesRead;
    } else {
      break;
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
//  Smooth canvas draw with phase interpolation (preserved exactly)
// ══════════════════════════════════════════════════════════════════

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

  // WebSocket + audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Playback scheduling
  const nextPlayTimeRef = useRef(0);
  const playbackActiveRef = useRef(false);
  const receivedSampleRateRef = useRef(16000);

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
      // Mute/unmute by toggling the mic stream tracks
      const stream = micStreamRef.current;
      if (stream) {
        for (const track of stream.getAudioTracks()) {
          track.enabled = !next;
        }
      }
      return next;
    });
  }, []);

  // ── Schedule a PCM16 chunk for seamless gapless playback ──
  const schedulePlayback = useCallback(
    (pcm16: Uint8Array, sr: number) => {
      let ctx = playCtxRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioContext({ sampleRate: sr });
        playCtxRef.current = ctx;
      }

      // Convert PCM16 (little-endian Int16) → Float32
      const sampleCount = pcm16.length / 2;
      const float32 = new Float32Array(sampleCount);
      const dv = new DataView(
        pcm16.buffer,
        pcm16.byteOffset,
        pcm16.byteLength,
      );
      for (let i = 0; i < sampleCount; i++) {
        float32[i] = dv.getInt16(i * 2, true) / 32768;
      }

      // If the playback context sample rate differs from the frame's, resample
      const ctxSr = ctx.sampleRate;
      let samples = float32;
      let finalSampleCount = sampleCount;
      if (ctxSr !== sr) {
        const ratio = ctxSr / sr;
        finalSampleCount = Math.round(sampleCount * ratio);
        const resampled = new Float32Array(finalSampleCount);
        for (let i = 0; i < finalSampleCount; i++) {
          const srcIdx = Math.min(
            Math.floor(i / ratio),
            sampleCount - 1,
          );
          resampled[i] = float32[srcIdx];
        }
        samples = resampled;
      }

      const buffer = ctx.createBuffer(1, finalSampleCount, ctxSr);
      buffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      // Gapless scheduling: chain buffers back-to-back
      const now = ctx.currentTime;
      const startTime = Math.max(now + 0.005, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;

      if (!playbackActiveRef.current) {
        playbackActiveRef.current = true;
      }

      source.onended = () => {
        // If this was the last chunk and nothing new is scheduled, playback ended
        if (ctx && ctx.currentTime >= nextPlayTimeRef.current - 0.01) {
          playbackActiveRef.current = false;
        }
      };
    },
    [],
  );

  // ── Main effect: canvas animation + WebSocket voice client ──
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

    // Analyser will be set up after mic access
    let analyser: AnalyserNode | null = null;
    let dataArr: Uint8Array<ArrayBuffer> | null = null;

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let lastUserText = "";

    // Track audio reception to detect speaking/listening transitions
    let lastAudioReceived = 0;
    let silenceCheckTimer: ReturnType<typeof setInterval> | null = null;

    // ── Setup WebSocket + mic capture ──
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

        // ── Request mic access ──
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch {
          if (!alive) return;
          setError(t("voice.micDenied"));
          smoothSetPhase("error");
          return;
        }
        if (!alive) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        micStreamRef.current = stream;

        // ── Set up AudioContext for mic capture + analyser ──
        const micCtx = new AudioContext();
        micCtxRef.current = micCtx;
        const source = micCtx.createMediaStreamSource(stream);

        // Analyser for the canvas visualization
        const micAnalyser = micCtx.createAnalyser();
        micAnalyser.fftSize = 128;
        source.connect(micAnalyser);
        analyserRef.current = micAnalyser;
        analyser = micAnalyser;
        dataArr = new Uint8Array(micAnalyser.frequencyBinCount);

        // ── AudioWorklet for resampling to 16 kHz PCM16 ──
        await micCtx.audioWorklet.addModule("/pcm-processor.js");
        const workletNode = new AudioWorkletNode(micCtx, "pcm-processor");
        source.connect(workletNode);

        // ── Build WS URL with query params ──
        const lang = navigator.language || "en-US";
        const params = new URLSearchParams({
          token,
          conversation_id: cid,
          lang,
          model,
        });
        const wsUrl = `${VOICE_WS_URL}?${params.toString()}`;

        // ── Connect WebSocket ──
        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.addEventListener("open", () => {
          if (!alive) return;
          smoothSetPhase("listening");

          // Start silence detection — if we stop receiving audio, go back to listening
          silenceCheckTimer = setInterval(() => {
            if (!alive) return;
            if (
              phaseRef.current === "speaking" &&
              Date.now() - lastAudioReceived > 500 &&
              !playbackActiveRef.current
            ) {
              // Audio playback finished
              const currentCid = convIdRef.current;
              if (currentCid && fullBotText) {
                addMessageRef.current(currentCid, {
                  id: `msg-${Date.now()}`,
                  role: "assistant",
                  content: fullBotText,
                });
              }
              fullBotText = "";
              smoothSetPhase("listening");
              setTranscript("");
            }
          }, 200);
        });

        ws.addEventListener("close", () => {
          if (!alive) return;
          if (
            phaseRef.current !== "init" &&
            phaseRef.current !== "error"
          ) {
            setError("Connection lost");
            smoothSetPhase("error");
          }
        });

        ws.addEventListener("error", () => {
          if (!alive) return;
          setError(t("voice.error"));
          smoothSetPhase("error");
        });

        ws.addEventListener("message", (ev: MessageEvent) => {
          if (!alive) return;

          if (ev.data instanceof ArrayBuffer) {
            // ── Binary: protobuf Frame with audio ──
            const decoded = decodeAudioFromFrame(ev.data);
            if (decoded) {
              lastAudioReceived = Date.now();
              receivedSampleRateRef.current = decoded.sampleRate;

              if (phaseRef.current !== "speaking") {
                // Bot started speaking — reset text accumulator
                fullBotText = "";
                setResponsePreview("");
                smoothSetPhase("speaking");
                // Reset playback scheduling so new utterance starts fresh
                nextPlayTimeRef.current = 0;
                playbackActiveRef.current = false;
              }

              schedulePlayback(decoded.audio, decoded.sampleRate);
            }
          } else if (typeof ev.data === "string") {
            // ── Text: JSON events from TranscriptRelay ──
            try {
              const msg = JSON.parse(ev.data);

              if (msg.type === "transcript" && msg.role === "user") {
                setTranscript(msg.text || "");
                if (msg.final && msg.text) {
                  lastUserText = msg.text;
                  const currentCid = convIdRef.current;
                  if (currentCid) {
                    addMessageRef.current(currentCid, {
                      id: `user-${Date.now()}`,
                      role: "user",
                      content: msg.text,
                    });
                  }
                }
              } else if (msg.type === "bot_text" || msg.type === "bot_llm_text") {
                fullBotText += msg.text || "";
                setResponsePreview(fullBotText);
              } else if (
                msg.type === "transcript" &&
                msg.role === "assistant"
              ) {
                fullBotText += msg.text || "";
                setResponsePreview(fullBotText);
              } else if (msg.type === "user_started_speaking") {
                // User speaking — stay in listening
              } else if (msg.type === "user_stopped_speaking") {
                smoothSetPhase("thinking");
              } else if (msg.type === "bot_ready") {
                smoothSetPhase("listening");
              } else if (msg.type === "error") {
                const errMsg =
                  typeof msg.data === "string" ? msg.data : t("voice.error");
                setError(errMsg);
                smoothSetPhase("error");
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        });

        // ── Pipe AudioWorklet output → WebSocket as protobuf frames ──
        workletNode.port.onmessage = (ev: MessageEvent) => {
          if (!alive) return;
          if (ws.readyState !== WebSocket.OPEN) return;

          const pcmBuffer: ArrayBuffer = ev.data;
          const frame = encodeAudioFrame(pcmBuffer, 16000, 1);
          ws.send(frame);
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

      if (silenceCheckTimer) clearInterval(silenceCheckTimer);

      // Close WebSocket
      const ws = wsRef.current;
      if (ws) {
        ws.close();
        wsRef.current = null;
      }

      // Stop mic tracks
      const stream = micStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((tr) => tr.stop());
        micStreamRef.current = null;
      }

      // Close AudioContexts
      const micCtx = micCtxRef.current;
      if (micCtx && micCtx.state !== "closed") {
        micCtx.close().catch(() => {});
        micCtxRef.current = null;
      }

      const playCtx = playCtxRef.current;
      if (playCtx && playCtx.state !== "closed") {
        playCtx.close().catch(() => {});
        playCtxRef.current = null;
      }

      analyserRef.current = null;
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
