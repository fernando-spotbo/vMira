"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";

interface MiraTimePickerProps {
  value: string; // HH:MM (24h)
  onChange: (time: string) => void;
  className?: string;
}

// Generate time options in 15-minute intervals
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function formatTimeDisplay(time: string): string {
  if (!time) return "Выберите время";
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function MiraTimePicker({ value, onChange, className }: MiraTimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [open]);

  // Scroll to selected time when opening
  useEffect(() => {
    if (!open || !listRef.current || !value) return;
    const idx = TIME_OPTIONS.indexOf(value);
    if (idx >= 0) {
      const itemHeight = 36;
      listRef.current.scrollTop = Math.max(0, idx * itemHeight - 3 * itemHeight);
    }
  }, [open, value]);

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2.5 text-[14px] text-white hover:border-white/[0.12] focus:outline-none focus:border-white/[0.15] transition-colors"
      >
        <span>{formatTimeDisplay(value)}</span>
        <ChevronRight size={14} className={`text-white/30 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {/* Dropdown time list */}
      {open && (
        <div className="absolute top-full left-0 z-[100] mt-1.5 w-full min-w-[120px] rounded-xl border border-white/[0.1] bg-[#1e1e1e] shadow-[0_12px_40px_rgba(0,0,0,0.7)] overflow-hidden mira-fade-in">
          <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1">
            {TIME_OPTIONS.map((time) => {
              const isSelected = time === value;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => { onChange(time); setOpen(false); }}
                  className={`flex w-full items-center px-3.5 py-2 text-[14px] transition-colors ${
                    isSelected
                      ? "bg-white/[0.1] text-white font-medium"
                      : "text-white/60 hover:bg-white/[0.06] hover:text-white/80"
                  }`}
                >
                  {formatTimeDisplay(time)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
