"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, Pencil, Trash2, Pause, Calendar } from "lucide-react";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import { deleteReminder, snoozeReminder } from "@/lib/api-client";
import EditReminderModal from "./EditReminderModal";

interface ReminderCardProps {
  id: string;
  title: string;
  remindAt: string;
  rrule?: string | null;
  status?: "pending" | "fired" | "cancelled";
}

function formatScheduleTime(remindAt: string): string {
  try {
    const date = new Date(remindAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });

    if (isToday) return `Сегодня в ${time}`;
    if (isTomorrow) return `Завтра в ${time}`;

    const dateStr = date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    return `${dateStr} в ${time}`;
  } catch {
    return remindAt;
  }
}

export default function ReminderCard({ id, title: initialTitle, remindAt: initialRemindAt, rrule: initialRrule, status = "pending" }: ReminderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(initialTitle);
  const [currentRemindAt, setCurrentRemindAt] = useState(initialRemindAt);
  const [currentRrule, setCurrentRrule] = useState(initialRrule);
  const [deleted, setDeleted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setShowReminders } = useChat();

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [menuOpen]);

  const handleDelete = async () => {
    setMenuOpen(false);
    await deleteReminder(id);
    setDeleted(true);
  };

  if (deleted) return null;

  const handlePause = async () => {
    setMenuOpen(false);
    await snoozeReminder(id, 1440);
  };

  return (
    <>
      <div className="my-3 max-w-[480px]">
        {/* Task tile — GPT style: bordered card, clickable text + ... menu */}
        <div className="flex items-start justify-between rounded-xl border border-white/[0.1] px-4 py-3 hover:border-white/[0.15] transition-colors">
          {/* Clickable text area → opens edit modal */}
          <button
            onClick={() => setEditOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-[15px] text-white font-medium leading-snug truncate">{currentTitle}</p>
            <p className="text-[13px] text-white/40 mt-0.5">{formatScheduleTime(currentRemindAt)}</p>
          </button>

          {/* Three-dot menu */}
          <div ref={menuRef} className="relative ml-3 shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <Ellipsis size={16} strokeWidth={1.8} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
                <button
                  onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <Pencil size={14} strokeWidth={1.8} />
                  <span>{t("reminders.edit")}</span>
                </button>
                {status === "pending" && (
                  <button
                    onClick={handlePause}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                  >
                    <Pause size={14} strokeWidth={1.8} />
                    <span>Пауза</span>
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-red-400 hover:bg-white/[0.06] transition-colors"
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                  <span>{t("reminders.delete")}</span>
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={() => { setMenuOpen(false); setShowReminders(true); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <Calendar size={14} strokeWidth={1.8} />
                  <span>Напоминания</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal — rendered via portal to escape overflow-hidden */}
      {editOpen && createPortal(
        <EditReminderModal
          reminder={{ id, title: currentTitle, remind_at: currentRemindAt, rrule: currentRrule, body: null }}
          onClose={() => setEditOpen(false)}
          onUpdated={() => {
            // Refetch the reminder to get updated data
            (async () => {
              const { getReminders } = await import("@/lib/api-client");
              const result = await getReminders();
              if (result.ok) {
                const updated = result.data.find((r) => r.id === id);
                if (updated) {
                  setCurrentTitle(updated.title);
                  setCurrentRemindAt(updated.remind_at);
                  setCurrentRrule(updated.rrule);
                }
              }
            })();
            setEditOpen(false);
          }}
          onDeleted={() => { setEditOpen(false); setDeleted(true); }}
        />,
        document.body
      )}
    </>
  );
}
