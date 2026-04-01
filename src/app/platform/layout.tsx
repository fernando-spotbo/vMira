"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import { Settings, HelpCircle, LogOut, LayoutDashboard, BarChart3, Key, Wallet } from "lucide-react";

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
  const menuRef = useRef<HTMLDivElement>(null);

  const userName = user?.name || "User";
  const userEmail = user?.email || user?.phone || "";
  const userInitial = userName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!userMenu) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handle), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handle); };
  }, [userMenu]);

  return (
    <div className="fixed inset-0 bg-[#161616] overflow-hidden z-[9999] flex">
      {/* User menu popup — matches chat sidebar popup exactly */}
      {userMenu && menuRect && (
        <div
          ref={menuRef}
          className="fixed z-[150] w-[240px] rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          style={{ left: menuRect.left, bottom: window.innerHeight - menuRect.top + 8 }}
        >
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.15] text-white text-sm font-semibold">{userInitial}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{userName}</div>
                <div className="text-xs text-white/70 truncate">{userEmail}</div>
              </div>
            </div>
          </div>
          <button onClick={() => setUserMenu(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors">
            <Settings size={16} /><span className="flex-1 text-left">{t("user.settings")}</span>
          </button>
          <button onClick={() => setUserMenu(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors">
            <HelpCircle size={16} /><span className="flex-1 text-left">{t("user.help")}</span>
          </button>
          <div className="my-1 border-t border-white/[0.06]" />
          <button onClick={async () => { setUserMenu(false); await logout(); window.location.href = "/"; }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors">
            <LogOut size={16} /><span className="flex-1 text-left">{t("user.logout")}</span>
          </button>
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
