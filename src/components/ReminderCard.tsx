"use client";

import { useState } from "react";
import { Clock, Check, X, Pencil, Trash2, Repeat } from "lucide-react";
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

function formatSchedule(remindAt: string, rrule?: string | null): string {
  try {
    const date = new Date(remindAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

    if (rrule) {
      const parts: Record<string, string> = {};
      rrule.split(";").forEach((p) => {
        const [k, v] = p.split("=");
        if (k && v) parts[k] = v;
      });

      const dayMap: Record<string, string> = {
        MO: "пн", TU: "вт", WE: "ср", TH: "чт", FR: "пт", SA: "сб", SU: "вс",
      };

      if (parts.FREQ === "DAILY") return `Каждый день в ${time}`;
      if (parts.FREQ === "WEEKLY" && parts.BYDAY) {
        const days = parts.BYDAY.split(",").map((d) => dayMap[d] || d).join(", ");
        return `${days} в ${time}`;
      }
      if (parts.FREQ === "WEEKLY") return `Каждую неделю в ${time}`;
      if (parts.FREQ === "MONTHLY") return `Каждый месяц в ${time}`;
      return `Повтор · ${time}`;
    }

    if (isToday) return `Сегодня в ${time}`;
    if (isTomorrow) return `Завтра в ${time}`;

    const dateStr = date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    return `${dateStr} в ${time}`;
  } catch {
    return remindAt;
  }
}

export default function ReminderCard({ id, title, remindAt, rrule, status = "pending", onEdit, onDelete }: ReminderCardProps) {
  const [hovered, setHovered] = useState(false);

  const statusConfig = {
    pending: { dot: "bg-emerald-400/80", label: t("reminders.created") },
    fired: { dot: "bg-white/20", label: t("reminders.fired") },
    cancelled: { dot: "bg-white/10", label: t("reminders.cancelled") },
  }[status];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="my-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 max-w-[420px] transition-colors duration-150 hover:border-white/[0.1]"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
            <Clock size={14} strokeWidth={1.8} className="text-white/50" />
          </div>
          <span className="text-[15px] font-medium text-white truncate">{title}</span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
          <span className="text-[12px] text-white/30">{statusConfig.label}</span>
        </div>
      </div>

      {/* Schedule */}
      <div className="mt-2 ml-[38px] flex items-center gap-1.5">
        {rrule && <Repeat size={12} strokeWidth={1.8} className="text-white/30 shrink-0" />}
        <span className="text-[13px] text-white/40">{formatSchedule(remindAt, rrule)}</span>
      </div>

      {/* Actions — visible on hover */}
      <div className={`mt-3 ml-[38px] flex items-center gap-1 transition-all duration-150 ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {onEdit && status === "pending" && (
          <button
            onClick={() => onEdit(id)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <Pencil size={12} strokeWidth={1.8} />
            {t("reminders.edit")}
          </button>
        )}
        {onDelete && status === "pending" && (
          <button
            onClick={() => onDelete(id)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <Trash2 size={12} strokeWidth={1.8} />
            {t("reminders.delete")}
          </button>
        )}
      </div>
    </div>
  );
}
