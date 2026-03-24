"use client";

import { useState, useRef, useEffect } from "react";
import { Ellipsis, Clock, Pencil, Trash2, Pause, Play } from "lucide-react";
import { t } from "@/lib/i18n";

interface ReminderCardProps {
  id: string;
  title: string;
  remindAt: string;
  rrule?: string | null;
  status?: "pending" | "fired" | "cancelled";
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
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

export default function ReminderCard({ id, title, remindAt, rrule, status = "pending", onEdit, onDelete }: ReminderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [menuOpen]);

  return (
    <div className="my-3 max-w-[480px]">
      {/* Task tile — GPT style: bordered card, title + time + menu */}
      <div className="flex items-start justify-between rounded-xl border border-white/[0.1] px-4 py-3 hover:border-white/[0.15] transition-colors">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-white font-medium leading-snug truncate">{title}</p>
          <p className="text-[13px] text-white/40 mt-0.5">{formatScheduleTime(remindAt)}</p>
        </div>

        {/* Three-dot menu */}
        <div ref={menuRef} className="relative ml-3 shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <Ellipsis size={16} strokeWidth={1.8} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
              {onEdit && status === "pending" && (
                <button
                  onClick={() => { setMenuOpen(false); onEdit(id); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <Pencil size={14} strokeWidth={1.8} />
                  <span>{t("reminders.edit")}</span>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { setMenuOpen(false); onDelete(id); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-red-400 hover:bg-white/[0.06] transition-colors"
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                  <span>{t("reminders.delete")}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
