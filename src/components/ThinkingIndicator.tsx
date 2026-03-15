"use client";

import { useState, useEffect } from "react";

export default function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="animate-fade-in-up py-4">
      <div className="flex items-center gap-3">
        {/* Thinking spinner */}
        <div className="relative flex h-5 w-5 items-center justify-center">
          <div className="absolute h-5 w-5 rounded-full border-2 border-gpt-gray-600 border-t-gpt-gray-300 animate-spin" />
        </div>
        <div className="flex items-center gap-2">
          <span className="animate-thinking text-sm font-medium text-gpt-gray-300">
            Thinking
          </span>
          {elapsed > 0 && (
            <span className="text-xs text-gpt-gray-500">
              {elapsed}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
