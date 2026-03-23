"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ArrowUp } from "lucide-react";
import { t } from "@/lib/i18n";

interface VoiceRecordingProps {
  onClose: () => void;
  onSend: (text: string) => void;
}

export default function VoiceRecording({ onClose, onSend }: VoiceRecordingProps) {
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(32).fill(0.08));
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const startRef = useRef(Date.now());
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  // ── Initialize speech recognition + microphone ──
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(t("voice.unsupported"));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ru-RU";
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
          setTranscript(finalTranscript.trim());
          setInterimText("");
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setError(t("voice.micDenied"));
      } else if (event.error !== "aborted") {
        setError(t("voice.error"));
      }
    };

    recognition.onend = () => {
      // Auto-restart if still active (browser stops after silence)
      if (recognitionRef.current && isListening) {
        try { recognition.start(); } catch {}
      }
    };

    // Start mic + speech recognition
    let unmounted = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // If unmounted while waiting for mic, stop immediately
        if (unmounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;

        recognition.start();
        setIsListening(true);
      } catch {
        setError(t("voice.micDenied"));
      }
    })();

    return () => {
      unmounted = true;
      try { recognition.stop(); } catch {}
      recognitionRef.current = null;
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

  const handleSend = () => {
    const text = (transcript + " " + interimText).trim();
    if (text) onSend(text);
    onClose();
  };

  const displayText = transcript + (interimText ? " " + interimText : "");
  const hasText = displayText.trim().length > 0;

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
                {hasText ? (
                  <p className="text-[16px] text-white/70 leading-relaxed">
                    {transcript}
                    {interimText && (
                      <span className="text-white/30">{" "}{interimText}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-[16px] text-white/30">
                    {t("voice.listening")}
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
                  disabled={!hasText}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#161616] hover:bg-white/90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-default"
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
