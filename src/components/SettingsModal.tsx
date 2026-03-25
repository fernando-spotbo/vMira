"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, User, Palette, Bell, Shield, Keyboard, CalendarDays, ChevronRight, Copy, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import TelegramLinkModal from "./TelegramLinkModal";

interface SettingsModalProps {
  onClose: () => void;
}

const TAB_KEYS = ["general", "appearance", "notifications", "calendar", "privacy", "shortcuts"] as const;
type TabId = (typeof TAB_KEYS)[number];

const TABS: { id: TabId; labelKey: string; icon: typeof User }[] = [
  { id: "general", labelKey: "settings.general", icon: User },
  { id: "appearance", labelKey: "settings.appearance", icon: Palette },
  { id: "notifications", labelKey: "settings.notifications", icon: Bell },
  { id: "calendar", labelKey: "settings.calendar", icon: CalendarDays },
  { id: "privacy", labelKey: "settings.privacy", icon: Shield },
  { id: "shortcuts", labelKey: "settings.shortcuts", icon: Keyboard },
];

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
        enabled ? "bg-white/30" : "bg-white/[0.08]"
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 mr-4">
        <div className="text-[16px] text-white">{label}</div>
        {description && <div className="text-[13px] text-white/50 mt-0.5">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function SelectField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-[16px] text-white focus:outline-none focus:border-white/[0.15] transition-colors appearance-none cursor-pointer pr-8"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-white">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function GeneralTab() {
  const { user, updateUser } = useAuth();
  const [language, setLanguage] = useState(user?.language || "ru");
  const [archiveChats, setArchiveChats] = useState(true);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    updateUser({ language: lang });
  };

  return (
    <div>
      <SettingRow label={t("settings.language")}>
        <SelectField
          value={language}
          onChange={handleLanguageChange}
          options={[
            { value: "ru", label: "Русский" },
            { value: "en", label: "English" },
          ]}
        />
      </SettingRow>
      <SettingRow label={t("settings.archiveChats")} description={t("settings.archiveDesc")}>
        <ToggleSwitch enabled={archiveChats} onToggle={() => setArchiveChats(!archiveChats)} />
      </SettingRow>
      <SettingRow label={t("settings.deleteAll")} description={t("settings.deleteAllDesc")}>
        <button className="rounded-lg border border-red-500/30 px-4 py-2 text-[16px] text-red-400 hover:bg-red-500/10 transition-colors">
          {t("settings.deleteAllBtn")}
        </button>
      </SettingRow>
    </div>
  );
}

function AppearanceTab() {
  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState("default");

  return (
    <div>
      <SettingRow label={t("settings.theme")}>
        <SelectField
          value={theme}
          onChange={setTheme}
          options={[
            { value: "dark", label: t("settings.themeDark") },
            { value: "light", label: t("settings.themeLight") },
            { value: "system", label: t("settings.themeSystem") },
          ]}
        />
      </SettingRow>
      <SettingRow label={t("settings.fontSize")}>
        <SelectField
          value={fontSize}
          onChange={setFontSize}
          options={[
            { value: "small", label: t("settings.fontSmall") },
            { value: "default", label: t("settings.fontDefault") },
            { value: "large", label: t("settings.fontLarge") },
          ]}
        />
      </SettingRow>
    </div>
  );
}

const TIMEZONE_OPTIONS = [
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
  { value: "Europe/Samara", label: "Самара (UTC+4)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { value: "Asia/Omsk", label: "Омск (UTC+6)" },
  { value: "Asia/Novosibirsk", label: "Новосибирск (UTC+7)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { value: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { value: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { value: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { value: "Asia/Magadan", label: "Магадан (UTC+11)" },
  { value: "Asia/Kamchatka", label: "Камчатка (UTC+12)" },
];

function NotificationsTab() {
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [soundNotifs, setSoundNotifs] = useState(false);
  const [timezone, setTimezone] = useState("Europe/Moscow");
  const [loaded, setLoaded] = useState(false);

  // Telegram linking state
  const [tgLinked, setTgLinked] = useState(false);
  const [tgUsername, setTgUsername] = useState<string | null>(null);
  const [tgModalOpen, setTgModalOpen] = useState(false);

  // Load settings + Telegram status
  const refreshTgStatus = async () => {
    try {
      const { getTelegramStatus } = await import("@/lib/api-client");
      const tgResult = await getTelegramStatus();
      if (tgResult.ok) {
        setTgLinked(tgResult.data.linked);
        setTgUsername(tgResult.data.username);
      }
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const { getNotificationSettings } = await import("@/lib/api-client");
        const settingsResult = await getNotificationSettings();
        if (settingsResult.ok) {
          setEmailNotifs(settingsResult.data.email_enabled ?? false);
          setTelegramEnabled(settingsResult.data.telegram_enabled ?? false);
          setTimezone(settingsResult.data.timezone ?? "Europe/Moscow");
        }
        await refreshTgStatus();
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    })();
  }, []);

  const saveSettings = async (updates: Record<string, unknown>) => {
    try {
      const { updateNotificationSettings } = await import("@/lib/api-client");
      await updateNotificationSettings(updates as any);
    } catch {}
  };

  const handleEmailToggle = () => {
    const next = !emailNotifs;
    setEmailNotifs(next);
    saveSettings({ email_enabled: next });
  };

  const handleTelegramToggle = () => {
    const next = !telegramEnabled;
    setTelegramEnabled(next);
    saveSettings({ telegram_enabled: next });
  };

  const handleTimezone = (tz: string) => {
    setTimezone(tz);
    saveSettings({ timezone: tz });
  };

  const handleTgModalClose = () => {
    setTgModalOpen(false);
    refreshTgStatus();
  };

  return (
    <div>
      <SettingRow label={t("settings.timezone") || "Часовой пояс"} description={t("settings.timezoneDesc") || "Для корректного времени напоминаний"}>
        <SelectField value={timezone} onChange={handleTimezone} options={TIMEZONE_OPTIONS} />
      </SettingRow>
      <SettingRow label={t("settings.emailNotifs")} description={t("settings.emailNotifsDesc")}>
        <ToggleSwitch enabled={emailNotifs} onToggle={handleEmailToggle} />
      </SettingRow>
      <SettingRow label={t("settings.sound") || "Звук"} description={t("settings.soundDesc") || "Звук при получении уведомления"}>
        <ToggleSwitch enabled={soundNotifs} onToggle={() => setSoundNotifs(!soundNotifs)} />
      </SettingRow>
      {/* Telegram — single-click opens modal */}
      <SettingRow
        label={t("settings.telegramConnect")}
        description={tgLinked ? `${t("settings.telegramConnected")}${tgUsername ? ` · @${tgUsername}` : ""}` : t("settings.telegramDesc")}
      >
        <button
          onClick={() => setTgModalOpen(true)}
          className={`rounded-lg border px-4 py-2 text-[14px] transition-colors ${
            tgLinked
              ? "border-white/[0.08] text-white/50 hover:bg-white/[0.06]"
              : "border-white/[0.08] text-white hover:bg-white/[0.06]"
          }`}
        >
          {tgLinked ? t("settings.telegramSettings.btn") : t("settings.telegramConnect.btn")}
        </button>
      </SettingRow>
      {tgLinked && (
        <SettingRow label={t("settings.telegramNotifs")} description={t("settings.telegramNotifsDesc")}>
          <ToggleSwitch enabled={telegramEnabled} onToggle={handleTelegramToggle} />
        </SettingRow>
      )}
      {tgModalOpen && (
        <TelegramLinkModal onClose={handleTgModalClose} onLinked={() => { setTgLinked(true); refreshTgStatus(); }} />
      )}
    </div>
  );
}

function CalendarTab() {
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedActive, setFeedActive] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    import("@/lib/api-client").then(({ getCalendarFeedStatus, getGoogleCalendarStatus }) => {
      getCalendarFeedStatus().then(r => { if (r.ok) setFeedActive(r.data.active); });
      getGoogleCalendarStatus().then(r => { if (r.ok) setGoogleConnected(r.data.connected); });
    });
  }, []);

  const handleGenerateFeed = async () => {
    setFeedLoading(true);
    const { generateCalendarFeedToken } = await import("@/lib/api-client");
    const r = await generateCalendarFeedToken();
    if (r.ok) {
      setFeedUrl(r.data.url);
      setFeedActive(true);
    }
    setFeedLoading(false);
  };

  const handleRevokeFeed = async () => {
    const { revokeCalendarFeedToken } = await import("@/lib/api-client");
    await revokeCalendarFeedToken();
    setFeedUrl(null);
    setFeedActive(false);
  };

  const handleCopyFeed = () => {
    if (feedUrl) {
      navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    const { getGoogleCalendarAuthUrl } = await import("@/lib/api-client");
    const r = await getGoogleCalendarAuthUrl();
    if (r.ok && r.data.url) {
      const popup = window.open(r.data.url, "google_calendar", "width=500,height=600");
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "google_calendar_connected") {
          setGoogleConnected(true);
          setGoogleLoading(false);
          window.removeEventListener("message", handler);
          popup?.close();
        }
      };
      window.addEventListener("message", handler);
      // Fallback timeout
      setTimeout(() => { setGoogleLoading(false); window.removeEventListener("message", handler); }, 120000);
    } else {
      setGoogleLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    const { disconnectGoogleCalendar } = await import("@/lib/api-client");
    await disconnectGoogleCalendar();
    setGoogleConnected(false);
  };

  return (
    <div className="space-y-6">
      {/* ICS Feed */}
      <div>
        <h4 className="text-[15px] font-medium text-white mb-1">{t("settings.calendarFeed")}</h4>
        <p className="text-[13px] text-white/40 mb-3">{t("settings.calendarFeedDesc")}</p>

        {feedUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={feedUrl}
                className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-[13px] text-white/60 font-mono truncate focus:outline-none"
              />
              <button
                onClick={handleCopyFeed}
                className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-[13px] text-white/60 hover:text-white hover:bg-white/[0.1] transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t("settings.feedUrlCopied") : "Copy"}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleGenerateFeed} className="text-[13px] text-white/40 hover:text-white/60 transition-colors">
                {t("settings.regenerateFeedUrl")}
              </button>
              <button onClick={handleRevokeFeed} className="text-[13px] text-red-400/60 hover:text-red-400 transition-colors">
                {t("settings.revokeFeedUrl")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateFeed}
              disabled={feedLoading}
              className="rounded-lg bg-white/[0.06] border border-white/[0.08] px-4 py-2.5 text-[14px] text-white hover:bg-white/[0.1] transition-colors disabled:opacity-40"
            >
              {feedLoading ? "..." : feedActive ? t("settings.regenerateFeedUrl") : t("settings.generateFeedUrl")}
            </button>
            {feedActive && !feedUrl && (
              <span className="text-[13px] text-white/30">{t("settings.googleConnected")}</span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* Google Calendar */}
      <div>
        <h4 className="text-[15px] font-medium text-white mb-1">{t("settings.googleCalendar")}</h4>
        {googleConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-green-400/70">{t("settings.googleConnected")}</span>
            <button
              onClick={handleGoogleDisconnect}
              className="text-[13px] text-red-400/60 hover:text-red-400 transition-colors"
            >
              {t("settings.googleDisconnect")}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGoogleConnect}
            disabled={googleLoading}
            className="flex items-center gap-2 rounded-lg bg-white/[0.06] border border-white/[0.08] px-4 py-2.5 text-[14px] text-white hover:bg-white/[0.1] transition-colors disabled:opacity-40"
          >
            <ExternalLink size={14} strokeWidth={1.8} />
            {googleLoading ? "..." : t("settings.googleConnect")}
          </button>
        )}
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* Yandex Calendar (placeholder) */}
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-[15px] font-medium text-white/40">{t("settings.yandexCalendar")}</h4>
          <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/25">{t("settings.comingSoon")}</span>
        </div>
      </div>
    </div>
  );
}

function PrivacyTab() {
  const [saveHistory, setSaveHistory] = useState(true);
  const [shareData, setShareData] = useState(false);

  return (
    <div>
      <SettingRow label={t("settings.chatHistory")} description={t("settings.chatHistoryDesc")}>
        <ToggleSwitch enabled={saveHistory} onToggle={() => setSaveHistory(!saveHistory)} />
      </SettingRow>
      <SettingRow label={t("settings.improveMira")} description={t("settings.improveMiraDesc")}>
        <ToggleSwitch enabled={shareData} onToggle={() => setShareData(!shareData)} />
      </SettingRow>
    </div>
  );
}

function ShortcutsTab() {
  const shortcuts = [
    { keys: ["Ctrl", "N"], action: t("settings.newChat") },
    { keys: ["Ctrl", "K"], action: t("settings.searchChats") },
    { keys: ["Ctrl", "Shift", "S"], action: t("settings.toggleSidebar") },
    { keys: ["Ctrl", "/"], action: t("settings.showShortcuts") },
    { keys: ["Esc"], action: t("settings.closeModal") },
    { keys: ["Enter"], action: t("settings.sendMessage") },
    { keys: ["Shift", "Enter"], action: t("settings.newLine") },
  ];

  return (
    <div>
      {shortcuts.map((s) => (
        <div key={s.action} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
          <span className="text-[16px] text-white">{s.action}</span>
          <div className="flex items-center gap-1.5">
            {s.keys.map((key) => (
              <kbd
                key={key}
                className="rounded-md bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 text-[14px] text-white font-mono"
              >
                {key}
              </kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVisible(false);
        setTimeout(onClose, 250);
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setVisible(false);
      setTimeout(onClose, 250);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "general": return <GeneralTab />;
      case "appearance": return <AppearanceTab />;
      case "notifications": return <NotificationsTab />;
      case "calendar": return <CalendarTab />;
      case "privacy": return <PrivacyTab />;
      case "shortcuts": return <ShortcutsTab />;
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[200] flex items-center justify-center px-4 transition-all duration-250 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-[680px] h-[480px] flex rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-250 ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Left: tab navigation */}
        <div className="w-[220px] shrink-0 border-r border-white/[0.06] p-3 flex flex-col">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-[18px] font-medium text-white">{t("settings.title")}</h2>
            <button
              onClick={() => { setVisible(false); setTimeout(onClose, 250); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="space-y-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[16px] transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-white hover:bg-white/[0.06]"
                }`}
              >
                <tab.icon size={16} strokeWidth={1.8} />
                <span>{t(tab.labelKey)}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right: tab content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="text-lg font-medium text-white mb-1">
            {t(TABS.find((tab) => tab.id === activeTab)?.labelKey || "")}
          </h3>
          <div className="mt-4">
            {renderTab()}
          </div>
        </div>
      </div>
    </div>
  );
}
