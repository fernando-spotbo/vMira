"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Play, Settings, Sparkles, Code, Monitor, Star, Terminal, Search,
} from "lucide-react";
import { platformCards, codeCards, type HomeCard } from "@/lib/docs/navigation";
import type { Locale } from "@/lib/i18n";
import { DocsContent } from "@/components/docs/DocsContent";

function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const s = localStorage.getItem("mira-locale");
    if (s === "ru" || s === "en") return s;
  } catch {}
  return navigator.language.startsWith("ru") ? "ru" : "en";
}

const ICONS: Record<string, React.ReactNode> = {
  play: <Play size={20} strokeWidth={1.5} />,
  settings: <Settings size={20} strokeWidth={1.5} />,
  sparkles: <Sparkles size={20} strokeWidth={1.5} />,
  code: <Code size={20} strokeWidth={1.5} />,
  monitor: <Monitor size={20} strokeWidth={1.5} />,
  star: <Star size={20} strokeWidth={1.5} />,
  terminal: <Terminal size={20} strokeWidth={1.5} />,
};

/* ═══ Card styles matching preview-docs.html ═══ */
const cardBase: React.CSSProperties = {
  padding: 24, borderRadius: 12, cursor: "pointer", position: "relative", overflow: "hidden",
  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
  transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
};
const cardWarmBase: React.CSSProperties = {
  ...cardBase,
  background: "rgba(255,250,240,0.015)", borderColor: "rgba(255,250,240,0.06)",
};

function DocCard({ card, locale, warm }: { card: HomeCard; locale: Locale; warm?: boolean }) {
  const i = (t: Record<Locale, string>) => t[locale] || t.en;
  const base = warm ? cardWarmBase : cardBase;
  return (
    <Link
      href={`/docs/${card.slug}`}
      style={base}
      className="group block"
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.background = warm ? "rgba(255,250,240,0.03)" : "rgba(255,255,255,0.04)";
        el.style.borderColor = warm ? "rgba(255,250,240,0.10)" : "rgba(255,255,255,0.10)";
        el.style.transform = "translateY(-1px)";
        el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.background = warm ? "rgba(255,250,240,0.015)" : "rgba(255,255,255,0.02)";
        el.style.borderColor = warm ? "rgba(255,250,240,0.06)" : "rgba(255,255,255,0.06)";
        el.style.transform = "none";
        el.style.boxShadow = "none";
      }}
    >
      <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "rgba(255,255,255,0.3)", transition: "color 0.25s" }}
        className="group-hover:!text-white/50"
      >
        {ICONS[card.icon] || <Code size={20} />}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 500, color: "#fff", marginBottom: 6, letterSpacing: "-0.01em" }}>
        {i(card.title)}
      </h3>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, fontWeight: 300 }}>
        {i(card.description)}
      </p>
    </Link>
  );
}

function DocsHome({ locale }: { locale: Locale }) {
  const i = (t: Record<Locale, string>) => t[locale] || t.en;
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Hero */}
      <div className="docs-fade" style={{ textAlign: "center", marginBottom: 56, paddingTop: 4 }}>
        <h1 style={{ fontSize: 42, fontWeight: 300, color: "#fff", letterSpacing: "-0.03em", marginBottom: 10, lineHeight: 1.15 }}>
          {i({ en: "Build with Mira", ru: "Создавайте с Мирой" })}
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 28, fontWeight: 300 }}>
          {i({ en: "Learn how to get started with Mira Platform and Mira Code.", ru: "Узнайте, как начать работу с платформой Мира и Mira Code." })}
        </p>
        <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
          <input
            type="text"
            placeholder={i({ en: "Ask Mira about the docs...", ru: "Спросите Миру о документации..." })}
            style={{
              width: "100%", padding: "14px 70px 14px 44px", borderRadius: 16,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              color: "#ececec", fontSize: 14, fontFamily: "inherit", outline: "none",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
          />
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 3 }}>
            {["⌘", "K"].map(k => (
              <span key={k} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 4, padding: "1px 6px", fontFamily: "var(--font-mono, monospace)",
                fontSize: 13, color: "rgba(255,255,255,0.15)",
              }}>{k}</span>
            ))}
          </span>
        </div>
      </div>

      {/* Mira Platform */}
      <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 400, color: "#fff", marginBottom: 24, letterSpacing: "-0.01em" }}>
        {i({ en: "Mira Platform", ru: "Платформа Мира" })}
      </h2>
      <div className="docs-fade docs-fade-d1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 56 }}>
        {platformCards.map(c => <DocCard key={c.slug} card={c} locale={locale} />)}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", maxWidth: 200, margin: "0 auto 48px" }} />

      {/* Mira Code */}
      <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 400, color: "#fff", marginBottom: 24, letterSpacing: "-0.01em" }}>
        Mira Code
      </h2>
      <div className="docs-fade docs-fade-d2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 56 }}>
        {codeCards.map(c => <DocCard key={c.slug} card={c} locale={locale} warm />)}
      </div>
    </div>
  );
}

export default function DocsPage() {
  const params = useParams();
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(getLocale());
    const handler = () => setLocale(getLocale());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const slugArray = (params?.slug as string[] | undefined) || [];
  const slug = slugArray.join("/");

  if (!slug) return <DocsHome locale={locale} />;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <DocsContent slug={slug} locale={locale} />
    </div>
  );
}
