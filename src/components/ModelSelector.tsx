"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Zap, Sparkles, Rocket, Gem, Lock } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";

interface ModelDef {
  id: string;
  label: string;
  description: string;
  icon: typeof Zap;
  minPlan: string;
}

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, max: 2, enterprise: 3 };

const MODELS: ModelDef[] = [
  { id: "mira", label: "Mira Fast", description: "Быстрые ответы", icon: Zap, minPlan: "free" },
  { id: "mira-thinking", label: "Mira Thinking", description: "Режим размышлений", icon: Sparkles, minPlan: "pro" },
  { id: "mira-pro", label: "Mira Pro", description: "Сложные задачи", icon: Rocket, minPlan: "pro" },
  { id: "mira-max", label: "Mira Max", description: "Максимальное качество", icon: Gem, minPlan: "max" },
];

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useChat();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const chatPlan = user?.chat_plan || "free";
  const userRank = PLAN_RANK[chatPlan] ?? 0;

  const activeModel = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // If current selection requires a higher plan than user has, reset to mira
  useEffect(() => {
    const current = MODELS.find(m => m.id === selectedModel);
    if (current && (PLAN_RANK[current.minPlan] ?? 0) > userRank) {
      setSelectedModel("mira");
    }
  }, [chatPlan, selectedModel, setSelectedModel, userRank]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[16px] font-semibold text-white hover:bg-white/[0.06] transition-colors"
      >
        {activeModel.label}
        <ChevronDown size={16} className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
          {MODELS.map((model) => {
            const locked = (PLAN_RANK[model.minPlan] ?? 0) > userRank;
            return (
              <button
                key={model.id}
                onClick={() => {
                  if (!locked) { setSelectedModel(model.id); setOpen(false); }
                }}
                disabled={locked}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  locked ? "opacity-40 cursor-default" : "hover:bg-white/[0.06]"
                }`}
              >
                <model.icon size={18} className="shrink-0 text-white" />
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-medium text-white">{model.label}</div>
                  <div className="text-[13px] text-white/50">{model.description}</div>
                </div>
                {locked ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Lock size={12} className="text-white/30" />
                    <span className="text-[11px] text-white/30 uppercase">{model.minPlan}</span>
                  </div>
                ) : selectedModel === model.id ? (
                  <Check size={16} className="shrink-0 text-white" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
