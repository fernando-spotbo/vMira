"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Sparkles, Zap } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useI18n } from "@/lib/i18n";

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useChat();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const models = [
    { id: "Mira", label: t("model.mira"), description: t("model.miraDesc"), icon: Sparkles },
    { id: "Mira Lite", label: t("model.miraLite"), description: t("model.miraLiteDesc"), icon: Zap },
  ];

  const activeLabel = models.find(m => m.id === selectedModel)?.label || selectedModel;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[16px] font-semibold text-white hover:bg-white/[0.06] transition-colors"
      >
        {activeLabel}
        <ChevronDown size={16} className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => { setSelectedModel(model.id); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors"
            >
              <model.icon size={18} className="shrink-0 text-white" />
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-medium text-white">{model.label}</div>
                <div className="text-[13px] text-white/50">{model.description}</div>
              </div>
              {selectedModel === model.id && (
                <Check size={16} className="shrink-0 text-white" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
