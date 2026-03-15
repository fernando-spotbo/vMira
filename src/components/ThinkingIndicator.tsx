"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface ThinkingIndicatorProps {
  isComplete?: boolean;
  thinkingContent?: string;
}

export default function ThinkingIndicator({
  isComplete = false,
  thinkingContent,
}: ThinkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isComplete) return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 100);
    return () => clearInterval(timer);
  }, [isComplete]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="animate-fade-in-up py-3">
      <div className="flex items-start gap-4">
        {/* Avatar placeholder to align with messages */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gpt-gray-600 bg-gpt-gray-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gpt-gray-200">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
          </svg>
        </div>

        <div className="flex-1">
          <button
            onClick={() => thinkingContent && setExpanded(!expanded)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 -ml-3 hover:bg-gpt-gray-700/30 transition-colors"
          >
            {/* Spinner or checkmark */}
            {!isComplete ? (
              <div className="relative flex h-4 w-4 items-center justify-center">
                <div className="absolute h-4 w-4 rounded-full border-[1.5px] border-gpt-gray-600 border-t-gpt-gray-300 animate-spin" />
              </div>
            ) : (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gpt-green/20">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}

            <span className={`text-sm font-medium ${isComplete ? "text-gpt-gray-400" : "animate-thinking text-gpt-gray-300"}`}>
              {isComplete ? "Thought for" : "Thinking"}
              {elapsed > 0 && (
                <span className="ml-1 text-gpt-gray-500">{formatTime(elapsed)}</span>
              )}
            </span>

            {thinkingContent && (
              <ChevronDown
                size={14}
                className={`text-gpt-gray-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            )}
          </button>

          {/* Expandable thinking content */}
          {expanded && thinkingContent && (
            <div className="animate-fade-in-up mt-2 ml-0 rounded-lg border-l-2 border-gpt-gray-600 pl-4 text-sm text-gpt-gray-400 leading-6">
              {thinkingContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
