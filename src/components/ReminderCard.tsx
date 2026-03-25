"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, Pencil, Trash2, Pause, Calendar, Bell, Mail, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import { deleteReminder, snoozeReminder, updateReminder, getTelegramStatus } from "@/lib/api-client";
import EditReminderModal from "./EditReminderModal";

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
  const [tgLinked, setTgLinked] = useState<boolean | null>(null); // null = not checked yet
  const [linkPrompt, setLinkPrompt] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setShowReminders } = useChat();

  // Check Telegram link status on mount if telegram is in channels
  useEffect(() => {
    if (currentChannels.includes("telegram") || currentChannels.includes("email")) {
      getTelegramStatus().then(r => {
        if (r.ok) setTgLinked(r.data.linked);
      }).catch(() => {});
    }
  }, []);

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
    if (channel === "telegram" && !currentChannels.includes("telegram")) {
      const status = await getTelegramStatus();
      if (status.ok && !status.data.linked) {
        setTgLinked(false);
        setLinkPrompt(true);
        setMenuOpen(false);
        return;
      }
      setTgLinked(true);
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

  return (
    <>
      <div className="my-3 max-w-[480px]">
        <div className="flex items-start justify-between rounded-xl border border-white/[0.1] px-4 py-3 hover:border-white/[0.15] transition-colors">
          <button onClick={() => setEditOpen(true)} className="min-w-0 flex-1 text-left">
            <p className="text-[15px] text-white font-medium leading-snug truncate">{currentTitle}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[13px] text-white/40">{formatScheduleTime(currentRemindAt)}</p>
              <div className="flex items-center gap-1">
                <Bell size={11} strokeWidth={1.8} className="text-white/25" />
                {hasTelegram && (
                  <span className="flex items-center gap-0.5">
                    <TelegramIcon size={11} className={tgLinked === false ? "text-yellow-500/60" : "text-[#2AABEE]/60"} />
                    {tgLinked === false && <AlertTriangle size={9} className="text-yellow-500/60" />}
                  </span>
                )}
                {hasEmail && <Mail size={11} strokeWidth={1.8} className="text-white/25" />}
              </div>
            </div>
          </button>

          <div ref={menuRef} className="relative ml-3 shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <Ellipsis size={16} strokeWidth={1.8} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
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
                    <span>Пауза</span>
                  </button>
                )}
                <div className="my-1 border-t border-white/[0.06]" />
                <p className="px-3.5 py-1 text-[11px] text-white/25 uppercase tracking-wider">Доставка</p>
                <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/40 cursor-default">
                  <Bell size={14} strokeWidth={1.8} />
                  <span className="flex-1 text-left">В приложении</span>
                  <span className="text-[11px] text-white/30">✓</span>
                </button>
                <button
                  onClick={() => toggleChannel("telegram")}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <TelegramIcon size={14} className={hasTelegram ? "text-[#2AABEE]" : ""} />
                  <span className="flex-1 text-left">Telegram</span>
                  {hasTelegram && <span className="text-[11px] text-[#2AABEE]">✓</span>}
                </button>
                <button
                  onClick={() => toggleChannel("email")}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[14px] text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <Mail size={14} strokeWidth={1.8} className={hasEmail ? "text-white" : ""} />
                  <span className="flex-1 text-left">Email</span>
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
                  <span>Напоминания</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Telegram not linked prompt */}
        {linkPrompt && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-yellow-500/[0.06] border border-yellow-500/[0.12] px-3 py-2">
            <AlertTriangle size={14} className="text-yellow-500/70 shrink-0" />
            <p className="text-[13px] text-yellow-500/70 flex-1">
              Telegram не подключен.{" "}
              <button
                onClick={() => { setLinkPrompt(false); /* open settings */ }}
                className="underline hover:text-yellow-400 transition-colors"
              >
                Подключить в настройках
              </button>
            </p>
            <button onClick={() => setLinkPrompt(false)} className="text-yellow-500/40 hover:text-yellow-500/70 text-[16px] leading-none">&times;</button>
          </div>
        )}
      </div>

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
