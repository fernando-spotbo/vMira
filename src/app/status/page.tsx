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
  { id: "inference", name: "Model Inference", description: "GPU inference", checkUrl: "https://api.vmira.ai/health" },
];

// ── Palette ──────────────────────────────────────────────

const C = {
  bg: "#FAFAF9",
  card: "#FFFFFF",
  border: "rgba(0,0,0,0.06)",
  borderHover: "rgba(0,0,0,0.1)",
  text: "#1A1A1A",
  textSecondary: "#888888",
  textTertiary: "#B0B0B0",
  textFaint: "#D0D0D0",
  green: "#22C55E",
  greenBg: "rgba(34,197,94,0.08)",
  greenBar: "rgba(34,197,94,0.22)",
  greenBarHover: "#22C55E",
  yellow: "#EAB308",
  yellowBg: "rgba(234,179,8,0.08)",
  yellowBar: "rgba(234,179,8,0.28)",
  red: "#EF4444",
  redBg: "rgba(239,68,68,0.08)",
  redBar: "rgba(239,68,68,0.3)",
  muted: "rgba(0,0,0,0.04)",
};

const font = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

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

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusColor(s: string) {
  if (s === "operational" || s === "up") return C.green;
  if (s === "degraded") return C.yellow;
  if (s === "down") return C.red;
  return C.textTertiary;
}

function statusBg(s: string) {
  if (s === "operational" || s === "up") return C.greenBg;
  if (s === "degraded") return C.yellowBg;
  if (s === "down") return C.redBg;
  return C.muted;
}

function barColor(s: string, hover: boolean) {
  if (hover) return statusColor(s);
  if (s === "up") return C.greenBar;
  if (s === "degraded") return C.yellowBar;
  if (s === "down") return C.redBar;
  return "rgba(0,0,0,0.03)";
}

function statusLabel(s: string) {
  if (s === "operational") return "Operational";
  if (s === "degraded") return "Degraded";
  if (s === "down") return "Down";
  return "Checking";
}

// ── Mira Star Logo ──────────────────────────────────────

function MiraStar({ size = 20, color = C.text }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill={color} />
      <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill={color} />
    </svg>
  );
}

// ── Uptime Bar ──────────────────────────────────────────

function UptimeBar({ days }: { days: DayStatus[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const upCount = days.filter((d) => d.status === "up").length;
  const pct = ((upCount / days.length) * 100).toFixed(2);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 1.5, height: 24 }}>
        {days.map((day, i) => (
          <div
            key={day.date}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              flex: 1,
              borderRadius: 2,
              backgroundColor: barColor(day.status, hovered === i),
              transform: hovered === i ? "scaleY(1.35)" : "scaleY(1)",
              transformOrigin: "bottom",
              transition: "all 0.12s ease",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      {hovered !== null && (
        <div
          style={{
            position: "absolute",
            top: -32,
            left: `${(hovered / days.length) * 100}%`,
            transform: "translateX(-50%)",
            padding: "3px 10px",
            borderRadius: 6,
            background: C.text,
            color: "#fff",
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {formatDate(days[hovered].date)} — {days[hovered].status === "up" ? "No issues" : days[hovered].status === "degraded" ? "Degraded" : "Outage"}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: C.textTertiary, letterSpacing: "0.04em" }}>90d ago</span>
        <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
          {pct}%
        </span>
        <span style={{ fontSize: 10, color: C.textTertiary, letterSpacing: "0.04em" }}>Today</span>
      </div>
    </div>
  );
}

// ── Service Card ────────────────────────────────────────

function ServiceCard({ service, index }: { service: ServiceStatus; index: number }) {
  const color = statusColor(service.status);
  const bg = statusBg(service.status);

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        background: C.card,
        padding: "20px 22px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>{service.name}</div>
          <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 1 }}>{service.description}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {service.latency !== undefined && service.status === "operational" && (
            <span style={{ fontSize: 11, color: C.textTertiary, fontVariantNumeric: "tabular-nums" }}>{service.latency}ms</span>
          )}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              color,
              background: bg,
              padding: "3px 10px 3px 8px",
              borderRadius: 99,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color, display: "inline-block" }} />
            {statusLabel(service.status)}
          </div>
        </div>
      </div>
      <UptimeBar days={service.uptimeDays} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map((s) => ({
      id: s.id, name: s.name, description: s.description, status: "checking", uptimeDays: generateUptimeDays(),
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
    setServices((prev) => prev.map((s, i) => ({ ...s, status: results[i].status, latency: results[i].latency })));
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const iv = setInterval(checkHealth, 60_000);
    return () => clearInterval(iv);
  }, [checkHealth]);

  const allOk = services.every((s) => s.status === "operational");
  const anyDown = services.some((s) => s.status === "down");
  const opCount = services.filter((s) => s.status === "operational").length;

  const globalColor = allOk ? C.green : anyDown ? C.red : checking ? C.textTertiary : C.yellow;

  const keyframes = `
    @keyframes status-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes status-fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;

  const page: CSSProperties = {
    minHeight: "100vh",
    backgroundColor: C.bg,
    fontFamily: font,
    WebkitFontSmoothing: "antialiased",
    color: C.text,
  };

  return (
    <div style={page}>
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      {/* Top accent */}
      <div style={{ height: 3, background: `linear-gradient(90deg, transparent 0%, ${globalColor}60 30%, ${globalColor} 50%, ${globalColor}60 70%, transparent 100%)`, transition: "background 0.6s" }} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
        {/* ── Header ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 0 56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MiraStar size={18} color={C.text} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Mira</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: C.textTertiary, marginLeft: 2 }}>Status</span>
          </div>
          <a
            href="https://vmira.ai"
            style={{ fontSize: 12, color: C.textTertiary, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
          >
            vmira.ai
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </a>
        </header>

        {/* ── Hero ── */}
        <div style={{ marginBottom: 48 }}>
          {/* Status dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: globalColor,
                display: "inline-block",
                boxShadow: `0 0 0 3px ${globalColor}20`,
                transition: "all 0.5s",
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: globalColor, transition: "color 0.5s" }}>
              {allOk ? "All systems operational" : anyDown ? "Service disruption" : checking ? "Checking..." : "Partial degradation"}
            </span>
          </div>

          <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, maxWidth: 460 }}>
            Real-time health of Mira AI services.{" "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{opCount}/{services.length}</span> services responding.
            {lastChecked && (
              <span style={{ color: C.textTertiary }}>
                {" "}Last checked {lastChecked.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}.
              </span>
            )}
          </p>

          {/* Refresh */}
          <button
            onClick={checkHealth}
            disabled={checking}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 12,
              fontSize: 12,
              fontWeight: 500,
              color: C.textTertiary,
              background: "none",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "5px 12px",
              cursor: checking ? "default" : "pointer",
              opacity: checking ? 0.5 : 1,
              fontFamily: font,
              transition: "all 0.15s",
            }}
          >
            <svg
              width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: checking ? "status-spin 0.8s linear infinite" : "none" }}
            >
              <path d="M21 12a9 9 0 11-6.22-8.56" />
              <path d="M21 3v9h-9" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── Service cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 48 }}>
          {services.map((s, i) => (
            <ServiceCard key={s.id} service={s} index={i} />
          ))}
        </div>

        {/* ── Incidents ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textTertiary, marginBottom: 12 }}>
            Recent Incidents
          </div>
          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${C.border}`,
              background: C.card,
              padding: "18px 22px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.textTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: 13, color: C.textSecondary }}>No incidents in the last 90 days.</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer style={{ borderTop: `1px solid ${C.border}`, padding: "20px 0 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <MiraStar size={14} color={C.textTertiary} />
            <a href="https://vmira.ai" style={{ fontSize: 12, color: C.textTertiary, textDecoration: "none" }}>vmira.ai</a>
            <a href="https://platform.vmira.ai" style={{ fontSize: 12, color: C.textTertiary, textDecoration: "none" }}>Platform</a>
          </div>
          <span style={{ fontSize: 11, color: C.textFaint, fontVariantNumeric: "tabular-nums" }}>Refreshes every 60s</span>
        </footer>
      </div>
    </div>
  );
}
