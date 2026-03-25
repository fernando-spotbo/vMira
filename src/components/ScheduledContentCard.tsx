"use client";

import { useState } from "react";
import { Repeat, Trash2, Sparkles } from "lucide-react";
import { t } from "@/lib/i18n";
import { deleteReminder } from "@/lib/api-client";

interface ScheduledContentCardProps {
  id: string;
  title: string;
  prompt: string;
  scheduleAt: string;
  rrule: string;
}

function formatRrule(rrule: string): string {
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

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso;
  }
}

export default function ScheduledContentCard({ id, title, prompt, scheduleAt, rrule }: ScheduledContentCardProps) {
  const [deleted, setDeleted] = useState(false);

  const handleDelete = async () => {
    await deleteReminder(id);
    setDeleted(true);
  };

  if (deleted) return null;

  return (
    <div className="my-3 max-w-[480px]">
      <div className="rounded-xl border border-white/[0.1] px-4 py-3 hover:border-white/[0.15] transition-colors">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
            <Sparkles size={14} strokeWidth={1.8} className="text-white/50" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-white font-medium leading-snug">{title}</p>
            <p className="text-[13px] text-white/40 mt-0.5 flex items-center gap-1.5">
              <Repeat size={12} strokeWidth={1.8} />
              <span>{formatRrule(rrule)} в {formatTime(scheduleAt)}</span>
            </p>
            <p className="text-[13px] text-white/30 mt-1 line-clamp-2">{prompt}</p>
          </div>
          <button
            onClick={handleDelete}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
            title="Отменить"
          >
            <Trash2 size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}
