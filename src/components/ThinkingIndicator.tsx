"use client";

import { useState, useEffect } from "react";
import { useChat } from "@/context/ChatContext";
import { t } from "@/lib/i18n";

/**
 * Thinking/loading indicator — shows when Mira is processing.
 *
 * States:
 * 1. Queue (queuePosition > 0): "In queue — position 3"
 * 2. Thinking (no queue): animated orb + "Thinking..."
 * 3. Long wait (>10s): shows elapsed time
 */
export default function ThinkingIndicator() {
  const { queuePosition } = useChat();
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setElapsed(secs);
      setPhase(Math.floor(secs / 3) % 3);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const isQueued = queuePosition !== null && queuePosition > 0;

  return (
    <div className="animate-fade-in-up py-1">
      <div className="flex items-center gap-3">
        {/* Animated orb */}
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <div className="mira-orb" />
          <div className="mira-orb-ring" />
        </div>

        <div className="flex items-center gap-2">
          {isQueued ? (
            <span className="text-[14px] text-white/50">
              <span className="text-white/70">{t("thinking.queue")}</span>
              <span className="mx-1.5 text-white/20">·</span>
              <span>{t("thinking.queuePosition")} {queuePosition}</span>
            </span>
          ) : (
            <span className="text-[14px] text-white/50">
              <span className="mira-thinking-text">
                {phase === 0 ? t("thinking.label") : phase === 1 ? t("thinking.analyzing") : t("thinking.composing")}
              </span>
              {elapsed >= 5 && (
                <span className="ml-1.5 text-white/25 tabular-nums">{formatTime(elapsed)}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
