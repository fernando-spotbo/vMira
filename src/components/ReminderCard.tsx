"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, Pencil, Trash2, Pause, Calendar, Bell, Mail, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import { deleteReminder, snoozeReminder, updateReminder, getTelegramStatus } from "@/lib/api-client";
import EditReminderModal from "./EditReminderModal";
import TelegramLinkModal from "./TelegramLinkModal";

interface ReminderCardProps {
  id: string;
  title: string;
  body?: string | null;
  remindAt: string;
  rrule?: string | null;
  channels?: string[];
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
      day: "numeric", month: "long",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    return `${dateStr} в ${time}`;
  } catch { return remindAt; }
}

function TelegramIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

export default function ReminderCard({ id, title: initialTitle, body: initialBody, remindAt: initialRemindAt, rrule: initialRrule, channels: initialChannels, status = "pending" }: ReminderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(initialTitle);
  const [currentRemindAt, setCurrentRemindAt] = useState(initialRemindAt);
  const [currentRrule, setCurrentRrule] = useState(initialRrule);
  const [currentBody, setCurrentBody] = useState<string | null>(initialBody || null);
  const [currentChannels, setCurrentChannels] = useState<string[]>(initialChannels || ["in_app"]);
  const [deleted, setDeleted] = useState(false);
  const [tgLinkModal, setTgLinkModal] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
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

  const hasTelegram = currentChannels.includes("telegram");
  const hasEmail = currentChannels.includes("email");

  const toggleChannel = async (channel: "telegram" | "email") => {
    // For telegram, check if linked first
    if (channel === "telegram" && !hasTelegram) {
      const status = await getTelegramStatus();
      if (!status.ok || !status.data.linked) {
        setMenuOpen(false);
        setTgLinkModal(true);
        return;
      }
    }

    const has = currentChannels.includes(channel);
    const newChannels = has
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel];
    if (!newChannels.includes("in_app")) newChannels.unshift("in_app");
    setCurrentChannels(newChannels);
    setMenuOpen(false);
    await updateReminder(id, { channels: newChannels });
  };

  // After Telegram is linked via modal, add it as channel
  const handleTgLinked = async () => {
    if (!hasTelegram) {
      const newChannels = [...currentChannels, "telegram"];
      setCurrentChannels(newChannels);
      await updateReminder(id, { channels: newChannels });
    }
  };

  return (
    <>
      <div className="my-3">
        <div className="flex items-start justify-between rounded-xl border border-white/[0.1] px-4 py-3 hover:border-white/[0.15] transition-colors">
          <button onClick={() => setEditOpen(true)} className="min-w-0 flex-1 text-left">
            <p className="text-[15px] text-white font-medium leading-snug truncate">{currentTitle}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[13px] text-white/40">{formatScheduleTime(currentRemindAt)}</p>
              <div className="flex items-center gap-1.5 text-white/25">
                <Bell size={11} strokeWidth={1.8} />
                {hasTelegram && <TelegramIcon size={11} className="text-white/25" />}
                {hasEmail && <Mail size={11} strokeWidth={1.8} />}
              </div>
            </div>
          </button>

          <div ref={menuRef} className="relative ml-3 shrink-0">
            <button
              ref={btnRef}
              onClick={() => {
                if (!menuOpen && btnRef.current) {
                  const rect = btnRef.current.getBoundingClientRect();
                  const spaceBelow = window.innerHeight - rect.bottom;
                  setDropUp(spaceBelow < 320);
                }
                setMenuOpen(!menuOpen);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <Ellipsis size={16} strokeWidth={1.8} />
            </button>

            {menuOpen && (
              <div className={`absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)] ${dropUp ? "bottom-full mb-1" : "top-full"}`}>
                <button
                  onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <Pencil size={14} strokeWidth={1.8} />
                  <span>{t("reminders.edit")}</span>
                </button>
                {status === "pending" && (
                  <button onClick={handlePause} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors">
                    <Pause size={14} strokeWidth={1.8} />
                    <span>{t("reminders.pause")}</span>
                  </button>
                )}

                {/* Delivery channels */}
                <div className="my-1 border-t border-white/[0.06]" />
                <p className="px-3.5 py-1 text-[11px] text-white/20 uppercase tracking-wider">{t("delivery.label")}</p>
                <div className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/30">
                  <Bell size={14} strokeWidth={1.8} />
                  <span className="flex-1 text-left">{t("delivery.inApp")}</span>
                  <span className="text-[11px]">✓</span>
                </div>
                <button
                  onClick={() => toggleChannel("telegram")}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <TelegramIcon size={14} className={hasTelegram ? "text-white/70" : "text-white/30"} />
                  <span className="flex-1 text-left">{t("delivery.telegram")}</span>
                  {hasTelegram && <span className="text-[11px] text-white/30">✓</span>}
                </button>
                <button
                  onClick={() => toggleChannel("email")}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <Mail size={14} strokeWidth={1.8} className={hasEmail ? "text-white/70" : "text-white/30"} />
                  <span className="flex-1 text-left">{t("delivery.email")}</span>
                  {hasEmail && <span className="text-[11px] text-white/30">✓</span>}
                </button>

                <div className="my-1 border-t border-white/[0.06]" />
                <button onClick={handleDelete} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-red-400 hover:bg-white/[0.06] transition-colors">
                  <Trash2 size={14} strokeWidth={1.8} />
                  <span>{t("reminders.delete")}</span>
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button onClick={() => { setMenuOpen(false); setShowReminders(true); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors">
                  <Calendar size={14} strokeWidth={1.8} />
                  <span>{t("reminders.allReminders")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Telegram link modal — opens when trying to enable Telegram without linking */}
      {tgLinkModal && (
        <TelegramLinkModal
          onClose={() => setTgLinkModal(false)}
          onLinked={handleTgLinked}
        />
      )}

      {editOpen && createPortal(
        <EditReminderModal
          reminder={{ id, title: currentTitle, remind_at: currentRemindAt, rrule: currentRrule, body: currentBody }}
          onClose={() => setEditOpen(false)}
          onUpdated={() => {
            (async () => {
              const { getReminders } = await import("@/lib/api-client");
              const result = await getReminders();
              if (result.ok) {
                const updated = result.data.find((r) => r.id === id);
                if (updated) {
                  setCurrentTitle(updated.title);
                  setCurrentRemindAt(updated.remind_at);
                  setCurrentRrule(updated.rrule);
                  setCurrentBody(updated.body);
                  setCurrentChannels(updated.channels || ["in_app"]);
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
