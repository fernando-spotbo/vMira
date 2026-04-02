"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Clock, CheckCircle2, Sparkles, Repeat, Trash2,
  Bell, Mail, ChevronRight, Settings2,
} from "lucide-react";
import { t } from "@/lib/i18n";
import {
  getAccessToken, getReminders, deleteReminder,
  getTelegramStatus, getNotificationSettings, updateNotificationSettings,
  ReminderItem,
} from "@/lib/api-client";
import EditReminderModal from "./EditReminderModal";
import TelegramLinkModal from "./TelegramLinkModal";

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTime(remindAt: string): string {
  try {
    const d = new Date(remindAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
    if (isToday) return time;
    if (isTomorrow) return `${t("reminders.tomorrow")}, ${time}`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + `, ${time}`;
  } catch { return remindAt; }
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return t("reminders.today");
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return t("reminders.yesterday");
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch { return dateStr; }
}

function formatRrule(rrule: string | null): string {
  if (!rrule) return "";
  if (rrule.includes("FREQ=DAILY")) return t("scheduled.everyDay");
  if (rrule.includes("FREQ=WEEKLY")) {
    const days = rrule.match(/BYDAY=([A-Z,]+)/)?.[1];
    if (days) {
      const map: Record<string, string> = { MO: "Пн", TU: "Вт", WE: "Ср", TH: "Чт", FR: "Пт", SA: "Сб", SU: "Вс" };
      return days.split(",").map(d => map[d] || d).join(", ");
    }
    return t("scheduled.everyWeek");
  }
  if (rrule.includes("FREQ=MONTHLY")) return t("scheduled.everyMonth");
  return rrule;
}

function TelegramIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function ChannelDots({ channels }: { channels?: string[] }) {
  if (!channels || channels.length <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      {channels.includes("telegram") && <TelegramIcon size={12} className="text-white/25" />}
      {channels.includes("email") && <Mail size={12} strokeWidth={1.8} className="text-white/25" />}
    </div>
  );
}

// ── Delivery settings popover ────────────────────────────────────────────

function DeliveryPopover({
  open, onClose, onOpenTelegram,
  tgLinked, tgUsername, tgEnabled, emailEnabled,
  onToggleTg, onToggleEmail,
}: {
  open: boolean; onClose: () => void; onOpenTelegram: () => void;
  tgLinked: boolean; tgUsername: string | null;
  tgEnabled: boolean; emailEnabled: boolean;
  onToggleTg: () => void; onToggleEmail: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-white/[0.06] bg-[#1a1a1a] py-2 shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
    >
      {/* In-app */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Bell size={16} strokeWidth={1.8} className="text-white/40 shrink-0" />
        <span className="flex-1 text-[15px] text-white">{t("delivery.inApp")}</span>
        <span className="text-[13px] text-white/25">{t("delivery.alwaysOn")}</span>
      </div>

      <div className="mx-4 border-t border-white/[0.04]" />

      {/* Telegram */}
      <button
        onClick={tgLinked ? onToggleTg : () => { onClose(); onOpenTelegram(); }}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
      >
        <TelegramIcon size={16} className={tgEnabled && tgLinked ? "text-white/50" : "text-white/25"} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-white">Telegram</p>
          {tgLinked && tgUsername && (
            <p className="text-[13px] text-white/30">@{tgUsername}</p>
          )}
          {!tgLinked && (
            <p className="text-[13px] text-white/25">{t("delivery.notConnected")}</p>
          )}
        </div>
        {tgLinked ? (
          <div className={`h-6 w-11 rounded-full transition-colors duration-200 relative ${tgEnabled ? "bg-white/30" : "bg-white/[0.08]"}`}>
            <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${tgEnabled ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        ) : (
          <ChevronRight size={16} strokeWidth={1.8} className="text-white/25" />
        )}
      </button>

      <div className="mx-4 border-t border-white/[0.04]" />

      {/* Email */}
      <button
        onClick={onToggleEmail}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
      >
        <Mail size={16} strokeWidth={1.8} className={emailEnabled ? "text-white/50" : "text-white/25"} />
        <div className="flex-1">
          <p className="text-[15px] text-white">Email</p>
        </div>
        <div className={`h-6 w-11 rounded-full transition-colors duration-200 relative ${emailEnabled ? "bg-white/30" : "bg-white/[0.08]"}`}>
          <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${emailEnabled ? "translate-x-5" : "translate-x-0"}`} />
        </div>
      </button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────

interface RemindersPageProps {
  onBack: () => void;
}

export default function RemindersPage({ onBack }: RemindersPageProps) {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [tgModalOpen, setTgModalOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);

  const [tgLinked, setTgLinked] = useState(false);
  const [tgUsername, setTgUsername] = useState<string | null>(null);
  const [tgEnabled, setTgEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!getAccessToken()) { setLoading(false); return; }
    const result = await getReminders(undefined, 100);
    if (result.ok) setReminders(result.data);
    setLoading(false);
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const [tgStatus, settings] = await Promise.all([
        getTelegramStatus(),
        getNotificationSettings(),
      ]);
      if (tgStatus.ok) { setTgLinked(tgStatus.data.linked); setTgUsername(tgStatus.data.username); }
      if (settings.ok) { setTgEnabled(settings.data.telegram_enabled); setEmailEnabled(settings.data.email_enabled); }
    } catch {}
  }, []);

  useEffect(() => { fetchReminders(); fetchSettings(); }, [fetchReminders, fetchSettings]);

  const scheduledContent = reminders.filter(r => r.type === "scheduled_content" && (r.status === "pending" || r.status === "snoozed"));
  const pending = reminders.filter(r => r.type !== "scheduled_content" && (r.status === "pending" || r.status === "snoozed"));
  const recent = reminders.filter(r => r.status === "fired" || r.status === "cancelled").slice(0, 20);
  const hasContent = scheduledContent.length > 0 || pending.length > 0 || recent.length > 0;

  const toggleTg = async () => {
    if (!tgLinked) { setTgModalOpen(true); return; }
    const next = !tgEnabled; setTgEnabled(next);
    await updateNotificationSettings({ telegram_enabled: next });
  };

  const toggleEmail = async () => {
    const next = !emailEnabled; setEmailEnabled(next);
    await updateNotificationSettings({ email_enabled: next });
  };

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between h-14">
          <h1 className="text-[18px] font-semibold text-white">{t("reminders.title")}</h1>
          <div className="relative">
            <button
              onClick={() => setDeliveryOpen(!deliveryOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            >
              <Settings2 size={16} strokeWidth={1.8} />
            </button>
            <DeliveryPopover
              open={deliveryOpen}
              onClose={() => setDeliveryOpen(false)}
              onOpenTelegram={() => setTgModalOpen(true)}
              tgLinked={tgLinked}
              tgUsername={tgUsername}
              tgEnabled={tgEnabled}
              emailEnabled={emailEnabled}
              onToggleTg={toggleTg}
              onToggleEmail={toggleEmail}
            />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 pb-10">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-5 w-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          ) : !hasContent ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center py-24">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] mb-5">
                <Clock size={28} strokeWidth={1.4} className="text-white/15" />
              </div>
              <p className="text-[16px] text-white/25">{t("reminders.noReminders")}</p>
              <p className="text-[14px] text-white/15 mt-1.5">{t("reminders.noRemindersHint")}</p>
            </div>
          ) : (
            <>
              {/* ── Subscriptions (scheduled AI content) ── */}
              {scheduledContent.length > 0 && (
                <section className="mb-8">
                  <p className="text-[13px] font-medium text-white/50 mb-3 px-2">{t("reminders.subscriptions")}</p>
                  <div className="space-y-0.5">
                    {scheduledContent.map((sc) => (
                      <div key={sc.id} className="flex items-center gap-3 py-3.5 px-2 -mx-2 rounded-xl group hover:bg-white/[0.06] transition-colors">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                          <Sparkles size={16} strokeWidth={1.8} className="text-white/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] text-white truncate">{sc.title}</p>
                          <p className="text-[13px] text-white/40 mt-0.5 flex items-center gap-1.5">
                            <Repeat size={11} strokeWidth={1.8} />
                            <span>{formatRrule(sc.rrule)}</span>
                          </p>
                        </div>
                        <ChannelDots channels={sc.channels} />
                        <button
                          onClick={() => deleteReminder(sc.id).then(fetchReminders)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-all"
                        >
                          <Trash2 size={16} strokeWidth={1.8} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Active reminders ── */}
              {pending.length > 0 && (
                <section className="mb-8">
                  <p className="text-[13px] font-medium text-white/50 mb-3 px-2">{t("reminders.scheduled")}</p>
                  <div className="space-y-0.5">
                    {pending.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setEditingReminder(r)}
                        className="flex w-full items-center gap-3 py-3.5 px-2 -mx-2 rounded-xl hover:bg-white/[0.06] transition-colors text-left"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                          <Clock size={16} strokeWidth={1.8} className="text-white/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] text-white truncate">{r.title}</p>
                          {r.rrule && (
                            <p className="text-[13px] text-white/40 mt-0.5 flex items-center gap-1.5">
                              <Repeat size={11} strokeWidth={1.8} />
                              <span>{formatRrule(r.rrule)}</span>
                            </p>
                          )}
                        </div>
                        <ChannelDots channels={r.channels} />
                        <span className="text-[14px] text-white/30 shrink-0">{formatTime(r.remind_at)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Recent ── */}
              {recent.length > 0 && (
                <section>
                  <p className="text-[13px] font-medium text-white/30 mb-3 px-2">{t("reminders.recent")}</p>
                  <div className="space-y-0.5">
                    {recent.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-xl">
                        <CheckCircle2 size={16} strokeWidth={1.8} className="text-white/15 shrink-0" />
                        <span className="flex-1 text-[15px] text-white/30 truncate">{r.title}</span>
                        <span className="text-[13px] text-white/20 shrink-0">{formatRelativeDate(r.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {tgModalOpen && (
        <TelegramLinkModal
          onClose={() => { setTgModalOpen(false); fetchSettings(); }}
          onLinked={() => { setTgLinked(true); setTgEnabled(true); fetchSettings(); }}
        />
      )}
      {editingReminder && createPortal(
        <EditReminderModal
          reminder={editingReminder}
          onClose={() => setEditingReminder(null)}
          onUpdated={() => { setEditingReminder(null); fetchReminders(); }}
          onDeleted={() => { setEditingReminder(null); fetchReminders(); }}
        />,
        document.body,
      )}
    </div>
  );
}
