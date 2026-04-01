"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, X } from "lucide-react";
import { docsNav, topNav } from "@/lib/docs/navigation";
import type { Locale } from "@/lib/i18n";

function MiraLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.8 }}>
      <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="white" />
      <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="white" />
    </svg>
  );
}

function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem("mira-locale");
    if (stored === "ru" || stored === "en") return stored;
  } catch {}
  return navigator.language.startsWith("ru") ? "ru" : "en";
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>("en");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { setLocale(getLocale()); }, []);

  const toggleLocale = useCallback(() => {
    const next = locale === "en" ? "ru" : "en";
    setLocale(next);
    try { localStorage.setItem("mira-locale", next); } catch {}
    window.dispatchEvent(new Event("storage"));
  }, [locale]);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        (document.querySelector("[data-docs-search]") as HTMLInputElement)?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const currentSlug = pathname.replace("/docs/", "").replace("/docs", "") || "";
  const i = (text: Record<Locale, string>) => text[locale] || text.en;

  const filteredNav = search
    ? docsNav.map(s => ({
        ...s,
        items: s.items.filter(item =>
          i(item.title).toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.items.length > 0)
    : docsNav;

  return (
    <div style={{ fontFamily: "var(--font-sans, 'DM Sans'), -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      {/* ═══ TOPBAR ═══ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
        style={{
          height: 56,
          background: "rgba(22,22,22,0.92)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-6">
          <Link href="/docs" className="flex items-center gap-2.5" style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
            <MiraLogo />
            Mira API Docs
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {topNav.map(tab => {
              const isActive = tab.slug === ""
                ? currentSlug === "" || currentSlug === "introduction"
                : currentSlug.startsWith(tab.slug.split("/")[0]);
              return (
                <Link
                  key={tab.slug}
                  href={`/docs/${tab.slug}`}
                  className="transition-colors"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    fontWeight: isActive ? 500 : 400,
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.background = "transparent"; }}}
                >
                  {i(tab.title)}
                  {tab.slug === "mira-code/getting-started" && "  ↗"}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLocale}
            className="transition-colors cursor-pointer"
            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, color: "rgba(255,255,255,0.5)", background: "none", border: "none", fontFamily: "inherit" }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.background = "none"; }}
          >
            {locale === "en" ? "Русский" : "English"}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg"
            style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none" }}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <div className="flex" style={{ paddingTop: 56 }}>
        {/* ═══ SIDEBAR ═══ */}
        <aside
          className={`fixed lg:sticky top-[56px] z-40 shrink-0 overflow-y-auto transition-transform lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            width: 260,
            height: "calc(100vh - 56px)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            padding: 12,
            background: "#161616",
          }}
        >
          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute" style={{ left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
            <input
              data-docs-search
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={locale === "en" ? "Search..." : "Поиск..."}
              style={{
                width: "100%",
                padding: "8px 40px 8px 34px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#ececec",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            />
            <span
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                fontSize: 11, color: "rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 4, padding: "1px 5px", fontFamily: "var(--font-mono, monospace)",
              }}
            >
              ⌘K
            </span>
          </div>

          {/* Nav sections */}
          <nav>
            {filteredNav.map((section, si) => (
              <div key={si} style={{ marginBottom: 20 }}>
                <div style={{
                  padding: "4px 8px", fontSize: "11.5px", fontWeight: 600,
                  color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 2,
                }}>
                  {i(section.heading)}
                </div>
                {section.items.map(item => {
                  const isActive = currentSlug === item.slug;
                  return (
                    <Link
                      key={item.slug}
                      href={`/docs/${item.slug}`}
                      onClick={() => setSidebarOpen(false)}
                      className="block transition-colors"
                      style={{
                        padding: "5px 8px", borderRadius: 6, fontSize: 13, lineHeight: 1.5,
                        color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                        background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                        fontWeight: isActive ? 500 : 400,
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = isActive ? "#fff" : "rgba(255,255,255,0.5)"; e.currentTarget.style.background = isActive ? "rgba(255,255,255,0.08)" : "transparent"; }}}
                    >
                      {i(item.title)}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ═══ MAIN ═══ */}
        <main
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ height: "calc(100vh - 56px)", padding: "48px 64px 80px" }}
        >
          {children}
        </main>
      </div>

      {/* Global docs styles */}
      <style>{`
        @keyframes docsUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .docs-fade { animation: docsUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .docs-fade-d1 { animation-delay: 80ms; }
        .docs-fade-d2 { animation-delay: 160ms; }
      `}</style>
    </div>
  );
}
