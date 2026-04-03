"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ArrowUp, Globe } from "lucide-react";
import { t } from "@/lib/i18n";
import { transcribeAudio } from "@/lib/api-client";

interface VoiceRecordingProps {
  onClose: () => void;
  onSend: (text: string) => void;
}

// ── Feature detection ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNativeSR(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// ── Language options ──
const VOICE_LANGS = [
  { code: "", label: "AUTO", name: "Auto" },
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

// ── Fallback constants (MediaRecorder + Whisper) ──
const SILENCE_THRESHOLD = 0.03;
const SILENCE_TIMEOUT = 800;
const MIN_RECORDING = 400;

export default function VoiceRecording({ onClose, onSend }: VoiceRecordingProps) {
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(32).fill(0.08));
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [langIndex, setLangIndex] = useState(0); // 0 = AUTO

  const startRef = useRef(Date.now());
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animFrameRef = useRef<number>(0);
  const transcriptRef = useRef("");
  const aliveRef = useRef(true);

  // Native SpeechRecognition refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const useNativeRef = useRef(!!getNativeSR());

  // Fallback MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcribingRef = useRef(false);
  const voiceDetectedRef = useRef(false);
  const lastVoiceTimeRef = useRef(0);
  const recordingStartTimeRef = useRef(0);

  // ── Start / restart native SpeechRecognition with a given lang ──
  const startNativeRecognition = useCallback((langCode: string) => {
    const SR = getNativeSR();
    if (!SR) return;

    // Stop existing instance
    if (recognitionRef.current) {
      useNativeRef.current = false; // prevent auto-restart in onend
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    useNativeRef.current = true;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langCode;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      if (!aliveRef.current) return;
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      transcriptRef.current = finalText;
      setTranscript(finalText);
      setInterim(interimText);
    };

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      console.error("SpeechRecognition error:", e.error);
      useNativeRef.current = false;
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (aliveRef.current && useNativeRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      useNativeRef.current = false;
      recognitionRef.current = null;
    }
  }, []);

  // ── Cycle language ──
  const cycleLanguage = useCallback(() => {
    const nextIndex = (langIndex + 1) % VOICE_LANGS.length;
    setLangIndex(nextIndex);
    const nextLang = VOICE_LANGS[nextIndex];

    // Restart recognition with new language (native path only)
    if (useNativeRef.current || recognitionRef.current) {
      startNativeRecognition(nextLang.code);
    }
  }, [langIndex, startNativeRecognition]);

  // ── Fallback helpers (MediaRecorder + Whisper) ──

  const getMimeType = useCallback(() => {
    return MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus" : "audio/webm";
  }, []);

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !aliveRef.current) return;

    const mimeType = getMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(250);
    mediaRecorderRef.current = recorder;
    recordingStartTimeRef.current = Date.now();
    voiceDetectedRef.current = false;
    lastVoiceTimeRef.current = 0;
  }, [getMimeType]);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive" || transcribingRef.current) return;

    transcribingRef.current = true;
    setIsProcessing(true);

    const blobPromise = new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        if (chunksRef.current.length === 0) { resolve(null); return; }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        resolve(blob.size < 500 ? null : blob);
      };
      try { recorder.stop(); } catch { resolve(null); }
    });

    mediaRecorderRef.current = null;
    startRecorder();

    const blob = await blobPromise;
    if (blob && aliveRef.current) {
      try {
        const result = await transcribeAudio(blob);
        const text = result.text?.trim();
        if (text) {
          const updated = transcriptRef.current
            ? transcriptRef.current + " " + text
            : text;
          transcriptRef.current = updated;
          setTranscript(updated);
        }
      } catch (e) {
        console.error("Transcription failed:", e);
      }
    }

    transcribingRef.current = false;
    setIsProcessing(false);
  }, [startRecorder]);

  // ── Initialize microphone + STT engine ──
  useEffect(() => {
    aliveRef.current = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!aliveRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        // AudioContext for waveform (used by both paths)
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;
        dataArrRef.current = new Uint8Array(analyser.frequencyBinCount);

        // Try native SpeechRecognition (instant results), auto-detect lang
        if (getNativeSR()) {
          startNativeRecognition(""); // empty = auto-detect
        } else {
          useNativeRef.current = false;
          startRecorder();
        }

        setIsListening(true);
      } catch {
        setError(t("voice.micDenied"));
      }
    })();

    return () => {
      aliveRef.current = false;
      if (recognitionRef.current) {
        useNativeRef.current = false;
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch {}
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      analyserRef.current = null;
      dataArrRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Waveform animation + silence detection (fallback only) ──
  useEffect(() => {
    const analyser = analyserRef.current;
    if (!analyser || !isListening) return;

    let silenceCheckId: ReturnType<typeof setInterval> | null = null;
    if (!useNativeRef.current) {
      silenceCheckId = setInterval(() => {
        if (!aliveRef.current || !analyserRef.current || !dataArrRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArrRef.current);
        let sum = 0;
        for (let i = 0; i < dataArrRef.current.length; i++) sum += dataArrRef.current[i];
        const avg = sum / dataArrRef.current.length / 255;

        const now = Date.now();

        if (avg > SILENCE_THRESHOLD) {
          voiceDetectedRef.current = true;
          lastVoiceTimeRef.current = now;
        }

        if (
          voiceDetectedRef.current &&
          lastVoiceTimeRef.current > 0 &&
          now - lastVoiceTimeRef.current > SILENCE_TIMEOUT &&
          now - recordingStartTimeRef.current > MIN_RECORDING
        ) {
          voiceDetectedRef.current = false;
          lastVoiceTimeRef.current = 0;
          stopAndTranscribe();
        }
      }, 100);
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      const newBars: number[] = [];
      const binCount = dataArray.length;
      for (let i = 0; i < 32; i++) {
        const idx = Math.floor((i / 32) * binCount);
        const val = dataArray[idx] / 255;
        newBars.push(Math.max(0.06, val));
      }
      setBars(newBars);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (silenceCheckId) clearInterval(silenceCheckId);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening, stopAndTranscribe]);

  // ── Timer ──
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSend = async () => {
    // ── Native path: text is already available ──
    if (useNativeRef.current) {
      if (recognitionRef.current) {
        useNativeRef.current = false;
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      const finalText = (transcriptRef.current + " " + interim).trim();
      if (finalText) {
        onSend(finalText);
      }
      onClose();
      return;
    }

    // ── Fallback path: MediaRecorder + Whisper ──
    if (transcriptRef.current.trim()) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive" && voiceDetectedRef.current) {
        setIsProcessing(true);
        const blobPromise = new Promise<Blob | null>((resolve) => {
          recorder.onstop = () => {
            if (chunksRef.current.length === 0) { resolve(null); return; }
            const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
            chunksRef.current = [];
            resolve(blob.size < 500 ? null : blob);
          };
          try { recorder.stop(); } catch { resolve(null); }
        });
        mediaRecorderRef.current = null;
        const blob = await blobPromise;
        if (blob) {
          try {
            const result = await transcribeAudio(blob);
            const text = result.text?.trim();
            if (text) {
              transcriptRef.current = transcriptRef.current + " " + text;
            }
          } catch {}
        }
      }

      onSend(transcriptRef.current.trim());
      onClose();
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") { onClose(); return; }

    setIsProcessing(true);

    recorder.onstop = async () => {
      if (chunksRef.current.length === 0) { onClose(); return; }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];

      if (blob.size < 500) { onClose(); return; }

      try {
        const result = await transcribeAudio(blob);
        const text = result.text?.trim();
        if (text) {
          onSend(text);
        }
      } catch (e) {
        console.error("Transcription failed:", e);
      }
      onClose();
    };

    try { recorder.stop(); } catch { onClose(); }
  };

  const displayText = transcript || interim || (isProcessing ? t("voice.transcribing") : "");
  const hasText = (transcript + interim).trim().length > 0;
  const currentLang = VOICE_LANGS[langIndex];

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm mira-fade-in">
      <div className="w-full max-w-2xl mb-6 mx-4">
        <div className="rounded-3xl bg-[#1a1a1a] border border-white/[0.08] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative">
          {/* Error state */}
          {error ? (
            <div className="text-center py-6">
              <p className="text-[16px] text-white/50 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="rounded-xl bg-white/[0.08] px-6 py-2.5 text-[16px] text-white/60 hover:bg-white/[0.12] transition-colors"
              >
                {t("voice.close")}
              </button>
            </div>
          ) : (
            <>
              {/* Language selector — top right */}
              <button
                onClick={cycleLanguage}
                className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1.5 text-[12px] font-medium text-white/50 hover:bg-white/[0.10] hover:text-white/70 transition-all active:scale-95"
                title={currentLang.name}
              >
                <Globe size={12} className="text-white/35" />
                {currentLang.label}
              </button>

              {/* Waveform */}
              <div className="flex items-center justify-center gap-[3px] h-20 mb-4">
                {bars.map((height, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-white/60"
                    style={{
                      height: `${Math.max(4, height * 64)}px`,
                      transition: "height 80ms ease-out",
                    }}
                  />
                ))}
              </div>

              {/* Live transcript */}
              <div className="text-center mb-5 min-h-[56px] max-h-[120px] overflow-y-auto">
                {displayText ? (
                  <p className="text-[16px] leading-relaxed">
                    {transcript && <span className="text-white/70">{transcript}</span>}
                    {interim && <span className="text-white/40">{transcript ? " " : ""}{interim}</span>}
                    {!transcript && !interim && isProcessing && (
                      <span className="text-white/40">{t("voice.transcribing")}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-[16px] text-white/30">
                    {t("voice.listening")}<span className="mira-thinking-dots" />
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.08] text-white/50 hover:bg-white/[0.12] hover:text-white/70 transition-all"
                  title={t("voice.close")}
                >
                  <X size={20} strokeWidth={1.8} />
                </button>

                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${isProcessing ? "bg-yellow-400" : "bg-white/40"} animate-pulse`} />
                  <span className="text-[16px] text-white/40 tabular-nums font-mono">
                    {formatTime(elapsed)}
                  </span>
                </div>

                <button
                  onClick={handleSend}
                  disabled={isProcessing && !hasText}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#161616] hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50"
                  title={t("voice.send")}
                >
                  <ArrowUp size={20} strokeWidth={2.5} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
