"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Mail, Check, X, Loader2, AlertCircle, Copy, FileText, Languages, Timer, Play } from "lucide-react";
import { t } from "@/lib/i18n";
import { executeAction, cancelAction } from "@/lib/api-client";

interface ActionCardProps {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
}

function TelegramIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

// ── Type-specific icons ──────────────────────────────────────────────────

function ActionIcon({ type }: { type: string }) {
  const cls = "text-white/40";
  switch (type) {
    case "send_telegram": return <TelegramIcon size={16} className={cls} />;
    case "send_email": return <Mail size={16} strokeWidth={1.8} className={cls} />;
    case "create_draft": return <FileText size={16} strokeWidth={1.8} className={cls} />;
    case "translate": return <Languages size={16} strokeWidth={1.8} className={cls} />;
    case "set_timer": return <Timer size={16} strokeWidth={1.8} className={cls} />;
    default: return <Send size={16} strokeWidth={1.8} className={cls} />;
  }
}

function actionLabel(type: string): string {
  switch (type) {
    case "send_telegram": return "Telegram";
    case "send_email": return "Email";
    case "create_draft": return t("action.draft");
    case "translate": return t("action.translate");
    case "set_timer": return t("action.timer");
    default: return type;
  }
}

// ── Needs confirmation? ──────────────────────────────────────────────────

function needsConfirmation(type: string): boolean {
  return type === "send_telegram" || type === "send_email";
}

// ── Timer countdown hook ─────────────────────────────────────────────────

function useTimer(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setDone(true);
          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Mira", { body: "Timer done!" });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [seconds, active]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;

  return { remaining, display, done };
}

// ── Main component ───────────────────────────────────────────────────────

export default function ActionCard({ id, actionType, payload }: ActionCardProps) {
  const [status, setStatus] = useState<"proposed" | "executing" | "executed" | "cancelled" | "failed">(
    needsConfirmation(actionType) ? "proposed" : "executed"
  );
  const [copied, setCopied] = useState(false);
  const [timerActive, setTimerActive] = useState(actionType === "set_timer");

  const description = String(payload.description || "");
  const message = String(payload.message || payload.body || payload.content || "");
  const to = String(payload.to || "");
  const subject = String(payload.subject || "");
  const title = String(payload.title || "");

  // Translation
  const sourceText = String(payload.source_text || "");
  const targetText = String(payload.target_text || "");
  const sourceLang = String(payload.source_lang || "");
  const targetLang = String(payload.target_lang || "");

  // Timer
  const timerSeconds = Number(payload.seconds || 0);
  const timerLabel = String(payload.label || "");
  const timer = useTimer(timerSeconds, timerActive);

  const handleConfirm = async () => {
    setStatus("executing");
    const result = await executeAction(id);
    setStatus(result.ok ? (result.data.status as typeof status) : "failed");
  };

  const handleCancel = async () => {
    setStatus("cancelled");
    await cancelAction(id);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render by type ─────────────────────────────────────────────────────

  return (
    <div className="my-3 max-w-[520px]">
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.06]">
          <ActionIcon type={actionType} />
          <span className="text-[14px] text-white/40 flex-1">{actionLabel(actionType)}</span>
          {status === "executed" && actionType !== "set_timer" && <Check size={14} strokeWidth={2} className="text-white/30" />}
          {status === "failed" && <AlertCircle size={14} strokeWidth={1.8} className="text-red-400/60" />}
          {status === "cancelled" && <X size={14} strokeWidth={1.8} className="text-white/20" />}
        </div>

        {/* ── Send Telegram / Email ── */}
        {(actionType === "send_telegram" || actionType === "send_email") && (
          <div className="px-4 py-3">
            {to && <p className="text-[13px] text-white/30 mb-1">{to}{subject ? ` · ${subject}` : ""}</p>}
            <p className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap">{message || description}</p>
          </div>
        )}

        {/* ── Draft ── */}
        {actionType === "create_draft" && (
          <div className="px-4 py-3">
            {title && <p className="text-[13px] text-white/40 mb-2 font-medium">{title}</p>}
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3 max-h-[300px] overflow-y-auto">
              <p className="text-[15px] text-white/75 leading-relaxed whitespace-pre-wrap">{message}</p>
            </div>
            <button
              onClick={() => handleCopy(message)}
              className="flex items-center gap-2 mt-2.5 text-[13px] text-white/40 hover:text-white/60 transition-colors"
            >
              {copied ? <Check size={13} strokeWidth={1.8} /> : <Copy size={13} strokeWidth={1.8} />}
              {copied ? t("action.copied") : t("action.copy")}
            </button>
          </div>
        )}

        {/* ── Translate ── */}
        {actionType === "translate" && (
          <div className="px-4 py-3">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-white/25 uppercase tracking-wider mb-1">{sourceLang || "Original"}</p>
                <p className="text-[14px] text-white/50 leading-relaxed">{sourceText}</p>
              </div>
              <div className="border-t border-white/[0.04]" />
              <div>
                <p className="text-[11px] text-white/25 uppercase tracking-wider mb-1">{targetLang || "Translation"}</p>
                <p className="text-[15px] text-white/80 leading-relaxed">{targetText}</p>
              </div>
            </div>
            <button
              onClick={() => handleCopy(targetText)}
              className="flex items-center gap-2 mt-2.5 text-[13px] text-white/40 hover:text-white/60 transition-colors"
            >
              {copied ? <Check size={13} strokeWidth={1.8} /> : <Copy size={13} strokeWidth={1.8} />}
              {copied ? t("action.copied") : t("action.copy")}
            </button>
          </div>
        )}

        {/* ── Timer ── */}
        {actionType === "set_timer" && (
          <div className="px-4 py-4 flex flex-col items-center">
            {timerLabel && <p className="text-[13px] text-white/40 mb-2">{timerLabel}</p>}
            <p className={`text-[32px] font-light tabular-nums tracking-tight ${timer.done ? "text-white/50" : "text-white/80"}`}>
              {timer.display}
            </p>
            {timer.done && (
              <p className="text-[14px] text-white/40 mt-1">{t("action.timerDone")}</p>
            )}
          </div>
        )}

        {/* ── Footer: Confirm/Cancel for external actions ── */}
        {needsConfirmation(actionType) && status === "proposed" && (
          <div className="flex border-t border-white/[0.06]">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-[14px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
            >
              {t("reminders.cancel")}
            </button>
            <div className="w-px bg-white/[0.06]" />
            <button
              onClick={handleConfirm}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-[14px] text-white font-medium hover:bg-white/[0.04] transition-colors"
            >
              {t("action.confirm")}
            </button>
          </div>
        )}

        {status === "executing" && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-white/[0.06]">
            <Loader2 size={14} className="text-white/30 animate-spin" />
            <span className="text-[14px] text-white/30">{t("action.executing")}</span>
          </div>
        )}

        {needsConfirmation(actionType) && status === "executed" && (
          <div className="flex items-center justify-center py-2.5 border-t border-white/[0.06]">
            <span className="text-[13px] text-white/25">{t("action.done")}</span>
          </div>
        )}

        {status === "cancelled" && (
          <div className="flex items-center justify-center py-2.5 border-t border-white/[0.06]">
            <span className="text-[13px] text-white/20">{t("action.cancelled")}</span>
          </div>
        )}

        {status === "failed" && (
          <div className="flex items-center justify-center py-2.5 border-t border-white/[0.06]">
            <span className="text-[13px] text-red-400/60">{t("action.failed")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
