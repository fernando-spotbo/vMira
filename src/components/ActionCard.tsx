"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Mail, Check, Loader2, AlertCircle, Copy, FileText, Languages,
  Timer, Send, Code2, ChevronDown, ExternalLink, CloudSun, Calculator,
  CalendarPlus, Download, TrendingUp, TrendingDown,
} from "lucide-react";
import hljs from "highlight.js";
import { t } from "@/lib/i18n";
import WeatherCard from "./WeatherCard";
import { executeAction, cancelAction, getActionStatus } from "@/lib/api-client";
import { useLiveStock, useLiveWeather, type LiveStockData, type LiveWeatherData } from "@/hooks/useLiveData";

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
    case "show_weather": return <CloudSun size={16} strokeWidth={1.8} className={c} />;
    case "show_stock": return <TrendingUp size={16} strokeWidth={1.8} className={c} />;
    case "calculate": return <Calculator size={16} strokeWidth={1.8} className={c} />;
    case "create_event": return <CalendarPlus size={16} strokeWidth={1.8} className={c} />;
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
    case "show_weather": return t("action.weather");
    case "show_stock": return t("action.stock");
    case "calculate": return t("action.calc");
    case "create_event": return t("action.event");
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
  const defaultStatus = actionType === "send_telegram" ? "proposed" : "executed";
  const [status, setStatus] = useState<"proposed" | "executing" | "executed" | "cancelled" | "failed">(defaultStatus);
  const [statusLoaded, setStatusLoaded] = useState(false);

  // Fetch persisted status on mount (handles page reloads)
  useEffect(() => {
    if (actionType === "send_telegram" || actionType === "set_timer") {
      getActionStatus(id).then(r => {
        if (r.ok && r.data.status) {
          setStatus(r.data.status as typeof defaultStatus);
        }
        setStatusLoaded(true);
      }).catch(() => setStatusLoaded(true));
    } else {
      setStatusLoaded(true);
    }
  }, [id, actionType, defaultStatus]);

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
  // Timer should only count on first render in this session.
  // Use a session-scoped set to track which timers have been started.
  const [timerStarted] = useState(() => {
    if (actionType !== "set_timer") return false;
    const key = `timer_started_${id}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return false;
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, "1");
    return true;
  });
  const timer = useTimer(timerSeconds, timerStarted);

  // Weather
  const weatherCity = String(payload.city || "");
  const weatherSummary = String(payload.summary || "");
  const weatherForecast = (payload.forecast as Array<{ day: string; temp: string; icon: string; temp_max?: number; temp_min?: number; precip_prob?: number; precip_sum?: number; wind_max?: number; uv_max?: number }>) || [];
  const weatherHourly = (payload.hourly as Array<{ time: string; temp: number; icon: string; precip?: number | null }>) || [];
  const weatherWind = String(payload.wind || "");
  const weatherWindGusts = payload.wind_gusts ? String(payload.wind_gusts) : "";
  const weatherFeelsLike = String(payload.feels_like || "");
  const weatherHumidity = String(payload.humidity || "");
  const weatherUv = payload.uv_index != null ? Number(payload.uv_index) : null;
  const weatherPrecipProb = payload.precip_prob ? String(payload.precip_prob) : "";
  const weatherPrecipSum = payload.precip_sum ? String(payload.precip_sum) : "";
  const weatherSunrise = payload.sunrise ? String(payload.sunrise) : "";
  const weatherSunset = payload.sunset ? String(payload.sunset) : "";

  // Calculator
  const calcExpression = String(payload.expression || "");
  const calcResult = String(payload.result || "");
  const calcDetails = String(payload.details || "");

  // Calendar event
  const eventTitle = String(payload.title || title);
  const eventDate = String(payload.date || "");
  const eventTime = String(payload.time || "");
  const eventEndTime = String(payload.end_time || "");
  const eventLocation = String(payload.location || "");
  const eventDesc = String(payload.description || description);

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

        {/* ═══ WEATHER (live) ═══ */}
        {actionType === "show_weather" && <LiveWeatherCard
          city={weatherCity} summary={weatherSummary} forecast={weatherForecast}
          hourly={weatherHourly} wind={weatherWind} windGusts={weatherWindGusts}
          feelsLike={weatherFeelsLike} humidity={weatherHumidity}
          uvIndex={weatherUv} precipProb={weatherPrecipProb}
          sunrise={weatherSunrise} sunset={weatherSunset}
        />}

        {/* ═══ STOCK (live) ═══ */}
        {actionType === "show_stock" && (
          <LiveStockCard payload={payload} />
        )}

        {/* ═══ CALCULATE ═══ */}
        {actionType === "calculate" && (
          <div className="px-4 pb-3.5">
            {calcExpression && <p className="text-[14px] text-white/40 mb-1">{calcExpression}</p>}
            <p className="text-[28px] text-white font-light tracking-tight">{calcResult}</p>
            {calcDetails && <p className="text-[13px] text-white/30 mt-1">{calcDetails}</p>}
          </div>
        )}

        {/* ═══ CALENDAR EVENT ═══ */}
        {actionType === "create_event" && (
          <div className="px-4 pb-3.5">
            <p className="text-[16px] text-white font-medium mb-2">{eventTitle}</p>
            <div className="space-y-1.5 mb-3">
              <p className="text-[14px] text-white/60">
                {eventDate}{eventTime ? `, ${eventTime}` : ""}{eventEndTime ? ` — ${eventEndTime}` : ""}
              </p>
              {eventLocation && <p className="text-[14px] text-white/40">{eventLocation}</p>}
              {eventDesc && <p className="text-[14px] text-white/40">{eventDesc}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Generate ICS file and download
                  const start = `${eventDate.replace(/-/g, "")}T${(eventTime || "12:00").replace(":", "")}00`;
                  const end = eventEndTime
                    ? `${eventDate.replace(/-/g, "")}T${eventEndTime.replace(":", "")}00`
                    : `${eventDate.replace(/-/g, "")}T${String(parseInt(eventTime || "12") + 1).padStart(2, "0")}${(eventTime || "12:00").slice(3)}00`;
                  const ics = [
                    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
                    `DTSTART:${start}`, `DTEND:${end}`,
                    `SUMMARY:${eventTitle}`,
                    eventLocation ? `LOCATION:${eventLocation}` : "",
                    eventDesc ? `DESCRIPTION:${eventDesc}` : "",
                    "END:VEVENT", "END:VCALENDAR",
                  ].filter(Boolean).join("\r\n");
                  const blob = new Blob([ics], { type: "text/calendar" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `${eventTitle.replace(/\s+/g, "_")}.ics`;
                  a.click(); URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[14px] text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <Download size={14} strokeWidth={1.8} />
                .ics
              </button>
              <a
                href={`https://calendar.google.com/calendar/r/eventedit?text=${e(eventTitle)}&dates=${eventDate.replace(/-/g, "")}T${(eventTime || "12:00").replace(":", "")}00/${eventDate.replace(/-/g, "")}T${(eventEndTime || String(parseInt(eventTime || "12") + 1).padStart(2, "0") + ":00").replace(":", "")}00&location=${e(eventLocation)}&details=${e(eventDesc)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[14px] text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <ExternalLink size={14} strokeWidth={1.8} />
                Google Calendar
              </a>
            </div>
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

// ═══════════════════════════════════════════════════════════════════════
// ── LiveStockCard — polls while visible
// ═══════════════════════════════════════════════════════════════════════

function LiveStockCard({ payload }: { payload: Record<string, unknown> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [priceKey, setPriceKey] = useState(0);
  const [liveTime, setLiveTime] = useState<string>("");
  const p = payload;
  const symbol = String(p.symbol || "");

  const initialData: LiveStockData = {
    symbol,
    name: String(p.name || symbol),
    price: Number(p.price) || 0,
    open: Number(p.open) || 0,
    previous_close: Number(p.previous_close) || 0,
    change: Number(p.change) || 0,
    change_percent: Number(p.change_percent) || 0,
    high: Number(p.high) || 0,
    low: Number(p.low) || 0,
    currency: String(p.currency || "USD"),
    source: String(p.source || ""),
    updated: String(p.updated || ""),
    chart: (p.chart as LiveStockData["chart"]) || [],
  };

  // Poll every 5 seconds
  const { data, flash } = useLiveStock(symbol, initialData, containerRef, 5_000);
  const d = data || initialData;
  const isUp = d.change >= 0;
  const accentColor = isUp ? "#4ade80" : "#f87171";
  const lineColor = isUp ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)";
  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Bump animation key on price change
  useEffect(() => {
    if (flash) setPriceKey((k) => k + 1);
  }, [flash]);

  // Live clock — updates every second to show freshness
  useEffect(() => {
    const tick = () => setLiveTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // Chart geometry
  const W = 400, H = 90, PAD = 6;
  const chartPts = useMemo(() => {
    if (d.chart.length < 2) return [];
    const prices = d.chart.map(c => c.price);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    return d.chart.map((c, i) => ({
      x: PAD + (i / (d.chart.length - 1)) * (W - PAD * 2),
      y: PAD + (1 - (c.price - minP) / range) * (H - PAD * 2),
      price: c.price,
    }));
  }, [d.chart]);

  const chartPath = useMemo(() => {
    if (chartPts.length < 2) return "";
    let path = `M ${chartPts[0].x} ${chartPts[0].y}`;
    for (let i = 1; i < chartPts.length; i++) {
      const cpx = (chartPts[i - 1].x + chartPts[i].x) / 2;
      path += ` C ${cpx} ${chartPts[i - 1].y}, ${cpx} ${chartPts[i].y}, ${chartPts[i].x} ${chartPts[i].y}`;
    }
    return path;
  }, [chartPts]);

  const chartFill = useMemo(() => {
    if (!chartPath || chartPts.length < 2) return "";
    const last = chartPts[chartPts.length - 1];
    return `${chartPath} L ${last.x} ${H} L ${chartPts[0].x} ${H} Z`;
  }, [chartPath, chartPts]);

  const lastPt = chartPts.length > 0 ? chartPts[chartPts.length - 1] : null;

  const prevCloseY = useMemo(() => {
    if (d.previous_close <= 0 || d.chart.length < 2) return null;
    const prices = d.chart.map(c => c.price);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    return PAD + (1 - (d.previous_close - minP) / range) * (H - PAD * 2);
  }, [d.chart, d.previous_close]);

  const hoverPt = useMemo(() => {
    if (hoverX === null || chartPts.length === 0) return null;
    let closest = chartPts[0];
    let minDist = Math.abs(chartPts[0].x - hoverX);
    for (const pt of chartPts) {
      const dist = Math.abs(pt.x - hoverX);
      if (dist < minDist) { closest = pt; minDist = dist; }
    }
    return closest;
  }, [hoverX, chartPts]);

  const handleChartMouse = (e: React.MouseEvent) => {
    const rect = chartAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverX((e.clientX - rect.left) / rect.width * W);
  };

  // Compute live dot position as % for an overlay div (avoids SVG distortion)
  const dotPos = lastPt ? { left: `${(lastPt.x / W) * 100}%`, top: `${(lastPt.y / H) * 100}%` } : null;

  const keyframes = `
    @keyframes stock-ring-pulse { 0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; } 50% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; } }
    @keyframes stock-price-flash { 0% { transform: scale(1.05); } 100% { transform: scale(1); } }
    @keyframes stock-draw { from { stroke-dashoffset: 2000; } to { stroke-dashoffset: 0; } }
  `;

  return (
    <div ref={containerRef} className="px-5 pb-5 pt-1">
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      {/* Symbol + Name + Live clock */}
      <div className="flex items-baseline justify-between">
        <div>
          {d.name !== d.symbol && <p className="text-[13px] text-white/30">{d.name}</p>}
          <span className="text-[13px] text-white/20">{d.symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-white/20">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor, opacity: 0.7 }} />
            Live
          </span>
          <span className="text-[11px] text-white/15 tabular-nums">{liveTime}</span>
        </div>
      </div>

      {/* Price — flash on change */}
      <div className="flex items-baseline gap-3 mt-2">
        <span
          key={priceKey}
          className="text-[36px] font-extralight leading-none tracking-tighter"
          style={{
            color: flash === "up" ? "#4ade80" : flash === "down" ? "#f87171" : "#fff",
            transition: "color 0.6s ease",
            animation: flash ? "stock-price-flash 0.4s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
          }}
        >
          {fmt(d.price)}
        </span>
        <span className="text-[13px] text-white/30">{d.currency}</span>
      </div>

      {/* Change badge */}
      <div className="flex items-center gap-2 mt-1">
        {isUp
          ? <TrendingUp size={14} strokeWidth={1.8} style={{ color: `${accentColor}b0` }} />
          : <TrendingDown size={14} strokeWidth={1.8} style={{ color: `${accentColor}b0` }} />
        }
        <span className="text-[14px] font-medium transition-all duration-300" style={{ color: `${accentColor}b0` }}>
          {isUp ? "+" : ""}{d.change.toFixed(2)} ({isUp ? "+" : ""}{d.change_percent.toFixed(2)}%)
        </span>
      </div>

      {/* Interactive Chart */}
      {chartPts.length > 1 && (
        <div
          ref={chartAreaRef}
          className="mt-4 -mx-1 relative cursor-crosshair"
          onMouseMove={handleChartMouse}
          onMouseLeave={() => setHoverX(null)}
        >
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block">
            <defs>
              <linearGradient id={`stock-grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.12" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {prevCloseY !== null && (
              <line x1={0} y1={prevCloseY} x2={W} y2={prevCloseY} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4,4" />
            )}

            {chartFill && <path d={chartFill} fill={`url(#stock-grad-${symbol})`} />}

            {chartPath && (
              <path d={chartPath} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round"
                style={{ strokeDasharray: 2000, strokeDashoffset: 0, animation: "stock-draw 1.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
              />
            )}

            {/* Hover crosshair — inside SVG for the line */}
            {hoverPt && (
              <line x1={hoverPt.x} y1={0} x2={hoverPt.x} y2={H} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            )}
          </svg>

          {/* Hover dot — rendered as overlay div so it stays circular */}
          {hoverPt && (
            <div className="absolute pointer-events-none" style={{ left: `${(hoverPt.x / W) * 100}%`, top: `${(hoverPt.y / H) * 100}%`, transform: "translate(-50%,-50%)" }}>
              <div className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}80` }} />
            </div>
          )}

          {/* Live endpoint dot — overlay div (not SVG) for perfect circle */}
          {dotPos && !hoverPt && (
            <div className="absolute pointer-events-none" style={{ left: dotPos.left, top: dotPos.top, transform: "translate(-50%,-50%)" }}>
              {/* Pulse ring */}
              <div
                className="absolute w-5 h-5 rounded-full"
                style={{
                  backgroundColor: accentColor,
                  opacity: 0.15,
                  top: "50%", left: "50%",
                  animation: "stock-ring-pulse 2.5s ease-in-out infinite",
                }}
              />
              {/* Solid dot */}
              <div
                className="relative w-[7px] h-[7px] rounded-full border-[1.5px] border-[#161616]"
                style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}60` }}
              />
            </div>
          )}

          {/* Hover price tooltip */}
          {hoverPt && (
            <div className="absolute pointer-events-none" style={{ left: `${(hoverPt.x / W) * 100}%`, top: -4, transform: "translateX(-50%) translateY(-100%)" }}>
              <div className="px-2.5 py-1 rounded-md text-[11px] tabular-nums text-white/80"
                style={{ backgroundColor: "rgba(20,20,20,0.92)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {fmt(hoverPt.price)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details row — same font as price (no monospace) */}
      <div className="flex gap-4 mt-3 pt-3 border-t border-white/[0.06]">
        {[
          { label: "Open", value: d.open },
          { label: "Prev Close", value: d.previous_close },
          { label: "High", value: d.high },
          { label: "Low", value: d.low },
        ].map((item, i) => (
          <div key={i} className="flex-1">
            <p className="text-[11px] text-white/20">{item.label}</p>
            <p className="text-[14px] text-white/50 tabular-nums">{fmt(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── LiveWeatherCard — refreshes while visible
// ═══════════════════════════════════════════════════════════════════════

function LiveWeatherCard(props: {
  city: string; summary: string;
  forecast: Array<{ day: string; temp: string; icon: string; temp_max?: number; temp_min?: number; precip_prob?: number }>;
  hourly: Array<{ time: string; temp: number; icon: string; precip?: number | null }>;
  wind: string; windGusts: string; feelsLike: string; humidity: string;
  uvIndex: number | null; precipProb: string; sunrise: string; sunset: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const initialData: LiveWeatherData = {
    city: props.city,
    summary: props.summary,
    temperature: 0, feels_like: 0, description: "", icon: "",
    wind: props.wind, wind_gusts: props.windGusts,
    humidity: props.humidity, uv_index: props.uvIndex,
    precip_prob: props.precipProb,
    sunrise: props.sunrise, sunset: props.sunset,
    hourly: props.hourly.map(h => ({ time: h.time, temp: h.temp, icon: h.icon, precip: h.precip ?? null })),
    forecast: props.forecast,
  };

  const { data, lastUpdated } = useLiveWeather(props.city, initialData, containerRef);

  // If we got live data, use it; otherwise fall back to initial props
  const live = data && lastUpdated;
  const weatherProps = live ? {
    city: data.city || props.city,
    summary: data.summary || props.summary,
    forecast: data.forecast?.length ? data.forecast : props.forecast,
    hourly: data.hourly?.length ? data.hourly : props.hourly,
    wind: data.wind || props.wind,
    windGusts: data.wind_gusts || props.windGusts,
    feelsLike: data.feels_like ? `${data.feels_like}°C` : props.feelsLike,
    humidity: data.humidity || props.humidity,
    uvIndex: data.uv_index ?? props.uvIndex,
    precipProb: data.precip_prob || props.precipProb,
    sunrise: data.sunrise || props.sunrise,
    sunset: data.sunset || props.sunset,
  } : props;

  return (
    <div ref={containerRef}>
      <WeatherCard {...weatherProps} />
      {lastUpdated && (
        <div className="flex items-center gap-1.5 px-5 pb-3 -mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400/60 animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.08em] text-white/20">
            Live — updated {lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}
    </div>
  );
}
