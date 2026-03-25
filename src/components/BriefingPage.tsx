"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft, RefreshCw, Cloud, Clock, CalendarDays,
  MapPin, Wind, Droplets, Bell, Settings2,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { getBriefing, getBriefingSettings, updateBriefingSettings, BriefingData } from "@/lib/api-client";
import MiraTimePicker from "./ui/MiraTimePicker";

interface BriefingPageProps {
  onBack: () => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return ""; }
}

function tDay(key: string): string {
  const k = `weather.${key}`;
  const v = t(k);
  return v !== k ? v : key;
}

function tCondition(key: string): string {
  const k = `weather.${key}`;
  const v = t(k);
  return v !== k ? v : key;
}

export default function BriefingPage({ onBack }: BriefingPageProps) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [briefingEnabled, setBriefingEnabled] = useState(false);
  const [briefingTime, setBriefingTime] = useState("08:00");

  const loadData = async () => {
    const r = await getBriefing();
    if (r.ok) setData(r.data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    getBriefingSettings().then(r => {
      if (r.ok) {
        setBriefingEnabled(r.data.enabled);
        setBriefingTime(r.data.time);
      }
    });
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleBriefing = async (enabled: boolean) => {
    setBriefingEnabled(enabled);
    await updateBriefingSettings({ enabled });
  };

  const handleTimeChange = async (time: string) => {
    setBriefingTime(time);
    await updateBriefingSettings({ time });
  };

  const now = new Date();
  const greeting = now.getHours() < 12 ? t("briefing.goodMorning") : now.getHours() < 18 ? t("briefing.goodAfternoon") : t("briefing.goodEvening");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
          <h1 className="text-[20px] font-medium text-white">{t("briefing.title")}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <RefreshCw size={16} strokeWidth={1.8} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${showSettings ? "text-white/60 bg-white/[0.06]" : "text-white/30 hover:text-white/60 hover:bg-white/[0.06]"}`}
          >
            <Settings2 size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Settings popover */}
      {showSettings && (
        <div className="mx-5 mb-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] text-white">{t("briefing.telegramDelivery")}</p>
              <p className="text-[12px] text-white/30">{t("briefing.telegramDesc")}</p>
            </div>
            <button
              onClick={() => toggleBriefing(!briefingEnabled)}
              className={`relative w-10 h-[22px] rounded-full transition-colors ${briefingEnabled ? "bg-white/20" : "bg-white/[0.08]"}`}
            >
              <span className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${briefingEnabled ? "left-[22px] bg-white" : "left-[3px] bg-white/40"}`} />
            </button>
          </div>
          {briefingEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-white/40">{t("briefing.deliveryTime")}</span>
              <MiraTimePicker value={briefingTime} onChange={handleTimeChange} className="w-[100px]" />
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="mira-orb" style={{ position: "relative" }} />
          </div>
        ) : data ? (
          <div className="space-y-5">
            {/* Greeting */}
            <p className="text-[15px] text-white/40 mt-2">{greeting}</p>

            {/* Weather */}
            {data.weather && (
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[13px] text-white/30">{data.weather.city}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-[36px] font-extralight text-white leading-none tracking-tighter">{Math.round(data.weather.temperature)}°</span>
                      <span className="text-[14px] text-white/40">{tCondition(data.weather.description)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[12px] text-white/25">
                      <span className="flex items-center gap-1"><Wind size={12} /> {data.weather.wind_speed} km/h</span>
                      {data.weather.humidity != null && <span className="flex items-center gap-1"><Droplets size={12} /> {data.weather.humidity}%</span>}
                    </div>
                  </div>
                  <span className="text-[40px] leading-none select-none">{data.weather.icon}</span>
                </div>
                {/* Forecast */}
                {data.weather.forecast.length > 1 && (
                  <div className="flex gap-3 mt-3 pt-3 border-t border-white/[0.05] overflow-x-auto">
                    {data.weather.forecast.slice(0, 5).map((day, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 min-w-[48px]">
                        <span className="text-[11px] text-white/25">{tDay(day.day)}</span>
                        <span className="text-[16px] select-none">{day.icon}</span>
                        <span className="text-[12px] text-white/50">{Math.round(day.temp_max)}°</span>
                        <span className="text-[11px] text-white/20">{Math.round(day.temp_min)}°</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Today's Schedule */}
            {(data.reminders.length > 0 || data.events.length > 0) && (
              <div>
                <h3 className="text-[13px] font-medium text-white/30 uppercase tracking-wide mb-2">{t("briefing.today")}</h3>
                <div className="space-y-1">
                  {data.events.map(ev => (
                    <div key={ev.id} className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                      <CalendarDays size={15} strokeWidth={1.8} className="text-white/20 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-white">{ev.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[12px] text-white/30">{formatTime(ev.start_at)}{ev.end_at ? ` — ${formatTime(ev.end_at)}` : ""}</span>
                          {ev.location && <span className="flex items-center gap-0.5 text-[12px] text-white/20"><MapPin size={10} /> {ev.location}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.reminders.map(rem => (
                    <div key={rem.id} className="flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                      <Bell size={15} strokeWidth={1.8} className="text-white/20 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-white">{rem.title}</p>
                        <span className="text-[12px] text-white/30">{formatTime(rem.remind_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {data.reminders.length === 0 && data.events.length === 0 && (
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-6 text-center">
                <p className="text-[14px] text-white/30">{t("briefing.noEvents")}</p>
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-2">
              {[
                { label: t("briefing.reminders"), value: data.stats.total_reminders_pending },
                { label: t("briefing.thisWeek"), value: data.stats.total_events_this_week },
                { label: t("briefing.memories"), value: data.stats.memories_saved },
              ].filter(s => s.value > 0).map((s, i) => (
                <div key={i} className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5 text-center">
                  <p className="text-[18px] font-light text-white">{s.value}</p>
                  <p className="text-[11px] text-white/20 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-[14px] text-white/30">{t("briefing.loadError")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
