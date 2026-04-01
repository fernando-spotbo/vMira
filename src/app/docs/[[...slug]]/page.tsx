"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Settings, Sparkles, Code, Monitor, Star, Terminal, Search } from "lucide-react";
import { docsNav, platformCards, codeCards, type HomeCard } from "@/lib/docs/navigation";
import type { Locale } from "@/lib/i18n";
import { DocsContent } from "@/components/docs/DocsContent";

function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem("mira-locale");
    if (stored === "ru" || stored === "en") return stored;
  } catch {}
  return navigator.language.startsWith("ru") ? "ru" : "en";
}

const iconMap: Record<string, React.ReactNode> = {
  play: <Play size={18} strokeWidth={1.5} />,
  settings: <Settings size={18} strokeWidth={1.5} />,
  sparkles: <Sparkles size={18} strokeWidth={1.5} />,
  code: <Code size={18} strokeWidth={1.5} />,
  monitor: <Monitor size={18} strokeWidth={1.5} />,
  star: <Star size={18} strokeWidth={1.5} />,
  terminal: <Terminal size={18} strokeWidth={1.5} />,
};

function CardGrid({ title, cards, locale }: { title: string; cards: HomeCard[]; locale: Locale }) {
  const i = (text: Record<Locale, string>) => text[locale] || text.en;
  return (
    <div className="mb-12">
      <h2 className="text-[22px] font-medium text-white mb-6 text-center">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <Link
            key={card.slug}
            href={`/docs/${card.slug}`}
            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-200"
          >
            <div className="text-white/40 mb-3 group-hover:text-white/60 transition-colors">
              {iconMap[card.icon] || <Code size={18} />}
            </div>
            <h3 className="text-[15px] font-medium text-white mb-1.5">{i(card.title)}</h3>
            <p className="text-[13px] text-white/40 leading-relaxed">{i(card.description)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DocsHome({ locale }: { locale: Locale }) {
  const i = (text: Record<Locale, string>) => text[locale] || text.en;

  return (
    <div className="max-w-[960px] mx-auto">
      {/* Hero */}
      <div className="text-center mb-12 pt-4">
        <h1 className="text-[36px] font-light text-white mb-3">
          {i({ en: "Build with Mira", ru: "Создавайте с Мирой" })}
        </h1>
        <p className="text-[16px] text-white/50 mb-8">
          {i({
            en: "Learn how to get started with Mira Platform and Mira Code.",
            ru: "Узнайте, как начать работу с платформой Мира и Mira Code."
          })}
        </p>

        {/* Search bar */}
        <div className="max-w-[480px] mx-auto relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder={i({ en: "Ask Mira about the docs...", ru: "Спросите Миру о документации..." })}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[14px] text-white placeholder-white/25 focus:outline-none focus:border-white/[0.12] transition-colors"
          />
        </div>
      </div>

      {/* Mira Platform cards */}
      <CardGrid
        title={i({ en: "Mira Platform", ru: "Платформа Мира" })}
        cards={platformCards}
        locale={locale}
      />

      {/* Mira Code cards */}
      <CardGrid
        title="Mira Code"
        cards={codeCards}
        locale={locale}
      />
    </div>
  );
}

export default function DocsPage() {
  const params = useParams();
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(getLocale());
    // Listen for locale changes from layout
    const handler = () => setLocale(getLocale());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const slugArray = (params?.slug as string[] | undefined) || [];
  const slug = slugArray.join("/");

  // Home page
  if (!slug) {
    return <DocsHome locale={locale} />;
  }

  // Find the page in navigation
  let pageTitle: Record<Locale, string> | null = null;
  for (const section of docsNav) {
    const item = section.items.find(i => i.slug === slug);
    if (item) {
      pageTitle = item.title;
      break;
    }
  }

  const i = (text: Record<Locale, string>) => text[locale] || text.en;

  return (
    <div className="max-w-[760px] mx-auto">
      <DocsContent slug={slug} locale={locale} />
    </div>
  );
}
