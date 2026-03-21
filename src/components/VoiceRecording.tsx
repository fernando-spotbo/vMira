"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ArrowUp } from "lucide-react";

interface VoiceRecordingProps {
  onClose: () => void;
  onSend: (text: string) => void;
}

export default function VoiceRecording({ onClose, onSend }: VoiceRecordingProps) {
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(32).fill(0.15));
  const [transcript, setTranscript] = useState("");
  const animRef = useRef<number>(0);
  const startRef = useRef(Date.now());

  // Simulate waveform animation
  useEffect(() => {
    let frame: number;
    const animate = () => {
      setBars(prev =>
        prev.map((_, i) => {
          const t = Date.now() / 1000;
          const wave = Math.sin(t * 3 + i * 0.4) * 0.3 +
                       Math.sin(t * 5 + i * 0.7) * 0.15 +
                       Math.sin(t * 1.5 + i * 0.2) * 0.2;
          return Math.max(0.08, Math.min(1, 0.35 + wave));
        })
      );
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate transcript appearing after 2s
  useEffect(() => {
    const timer = setTimeout(() => {
      setTranscript("Listening...");
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSend = () => {
    if (transcript && transcript !== "Listening...") {
      onSend(transcript);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in-up">
      <div className="w-full max-w-2xl mb-6 mx-4">
        <div className="rounded-3xl bg-[#1a1a1a] border border-white/[0.08] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {/* Waveform visualization */}
          <div className="flex items-center justify-center gap-[3px] h-20 mb-4">
            {bars.map((height, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-white/60 transition-all duration-75"
                style={{ height: `${height * 64}px` }}
              />
            ))}
          </div>

          {/* Transcript area */}
          <div className="text-center mb-5 min-h-[28px]">
            <span className="text-[15px] text-white/50">
              {transcript}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.08] text-white/50 hover:bg-white/[0.12] hover:text-white/70 transition-all"
              title="Cancel"
            >
              <X size={20} strokeWidth={1.8} />
            </button>

            <div className="flex items-center gap-3">
              {/* Recording indicator */}
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[14px] text-white/50 tabular-nums font-mono">
                  {formatTime(elapsed)}
                </span>
              </div>
            </div>

            <button
              onClick={handleSend}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#161616] hover:bg-white/90 active:scale-95 transition-all"
              title="Send"
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
