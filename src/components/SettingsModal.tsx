"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, User, Palette, Bell, Shield, Keyboard, CalendarDays, ChevronRight, Copy, Check, ExternalLink, Camera, Settings2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import TelegramLinkModal from "./TelegramLinkModal";

interface SettingsModalProps {
  onClose: () => void;
}

const TAB_KEYS = ["profile", "general", "appearance", "notifications", "calendar", "privacy", "shortcuts"] as const;
type TabId = (typeof TAB_KEYS)[number];

const TABS: { id: TabId; labelKey: string; icon: typeof User }[] = [
  { id: "profile", labelKey: "settings.profile", icon: User },
  { id: "general", labelKey: "settings.general", icon: Settings2 },
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

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [fullName, setFullName] = useState(user?.name || "");
  const [language, setLanguage] = useState(user?.language || "ru");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showSaved = () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;

      // Crop to square center, then draw at 64x64
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 64, 64);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      setAvatarPreview(dataUrl);
      updateUser({ avatar_url: dataUrl });
      showSaved();
    };
    img.src = objectUrl;
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    updateUser({ avatar_url: "" });
    showSaved();
  };

  const handleDisplayNameBlur = () => {
    const trimmed = displayName.trim();
    if (trimmed !== (user?.display_name || "")) {
      updateUser({ display_name: trimmed || undefined });
      showSaved();
    }
  };

  const handleFullNameBlur = () => {
    const trimmed = fullName.trim();
    if (trimmed && trimmed !== user?.name) {
      updateUser({ name: trimmed });
      showSaved();
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    updateUser({ language: lang });
  };

  const userInitial = (user?.display_name || user?.name || "U").charAt(0).toUpperCase();

  return (
    <div>
      {/* Saved indicator */}
      {saved && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 rounded-full bg-[#2a2a2a] border border-white/[0.08] px-4 py-2 text-[13px] text-white/70">
          <Check size={14} className="text-green-400/80" />
          {t("settings.profileSaved")}
        </div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-5 pb-6 border-b border-white/[0.04]">
        <div className="relative group">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-white/[0.08] flex items-center justify-center shrink-0">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[22px] font-medium text-white/60">{userInitial}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <Camera size={18} className="text-white/80" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[13px] text-white/60 hover:text-white transition-colors text-left"
          >
            {t("settings.profilePhotoChange")}
          </button>
          {avatarPreview && (
            <button
              onClick={handleRemoveAvatar}
              className="text-[13px] text-white/30 hover:text-red-400/70 transition-colors text-left"
            >
              {t("settings.profilePhotoRemove")}
            </button>
          )}
        </div>
      </div>

      {/* Display name */}
      <div className="py-4 border-b border-white/[0.04]">
        <label className="block text-[16px] text-white mb-0.5">{t("settings.displayName")}</label>
        <p className="text-[13px] text-white/40 mb-2">{t("settings.displayNameDesc")}</p>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={handleDisplayNameBlur}
          placeholder={user?.name || ""}
          maxLength={64}
          className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2.5 text-[16px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
        />
      </div>

      {/* Full name */}
      <div className="py-4 border-b border-white/[0.04]">
        <label className="block text-[16px] text-white mb-2">{t("settings.fullName")}</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={handleFullNameBlur}
          maxLength={128}
          className="w-full rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2.5 text-[16px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
        />
      </div>

      {/* Email (read-only) */}
      <SettingRow label={t("settings.email")}>
        <span className="text-[16px] text-white/50">{user?.email || "—"}</span>
      </SettingRow>

      {/* Phone (read-only) */}
      <SettingRow label={t("settings.phone")}>
        <span className="text-[16px] text-white/50">{user?.phone || "—"}</span>
      </SettingRow>

      {/* Language */}
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
    </div>
  );
}

function GeneralTab() {
  const [archiveChats, setArchiveChats] = useState(true);

  return (
    <div>
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
  const [loading, setLoading] = useState<string | null>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  // OAuth providers that have two-way sync (server-side connection state)
  const oauthProviders = ["google", "outlook", "yandex"];

  useEffect(() => {
    import("@/lib/api-client").then(({ getCalendarProviderStatus }) => {
      // Check connection status for all OAuth providers
      for (const p of oauthProviders) {
        getCalendarProviderStatus(p).then(r => {
          if (r.ok && r.data.connected) setConnected(prev => ({ ...prev, [p]: true }));
        });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureFeedUrl = async (): Promise<string | null> => {
    if (feedUrl) return feedUrl;
    const { generateCalendarFeedToken } = await import("@/lib/api-client");
    const r = await generateCalendarFeedToken();
    if (r.ok) { setFeedUrl(r.data.url); return r.data.url; }
    return null;
  };

  const handleConnect = async (app: string) => {
    setLoading(app);

    if (oauthProviders.includes(app)) {
      // OAuth flow — opens popup, user authorizes, we get tokens
      const { getCalendarAuthUrl } = await import("@/lib/api-client");
      const r = await getCalendarAuthUrl(app);
      if (r.ok && r.data.url) {
        const popup = window.open(r.data.url, `cal_${app}`, "width=500,height=600");
        const handler = (e: MessageEvent) => {
          if (e.data?.type === "calendar_connected" && e.data?.provider === app) {
            setConnected(prev => ({ ...prev, [app]: true }));
            setLoading(null);
            window.removeEventListener("message", handler);
            popup?.close();
          }
        };
        window.addEventListener("message", handler);
        setTimeout(() => { setLoading(null); window.removeEventListener("message", handler); }, 120000);
      } else { setLoading(null); }
      return;
    }

    // Apple — ICS feed (no OAuth available)
    const url = await ensureFeedUrl();
    if (!url) { setLoading(null); return; }
    window.location.href = url.replace(/^https?:\/\//, "webcal://");
    setConnected(prev => ({ ...prev, [app]: true }));
    setLoading(null);
  };

  const handleDisconnect = async (app: string) => {
    const { disconnectCalendarProvider } = await import("@/lib/api-client");
    await disconnectCalendarProvider(app);
    setConnected(prev => ({ ...prev, [app]: false }));
  };

  const calApps = [
    { id: "google", name: "Google Calendar", oauth: true },
    { id: "outlook", name: "Outlook", oauth: true },
    { id: "yandex", name: t("settings.yandexCalendar"), oauth: true },
    { id: "apple", name: "Apple Calendar", oauth: false },
  ];

  return (
    <div>
      <p className="text-[13px] text-white/40 mb-4">{t("settings.calendarFeedDesc")}</p>
      <div className="space-y-1">
        {calApps.map(app => {
          const isConnected = connected[app.id];
          const isLoading = loading === app.id;

          return (
            <div key={app.id} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
              <div className="flex-1 min-w-0">
                <span className="text-[15px] text-white">{app.name}</span>
              </div>
              {isConnected ? (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[13px] text-green-400/60">
                    <Check size={13} /> {t("settings.googleConnected")}
                  </span>
                  <button
                    onClick={() => handleDisconnect(app.id)}
                    className="text-[13px] text-white/20 hover:text-red-400/60 transition-colors"
                  >
                    {t("settings.googleDisconnect")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(app.id)}
                  disabled={isLoading}
                  className="rounded-lg bg-white/[0.06] border border-white/[0.08] px-3.5 py-1.5 text-[13px] text-white/70 hover:text-white hover:bg-white/[0.1] transition-colors disabled:opacity-40"
                >
                  {isLoading ? "..." : t("settings.googleConnect")}
                </button>
              )}
            </div>
          );
        })}
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

// Menu sections for mobile drill-down view — grouped like the Claude reference
const MENU_SECTIONS: { items: TabId[]; }[] = [
  { items: ["profile"] },
  { items: ["general", "appearance"] },
  { items: ["notifications", "calendar"] },
  { items: ["privacy", "shortcuts"] },
];

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [mobileSubPage, setMobileSubPage] = useState<TabId | null>(null);
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileSubPage) {
          setMobileSubPage(null);
        } else {
          setVisible(false);
          setTimeout(onClose, 250);
        }
      }
    },
    [onClose, mobileSubPage]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  const renderTab = (tabId?: TabId) => {
    switch (tabId || activeTab) {
      case "profile": return <ProfileTab />;
      case "general": return <GeneralTab />;
      case "appearance": return <AppearanceTab />;
      case "notifications": return <NotificationsTab />;
      case "calendar": return <CalendarTab />;
      case "privacy": return <PrivacyTab />;
      case "shortcuts": return <ShortcutsTab />;
    }
  };

  const mobileTitle = mobileSubPage
    ? t(TABS.find((tab) => tab.id === mobileSubPage)?.labelKey || "")
    : t("settings.title");

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:px-4 transition-all duration-250 ${
        visible ? "bg-black/60 sm:backdrop-blur-sm" : "bg-black/0"
      }`}
    >
      <div
        ref={modalRef}
        className={`w-full max-h-[85vh] sm:max-h-none sm:max-w-[680px] sm:h-[480px] flex flex-col sm:flex-row rounded-t-2xl sm:rounded-2xl bg-[#1a1a1a] border-t border-white/[0.06] sm:border sm:border-white/[0.06] sm:shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-250 ${
          visible ? "opacity-100 translate-y-0 sm:scale-100" : "opacity-0 translate-y-8 sm:translate-y-0 sm:scale-95"
        }`}
      >
        {/* ═══ MOBILE LAYOUT ═══ */}
        <div className="flex flex-col flex-1 min-h-0 sm:hidden">
          {/* Mobile header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <button
              onClick={mobileSubPage ? () => setMobileSubPage(null) : handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white"
            >
              {mobileSubPage ? <ArrowLeft size={18} /> : <X size={18} />}
            </button>
            <h2 className="text-[17px] font-semibold text-white absolute left-1/2 -translate-x-1/2">
              {mobileTitle}
            </h2>
            <div className="w-10" />
          </div>

          {/* Mobile content — menu list or sub-page */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {mobileSubPage === null ? (
              /* ── Menu list ── */
              <div className="px-4 pb-8">
                {/* User email pill */}
                {(user?.email || user?.phone) && (
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 mb-4">
                    <span className="text-[15px] text-white/70">{user.email || user.phone}</span>
                  </div>
                )}

                {MENU_SECTIONS.map((section, si) => (
                  <div key={si} className={si > 0 ? "mt-2 pt-2 border-t border-white/[0.06]" : ""}>
                    {section.items.map((tabId) => {
                      const tab = TABS.find((t) => t.id === tabId)!;
                      return (
                        <button
                          key={tabId}
                          onClick={() => setMobileSubPage(tabId)}
                          className="flex w-full items-center gap-4 px-1 py-3.5 text-left active:bg-white/[0.04] transition-colors rounded-lg"
                        >
                          <tab.icon size={20} strokeWidth={1.6} className="text-white/50 shrink-0" />
                          <span className="flex-1 text-[16px] text-white">{t(tab.labelKey)}</span>
                          <ChevronRight size={18} className="text-white/25 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              /* ── Sub-page content ── */
              <div className="px-4 pb-8">
                {renderTab(mobileSubPage)}
              </div>
            )}
          </div>
        </div>

        {/* ═══ DESKTOP LAYOUT (unchanged) ═══ */}
        {/* Left: tab navigation */}
        <div className="hidden sm:flex w-[220px] shrink-0 border-r border-white/[0.06] p-3 flex-col">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-[18px] font-medium text-white">{t("settings.title")}</h2>
            <button
              onClick={handleClose}
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
        <div className="hidden sm:block flex-1 p-6 overflow-y-auto">
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
