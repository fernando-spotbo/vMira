"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Clock, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { getAccessToken, getNotifications, markNotificationRead, markAllNotificationsRead, NotificationItem } from "@/lib/api-client";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "только что";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  return `${days} дн назад`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const fetchData = useCallback(async () => {
    if (!getAccessToken()) return;
    const result = await getNotifications(20);
    if (result.ok) {
      setNotifications(result.data.notifications || []);
      setUnreadCount(result.data.unread_count || 0);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead();
  };

  const displayed = showAll ? notifications : notifications.filter((n) => !n.read);

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchData(); }}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
        title={t("notifications.title")}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-[#161616] leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] flex flex-col rounded-2xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-50 overflow-hidden mira-fade-in"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-medium text-white">{t("notifications.title")}</h3>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.1] px-1.5 text-[11px] text-white/60 font-medium">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="rounded-lg px-2.5 py-1.5 text-[12px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
                  {t("notifications.markAllRead")}
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-0.5 px-3 py-2 border-b border-white/[0.04]">
            <button onClick={() => setShowAll(false)} className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${!showAll ? "bg-white/[0.08] text-white font-medium" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}>
              {t("notifications.unread")}
            </button>
            <button onClick={() => setShowAll(true)} className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${showAll ? "bg-white/[0.08] text-white font-medium" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"}`}>
              {t("reminders.all")}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] mb-3">
                  <Bell size={18} strokeWidth={1.5} className="text-white/20" />
                </div>
                <p className="text-[14px] text-white/30">{t("notifications.empty")}</p>
              </div>
            ) : (
              displayed.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.read) handleMarkRead(n.id); }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] border-b border-white/[0.03] last:border-0 ${!n.read ? "bg-white/[0.02]" : ""}`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${!n.read ? "bg-white/[0.08]" : "bg-white/[0.04]"}`}>
                    <Clock size={13} strokeWidth={1.8} className={!n.read ? "text-white/60" : "text-white/25"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] leading-snug truncate ${!n.read ? "text-white font-medium" : "text-white/50"}`}>{n.title}</p>
                    {n.body && <p className="text-[13px] text-white/30 mt-0.5 truncate">{n.body}</p>}
                    <p className="text-[11px] text-white/20 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-white/60" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
