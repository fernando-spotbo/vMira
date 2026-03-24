"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS_RU = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];
const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

interface MiraDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
  dropUp?: boolean;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

export default function MiraDatePicker({ value, onChange, className, dropUp }: MiraDatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(value + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [open]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  // Previous month's trailing days
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);
  const leadingDays = firstDay;

  // Next month's leading days
  const totalCells = leadingDays + daysInMonth;
  const trailingDays = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(dateStr);
    setOpen(false);
  };

  // Display value
  const displayDate = value
    ? (() => {
        const d = new Date(value + "T00:00:00");
        return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : "Выберите дату";

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2.5 text-[14px] text-white hover:border-white/[0.12] focus:outline-none focus:border-white/[0.15] transition-colors"
      >
        <span>{displayDate}</span>
        <ChevronRight size={14} className={`text-white/30 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className={`absolute left-0 z-[100] w-[280px] rounded-xl border border-white/[0.1] bg-[#1e1e1e] shadow-[0_12px_40px_rgba(0,0,0,0.7)] p-3 mira-fade-in ${dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}>
          {/* Month/year header with navigation */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-semibold text-white">
              {MONTHS_RU[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              >
                <ChevronRight size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS_RU.map((day) => (
              <div key={day} className="flex items-center justify-center h-8 text-[12px] text-white/30 font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {/* Leading days from previous month */}
            {Array.from({ length: leadingDays }, (_, i) => (
              <div key={`prev-${i}`} className="flex items-center justify-center h-8 text-[13px] text-white/15">
                {prevMonthDays - leadingDays + i + 1}
              </div>
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex items-center justify-center h-8 w-8 mx-auto rounded-full text-[13px] transition-colors ${
                    isSelected
                      ? "bg-white text-[#161616] font-semibold"
                      : isToday
                      ? "border border-white/40 text-white font-medium hover:bg-white/[0.08]"
                      : "text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  {day}
                </button>
              );
            })}

            {/* Trailing days from next month */}
            {Array.from({ length: trailingDays }, (_, i) => (
              <div key={`next-${i}`} className="flex items-center justify-center h-8 text-[13px] text-white/15">
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
