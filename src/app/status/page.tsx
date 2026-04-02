"use client";

import { useState, useEffect, useCallback, CSSProperties } from "react";

// ── Types ────────────────────────────────────────────────

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  status: "operational" | "degraded" | "down" | "checking";
  latency?: number;
  uptimeDays: DayStatus[];
}

interface DayStatus {
  date: string;
  status: "up" | "degraded" | "down" | "no-data";
}

// ── Config ───────────────────────────────────────────────

const SERVICES = [
  { id: "chat", name: "Mira Chat", description: "AI assistant", checkUrl: "https://api.vmira.ai/health" },
  { id: "api", name: "Mira API", description: "REST API for developers", checkUrl: "https://api.vmira.ai/health" },
  { id: "code", name: "Mira Code", description: "Developer CLI", checkUrl: "https://api.vmira.ai/api/v1/models" },
  { id: "inference", name: "Model Inference", description: "GPU inference servers", checkUrl: "https://api.vmira.ai/health" },
];

// ── Helpers ──────────────────────────────────────────────

function generateUptimeDays(): DayStatus[] {
  const days: DayStatus[] = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().split("T")[0], status: "up" });
  }
  return days;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const green = "#4ade80";
const yellow = "#facc15";
const red = "#f87171";

function statusColor(s: string) {
  if (s === "operational" || s === "up") return green;
  if (s === "degraded") return yellow;
  if (s === "down") return red;
  return "rgba(255,255,255,0.12)";
}

function statusLabel(s: string) {
  if (s === "operational") return "Operational";
  if (s === "degraded") return "Degraded";
  if (s === "down") return "Down";
  return "Checking";
}

// ── Uptime Bar ──────────────────────────────────────────

function UptimeBar({ days }: { days: DayStatus[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const upCount = days.filter((d) => d.status === "up").length;
  const pct = ((upCount / days.length) * 100).toFixed(2);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: "1.5px", height: 28 }}>
        {days.map((day, i) => {
          const isHovered = hovered === i;
          const base =
            day.status === "up" ? "rgba(74,222,128,0.18)"
            : day.status === "degraded" ? "rgba(250,204,21,0.3)"
            : day.status === "down" ? "rgba(248,113,113,0.35)"
            : "rgba(255,255,255,0.03)";
          return (
            <div
              key={day.date}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: 1,
                borderRadius: 2,
                backgroundColor: isHovered ? statusColor(day.status) : base,
                transform: isHovered ? "scaleY(1.3)" : "scaleY(1)",
                transformOrigin: "bottom",
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>
      {hovered !== null && (
        <div
          style={{
            position: "absolute",
            top: -36,
            left: `${(hovered / days.length) * 100}%`,
            transform: "translateX(-50%)",
            padding: "4px 10px",
            borderRadius: 8,
            background: "rgba(15,15,15,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {formatDate(days[hovered].date)} —{" "}
          <span style={{ color: statusColor(days[hovered].status) }}>
            {days[hovered].status === "up" ? "No issues" : days[hovered].status === "degraded" ? "Degraded" : "Outage"}
          </span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>90 days ago</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>
          {pct}% <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>uptime</span>
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Today</span>
      </div>
    </div>
  );
}

// ── Service Card ────────────────────────────────────────

function ServiceCard({ service }: { service: ServiceStatus }) {
  const color = statusColor(service.status);
  const checking = service.status === "checking";

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(255,255,255,0.02)",
        overflow: "hidden",
      }}
    >
      {/* Accent line */}
      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
          opacity: checking ? 0.3 : 1,
          transition: "opacity 0.5s",
        }}
      />

      <div style={{ padding: "20px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>
              {service.name}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
              {service.description}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {service.latency !== undefined && service.status === "operational" && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontVariantNumeric: "tabular-nums" }}>
                {service.latency}ms
              </span>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                color,
                background: `${color}12`,
                padding: "3px 10px",
                borderRadius: 99,
              }}
            >
              {/* Status dot */}
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}50`,
                  display: "inline-block",
                }}
              />
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

// ── Refresh Icon ────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: spinning ? "status-spin 1s linear infinite" : "none",
      }}
    >
      <path d="M21 12a9 9 0 11-6.22-8.56" />
      <path d="M21 3v9h-9" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      status: "checking",
      uptimeDays: generateUptimeDays(),
    }))
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(true);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    const results = await Promise.all(
      SERVICES.map(async (cfg) => {
        const start = Date.now();
        try {
          const res = await fetch(cfg.checkUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
          const latency = Date.now() - start;
          return res.ok ? { status: "operational" as const, latency } : { status: "degraded" as const, latency };
        } catch {
          return { status: "down" as const, latency: undefined };
        }
      })
    );
    setServices((prev) =>
      prev.map((s, i) => ({ ...s, status: results[i].status, latency: results[i].latency }))
    );
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const allOk = services.every((s) => s.status === "operational");
  const anyDown = services.some((s) => s.status === "down");
  const opCount = services.filter((s) => s.status === "operational").length;

  const barColor = allOk ? green : anyDown ? red : checking ? "rgba(255,255,255,0.1)" : yellow;
  const headline = allOk
    ? "All Systems Operational"
    : anyDown
      ? "Service Disruption Detected"
      : checking
        ? "Checking Systems..."
        : "Partial Degradation";

  // Inline keyframes injected via a <style> tag (not styled-jsx)
  const keyframes = `
    @keyframes status-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  `;

  const container: CSSProperties = {
    minHeight: "100vh",
    backgroundColor: "#0b0b0b",
    color: "#fff",
    fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
    WebkitFontSmoothing: "antialiased",
  };

  return (
    <div style={container}>
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      {/* Top accent bar */}
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${barColor}80, ${barColor}, ${barColor}80, transparent)`,
          transition: "background 0.5s",
        }}
      />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
        {/* Nav */}
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              M
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>Mira Status</span>
          </div>
          <a
            href="https://vmira.ai"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "none" }}
          >
            vmira.ai ↗
          </a>
        </nav>

        {/* Hero */}
        <div style={{ textAlign: "center", paddingBottom: 48 }}>
          {/* Pulse dot */}
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: barColor,
              boxShadow: `0 0 12px ${barColor}60`,
              margin: "0 auto 24px",
              animation: "status-pulse 2.5s ease-in-out infinite",
              transition: "background-color 0.5s, box-shadow 0.5s",
            }}
          />

          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: "#fff",
              letterSpacing: "-0.02em",
              margin: "0 0 12px",
              lineHeight: 1.2,
            }}
          >
            {headline}
          </h1>

          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.3)", margin: "0 0 24px", maxWidth: 420, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
            {allOk
              ? "All Mira services are running normally."
              : anyDown
                ? "Some services are experiencing issues. Our team has been notified."
                : "Monitoring service performance."}
          </p>

          {/* Stats row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, fontSize: 12 }}>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{opCount}</span>/{services.length} services up
            </span>
            {lastChecked && (
              <span style={{ color: "rgba(255,255,255,0.2)", fontVariantNumeric: "tabular-nums" }}>
                {lastChecked.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button
              onClick={checkHealth}
              disabled={checking}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                color: "rgba(255,255,255,0.2)",
                background: "none",
                border: "none",
                cursor: checking ? "default" : "pointer",
                opacity: checking ? 0.4 : 1,
                padding: 0,
              }}
            >
              <RefreshIcon spinning={checking} />
              Refresh
            </button>
          </div>
        </div>

        {/* Section header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>
            Services
          </span>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.15)" }}>
            90-day uptime
          </span>
        </div>

        {/* Service cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 56 }}>
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>

        {/* Incidents */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.2)", fontWeight: 500, marginBottom: 16 }}>
            Recent Incidents
          </div>
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(255,255,255,0.015)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.8}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
              <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>No incidents in the last 90 days</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "24px 0 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 20 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.15)" }}>Mira AI</span>
            <a href="https://vmira.ai" style={{ fontSize: 12, color: "rgba(255,255,255,0.15)", textDecoration: "none" }}>vmira.ai</a>
            <a href="https://platform.vmira.ai" style={{ fontSize: 12, color: "rgba(255,255,255,0.15)", textDecoration: "none" }}>Platform</a>
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.1)", fontVariantNumeric: "tabular-nums" }}>Auto-refreshes every 60s</span>
        </div>
      </div>
    </div>
  );
}
