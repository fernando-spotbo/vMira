"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { updateReminder, deleteReminder, snoozeReminder } from "@/lib/api-client";
import MiraDatePicker from "./ui/MiraDatePicker";
import MiraTimePicker from "./ui/MiraTimePicker";

const RECURRENCE_OPTIONS = [
  { value: "", label: "Не повторять" },
  { value: "FREQ=DAILY", label: "Каждый день" },
  { value: "FREQ=WEEKLY", label: "Каждую неделю" },
  { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "По будням" },
  { value: "FREQ=MONTHLY", label: "Каждый месяц" },
];

interface EditReminderModalProps {
  reminder: {
    id: string;
    title: string;
    remind_at: string;
    rrule?: string | null;
    body?: string | null;
  };
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function EditReminderModal({ reminder, onClose, onUpdated, onDeleted }: EditReminderModalProps) {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(reminder.title);
  const [instructions, setInstructions] = useState(reminder.body || "");
  const [recurrence, setRecurrence] = useState(reminder.rrule || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    try {
      const d = new Date(reminder.remind_at);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      setDate(`${y}-${m}-${day}`);
      setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    } catch {
      setDate(new Date().toISOString().slice(0, 10));
      setTime("12:00");
    }
  }, [reminder.remind_at]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { setVisible(false); setTimeout(onClose, 200); }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setVisible(false);
      setTimeout(onClose, 200);
    }
  };

  const close = () => { setVisible(false); setTimeout(onClose, 200); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const remindAt = new Date(`${date}T${time}:00`).toISOString();
    const result = await updateReminder(reminder.id, {
      title: name.trim(),
      body: instructions.trim() || null,
      remind_at: remindAt,
      rrule: recurrence || null,
    });

    if (result.ok) {
      onUpdated();
      close();
    } else {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await deleteReminder(reminder.id);
    if (result.ok) {
      onDeleted();
      close();
    }
  };

  const handlePause = async () => {
    const result = await snoozeReminder(reminder.id, 1440);
    if (result.ok) {
      onUpdated();
      close();
    }
  };

  return (
    <div
      onClick={handleBackdrop}
      className={`fixed inset-0 z-[300] flex items-center justify-center px-4 transition-all duration-200 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-[480px] rounded-2xl bg-[#1a1a1a] border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-visible transition-all duration-200 ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-[17px] font-medium text-white">Редактировать напоминание</h2>
          <button
            onClick={close}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[13px] font-medium text-white mb-1.5">Название</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2.5 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
              placeholder="Напоминание..."
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-[13px] font-medium text-white mb-1.5">Описание</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2.5 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors resize-none"
              placeholder="Дополнительные детали..."
            />
          </div>

          {/* When — recurrence + date picker + time picker */}
          <div>
            <label className="block text-[13px] font-medium text-white mb-1.5">Когда</label>
            <div className="flex items-start gap-2">
              {/* Recurrence dropdown */}
              <div className="flex-1">
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2.5 text-[14px] text-white focus:outline-none focus:border-white/[0.15] transition-colors appearance-none cursor-pointer [color-scheme:dark]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 10px center",
                    paddingRight: "30px",
                  }}
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date picker */}
              <MiraDatePicker value={date} onChange={setDate} className="flex-1" />

              {/* Time picker */}
              <MiraTimePicker value={time} onChange={setTime} className="w-[110px]" />
            </div>
          </div>

          {/* Actions — GPT layout: Pause + Delete left, Cancel + Save right */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePause}
                className="rounded-lg px-3.5 py-2 text-[14px] text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              >
                Пауза
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg border border-red-500/30 px-3.5 py-2 text-[14px] text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Удалить
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={close}
                className="rounded-lg px-3.5 py-2 text-[14px] text-white/50 hover:text-white/70 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="rounded-lg bg-white px-4 py-2 text-[14px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
