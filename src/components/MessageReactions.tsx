"use client";

import { useState, useRef, useEffect } from "react";
import { SmilePlus } from "lucide-react";

const REACTIONS = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "👎", label: "Thumbs down" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "🤔", label: "Thinking" },
  { emoji: "🎉", label: "Celebrate" },
];

interface MessageReactionsProps {
  messageId: string;
}

export default function MessageReactions({ messageId }: MessageReactionsProps) {
  const [activeReactions, setActiveReactions] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handle = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handle), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handle); };
  }, [showPicker]);

  const toggleReaction = (emoji: string) => {
    setActiveReactions(prev =>
      prev.includes(emoji) ? prev.filter(r => r !== emoji) : [...prev, emoji]
    );
    setShowPicker(false);
  };

  return (
    <div className="flex items-center gap-1 relative">
      {/* Active reactions as pills */}
      {activeReactions.map((emoji) => (
        <button
          key={emoji}
          onClick={() => toggleReaction(emoji)}
          className="flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[13px] hover:bg-white/[0.1] transition-colors animate-scale-in"
        >
          <span>{emoji}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:text-white/40 hover:bg-white/[0.05] transition-colors"
          title="Add reaction"
        >
          <SmilePlus size={15} />
        </button>

        {/* Picker popup */}
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex items-center gap-0.5 rounded-xl bg-[#1e1e1e] border border-white/[0.08] px-2 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)] animate-scale-in">
            {REACTIONS.map((r) => (
              <button
                key={r.emoji}
                onClick={() => toggleReaction(r.emoji)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-[18px] transition-all hover:bg-white/[0.08] hover:scale-110 ${
                  activeReactions.includes(r.emoji) ? "bg-white/[0.1]" : ""
                }`}
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
