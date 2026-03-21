"use client";

import { useState, useEffect } from "react";
import { t } from "@/lib/i18n";

const VESICA_V = "M12 1Q18.5 12 12 23Q5.5 12 12 1Z";
const VESICA_H = "M1 12Q12 5.5 23 12Q12 18.5 1 12Z";

export default function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="animate-fade-in-up py-4">
      <div className="flex items-start gap-4">
        {/* Layered animated star */}
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
          {/* Outer glow layer — slow counter-rotation, low opacity */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="absolute mira-star-glow"
          >
            <path d={VESICA_V} fill="currentColor" />
            <path d={VESICA_H} fill="currentColor" />
          </svg>

          {/* Middle echo layer — offset timing, medium opacity */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="absolute mira-star-echo"
          >
            <path d={VESICA_V} fill="currentColor" />
            <path d={VESICA_H} fill="currentColor" />
          </svg>

          {/* Core star — primary animation */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className="relative mira-star-core"
          >
            <path d={VESICA_V} fill="currentColor" />
            <path d={VESICA_H} fill="currentColor" />
          </svg>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[16px] font-medium mira-thinking-text">
            {t("thinking.label")}
            {elapsed > 0 && (
              <span className="ml-1.5 text-white/40">{formatTime(elapsed)}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
