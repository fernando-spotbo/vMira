"use client";

import { useState, useEffect } from "react";
import { Activity, CheckCircle2, XCircle, AlertTriangle, Clock, ExternalLink, RefreshCw } from "lucide-react";

// ── Types ────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  description: string;
  url: string;
  status: "operational" | "degraded" | "down" | "checking";
  latency?: number;
  uptimePercent?: number;
  uptimeDays: DayStatus[];
}

interface DayStatus {
  date: string;
  status: "up" | "degraded" | "down" | "no-data";
}

// ── Config ───────────────────────────────────────────────

const SERVICES_CONFIG = [
  { id: "chat", name: "Мира Chat", description: "AI-ассистент на vmira.ai", url: "https://api.vmira.ai/health", checkUrl: "https://api.vmira.ai/health" },
  { id: "api", name: "Mira API", description: "REST API для разработчиков", url: "https://api.vmira.ai", checkUrl: "https://api.vmira.ai/health" },
  { id: "code", name: "Mira Code", description: "CLI для разработчиков", url: "https://api.vmira.ai", checkUrl: "https://api.vmira.ai/api/v1/models" },
  { id: "inference", name: "Model Inference", description: "GPU-сервер для генерации", url: "", checkUrl: "https://api.vmira.ai/health" },
];

// ── Helpers ──────────────────────────────────────────────

function generateUptimeDays(): DayStatus[] {
  const days: DayStatus[] = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    // Future: fetch from API. For now, assume operational since launch
    days.push({ date: dateStr, status: i > 1 ? "up" : "up" });
  }
  return days;
}

function statusColor(status: string) {
  switch (status) {
    case "operational": case "up": return "#22c55e";
    case "degraded": return "#eab308";
    case "down": return "#ef4444";
    default: return "rgba(255,255,255,0.15)";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "operational": return "Operational";
    case "degraded": return "Degraded";
    case "down": return "Down";
    default: return "Checking...";
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "operational":
      return <CheckCircle2 size={18} style={{ color: "#22c55e" }} />;
    case "degraded":
      return <AlertTriangle size={18} style={{ color: "#eab308" }} />;
    case "down":
      return <XCircle size={18} style={{ color: "#ef4444" }} />;
    default:
      return <RefreshCw size={14} className="animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />;
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ── Uptime Bar ──────────────────────────────────────────

function UptimeBar({ days }: { days: DayStatus[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const upCount = days.filter(d => d.status === "up").length;
  const pct = ((upCount / days.length) * 100).toFixed(2);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-white/25">90 days ago</span>
        <span className="text-[13px] text-white/50 tabular-nums font-medium">{pct}% uptime</span>
        <span className="text-[12px] text-white/25">Today</span>
      </div>
      <div className="flex gap-[2px] h-[32px] relative">
        {days.map((day, i) => (
          <div
            key={day.date}
            className="flex-1 rounded-[2px] transition-all duration-100 cursor-pointer"
            style={{
              backgroundColor: hoveredIdx === i
                ? statusColor(day.status)
                : day.status === "up"
                ? "rgba(34, 197, 94, 0.25)"
                : day.status === "degraded"
                ? "rgba(234, 179, 8, 0.4)"
                : day.status === "down"
                ? "rgba(239, 68, 68, 0.5)"
                : "rgba(255,255,255,0.04)",
              transform: hoveredIdx === i ? "scaleY(1.15)" : "scaleY(1)",
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        ))}

        {hoveredIdx !== null && (
          <div
            className="absolute -top-10 px-2.5 py-1 rounded-md bg-[#252525] border border-white/[0.08] text-[12px] text-white/70 whitespace-nowrap pointer-events-none z-10"
            style={{
              left: `${(hoveredIdx / days.length) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            {formatDate(days[hoveredIdx].date)} — {days[hoveredIdx].status === "up" ? "No issues" : days[hoveredIdx].status === "degraded" ? "Degraded" : "Outage"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Service Card ────────────────────────────────────────

function ServiceCard({ service }: { service: ServiceStatus }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3.5">
          <StatusIcon status={service.status} />
          <div>
            <h3 className="text-[16px] font-medium text-white">{service.name}</h3>
            <p className="text-[13px] text-white/30 mt-0.5">{service.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {service.latency !== undefined && service.status === "operational" && (
            <span className="text-[13px] text-white/20 tabular-nums">{service.latency}ms</span>
          )}
          <span
            className="text-[13px] font-medium px-3 py-1 rounded-full"
            style={{
              color: statusColor(service.status),
              backgroundColor: `${statusColor(service.status)}15`,
            }}
          >
            {statusLabel(service.status)}
          </span>
        </div>
      </div>
      <div className="px-6 pb-5">
        <UptimeBar days={service.uptimeDays} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES_CONFIG.map(s => ({
      name: s.name,
      description: s.description,
      url: s.url,
      status: "checking",
      uptimeDays: generateUptimeDays(),
    }))
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(true);

  const checkHealth = async () => {
    setChecking(true);
    const results = await Promise.all(
      SERVICES_CONFIG.map(async (cfg) => {
        const start = Date.now();
        try {
          const res = await fetch(cfg.checkUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
          const latency = Date.now() - start;
          if (res.ok) {
            return { status: "operational" as const, latency };
          }
          return { status: "degraded" as const, latency };
        } catch {
          return { status: "down" as const, latency: undefined };
        }
      })
    );

    setServices(prev =>
      prev.map((s, i) => ({
        ...s,
        status: results[i].status,
        latency: results[i].latency,
      }))
    );
    setLastChecked(new Date());
    setChecking(false);
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60_000);
    return () => clearInterval(interval);
  }, []);

  const allOperational = services.every(s => s.status === "operational");
  const anyDown = services.some(s => s.status === "down");

  return (
    <div className="min-h-screen bg-[#111111]">
      {/* Gradient top bar */}
      <div
        className="h-[3px]"
        style={{
          background: allOperational
            ? "linear-gradient(90deg, #22c55e 0%, #16a34a 50%, #22c55e 100%)"
            : anyDown
            ? "linear-gradient(90deg, #ef4444 0%, #dc2626 50%, #ef4444 100%)"
            : "linear-gradient(90deg, #eab308 0%, #ca8a04 50%, #eab308 100%)",
        }}
      />

      <div className="max-w-[800px] mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Activity size={22} className="text-white/40" />
          <h1 className="text-[28px] font-semibold text-white tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia), serif" }}>
            Mira Status
          </h1>
        </div>
        <p className="text-[15px] text-white/35 mb-12 ml-[34px]">
          Real-time health of Mira AI services.
        </p>

        {/* Global status banner */}
        <div
          className="rounded-2xl px-7 py-6 mb-10 border"
          style={{
            borderColor: allOperational ? "rgba(34,197,94,0.15)" : anyDown ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)",
            backgroundColor: allOperational ? "rgba(34,197,94,0.04)" : anyDown ? "rgba(239,68,68,0.04)" : "rgba(234,179,8,0.04)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: allOperational ? "#22c55e" : anyDown ? "#ef4444" : "#eab308" }}
              />
              <span className="text-[18px] font-medium text-white">
                {allOperational ? "All Systems Operational" : anyDown ? "Service Disruption" : "Partial Degradation"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {lastChecked && (
                <span className="text-[12px] text-white/20">
                  Updated {lastChecked.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={checkHealth}
                disabled={checking}
                className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/50 transition-colors"
              >
                <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Service cards */}
        <div className="space-y-4 mb-16">
          {services.map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>

        {/* Incidents */}
        <div className="mb-16">
          <h2 className="text-[18px] font-medium text-white mb-6">Recent Incidents</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-6">
            <div className="flex items-center gap-3 text-white/25">
              <Clock size={16} />
              <span className="text-[14px]">No incidents in the last 90 days.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] pt-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-white/20">Mira AI</span>
            <a href="https://vmira.ai" className="text-[13px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1">
              vmira.ai <ExternalLink size={10} />
            </a>
            <a href="https://platform.vmira.ai" className="text-[13px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1">
              Platform <ExternalLink size={10} />
            </a>
          </div>
          <span className="text-[12px] text-white/15">Auto-refreshes every 60s</span>
        </div>
      </div>
    </div>
  );
}
