"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import { Settings, HelpCircle, LogOut, LayoutDashboard, BarChart3, Key, Wallet, Zap, ChevronRight, BookOpen, FileText, Shield, Bug, Keyboard } from "lucide-react";
import SettingsModal from "@/components/SettingsModal";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard },
  { href: "/usage", icon: BarChart3 },
  { href: "/billing", icon: Wallet },
  { href: "/api-keys", icon: Key },
];

function getNavLabel(href: string): string {
  const labels: Record<string, () => string> = {
    "/dashboard": () => t("platform.dashboard"),
    "/usage": () => t("platform.usage"),
    "/billing": () => "Биллинг",
    "/api-keys": () => t("platform.apiKeys"),
  };
  return labels[href]?.() || href;
}

function MiraLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor" />
      <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor" />
    </svg>
  );
}

function PlatformLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [userMenu, setUserMenu] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"help" | "learn" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userName = user?.name || "User";
  const userEmail = user?.email || user?.phone || "";
  const userInitial = userName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!userMenu) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setUserMenu(false); setSubmenu(null); }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handle), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handle); };
  }, [userMenu]);

  const openSubmenu = (which: "help" | "learn") => {
    if (submenuTimeout.current) clearTimeout(submenuTimeout.current);
    setSubmenu(which);
  };
  const closeSubmenuDelayed = () => {
    submenuTimeout.current = setTimeout(() => setSubmenu(null), 250);
  };
  const keepSubmenuOpen = () => {
    if (submenuTimeout.current) clearTimeout(submenuTimeout.current);
  };

  const helpItems = [
    { icon: BookOpen, label: t("user.helpCenter"), href: "/help" },
    { icon: Bug, label: t("user.reportBug") },
    { icon: Keyboard, label: t("user.shortcuts"), shortcut: "Ctrl+/" },
  ];

  const learnItems = [
    { icon: BookOpen, label: t("user.about"), href: "/" },
    { icon: FileText, label: t("user.terms"), href: "/legal/terms" },
    { icon: Shield, label: t("user.usagePolicy"), href: "/legal/usage-policy" },
    { icon: Shield, label: t("user.privacyPolicy"), href: "/legal/privacy" },
  ];

  const closeMenu = () => { setUserMenu(false); setSubmenu(null); };

  return (
    <div className="fixed inset-0 bg-[#161616] overflow-hidden z-[9999] flex">
      {/* Settings modal */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {/* User menu popup — exact replica of chat sidebar popup */}
      {userMenu && menuRect && (
        <div ref={menuRef} className="fixed z-[150] flex gap-1" style={{ left: menuRect.left, bottom: window.innerHeight - menuRect.top + 8 }}>
          <div className="w-[240px] rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.15] text-white text-sm font-semibold">{userInitial}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{userName}</div>
                  <div className="text-xs text-white/70 truncate">{userEmail}</div>
                </div>
              </div>
            </div>
            <button onClick={() => { closeMenu(); setTimeout(() => setSettingsOpen(true), 50); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors">
              <Settings size={16} /><span className="flex-1 text-left">{t("user.settings")}</span>
              <span className="text-[11px] text-white/40">Ctrl+,</span>
            </button>
            <button
              onMouseEnter={() => openSubmenu("help")}
              onMouseLeave={closeSubmenuDelayed}
              onClick={() => setSubmenu(submenu === "help" ? null : "help")}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
            >
              <HelpCircle size={16} /><span className="flex-1 text-left">{t("user.help")}</span><ChevronRight size={14} className="text-white/40" />
            </button>
            <div className="my-1 border-t border-white/[0.06]" />
            <button
              onMouseEnter={() => openSubmenu("learn")}
              onMouseLeave={closeSubmenuDelayed}
              onClick={() => setSubmenu(submenu === "learn" ? null : "learn")}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
            >
              <HelpCircle size={16} /><span className="flex-1 text-left">{t("user.learnMore")}</span><ChevronRight size={14} className="text-white/40" />
            </button>
            <div className="my-1 border-t border-white/[0.06]" />
            <button onClick={async () => { closeMenu(); await logout(); window.location.href = "/"; }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors">
              <LogOut size={16} /><span className="flex-1 text-left">{t("user.logout")}</span>
            </button>
          </div>

          {/* Submenu — appears to the right */}
          {submenu && (
            <div
              className="w-[210px] rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)] self-end"
              onMouseEnter={keepSubmenuOpen}
              onMouseLeave={closeSubmenuDelayed}
            >
              {(submenu === "help" ? helpItems : learnItems).map((item) => {
                const content = (
                  <>
                    <item.icon size={16} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {"shortcut" in item && item.shortcut && (
                      <span className="text-[11px] text-white/40">{item.shortcut}</span>
                    )}
                    {"href" in item && item.href && item.href !== "/" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                    )}
                  </>
                );

                if ("href" in item && item.href) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target={item.href.startsWith("/legal") ? "_blank" : undefined}
                      onClick={closeMenu}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <button
                    key={item.label}
                    onClick={closeMenu}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sidebar — 260px expanded, matching chat sidebar */}
      <aside
        className="hidden md:flex h-full shrink-0 flex-col bg-[#131313] transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: expanded ? 260 : 50 }}
      >
        <div className="flex h-full flex-col" style={{ minWidth: expanded ? 260 : 50 }}>
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center px-[5px]">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
              title={expanded ? "Collapse" : "Expand"}
            >
              <MiraLogo />
            </button>
            {expanded && (
              <div className="flex items-center gap-0.5 ml-auto">
                <button
                  onClick={() => setExpanded(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
                  title="Collapse"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Nav */}
          <div className={expanded ? "px-3 pb-3 space-y-0.5" : "flex flex-col items-center gap-1 px-[5px]"}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const label = getNavLabel(item.href);
              return expanded ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                    active ? "bg-white/[0.08] text-white font-medium" : "text-white hover:bg-white/[0.06]"
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.8} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    active ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"
                  }`}
                  title={label}
                >
                  <item.icon size={18} strokeWidth={1.8} />
                </Link>
              );
            })}
          </div>

          {expanded && <div className="mx-3 border-t border-white/[0.06]" />}
          <div className="flex-1" />

          {/* User */}
          <div className={`shrink-0 ${expanded ? "border-t border-white/[0.06] p-2" : "pb-3 flex justify-center"}`}>
            <button
              onClick={(e) => { setMenuRect((e.currentTarget).getBoundingClientRect()); setUserMenu(true); }}
              className={
                expanded
                  ? "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-white/[0.04] transition-colors"
                  : "flex h-10 w-10 items-center justify-center"
              }
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.15] text-white text-xs font-semibold">
                {userInitial}
              </div>
              {expanded && (
                <div className="flex-1 text-left overflow-hidden">
                  <div className="text-sm text-white truncate">{userName}</div>
                  <div className="text-[11px] text-white/70 truncate">{userEmail}</div>
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="px-10 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <PlatformLayoutInner>{children}</PlatformLayoutInner>
    </ProtectedRoute>
  );
}
