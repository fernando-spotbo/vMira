"use client";

import { useState, useEffect, useRef } from "react";
import { Mail, Check, Loader2, AlertCircle, Copy, FileText, Languages, Timer, ExternalLink, Send } from "lucide-react";
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

function ActionIcon({ type }: { type: string }) {
  const cls = "text-white/40 shrink-0";
  switch (type) {
    case "send_telegram": return <TelegramIcon size={16} className={cls} />;
    case "send_email": return <Mail size={16} strokeWidth={1.8} className={cls} />;
    case "create_draft": return <FileText size={16} strokeWidth={1.8} className={cls} />;
    case "translate": return <Languages size={16} strokeWidth={1.8} className={cls} />;
    case "set_timer": return <Timer size={16} strokeWidth={1.8} className={cls} />;
    default: return <FileText size={16} strokeWidth={1.8} className={cls} />;
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

function buildMailtoLink(to: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();
  return `mailto:${encodeURIComponent(to)}${query ? `?${query}` : ""}`;
}

interface EmailProvider {
  name: string;
  icon: string;
  buildUrl: (to: string, subject: string, body: string) => string;
}

const EMAIL_PROVIDERS: EmailProvider[] = [
  {
    name: "Gmail",
    icon: "G",
    buildUrl: (to, subject, body) =>
      `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    name: "Yandex",
    icon: "Я",
    buildUrl: (to, subject, body) =>
      `https://mail.yandex.ru/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    name: "Mail.ru",
    icon: "@",
    buildUrl: (to, subject, body) =>
      `https://e.mail.ru/compose/?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    name: "Outlook",
    icon: "O",
    buildUrl: (to, subject, body) =>
      `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
];

// ── Timer hook ───────────────────────────────────────────────────────────

function useTimer(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active || seconds <= 0) return;
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setDone(true);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Mira", { body: t("action.timerDone") });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [seconds, active]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${mins}:${String(secs).padStart(2, "0")}`;
  const progress = seconds > 0 ? (seconds - remaining) / seconds : 0;

  return { display, done, progress };
}

// ── Copyable text block ──────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-[14px] text-white/30 hover:text-white/50 transition-colors"
    >
      {copied ? <Check size={14} strokeWidth={1.8} /> : <Copy size={14} strokeWidth={1.8} />}
      {copied ? t("action.copied") : t("action.copy")}
    </button>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────

export default function ActionCard({ id, actionType, payload }: ActionCardProps) {
  const [status, setStatus] = useState<"proposed" | "executing" | "executed" | "cancelled" | "failed">(
    actionType === "send_telegram" ? "proposed" : "executed"
  );

  const description = String(payload.description || "");
  const message = String(payload.message || payload.body || payload.content || "");
  const to = String(payload.to || "");
  const subject = String(payload.subject || "");
  const title = String(payload.title || "");
  const sourceText = String(payload.source_text || "");
  const targetText = String(payload.target_text || "");
  const sourceLang = String(payload.source_lang || "").toUpperCase();
  const targetLang = String(payload.target_lang || "").toUpperCase();
  const timerSeconds = Number(payload.seconds || 0);
  const timerLabel = String(payload.label || description);
  const timer = useTimer(timerSeconds, actionType === "set_timer");

  const handleConfirm = async () => {
    setStatus("executing");
    const result = await executeAction(id);
    setStatus(result.ok ? (result.data.status as typeof status) : "failed");
  };

  const handleCancel = async () => {
    setStatus("cancelled");
    await cancelAction(id);
  };

  return (
    <div className="my-3 max-w-[520px]">
      <div className="rounded-xl border border-white/[0.1] hover:border-white/[0.15] transition-colors overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <ActionIcon type={actionType} />
          <span className="text-[15px] text-white/40 flex-1">{actionLabel(actionType)}</span>
          {status === "executed" && actionType !== "set_timer" && actionType !== "send_telegram" && (
            <CopyButton text={actionType === "translate" ? targetText : message} />
          )}
          {status === "executed" && actionType === "send_telegram" && (
            <span className="flex items-center gap-1.5 text-[13px] text-white/25">
              <Check size={13} strokeWidth={2} />
              {t("action.done")}
            </span>
          )}
          {status === "failed" && (
            <span className="flex items-center gap-1.5 text-[13px] text-red-400/60">
              <AlertCircle size={13} strokeWidth={1.8} />
              {t("action.failed")}
            </span>
          )}
          {status === "cancelled" && (
            <span className="text-[13px] text-white/20">{t("action.cancelled")}</span>
          )}
        </div>

        {/* ── Telegram ── */}
        {actionType === "send_telegram" && (
          <div className="px-4 pb-3">
            <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap">{message || description}</p>
          </div>
        )}

        {/* ── Email — draft with provider links ── */}
        {actionType === "send_email" && (
          <div className="px-4 pb-3">
            {/* Email header fields */}
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3.5 py-2.5 space-y-1.5 mb-2">
              {to && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-white/25 w-14 shrink-0">{t("action.emailTo")}</span>
                  <span className="text-[15px] text-white/70">{to}</span>
                </div>
              )}
              {subject && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-white/25 w-14 shrink-0">{t("action.emailSubject")}</span>
                  <span className="text-[15px] text-white/70">{subject}</span>
                </div>
              )}
            </div>

            {/* Email body */}
            {message && (
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5 mb-3 max-h-[300px] overflow-y-auto">
                <p className="text-[15px] text-white/70 leading-[1.7] whitespace-pre-wrap">{message}</p>
              </div>
            )}

            {/* Provider buttons */}
            <p className="text-[13px] text-white/25 mb-2">{t("action.openWith")}</p>
            <div className="flex flex-wrap gap-2">
              {EMAIL_PROVIDERS.map((provider) => (
                <a
                  key={provider.name}
                  href={provider.buildUrl(to, subject, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[14px] text-white/50 hover:text-white/70 hover:bg-white/[0.06] hover:border-white/[0.1] transition-colors"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-white/40 bg-white/[0.06]">{provider.icon}</span>
                  {provider.name}
                </a>
              ))}
            </div>

            {/* Copy fallback */}
            <div className="flex items-center gap-4 mt-3">
              <CopyButton text={`${subject ? `${subject}\n\n` : ""}${message}`} />
            </div>
          </div>
        )}

        {/* ── Draft — clean text with title ── */}
        {actionType === "create_draft" && (
          <div className="px-4 pb-3">
            {title && (
              <p className="text-[15px] text-white font-medium mb-2">{title}</p>
            )}
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-4 max-h-[400px] overflow-y-auto">
              <p className="text-[15px] text-white/70 leading-[1.7] whitespace-pre-wrap">{message}</p>
            </div>
          </div>
        )}

        {/* ── Translate — source / target ── */}
        {actionType === "translate" && (
          <div className="px-4 pb-3">
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] overflow-hidden">
              {/* Source */}
              <div className="px-3.5 py-3">
                {sourceLang && <p className="text-[12px] text-white/20 mb-1 font-medium tracking-wide">{sourceLang}</p>}
                <p className="text-[15px] text-white/40 leading-relaxed">{sourceText}</p>
              </div>
              <div className="border-t border-white/[0.06]" />
              {/* Target */}
              <div className="px-3.5 py-3">
                {targetLang && <p className="text-[12px] text-white/20 mb-1 font-medium tracking-wide">{targetLang}</p>}
                <p className="text-[15px] text-white leading-relaxed">{targetText}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Timer ── */}
        {actionType === "set_timer" && (
          <div className="px-4 pb-4">
            {timerLabel && <p className="text-[14px] text-white/40 text-center mb-3">{timerLabel}</p>}
            <div className="flex flex-col items-center">
              <p className={`text-[40px] font-light tabular-nums tracking-tight ${timer.done ? "text-white/30" : "text-white"}`}>
                {timer.display}
              </p>
              <div className="w-full max-w-[180px] h-[3px] rounded-full bg-white/[0.06] mt-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${timer.done ? "bg-white/15" : "bg-white/30"}`}
                  style={{ width: `${timer.progress * 100}%` }}
                />
              </div>
              {timer.done && (
                <p className="text-[15px] text-white/40 mt-3">{t("action.timerDone")}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Confirm/Cancel (Telegram only for now) ── */}
        {actionType === "send_telegram" && status === "proposed" && (
          <div className="flex border-t border-white/[0.06]">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center py-3 text-[15px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
            >
              {t("reminders.cancel")}
            </button>
            <div className="w-px bg-white/[0.06]" />
            <button
              onClick={handleConfirm}
              className="flex-1 flex items-center justify-center py-3 text-[15px] text-white font-medium hover:bg-white/[0.04] transition-colors"
            >
              <Send size={14} strokeWidth={1.8} className="mr-2" />
              {t("action.confirm")}
            </button>
          </div>
        )}

        {status === "executing" && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-white/[0.06]">
            <Loader2 size={15} className="text-white/30 animate-spin" />
            <span className="text-[14px] text-white/30">{t("action.executing")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
