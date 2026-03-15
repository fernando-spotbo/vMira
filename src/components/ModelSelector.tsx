"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Sparkles, Zap } from "lucide-react";
import { useChat } from "@/context/ChatContext";

const models = [
  { id: "GPT-4o", label: "GPT-4o", description: "Great for most tasks", icon: Sparkles },
  { id: "GPT-4o mini", label: "GPT-4o mini", description: "Fastest model", icon: Zap },
];

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useChat();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-lg font-semibold text-gpt-gray-100 hover:bg-gpt-gray-700/50 transition-colors"
      >
        {selectedModel}
        <ChevronDown size={16} className={`text-gpt-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-gpt-gray-600 bg-gpt-gray-850 py-1 shadow-xl">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                setSelectedModel(model.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gpt-gray-700/50 transition-colors"
            >
              <model.icon size={18} className="shrink-0 text-gpt-gray-300" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gpt-gray-100">{model.label}</div>
                <div className="text-xs text-gpt-gray-400">{model.description}</div>
              </div>
              {selectedModel === model.id && (
                <Check size={16} className="shrink-0 text-gpt-gray-300" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
