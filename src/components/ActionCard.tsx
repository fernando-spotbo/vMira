"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Mail, Check, Loader2, AlertCircle, Copy, FileText, Languages,
  Timer, Send, Code2, ChevronDown, ExternalLink,
} from "lucide-react";
import hljs from "highlight.js";
import { t } from "@/lib/i18n";
import { executeAction, cancelAction } from "@/lib/api-client";

// ── Types & constants ────────────────────────────────────────────────────

interface ActionCardProps {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
}

const COLLAPSED_HEIGHT = 240;

const EMAIL_PROVIDERS = [
  { name: "Gmail", letter: "G", url: (to: string, s: string, b: string) => `https://mail.google.com/mail/?view=cm&to=${e(to)}&su=${e(s)}&body=${e(b)}` },
  { name: "Yandex", letter: "Я", url: (to: string, s: string, b: string) => `https://mail.yandex.ru/compose?to=${e(to)}&subject=${e(s)}&body=${e(b)}` },
  { name: "Mail.ru", letter: "@", url: (to: string, s: string, b: string) => `https://e.mail.ru/compose/?to=${e(to)}&subject=${e(s)}&body=${e(b)}` },
  { name: "Outlook", letter: "O", url: (to: string, s: string, b: string) => `https://outlook.live.com/mail/0/deeplink/compose?to=${e(to)}&subject=${e(s)}&body=${e(b)}` },
];
function e(s: string) { return encodeURIComponent(s); }

// ── Shared primitives ────────────────────────────────────────────────────

function TelegramIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function TypeIcon({ type }: { type: string }) {
  const c = "text-white/40 shrink-0";
  switch (type) {
    case "send_telegram": return <TelegramIcon size={16} className={c} />;
    case "send_email": return <Mail size={16} strokeWidth={1.8} className={c} />;
    case "create_draft": return <FileText size={16} strokeWidth={1.8} className={c} />;
    case "translate": return <Languages size={16} strokeWidth={1.8} className={c} />;
    case "set_timer": return <Timer size={16} strokeWidth={1.8} className={c} />;
    case "create_code": return <Code2 size={16} strokeWidth={1.8} className={c} />;
    default: return <FileText size={16} strokeWidth={1.8} className={c} />;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "send_telegram": return "Telegram";
    case "send_email": return "Email";
    case "create_draft": return t("action.draft");
    case "translate": return t("action.translate");
    case "set_timer": return t("action.timer");
    case "create_code": return t("action.code");
    default: return type;
  }
}

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors ${className || ""}`}
      title={ok ? t("action.copied") : t("action.copy")}
    >
      {ok ? <Check size={14} strokeWidth={1.8} /> : <Copy size={14} strokeWidth={1.8} />}
    </button>
  );
}

/** Expandable content wrapper — collapses long content with a gradient fade */
function Expandable({ children, maxH = COLLAPSED_HEIGHT }: { children: React.ReactNode; maxH?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [needsExpand, setNeedsExpand] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.scrollHeight > maxH + 40) setNeedsExpand(true);
  }, [maxH]);

  return (
    <div className="relative">
      <div
        ref={ref}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: expanded ? "none" : `${maxH}px` }}
      >
        {children}
      </div>
      {needsExpand && !expanded && (
        <div className="absolute bottom-0 left-0 right-0">
          <div className="h-16 bg-gradient-to-t from-[#161616] to-transparent pointer-events-none" />
          <button
            onClick={() => setExpanded(true)}
            className="relative z-10 flex w-full items-center justify-center gap-1.5 py-2 text-[14px] text-white/40 hover:text-white/60 transition-colors bg-[#161616]"
          >
            <ChevronDown size={14} strokeWidth={1.8} />
            {t("action.showMore")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Timer hook ───────────────────────────────────────────────────────────

function useTimer(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  const [done, setDone] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active || seconds <= 0) return;
    setRemaining(seconds);
    ref.current = setInterval(() => {
      setRemaining(p => {
        if (p <= 1) { clearInterval(ref.current!); setDone(true); try { new Notification("Mira", { body: t("action.timerDone") }); } catch {} return 0; }
        return p - 1;
      });
    }, 1000);
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [seconds, active]);

  const m = Math.floor(remaining / 60), s = remaining % 60;
  return { display: `${m}:${String(s).padStart(2, "0")}`, done, progress: seconds > 0 ? (seconds - remaining) / seconds : 0 };
}

// ── Main component ───────────────────────────────────────────────────────

export default function ActionCard({ id, actionType, payload }: ActionCardProps) {
  const [status, setStatus] = useState<"proposed" | "executing" | "executed" | "cancelled" | "failed">(
    actionType === "send_telegram" ? "proposed" : "executed"
  );

  // Payload extraction
  const description = String(payload.description || "");
  const message = String(payload.message || payload.body || payload.content || "");
  const to = String(payload.to || "");
  const subject = String(payload.subject || "");
  const title = String(payload.title || "");
  const sourceText = String(payload.source_text || "");
  const targetText = String(payload.target_text || message);
  const sourceLang = String(payload.source_lang || "").toUpperCase();
  const targetLang = String(payload.target_lang || "").toUpperCase();
  const codeContent = String(payload.code || message);
  const codeLang = String(payload.language || "text");
  const timerSeconds = Number(payload.seconds || 0);
  const timerLabel = String(payload.label || description);
  const timer = useTimer(timerSeconds, actionType === "set_timer");

  const highlighted = useMemo(() => {
    if (actionType !== "create_code" || !codeContent) return "";
    try { return hljs.highlight(codeContent, { language: hljs.getLanguage(codeLang) ? codeLang : "plaintext" }).value; }
    catch { return codeContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  }, [actionType, codeContent, codeLang]);

  const handleConfirm = async () => { setStatus("executing"); const r = await executeAction(id); setStatus(r.ok ? (r.data.status as typeof status) : "failed"); };
  const handleCancel = async () => { setStatus("cancelled"); await cancelAction(id); };

  // Determine primary copyable text
  const copyText = actionType === "translate" ? targetText : actionType === "create_code" ? codeContent : actionType === "send_email" ? `${subject}\n\n${message}` : message;

  return (
    <div className="my-3">
      <div className="rounded-xl border border-white/[0.1] hover:border-white/[0.15] transition-colors">

        {/* ═══ Header bar ═══ */}
        <div className="flex items-center gap-2.5 px-4 h-10">
          <TypeIcon type={actionType} />
          {actionType === "create_code" ? (
            <span className="text-[15px] text-white font-medium flex-1">{codeLang.charAt(0).toUpperCase() + codeLang.slice(1)}</span>
          ) : (
            <span className="text-[14px] text-white/35 flex-1">{typeLabel(actionType)}</span>
          )}

          {/* Status indicators */}
          {status === "executed" && actionType === "send_telegram" && (
            <span className="flex items-center gap-1.5 text-[13px] text-white/25"><Check size={13} strokeWidth={2} />{t("action.done")}</span>
          )}
          {status === "failed" && (
            <span className="flex items-center gap-1.5 text-[13px] text-red-400/60"><AlertCircle size={13} strokeWidth={1.8} />{t("action.failed")}</span>
          )}
          {status === "cancelled" && (
            <span className="text-[13px] text-white/20">{t("action.cancelled")}</span>
          )}

          {/* Copy button — for non-confirm cards */}
          {actionType !== "send_telegram" && actionType !== "set_timer" && copyText && (
            <CopyBtn text={copyText} />
          )}
        </div>

        {/* ═══ TELEGRAM ═══ */}
        {actionType === "send_telegram" && (
          <div className="px-4 pb-3.5">
            <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap">{message || description}</p>
          </div>
        )}

        {/* ═══ EMAIL ═══ */}
        {actionType === "send_email" && (
          <div className="px-4 pb-3.5">
            {/* Header fields */}
            {(to || subject) && (
              <div className="mb-2.5 space-y-1">
                {to && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] text-white/20 w-14 shrink-0">{t("action.emailTo")}</span>
                    <span className="text-[15px] text-white">{to}</span>
                  </div>
                )}
                {subject && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] text-white/20 w-14 shrink-0">{t("action.emailSubject")}</span>
                    <span className="text-[15px] text-white font-medium">{subject}</span>
                  </div>
                )}
              </div>
            )}

            {/* Body */}
            {message && (
              <Expandable maxH={200}>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-4">
                  <p className="text-[15px] text-white leading-[1.75] whitespace-pre-wrap">{message}</p>
                </div>
              </Expandable>
            )}

            {/* Provider row */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto">
              {EMAIL_PROVIDERS.map((p) => (
                <a
                  key={p.name}
                  href={p.url(to, subject, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 shrink-0 rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-[13px] text-white/40 hover:text-white/60 hover:border-white/[0.1] hover:bg-white/[0.03] transition-colors"
                >
                  <span className="text-[11px] font-bold text-white/30">{p.letter}</span>
                  {p.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ═══ DRAFT ═══ */}
        {actionType === "create_draft" && (
          <div className="px-4 pb-3.5">
            {title && <p className="text-[15px] text-white font-medium mb-2.5">{title}</p>}
            <Expandable maxH={COLLAPSED_HEIGHT}>
              <p className="text-[15px] text-white leading-[1.75] whitespace-pre-wrap">{message}</p>
            </Expandable>
          </div>
        )}

        {/* ═══ TRANSLATE ═══ */}
        {actionType === "translate" && (
          <div className="px-4 pb-3.5">
            {sourceText && (
              <p className="text-[15px] text-white/30 leading-relaxed mb-3">{sourceText}</p>
            )}
            <div>
              {targetLang && <span className="text-[12px] text-white/20 font-medium tracking-wider">{targetLang}</span>}
              <p className="text-[15px] text-white leading-relaxed mt-1">{targetText}</p>
            </div>
          </div>
        )}

        {/* ═══ TIMER ═══ */}
        {actionType === "set_timer" && (
          <div className="px-4 pb-5 pt-1">
            {timerLabel && <p className="text-[14px] text-white/35 text-center mb-4">{timerLabel}</p>}
            <div className="flex flex-col items-center">
              <p className={`text-[44px] font-extralight tabular-nums tracking-tight leading-none ${timer.done ? "text-white/25" : "text-white"}`}>
                {timer.display}
              </p>
              <div className="w-40 h-[2px] rounded-full bg-white/[0.06] mt-5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${timer.done ? "bg-white/10" : "bg-white/30"}`}
                  style={{ width: `${timer.progress * 100}%` }}
                />
              </div>
              {timer.done && <p className="text-[14px] text-white/35 mt-4">{t("action.timerDone")}</p>}
            </div>
          </div>
        )}

        {/* ═══ CODE ═══ */}
        {actionType === "create_code" && (
          <div className="overflow-hidden rounded-b-2xl bg-[#1a1a1a]">
            {title && <p className="text-[14px] text-white/40 px-5 pt-3 pb-1">{title}</p>}
            <Expandable maxH={320}>
              <div className="overflow-x-auto px-5 pb-5 pt-2">
                <pre className="text-[14px] leading-[1.8]">
                  <code
                    className={`hljs language-${codeLang} font-mono`}
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                  />
                </pre>
              </div>
            </Expandable>
          </div>
        )}

        {/* ═══ Footer: Confirm / Cancel ═══ */}
        {actionType === "send_telegram" && status === "proposed" && (
          <div className="flex border-t border-white/[0.06]">
            <button onClick={handleCancel} className="flex-1 flex items-center justify-center h-11 text-[15px] text-white/35 hover:text-white/50 hover:bg-white/[0.03] transition-colors">
              {t("reminders.cancel")}
            </button>
            <div className="w-px bg-white/[0.06]" />
            <button onClick={handleConfirm} className="flex-1 flex items-center justify-center gap-2 h-11 text-[15px] text-white font-medium hover:bg-white/[0.03] transition-colors">
              <Send size={14} strokeWidth={1.8} />
              {t("action.confirm")}
            </button>
          </div>
        )}

        {status === "executing" && (
          <div className="flex items-center justify-center gap-2 h-11 border-t border-white/[0.06]">
            <Loader2 size={14} className="text-white/25 animate-spin" />
            <span className="text-[14px] text-white/25">{t("action.executing")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
