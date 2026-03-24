"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, Clock, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { getAccessToken } from "@/lib/api-client";

const PROXY_URL = "/api/proxy";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  reminder_id: string | null;
  created_at: string;
}

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${PROXY_URL}/notifications?limit=20`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // silently fail — bell still shows, just no data
    }
  }, []);

  // Poll every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    // Delay to avoid closing on the same click that opened it
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [isOpen]);

  const markRead = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await fetch(`${PROXY_URL}/notifications/${id}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });
    } catch {}
  };

  const markAllRead = async () => {
    const token = getAccessToken();
    if (!token) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await fetch(`${PROXY_URL}/notifications/read-all`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });
    } catch {}
  };

  const displayed = showAll ? notifications : notifications.filter((n) => !n.read);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
        title={t("notifications.title")}
      >
        <Bell size={18} strokeWidth={1.8} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-[#161616] leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] flex flex-col rounded-2xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-50 overflow-hidden mira-fade-in"
        >
          {/* Header */}
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
                <button
                  onClick={markAllRead}
                  className="rounded-lg px-2.5 py-1.5 text-[12px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  {t("notifications.markAllRead")}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-0.5 px-3 py-2 border-b border-white/[0.04]">
            <button
              onClick={() => setShowAll(false)}
              className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                !showAll ? "bg-white/[0.08] text-white font-medium" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              {t("notifications.unread")}
            </button>
            <button
              onClick={() => setShowAll(true)}
              className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                showAll ? "bg-white/[0.08] text-white font-medium" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              {t("reminders.all")}
            </button>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] mb-3">
                  <Bell size={18} strokeWidth={1.5} className="text-white/20" />
                </div>
                <p className="text-[14px] text-white/30">{t("notifications.empty")}</p>
              </div>
            ) : (
              displayed.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.read) markRead(notification.id);
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] border-b border-white/[0.03] last:border-0 ${
                    !notification.read ? "bg-white/[0.02]" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    !notification.read ? "bg-white/[0.08]" : "bg-white/[0.04]"
                  }`}>
                    {notification.type === "reminder" ? (
                      <Clock size={13} strokeWidth={1.8} className={!notification.read ? "text-white/60" : "text-white/25"} />
                    ) : (
                      <Bell size={13} strokeWidth={1.8} className={!notification.read ? "text-white/60" : "text-white/25"} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] leading-snug truncate ${
                      !notification.read ? "text-white font-medium" : "text-white/50"
                    }`}>
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="text-[13px] text-white/30 mt-0.5 truncate">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-[11px] text-white/20 mt-1">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {!notification.read && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-white/60" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
