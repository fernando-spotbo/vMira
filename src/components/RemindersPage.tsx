"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, CheckCircle2, ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n";
import { getAccessToken } from "@/lib/api-client";
import EditReminderModal from "./EditReminderModal";

const PROXY_URL = "/api/proxy";

interface Reminder {
  id: string;
  title: string;
  body: string | null;
  remind_at: string;
  rrule: string | null;
  status: string;
  channels: string[];
  created_at: string;
}

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
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const fetchReminders = useCallback(async () => {
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }

    try {
      const res = await fetch(`${PROXY_URL}/reminders?limit=100`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setReminders(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const pending = reminders.filter((r) => r.status === "pending" || r.status === "snoozed");
  const recent = reminders.filter((r) => r.status === "fired" || r.status === "cancelled");

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors md:hidden"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-semibold text-white">Напоминания</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
          </div>
        ) : reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Clock size={32} strokeWidth={1.2} className="text-white/15 mb-3" />
            <p className="text-[15px] text-white/30">Нет напоминаний</p>
            <p className="text-[13px] text-white/20 mt-1">Попросите Миру создать одно в чате</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {/* Scheduled section */}
            {pending.length > 0 && (
              <div className="mb-8">
                <h2 className="text-[15px] font-semibold text-white mb-4">Запланировано</h2>
                <div className="space-y-0.5">
                  {pending.map((reminder) => (
                    <button
                      key={reminder.id}
                      onClick={() => setEditingReminder(reminder)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 hover:bg-white/[0.04] transition-colors text-left group"
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
                <h2 className="text-[15px] font-semibold text-white mb-4">Недавние</h2>
                <div className="space-y-0.5">
                  {recent.map((reminder) => (
                    <button
                      key={reminder.id}
                      onClick={() => setEditingReminder(reminder)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 hover:bg-white/[0.04] transition-colors text-left group"
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

      {/* Edit modal */}
      {editingReminder && (
        <EditReminderModal
          reminder={editingReminder}
          onClose={() => setEditingReminder(null)}
          onUpdated={() => { setEditingReminder(null); fetchReminders(); }}
          onDeleted={() => { setEditingReminder(null); fetchReminders(); }}
        />
      )}
    </div>
  );
}
