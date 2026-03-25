"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface WeatherCardProps {
  city: string;
  summary: string;
  forecast: Array<{ day: string; temp: string; icon: string; temp_max?: number; temp_min?: number; precip_prob?: number }>;
  hourly: Array<{ time: string; temp: number; icon: string; precip?: number | null }>;
  wind: string;
  windGusts: string;
  feelsLike: string;
  humidity: string;
  uvIndex: number | null;
  precipProb: string;
  sunrise: string;
  sunset: string;
}

function toF(c: number): number { return Math.round(c * 9 / 5 + 32); }
function tDay(key: string): string {
  const k = `weather.${key}`;
  const v = t(k);
  return v !== k ? v : key;
}
function convertTemp(val: string, f: boolean): string {
  if (!f) return val;
  return val.replace(/([+-]?\d+)(°C?)/g, (_, n) => `${toF(Number(n))}°`);
}

export default function WeatherCard(props: WeatherCardProps) {
  const [useFahrenheit, setUseFahrenheit] = useState(false);
  const f = useFahrenheit;

  const tempMatch = props.summary.match(/([+-]?\d+)°/);
  const rawTemp = tempMatch ? Number(tempMatch[1]) : 0;
  const currentTemp = f ? `${toF(rawTemp)}°` : `${rawTemp}°`;
  const rawCond = props.summary.replace(/[+-]?\d+°C?,?\s*/, "").trim();
  const condKey = `weather.${rawCond}`;
  const conditions = t(condKey) !== condKey ? t(condKey) : rawCond;
  const mainIcon = props.forecast[0]?.icon || "🌤️";
  const uvLabel = props.uvIndex != null ? (props.uvIndex <= 2 ? t("weather.uvLow") : props.uvIndex <= 5 ? t("weather.uvModerate") : props.uvIndex <= 7 ? t("weather.uvHigh") : t("weather.uvVeryHigh")) : "";

  // Hourly temps for curve
  const temps = props.hourly.map(h => f ? toF(h.temp) : h.temp);
  const minT = Math.min(...temps, 0);
  const maxT = Math.max(...temps, 1);
  const range = maxT - minT || 1;

  // SVG curve
  const W = Math.max(props.hourly.length * 56, 400);
  const H = 60;
  const PAD = 12;
  const points = temps.map((t, i) => ({
    x: PAD + (i / Math.max(temps.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - (t - minT) / range) * (H - PAD * 2),
    t,
  }));

  // Smooth path
  let path = "";
  if (points.length > 1) {
    path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      path += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
  }

  return (
    <div className="px-5 pb-5 pt-1">
      {/* Hero + unit toggle */}
      <div className="flex items-start justify-between">
        <div>
          {props.city && <p className="text-[14px] text-white/40 mb-0.5">{props.city}</p>}
          <div className="flex items-baseline gap-2">
            <span className="text-[48px] font-extralight text-white leading-none tracking-tighter">{currentTemp}</span>
            <button
              onClick={() => setUseFahrenheit(!f)}
              className="text-[14px] text-white/30 hover:text-white/60 transition-colors"
            >
              °C | °F
            </button>
          </div>
          <p className="text-[15px] text-white/50 mt-1">{conditions}</p>
          <p className="text-[13px] text-white/30 mt-0.5">
            {convertTemp(props.feelsLike, f) && `${t("weather.feelsLike")} ${convertTemp(props.feelsLike, f)}`}
          </p>
        </div>
        <span className="text-[52px] leading-none mt-1 select-none">{mainIcon}</span>
      </div>

      {/* Detail pills */}
      <div className="flex gap-2 mt-4 overflow-x-auto">
        {[
          props.wind && { l: t("weather.wind"), v: props.wind },
          props.humidity && { l: t("weather.humidity"), v: props.humidity },
          props.precipProb && { l: t("weather.precip"), v: props.precipProb },
          props.uvIndex != null && { l: t("weather.uv"), v: `${props.uvIndex} · ${uvLabel}` },
          props.sunrise && props.sunset && { l: "☀", v: `${props.sunrise} — ${props.sunset}` },
        ].filter(Boolean).map((item, i) => {
          const d = item as { l: string; v: string };
          return (
            <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 shrink-0">
              <span className="text-[12px] text-white/25">{d.l}</span>
              <span className="text-[13px] text-white/70">{d.v}</span>
            </div>
          );
        })}
      </div>

      {/* Hourly temperature curve */}
      {props.hourly.length > 1 && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <div className="overflow-x-auto -mx-2 px-2">
            <div style={{ width: W, minWidth: W }}>
              {/* Curve SVG */}
              <svg width={W} height={H} className="block">
                {/* Gradient fill under curve */}
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {path && (
                  <>
                    <path
                      d={`${path} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`}
                      fill="url(#tempGrad)"
                    />
                    <path d={path} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                  </>
                )}
                {/* Dots + temp labels */}
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="2.5" fill="rgba(255,255,255,0.5)" />
                    <text x={p.x} y={p.y - 8} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11" fontWeight="500">
                      {p.t}°
                    </text>
                  </g>
                ))}
              </svg>
              {/* Time labels */}
              <div className="flex" style={{ width: W }}>
                {props.hourly.map((h, i) => (
                  <div key={i} className="text-center" style={{ width: W / props.hourly.length }}>
                    <span className="text-[11px] text-white/25">{h.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5-day forecast */}
      {props.forecast.length > 1 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="space-y-0">
            {props.forecast.map((day, i) => {
              const hi = day.temp_max != null ? (f ? toF(day.temp_max) : Math.round(day.temp_max)) : null;
              const lo = day.temp_min != null ? (f ? toF(day.temp_min) : Math.round(day.temp_min)) : null;
              return (
                <div key={i} className="flex items-center gap-3 py-2 px-1 -mx-1 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <span className={`text-[14px] w-16 shrink-0 ${i === 0 ? "text-white font-medium" : "text-white/40"}`}>{tDay(day.day)}</span>
                  <span className="text-[18px] leading-none shrink-0 select-none">{day.icon}</span>
                  {day.precip_prob != null && day.precip_prob > 0 ? (
                    <span className="text-[12px] text-white/20 w-8 shrink-0">{day.precip_prob}%</span>
                  ) : <span className="w-8 shrink-0" />}
                  <div className="flex-1 flex items-center gap-2 justify-end">
                    {hi != null && lo != null ? (
                      <>
                        <span className="text-[14px] text-white/30 w-8 text-right">{lo}°</span>
                        <div className="w-20 h-[3px] rounded-full bg-white/[0.06] overflow-hidden relative">
                          <div
                            className="absolute h-full rounded-full bg-white/20"
                            style={{
                              left: `${Math.max(0, (((day.temp_min ?? 0) + 20) / 60) * 100)}%`,
                              right: `${Math.max(0, 100 - (((day.temp_max ?? 0) + 20) / 60) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[14px] text-white w-8">{hi}°</span>
                      </>
                    ) : (
                      <span className="text-[14px] text-white">{f ? convertTemp(day.temp, true) : day.temp}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
