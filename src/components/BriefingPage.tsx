"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Send, Settings2, Clock, Bell } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { t } from "@/lib/i18n";
import { getBriefing, updateBriefingSettings } from "@/lib/api-client";
import MiraTimePicker from "./ui/MiraTimePicker";

interface BriefingPageProps {
  onBack: () => void;
}

const SUGGESTIONS = [
  "TSLA and AAPL pre-market prices, S&P 500 futures",
  "Weather in my city, today's reminders and calendar",
  "NBA games today, scores from last night",
  "Top 3 tech news headlines, Bitcoin price",
  "Earnings calls this week, major IPOs",
  "A random history fact and a motivational quote",
  "USD/RUB rate, Moscow weather, my schedule",
];

export default function BriefingPage({ onBack }: BriefingPageProps) {
  const [configured, setConfigured] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgTime, setTgTime] = useState("08:00");
  const [editPrompt, setEditPrompt] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getBriefing().then(r => {
      if (r.ok) {
        setConfigured(r.data.configured);
        setPrompt(r.data.prompt || "");
        setEditPrompt(r.data.prompt || "");
        setContent(r.data.content || null);
        setGeneratedAt(r.data.generated_at || null);
        setTgEnabled(r.data.enabled);
        setTgTime(r.data.time);
      }
      setLoading(false);
    });
  }, []);

  const handleSaveAndGenerate = async (newPrompt?: string) => {
    const p = newPrompt || editPrompt;
    if (!p.trim()) return;
    setGenerating(true);
    setPrompt(p);
    setEditPrompt(p);
    setConfigured(true);

    // Save prompt
    await updateBriefingSettings({ prompt: p.trim() });

    // Generate
    const { apiCall } = await import("@/lib/api-client");
    const r = await apiCall<{ content: string | null; generated_at: string | null }>("/briefing/generate");
    if (r.ok) {
      setContent(r.data.content || null);
      setGeneratedAt(r.data.generated_at || null);
    }
    setGenerating(false);
  };

  const handleRefresh = () => handleSaveAndGenerate(prompt);

  const toggleTelegram = async (enabled: boolean) => {
    setTgEnabled(enabled);
    await updateBriefingSettings({ enabled });
  };

  const handleTimeChange = async (time: string) => {
    setTgTime(time);
    await updateBriefingSettings({ time });
  };

  const formatAge = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return t("briefing.justNow");
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch { return ""; }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="mira-orb" style={{ position: "relative" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
          <h1 className="text-[20px] font-medium text-white">{t("briefing.title")}</h1>
        </div>
        {configured && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={generating}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors disabled:opacity-30"
            >
              <RefreshCw size={16} strokeWidth={1.8} className={generating ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showSettings ? "text-white/60 bg-white/[0.06]" : "text-white/30 hover:text-white/60 hover:bg-white/[0.06]"}`}
            >
              <Settings2 size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>

      {/* Settings */}
      {showSettings && configured && (
        <div className="mx-5 mb-3 space-y-3">
          {/* Edit prompt */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <textarea
              value={editPrompt}
              onChange={e => setEditPrompt(e.target.value)}
              rows={2}
              className="w-full bg-transparent text-[14px] text-white placeholder-white/20 resize-none focus:outline-none"
              placeholder={t("briefing.promptPlaceholder")}
            />
            {editPrompt !== prompt && (
              <button
                onClick={() => handleSaveAndGenerate()}
                disabled={generating}
                className="mt-1 rounded-lg bg-white/[0.08] px-3 py-1.5 text-[13px] text-white hover:bg-white/[0.12] transition-colors disabled:opacity-30"
              >
                {generating ? "..." : t("briefing.saveAndGenerate")}
              </button>
            )}
          </div>
          {/* Telegram delivery */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={14} strokeWidth={1.8} className="text-white/30" />
              <span className="text-[13px] text-white/50">Telegram</span>
              {tgEnabled && <MiraTimePicker value={tgTime} onChange={handleTimeChange} className="w-[90px]" />}
            </div>
            <button
              onClick={() => toggleTelegram(!tgEnabled)}
              className={`relative w-9 h-5 rounded-full transition-colors ${tgEnabled ? "bg-white/20" : "bg-white/[0.08]"}`}
            >
              <span className={`absolute top-[3px] h-3.5 w-3.5 rounded-full transition-all ${tgEnabled ? "left-[19px] bg-white" : "left-[3px] bg-white/40"}`} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[44rem] px-5 pb-8">
          {!configured ? (
            /* Setup state — prompt input + suggestions */
            <div className="pt-8 space-y-6">
              <div className="text-center">
                <p className="text-[15px] text-white/50">{t("briefing.setupTitle")}</p>
                <p className="text-[13px] text-white/25 mt-1">{t("briefing.setupDesc")}</p>
              </div>

              {/* Input */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <textarea
                  ref={inputRef}
                  value={editPrompt}
                  onChange={e => setEditPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-transparent text-[15px] text-white placeholder-white/20 resize-none focus:outline-none"
                  placeholder={t("briefing.promptPlaceholder")}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveAndGenerate(); } }}
                />
                <div className="flex justify-end mt-1">
                  <button
                    onClick={() => handleSaveAndGenerate()}
                    disabled={!editPrompt.trim() || generating}
                    className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-[#161616] hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {generating ? "..." : <><Send size={13} /> {t("briefing.generate")}</>}
                  </button>
                </div>
              </div>

              {/* Suggestions */}
              <div className="space-y-1.5">
                <p className="text-[12px] text-white/20 uppercase tracking-wide">{t("briefing.ideas")}</p>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setEditPrompt(s); handleSaveAndGenerate(s); }}
                    disabled={generating}
                    className="block w-full text-left rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 text-[13px] text-white/50 hover:text-white/70 hover:bg-white/[0.05] hover:border-white/[0.08] transition-all disabled:opacity-30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : generating && !content ? (
            /* Generating first briefing */
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="mira-orb" style={{ position: "relative" }} />
              <p className="text-[14px] text-white/30">{t("briefing.generating")}</p>
            </div>
          ) : content ? (
            /* Briefing content */
            <div className="pt-4">
              {generatedAt && (
                <p className="text-[12px] text-white/15 mb-4">{formatAge(generatedAt)}</p>
              )}
              <div className="markdown-body text-[15px] leading-7 text-white">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
              {generating && (
                <div className="flex items-center gap-2 mt-4 py-2">
                  <RefreshCw size={14} className="animate-spin text-white/20" />
                  <span className="text-[13px] text-white/20">{t("briefing.refreshing")}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <p className="text-[14px] text-white/30">{t("briefing.loadError")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
