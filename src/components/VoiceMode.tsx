"use client";

import { useState, useEffect, useRef } from "react";
import { X, Mic, MicOff } from "lucide-react";

interface VoiceModeProps {
  onClose: () => void;
}

export default function VoiceMode({ onClose }: VoiceModeProps) {
  const [phase, setPhase] = useState<"listening" | "thinking" | "speaking">("listening");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ripples, setRipples] = useState([1, 2, 3]);
  const startRef = useRef(Date.now());

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cycle through phases for demo
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("thinking"), 4000);
    const t2 = setTimeout(() => setPhase("speaking"), 6000);
    const t3 = setTimeout(() => setPhase("listening"), 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const phaseLabel = {
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
  };

  const orbColors = {
    listening: "from-white/20 to-white/5",
    thinking: "from-white/10 to-white/[0.02]",
    speaking: "from-white/25 to-white/8",
  };

  return (
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-[#0a0a0a]">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
      >
        <X size={22} strokeWidth={1.8} />
      </button>

      {/* Animated orb */}
      <div className="relative flex items-center justify-center mb-10">
        {/* Ripple rings */}
        {ripples.map((r) => (
          <div
            key={r}
            className={`absolute rounded-full border border-white/[0.06] ${
              phase === "listening" ? "voice-ripple" : phase === "speaking" ? "voice-ripple-fast" : ""
            }`}
            style={{
              width: 120 + r * 40,
              height: 120 + r * 40,
              animationDelay: `${r * 0.3}s`,
              opacity: phase === "thinking" ? 0.3 : 1,
            }}
          />
        ))}

        {/* Core orb */}
        <div
          className={`relative w-28 h-28 rounded-full bg-gradient-to-b ${orbColors[phase]} backdrop-blur-sm border border-white/[0.1] flex items-center justify-center transition-all duration-700 ${
            phase === "thinking" ? "voice-orb-think" : phase === "speaking" ? "voice-orb-speak" : "voice-orb-listen"
          }`}
        >
          {/* Logo inside orb */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white/70">
            <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
            <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
          </svg>
        </div>
      </div>

      {/* Phase label */}
      <p className="text-[18px] text-white/60 mb-2 transition-all duration-300">
        {phaseLabel[phase]}
      </p>
      <p className="text-[14px] text-white/25 tabular-nums font-mono mb-16">
        {formatTime(elapsed)}
      </p>

      {/* Bottom controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => setMuted(!muted)}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
            muted
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-white/[0.06] text-white/50 border border-white/[0.08] hover:bg-white/[0.1]"
          }`}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        <button
          onClick={onClose}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all"
          title="End call"
        >
          <X size={24} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
