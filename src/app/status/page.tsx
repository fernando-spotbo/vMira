"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  Clock,
  Zap,
  Shield,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  url: string;
  status: "operational" | "degraded" | "down" | "checking";
  latency?: number;
  uptimeDays: DayStatus[];
}

interface DayStatus {
  date: string;
  status: "up" | "degraded" | "down" | "no-data";
}

// ── Config ───────────────────────────────────────────────

const SERVICES_CONFIG = [
  {
    id: "chat",
    name: "Мира Chat",
    description: "AI assistant at vmira.ai",
    url: "https://vmira.ai",
    checkUrl: "https://api.vmira.ai/health",
    icon: "chat",
  },
  {
    id: "api",
    name: "Mira API",
    description: "REST API for developers",
    url: "https://api.vmira.ai",
    checkUrl: "https://api.vmira.ai/health",
    icon: "api",
  },
  {
    id: "code",
    name: "Mira Code",
    description: "CLI for developers",
    url: "https://api.vmira.ai",
    checkUrl: "https://api.vmira.ai/api/v1/models",
    icon: "code",
  },
  {
    id: "inference",
    name: "Model Inference",
    description: "GPU inference servers",
    url: "",
    checkUrl: "https://api.vmira.ai/health",
    icon: "inference",
  },
];

// ── Helpers ──────────────────────────────────────────────

function generateUptimeDays(): DayStatus[] {
  const days: DayStatus[] = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: dateStr, status: "up" });
  }
  return days;
}

function statusColor(status: string) {
  switch (status) {
    case "operational":
    case "up":
      return "#34d399";
    case "degraded":
      return "#fbbf24";
    case "down":
      return "#f87171";
    default:
      return "rgba(255,255,255,0.12)";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
    default:
      return "Checking";
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Service Icon ─────────────────────────────────────────

function ServiceIcon({ type, status }: { type: string; status: string }) {
  const color = statusColor(status);
  const icons: Record<string, React.ReactNode> = {
    chat: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 4.5A2.5 2.5 0 015.5 2h9A2.5 2.5 0 0117 4.5v7a2.5 2.5 0 01-2.5 2.5H8l-3.5 3V14H5.5A2.5 2.5 0 013 11.5v-7z"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="7.5" cy="8" r="1" fill={color} />
        <circle cx="10" cy="8" r="1" fill={color} />
        <circle cx="12.5" cy="8" r="1" fill={color} />
      </svg>
    ),
    api: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="3" width="16" height="14" rx="2.5" stroke={color} strokeWidth="1.5" />
        <path d="M6 8l2.5 2L6 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="10.5" y1="12" x2="14" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    code: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 6L2 10l4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 6l4 4-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.5 3l-3 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    inference: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="3" stroke={color} strokeWidth="1.5" />
        <circle cx="7" cy="7" r="1.5" fill={color} />
        <circle cx="13" cy="7" r="1.5" fill={color} />
        <circle cx="7" cy="13" r="1.5" fill={color} />
        <circle cx="13" cy="13" r="1.5" fill={color} />
        <circle cx="10" cy="10" r="1.5" fill={color} />
      </svg>
    ),
  };
  return <span className="shrink-0">{icons[type] ?? icons.api}</span>;
}

// ── Status Indicator ─────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span className="relative flex items-center justify-center w-3 h-3">
      <span
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: color,
          opacity: 0.25,
          animation: status === "checking" ? "none" : "status-ring 2.5s ease-in-out infinite",
        }}
      />
      <span
        className="relative w-2 h-2 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}60`,
        }}
      />
    </span>
  );
}

// ── Uptime Bar ──────────────────────────────────────────

function UptimeBar({ days }: { days: DayStatus[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const upCount = days.filter((d) => d.status === "up").length;
  const pct = ((upCount / days.length) * 100).toFixed(2);

  return (
    <div className="relative">
      <div className="flex gap-[1.5px] h-[28px]">
        {days.map((day, i) => (
          <div
            key={day.date}
            className="flex-1 rounded-sm transition-all duration-150"
            style={{
              backgroundColor:
                hoveredIdx === i
                  ? statusColor(day.status)
                  : day.status === "up"
                    ? "rgba(52, 211, 153, 0.18)"
                    : day.status === "degraded"
                      ? "rgba(251, 191, 36, 0.35)"
                      : day.status === "down"
                        ? "rgba(248, 113, 113, 0.4)"
                        : "rgba(255,255,255,0.03)",
              transform: hoveredIdx === i ? "scaleY(1.25)" : "scaleY(1)",
              transformOrigin: "bottom",
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        ))}
      </div>

      {/* Tooltip */}
      {hoveredIdx !== null && (
        <div
          className="absolute -top-9 px-3 py-1.5 rounded-lg text-[11px] tracking-wide whitespace-nowrap pointer-events-none z-10"
          style={{
            left: `${(hoveredIdx / days.length) * 100}%`,
            transform: "translateX(-50%)",
            background: "rgba(20,20,20,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {formatDate(days[hoveredIdx].date)} —{" "}
          <span style={{ color: statusColor(days[hoveredIdx].status) }}>
            {days[hoveredIdx].status === "up"
              ? "No issues"
              : days[hoveredIdx].status === "degraded"
                ? "Degraded"
                : "Outage"}
          </span>
        </div>
      )}

      {/* Bar labels */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] uppercase tracking-[0.1em] text-white/20">
          90 days ago
        </span>
        <span className="text-[12px] tabular-nums font-medium text-white/40">
          {pct}%
          <span className="text-white/20 ml-1 font-normal">uptime</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.1em] text-white/20">
          Today
        </span>
      </div>
    </div>
  );
}

// ── Service Card ────────────────────────────────────────

function ServiceCard({
  service,
  config,
  index,
}: {
  service: ServiceStatus;
  config: (typeof SERVICES_CONFIG)[0];
  index: number;
}) {
  return (
    <div
      className="group relative rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)",
        border: "1px solid rgba(255,255,255,0.05)",
        animationDelay: `${index * 80}ms`,
      }}
    >
      {/* Top accent line */}
      <div
        className="h-[1px] w-full transition-opacity duration-500"
        style={{
          background: `linear-gradient(90deg, transparent, ${statusColor(service.status)}40, transparent)`,
          opacity: service.status === "operational" ? 1 : 0.5,
        }}
      />

      <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-300"
              style={{
                background: `${statusColor(service.status)}08`,
                border: `1px solid ${statusColor(service.status)}15`,
              }}
            >
              <ServiceIcon type={config.icon} status={service.status} />
            </div>
            <div>
              <h3 className="text-[15px] font-medium text-white/90 leading-tight">
                {service.name}
              </h3>
              <p className="text-[12px] text-white/25 mt-0.5">{service.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {service.latency !== undefined && service.status === "operational" && (
              <span className="text-[11px] tabular-nums text-white/15 flex items-center gap-1">
                <Zap size={10} />
                {service.latency}ms
              </span>
            )}
            <div
              className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full"
              style={{
                color: statusColor(service.status),
                background: `${statusColor(service.status)}0a`,
              }}
            >
              <StatusDot status={service.status} />
              {statusLabel(service.status)}
            </div>
          </div>
        </div>

        {/* Uptime bar */}
        <UptimeBar days={service.uptimeDays} />
      </div>
    </div>
  );
}

// ── Hero Pulse ──────────────────────────────────────────

function HeroPulse({ status }: { status: "operational" | "degraded" | "down" | "checking" }) {
  const color = statusColor(status);
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      {/* Outer ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `1px solid ${color}15`,
          animation: "hero-pulse-outer 3s ease-in-out infinite",
        }}
      />
      {/* Middle ring */}
      <div
        className="absolute inset-2 rounded-full"
        style={{
          border: `1px solid ${color}20`,
          animation: "hero-pulse-mid 3s ease-in-out 0.3s infinite",
        }}
      />
      {/* Inner glow */}
      <div
        className="absolute inset-4 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}25 0%, transparent 70%)`,
          animation: "hero-pulse-inner 3s ease-in-out 0.6s infinite",
        }}
      />
      {/* Center icon */}
      <div className="relative z-10">
        {status === "operational" ? (
          <Shield size={24} style={{ color }} strokeWidth={1.5} />
        ) : status === "down" ? (
          <XCircle size={24} style={{ color }} strokeWidth={1.5} />
        ) : status === "degraded" ? (
          <AlertTriangle size={24} style={{ color }} strokeWidth={1.5} />
        ) : (
          <RefreshCw
            size={24}
            style={{ color: "rgba(255,255,255,0.3)" }}
            strokeWidth={1.5}
            className="animate-spin"
          />
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES_CONFIG.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      url: s.url,
      status: "checking",
      uptimeDays: generateUptimeDays(),
    }))
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(true);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    const results = await Promise.all(
      SERVICES_CONFIG.map(async (cfg) => {
        const start = Date.now();
        try {
          const res = await fetch(cfg.checkUrl, {
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
          const latency = Date.now() - start;
          if (res.ok) return { status: "operational" as const, latency };
          return { status: "degraded" as const, latency };
        } catch {
          return { status: "down" as const, latency: undefined };
        }
      })
    );

    setServices((prev) =>
      prev.map((s, i) => ({
        ...s,
        status: results[i].status,
        latency: results[i].latency,
      }))
    );
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const allOperational = services.every((s) => s.status === "operational");
  const anyDown = services.some((s) => s.status === "down");
  const globalStatus = allOperational
    ? "operational"
    : anyDown
      ? "down"
      : services.some((s) => s.status === "checking")
        ? "checking"
        : "degraded";

  const operationalCount = services.filter((s) => s.status === "operational").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-auto relative">
      {/* Background grain */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* Top gradient bar */}
      <div
        className="h-[2px] relative z-10"
        style={{
          background:
            globalStatus === "operational"
              ? "linear-gradient(90deg, transparent, #34d39960, #34d399, #34d39960, transparent)"
              : globalStatus === "down"
                ? "linear-gradient(90deg, transparent, #f8717160, #f87171, #f8717160, transparent)"
                : globalStatus === "degraded"
                  ? "linear-gradient(90deg, transparent, #fbbf2460, #fbbf24, #fbbf2460, transparent)"
                  : "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
        }}
      />

      <div className="relative z-10 max-w-[860px] mx-auto px-5 sm:px-8">
        {/* ─── Header ─────────────────────────────────── */}
        <header className="pt-14 sm:pt-20 pb-12 sm:pb-16">
          {/* Nav bar */}
          <nav className="flex items-center justify-between mb-14 sm:mb-20">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-white/[0.07] flex items-center justify-center">
                <span className="text-[11px] font-bold text-white/50">M</span>
              </div>
              <span className="text-[13px] font-medium text-white/40">Mira Status</span>
            </div>
            <a
              href="https://vmira.ai"
              className="flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/50 transition-colors duration-300"
            >
              vmira.ai
              <ArrowUpRight size={11} />
            </a>
          </nav>

          {/* Hero section */}
          <div className="flex flex-col items-center text-center">
            <HeroPulse status={globalStatus as "operational" | "degraded" | "down" | "checking"} />

            <h1
              className="text-[32px] sm:text-[40px] font-medium tracking-tight mt-8 leading-tight"
              style={{ fontFamily: "var(--font-serif, Georgia), serif" }}
            >
              {allOperational
                ? "All Systems Operational"
                : anyDown
                  ? "Service Disruption Detected"
                  : checking
                    ? "Checking Systems..."
                    : "Partial Degradation"}
            </h1>

            <p className="text-[14px] sm:text-[15px] text-white/30 mt-3 max-w-md leading-relaxed">
              {allOperational
                ? "All Mira services are running normally. No incidents reported."
                : anyDown
                  ? "Some services are experiencing issues. Our team has been notified."
                  : "We're monitoring service performance and working on improvements."}
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-8">
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: statusColor(globalStatus) }}
                />
                <span className="text-[12px] tabular-nums text-white/30">
                  <span className="text-white/60 font-medium">{operationalCount}</span>
                  /{services.length} services up
                </span>
              </div>
              {lastChecked && (
                <span className="text-[12px] tabular-nums text-white/20 flex items-center gap-1.5">
                  <Clock size={10} />
                  {formatTime(lastChecked)}
                </span>
              )}
              <button
                onClick={checkHealth}
                disabled={checking}
                className="flex items-center gap-1.5 text-[12px] text-white/20 hover:text-white/45 transition-colors duration-300 disabled:opacity-40"
              >
                <RefreshCw size={11} className={checking ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* ─── Services ───────────────────────────────── */}
        <section className="space-y-3 mb-16">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/20 font-medium">
              Services
            </h2>
            <span className="text-[11px] uppercase tracking-[0.15em] text-white/15">
              90-day uptime
            </span>
          </div>

          {services.map((service, i) => (
            <ServiceCard
              key={service.id}
              service={service}
              config={SERVICES_CONFIG[i]}
              index={i}
            />
          ))}
        </section>

        {/* ─── Incidents ──────────────────────────────── */}
        <section className="mb-16">
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/20 font-medium mb-5">
            Recent Incidents
          </h2>
          <div
            className="rounded-xl p-6 sm:p-7"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-white/15" />
              <span className="text-[13px] text-white/25">
                No incidents in the last 90 days
              </span>
            </div>
          </div>
        </section>

        {/* ─── Footer ─────────────────────────────────── */}
        <footer className="pb-12 pt-6">
          <div
            className="h-[1px] mb-8"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
            }}
          />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <span className="text-[12px] text-white/15">Mira AI</span>
              <a
                href="https://vmira.ai"
                className="text-[12px] text-white/15 hover:text-white/35 transition-colors duration-300"
              >
                vmira.ai
              </a>
              <a
                href="https://platform.vmira.ai"
                className="text-[12px] text-white/15 hover:text-white/35 transition-colors duration-300"
              >
                Platform
              </a>
              <a
                href="https://docs.vmira.ai"
                className="text-[12px] text-white/15 hover:text-white/35 transition-colors duration-300"
              >
                Docs
              </a>
            </div>
            <span className="text-[11px] text-white/10 tabular-nums">
              Auto-refreshes every 60s
            </span>
          </div>
        </footer>
      </div>

      {/* ── Embedded Styles ──────────────────────────── */}
      <style jsx>{`
        @keyframes status-ring {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.25;
          }
          50% {
            transform: scale(1.8);
            opacity: 0;
          }
        }

        @keyframes hero-pulse-outer {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.1;
          }
        }

        @keyframes hero-pulse-mid {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.15;
          }
        }

        @keyframes hero-pulse-inner {
          0%,
          100% {
            transform: scale(0.9);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
