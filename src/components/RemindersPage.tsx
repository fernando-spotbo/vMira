"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Clock, CheckCircle2, Sparkles, Repeat, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { getAccessToken, getReminders, ReminderItem } from "@/lib/api-client";
import EditReminderModal from "./EditReminderModal";

function formatTime(remindAt: string): string {
  try {
    const d = new Date(remindAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });

    if (isToday) return `Сегодня в ${time}`;
    if (isTomorrow) return `Завтра в ${time}`;

    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) + ` в ${time}`;
  } catch {
    return remindAt;
  }
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Сегодня";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Вчера";
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

interface RemindersPageProps {
  onBack: () => void;
}

export default function RemindersPage({ onBack }: RemindersPageProps) {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);

  const fetchReminders = useCallback(async () => {
    if (!getAccessToken()) { setLoading(false); return; }
    const result = await getReminders(undefined, 100);
    if (result.ok) {
      setReminders(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const scheduledContent = reminders.filter((r) => r.type === "scheduled_content" && (r.status === "pending" || r.status === "snoozed"));
  const pending = reminders.filter((r) => r.type !== "scheduled_content" && (r.status === "pending" || r.status === "snoozed"));
  const recent = reminders.filter((r) => r.status === "fired" || r.status === "cancelled");

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* Header — matches GPT "Calendarios" style: just title, left-aligned */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-[18px] font-semibold text-white">{t("reminders.title")}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
          </div>
        ) : reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Clock size={32} strokeWidth={1.2} className="text-white/15 mb-3" />
            <p className="text-[15px] text-white/30">{t("reminders.noReminders")}</p>
            <p className="text-[13px] text-white/20 mt-1">{t("reminders.noRemindersHint")}</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {/* Scheduled AI content (рассылки) */}
            {scheduledContent.length > 0 && (
              <div className="mb-10">
                <h2 className="text-[15px] font-semibold text-white mb-5 flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={1.8} className="text-white/40" />
                  {t("reminders.subscriptions")}
                </h2>
                <div className="space-y-2">
                  {scheduledContent.map((sc) => (
                    <div
                      key={sc.id}
                      className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg group"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                        <Sparkles size={14} strokeWidth={1.8} className="text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-white truncate">{sc.title}</p>
                        <p className="text-[13px] text-white/30 flex items-center gap-1">
                          <Repeat size={11} strokeWidth={1.8} />
                          {sc.rrule?.includes("FREQ=DAILY") ? "Каждый день" : sc.rrule?.includes("FREQ=WEEKLY") ? "Каждую неделю" : sc.rrule?.includes("FREQ=MONTHLY") ? "Каждый месяц" : sc.rrule}
                          {" в "}
                          {(() => { try { return new Date(sc.remind_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return ""; } })()}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const { deleteReminder } = await import("@/lib/api-client");
                          await deleteReminder(sc.id);
                          fetchReminders();
                        }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-all"
                        title="Отменить"
                      >
                        <Trash2 size={14} strokeWidth={1.8} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled section */}
            {pending.length > 0 && (
              <div className="mb-10">
                <h2 className="text-[15px] font-semibold text-white mb-5">{t("reminders.scheduled")}</h2>
                <div className="space-y-1">
                  {pending.map((reminder) => (
                    <button
                      key={reminder.id}
                      onClick={() => setEditingReminder(reminder)}
                      className="flex w-full items-center gap-3 py-3 hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition-colors text-left"
                    >
                      <Clock size={16} strokeWidth={1.8} className="text-white/40 shrink-0" />
                      <span className="flex-1 text-[15px] text-white truncate">{reminder.title}</span>
                      <span className="text-[13px] text-white/30 shrink-0">{formatTime(reminder.remind_at)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent section */}
            {recent.length > 0 && (
              <div>
                <h2 className="text-[15px] font-semibold text-white mb-5">{t("reminders.recent")}</h2>
                <div className="space-y-1">
                  {recent.map((reminder) => (
                    <button
                      key={reminder.id}
                      onClick={() => setEditingReminder(reminder)}
                      className="flex w-full items-center gap-3 py-3 hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition-colors text-left"
                    >
                      <CheckCircle2 size={16} strokeWidth={1.8} className="text-white/25 shrink-0" />
                      <span className="flex-1 text-[15px] text-white/50 truncate">{reminder.title}</span>
                      <span className="text-[13px] text-white/20 shrink-0">{formatRelativeDate(reminder.created_at)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit modal via portal */}
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
