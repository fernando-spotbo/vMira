"use client";

import { useState, useEffect, useRef } from "react";
import { X, ArrowUp } from "lucide-react";
import { t } from "@/lib/i18n";
import { transcribeAudio } from "@/lib/api-client";

interface VoiceRecordingProps {
  onClose: () => void;
  onSend: (text: string) => void;
}

export default function VoiceRecording({ onClose, onSend }: VoiceRecordingProps) {
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(32).fill(0.08));
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const startRef = useRef(Date.now());
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Initialize microphone + MediaRecorder ──
  useEffect(() => {
    let unmounted = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (unmounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Start recording
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus" : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(500);
        mediaRecorderRef.current = recorder;
        setIsListening(true);
      } catch {
        setError(t("voice.micDenied"));
      }
    })();

    return () => {
      unmounted = true;
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch {}
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      analyserRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Real waveform from mic input ──
  useEffect(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

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

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isListening]);

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
    if (transcript.trim()) {
      onSend(transcript.trim());
      onClose();
      return;
    }

    // Stop recording and transcribe
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") { onClose(); return; }

    setIsProcessing(true);

    recorder.onstop = async () => {
      if (chunksRef.current.length === 0) { onClose(); return; }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];

      if (blob.size < 1000) { onClose(); return; }

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

  const displayText = transcript || (isProcessing ? t("voice.thinking") : "");
  const hasText = transcript.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 mira-fade-in">
      <div className="w-full max-w-2xl mb-6 mx-4">
        <div className="rounded-3xl bg-[#1a1a1a] border border-white/[0.08] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
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
                  <p className="text-[16px] text-white/70 leading-relaxed">{displayText}</p>
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
                  <div className="h-2 w-2 rounded-full bg-white/40 animate-pulse" />
                  <span className="text-[16px] text-white/40 tabular-nums font-mono">
                    {formatTime(elapsed)}
                  </span>
                </div>

                <button
                  onClick={handleSend}
                  disabled={isProcessing}
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
