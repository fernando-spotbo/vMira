"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Clock, CheckCircle2, Sparkles, Repeat, Trash2, Bell, Mail, Send, ChevronRight, Globe } from "lucide-react";
import { t } from "@/lib/i18n";
import { getAccessToken, getReminders, deleteReminder, getTelegramStatus, getNotificationSettings, updateNotificationSettings, ReminderItem } from "@/lib/api-client";
import EditReminderModal from "./EditReminderModal";
import TelegramLinkModal from "./TelegramLinkModal";

function formatTime(remindAt: string): string {
  try {
    const d = new Date(remindAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
    if (isToday) return `${t("reminders.today")} ${time}`;
    if (isTomorrow) return `${t("reminders.tomorrow")} ${time}`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + ` ${time}`;
  } catch { return remindAt; }
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return t("reminders.today");
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
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

function TelegramIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function ChannelBadges({ channels }: { channels?: string[] }) {
  if (!channels || channels.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {channels.includes("in_app") && <Bell size={11} strokeWidth={1.8} className="text-white/20" />}
      {channels.includes("telegram") && <TelegramIcon size={11} className="text-white/20" />}
      {channels.includes("email") && <Mail size={11} strokeWidth={1.8} className="text-white/20" />}
    </div>
  );
}

interface RemindersPageProps {
  onBack: () => void;
}

export default function RemindersPage({ onBack }: RemindersPageProps) {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [tgModalOpen, setTgModalOpen] = useState(false);

  // Delivery settings
  const [tgLinked, setTgLinked] = useState(false);
  const [tgUsername, setTgUsername] = useState<string | null>(null);
  const [tgEnabled, setTgEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [timezone, setTimezone] = useState("Europe/Moscow");

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
      if (tgStatus.ok) {
        setTgLinked(tgStatus.data.linked);
        setTgUsername(tgStatus.data.username);
      }
      if (settings.ok) {
        setTgEnabled(settings.data.telegram_enabled);
        setEmailEnabled(settings.data.email_enabled);
        setTimezone(settings.data.timezone || "Europe/Moscow");
      }
    } catch {}
  }, []);

  useEffect(() => { fetchReminders(); fetchSettings(); }, [fetchReminders, fetchSettings]);

  const scheduledContent = reminders.filter((r) => r.type === "scheduled_content" && (r.status === "pending" || r.status === "snoozed"));
  const pending = reminders.filter((r) => r.type !== "scheduled_content" && (r.status === "pending" || r.status === "snoozed"));
  const recent = reminders.filter((r) => r.status === "fired" || r.status === "cancelled").slice(0, 20);

  const handleDeleteReminder = async (id: string) => {
    await deleteReminder(id);
    fetchReminders();
  };

  const toggleTgEnabled = async () => {
    if (!tgLinked) { setTgModalOpen(true); return; }
    const next = !tgEnabled;
    setTgEnabled(next);
    await updateNotificationSettings({ telegram_enabled: next });
  };

  const toggleEmailEnabled = async () => {
    const next = !emailEnabled;
    setEmailEnabled(next);
    await updateNotificationSettings({ email_enabled: next });
  };

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* Header */}
      <div className="px-5 pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between h-14">
          <h1 className="text-[18px] font-semibold text-white">{t("reminders.title")}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 pb-10">

          {/* ── Delivery channels card ── */}
          <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04]">
              <p className="text-[13px] text-white/40 uppercase tracking-wider font-medium">{t("delivery.label")}</p>
            </div>

            {/* In-app — always on */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
              <Bell size={16} strokeWidth={1.8} className="text-white/40 shrink-0" />
              <div className="flex-1">
                <p className="text-[14px] text-white">{t("delivery.inApp")}</p>
              </div>
              <span className="text-[12px] text-white/20">{t("delivery.alwaysOn")}</span>
            </div>

            {/* Telegram */}
            <button
              onClick={tgLinked ? toggleTgEnabled : () => setTgModalOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors text-left"
            >
              <TelegramIcon size={16} className={tgEnabled && tgLinked ? "text-white/60" : "text-white/20"} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-white">Telegram</p>
                <p className="text-[12px] text-white/30">
                  {tgLinked
                    ? (tgUsername ? `@${tgUsername}` : t("telegram.connected"))
                    : t("delivery.notConnected")
                  }
                </p>
              </div>
              {tgLinked ? (
                <div className={`h-6 w-11 rounded-full transition-colors relative ${tgEnabled ? "bg-white/30" : "bg-white/[0.08]"}`}>
                  <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${tgEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              ) : (
                <ChevronRight size={16} className="text-white/20" />
              )}
            </button>

            {/* Email */}
            <button
              onClick={toggleEmailEnabled}
              className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
            >
              <Mail size={16} strokeWidth={1.8} className={emailEnabled ? "text-white/60" : "text-white/20"} />
              <div className="flex-1">
                <p className="text-[14px] text-white">Email</p>
                <p className="text-[12px] text-white/30">{t("delivery.emailDesc")}</p>
              </div>
              <div className={`h-6 w-11 rounded-full transition-colors relative ${emailEnabled ? "bg-white/30" : "bg-white/[0.08]"}`}>
                <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${emailEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Clock size={32} strokeWidth={1.2} className="text-white/10 mb-3" />
              <p className="text-[15px] text-white/30">{t("reminders.noReminders")}</p>
              <p className="text-[13px] text-white/15 mt-1">{t("reminders.noRemindersHint")}</p>
            </div>
          ) : (
            <>
              {/* ── Subscriptions (scheduled content) ── */}
              {scheduledContent.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-[13px] text-white/30 uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
                    <Sparkles size={13} strokeWidth={1.8} />
                    {t("reminders.subscriptions")}
                  </h2>
                  <div className="space-y-1">
                    {scheduledContent.map((sc) => (
                      <div key={sc.id} className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg group hover:bg-white/[0.02] transition-colors">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                          <Sparkles size={14} strokeWidth={1.8} className="text-white/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-white truncate">{sc.title}</p>
                          <p className="text-[12px] text-white/25 flex items-center gap-1">
                            <Repeat size={10} strokeWidth={1.8} />
                            {formatRrule(sc.rrule)}
                          </p>
                        </div>
                        <ChannelBadges channels={sc.channels} />
                        <button
                          onClick={() => handleDeleteReminder(sc.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-white/[0.06] transition-all"
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Active reminders ── */}
              {pending.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-[13px] text-white/30 uppercase tracking-wider font-medium mb-3">
                    {t("reminders.scheduled")} · {pending.length}
                  </h2>
                  <div className="space-y-0.5">
                    {pending.map((reminder) => (
                      <button
                        key={reminder.id}
                        onClick={() => setEditingReminder(reminder)}
                        className="flex w-full items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg hover:bg-white/[0.02] transition-colors text-left group"
                      >
                        <Clock size={15} strokeWidth={1.8} className="text-white/25 shrink-0" />
                        <span className="flex-1 text-[14px] text-white truncate">{reminder.title}</span>
                        <ChannelBadges channels={reminder.channels} />
                        <span className="text-[12px] text-white/20 shrink-0">{formatTime(reminder.remind_at)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Recent (fired/cancelled) ── */}
              {recent.length > 0 && (
                <div>
                  <h2 className="text-[13px] text-white/30 uppercase tracking-wider font-medium mb-3">
                    {t("reminders.recent")}
                  </h2>
                  <div className="space-y-0.5">
                    {recent.map((reminder) => (
                      <div
                        key={reminder.id}
                        className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg"
                      >
                        <CheckCircle2 size={15} strokeWidth={1.8} className="text-white/15 shrink-0" />
                        <span className="flex-1 text-[14px] text-white/35 truncate">{reminder.title}</span>
                        <span className="text-[12px] text-white/15 shrink-0">{formatRelativeDate(reminder.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Telegram link modal */}
      {tgModalOpen && (
        <TelegramLinkModal
          onClose={() => { setTgModalOpen(false); fetchSettings(); }}
          onLinked={() => { setTgLinked(true); setTgEnabled(true); fetchSettings(); }}
        />
      )}

      {/* Edit modal */}
      {editingReminder && createPortal(
        <EditReminderModal
          reminder={editingReminder}
          onClose={() => setEditingReminder(null)}
          onUpdated={() => { setEditingReminder(null); fetchReminders(); }}
          onDeleted={() => { setEditingReminder(null); fetchReminders(); }}
        />,
        document.body
      )}
    </div>
  );
}
