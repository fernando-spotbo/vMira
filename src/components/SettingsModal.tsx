"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, User, Palette, Bell, Shield, Keyboard, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";

interface SettingsModalProps {
  onClose: () => void;
}

const TAB_KEYS = ["general", "appearance", "notifications", "privacy", "shortcuts"] as const;
type TabId = (typeof TAB_KEYS)[number];

const TABS: { id: TabId; labelKey: string; icon: typeof User }[] = [
  { id: "general", labelKey: "settings.general", icon: User },
  { id: "appearance", labelKey: "settings.appearance", icon: Palette },
  { id: "notifications", labelKey: "settings.notifications", icon: Bell },
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
  const [quietStart, setQuietStart] = useState("23:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [loaded, setLoaded] = useState(false);

  // Telegram linking state
  const [tgLinked, setTgLinked] = useState(false);
  const [tgUsername, setTgUsername] = useState<string | null>(null);
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);
  const [tgLoading, setTgLoading] = useState(false);

  // Load settings + Telegram status
  useEffect(() => {
    (async () => {
      try {
        const { getNotificationSettings, getTelegramStatus } = await import("@/lib/api-client");
        const [settingsResult, tgResult] = await Promise.all([
          getNotificationSettings(),
          getTelegramStatus(),
        ]);
        if (settingsResult.ok) {
          setEmailNotifs(settingsResult.data.email_enabled ?? false);
          setTelegramEnabled(settingsResult.data.telegram_enabled ?? false);
          setTimezone(settingsResult.data.timezone ?? "Europe/Moscow");
          setQuietStart(settingsResult.data.quiet_start ?? "23:00");
          setQuietEnd(settingsResult.data.quiet_end ?? "07:00");
        }
        if (tgResult.ok) {
          setTgLinked(tgResult.data.linked);
          setTgUsername(tgResult.data.username);
        }
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

  const handleQuietStart = (v: string) => {
    setQuietStart(v);
    saveSettings({ quiet_start: v });
  };

  const handleQuietEnd = (v: string) => {
    setQuietEnd(v);
    saveSettings({ quiet_end: v });
  };

  const handleConnectTelegram = async () => {
    setTgLoading(true);
    try {
      const { generateTelegramLinkToken } = await import("@/lib/api-client");
      const result = await generateTelegramLinkToken();
      if (result.ok) {
        setTgDeepLink(result.data.deep_link);
      }
    } catch {}
    setTgLoading(false);
  };

  const handleUnlinkTelegram = async () => {
    try {
      const { unlinkTelegram } = await import("@/lib/api-client");
      const result = await unlinkTelegram();
      if (result.ok) {
        setTgLinked(false);
        setTgUsername(null);
        setTgDeepLink(null);
        setTelegramEnabled(false);
      }
    } catch {}
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
      <SettingRow label={t("settings.quietHours") || "Тихие часы"} description={t("settings.quietHoursDesc") || "Не отправлять уведомления в это время"}>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={quietStart}
            onChange={(e) => handleQuietStart(e.target.value)}
            className="rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1.5 text-[14px] text-white focus:outline-none focus:border-white/[0.15] transition-colors [color-scheme:dark]"
          />
          <span className="text-[13px] text-white/30">—</span>
          <input
            type="time"
            value={quietEnd}
            onChange={(e) => handleQuietEnd(e.target.value)}
            className="rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1.5 text-[14px] text-white focus:outline-none focus:border-white/[0.15] transition-colors [color-scheme:dark]"
          />
        </div>
      </SettingRow>

      {/* Telegram section */}
      <div className="mt-2 pt-2 border-t border-white/[0.04]">
        {tgLinked ? (
          <>
            <SettingRow
              label="Telegram"
              description={`Подключен${tgUsername ? ` как @${tgUsername}` : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <button
                  onClick={handleUnlinkTelegram}
                  className="rounded-lg border border-red-500/20 px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Отвязать
                </button>
              </div>
            </SettingRow>
            <SettingRow
              label="Уведомления в Telegram"
              description="Напоминания будут приходить в Telegram"
            >
              <ToggleSwitch enabled={telegramEnabled} onToggle={handleTelegramToggle} />
            </SettingRow>
          </>
        ) : tgDeepLink ? (
          <div className="py-4">
            <p className="text-[14px] text-white/70 mb-3">
              Откройте ссылку для привязки Telegram:
            </p>
            <a
              href={tgDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#2AABEE]/10 border border-[#2AABEE]/20 px-4 py-2.5 text-[14px] text-[#2AABEE] hover:bg-[#2AABEE]/20 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Открыть в Telegram
            </a>
            <p className="text-[12px] text-white/30 mt-2">
              Ссылка действует 10 минут. После привязки обновите эту страницу.
            </p>
          </div>
        ) : (
          <SettingRow
            label="Telegram"
            description="Получайте напоминания и общайтесь с Мирой в Telegram"
          >
            <button
              onClick={handleConnectTelegram}
              disabled={tgLoading}
              className="rounded-lg border border-[#2AABEE]/30 bg-[#2AABEE]/10 px-4 py-2 text-[14px] text-[#2AABEE] hover:bg-[#2AABEE]/20 transition-colors disabled:opacity-50"
            >
              {tgLoading ? "..." : "Подключить"}
            </button>
          </SettingRow>
        )}
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
