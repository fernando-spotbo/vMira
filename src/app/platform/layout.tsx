"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import { BookOpen, Settings, HelpCircle, LogOut, ChevronDown, LayoutDashboard, BarChart3, Key, FileText, Wallet } from "lucide-react";

function getSections() {
  return [
    {
      label: t("platform.analytics"),
      items: [
        { href: "/dashboard", label: t("platform.dashboard"), icon: LayoutDashboard },
        { href: "/usage", label: t("platform.usage"), icon: BarChart3 },
        { href: "/billing", label: "Биллинг", icon: Wallet },
      ],
    },
    {
      label: t("platform.manage"),
      items: [
        { href: "/api-keys", label: t("platform.apiKeys"), icon: Key },
        { href: "/docs", label: t("platform.docs"), icon: FileText },
      ],
    },
  ];
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
    const t = setTimeout(() => document.addEventListener("mousedown", handle), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handle); };
  }, [userMenu]);

  const sections = getSections();
  const allItems = sections.flatMap((s) => s.items);

  return (
    <div className="fixed inset-0 bg-[#161616] overflow-hidden z-[9999] flex">
      {/* User menu popup */}
      {userMenu && menuRect && (
        <div
          ref={menuRef}
          className="fixed z-[150] w-[230px] rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          style={{ left: menuRect.left, bottom: window.innerHeight - menuRect.top + 8 }}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.15] text-white text-sm font-semibold">{userInitial}</div>
            <div>
              <div className="text-sm font-medium text-white/80">{userName}</div>
              <div className="text-xs text-white/30">{userEmail}</div>
            </div>
          </div>
          <button onClick={() => setUserMenu(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-colors">
            <Settings size={16} /><span className="flex-1 text-left">Settings</span>
          </button>
          <button onClick={() => setUserMenu(false)} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-colors">
            <HelpCircle size={16} /><span className="flex-1 text-left">Help</span>
          </button>
          <div className="my-1 border-t border-white/[0.06]" />
          <button onClick={async () => { setUserMenu(false); await logout(); window.location.href = "/"; }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-colors">
            <LogOut size={16} /><span className="flex-1 text-left">Log out</span>
          </button>
        </div>
      )}

      {/* Sidebar — animated width like chat */}
      <aside
        className="hidden md:flex h-full shrink-0 flex-col bg-[#131313] border-r border-white/[0.06] transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: expanded ? 200 : 50 }}
      >
        <div className="flex h-full flex-col" style={{ minWidth: expanded ? 200 : 50 }}>
          {/* Header — logo stays left, collapse button on right */}
          <div className="flex h-14 shrink-0 items-center px-[5px]">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.05] transition-colors"
              title={expanded ? "Collapse" : "Expand"}
            >
              <MiraLogo />
            </button>
            {expanded && (
              <>
                <span className="text-[14px] font-medium text-white/60 ml-1 whitespace-nowrap">{t("platform.console")}</span>
                <button
                  onClick={() => setExpanded(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white/30 hover:bg-white/[0.05] hover:text-white/60 transition-colors ml-auto"
                  title="Collapse sidebar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Nav */}
          {/* Nav — icons always in same position */}
          <nav className={`flex-1 pt-2 ${expanded ? "space-y-5" : "space-y-1"} ${expanded ? "px-3" : "px-[5px]"}`}>
            {sections.map((section) => (
              <div key={section.label}>
                {expanded && (
                  <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-white/20">
                    {section.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg transition-colors ${
                          expanded ? "px-3 py-1.5" : "h-10 w-10 justify-center"
                        } ${
                          active ? "bg-white/[0.07] text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
                        }`}
                        title={expanded ? undefined : item.label}
                      >
                        <item.icon size={16} strokeWidth={1.8} className="shrink-0" />
                        {expanded && <span className="text-[14px] truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom: docs + user */}
          {/* Bottom */}
          <div className={`border-t border-white/[0.06] py-3 ${expanded ? "px-3" : "px-[5px]"}`}>
            <Link
              href="/docs"
              className={`flex items-center gap-2.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors ${
                expanded ? "px-3 py-1.5 text-[13px]" : "h-10 w-10 justify-center"
              }`}
              title={expanded ? undefined : "Docs"}
            >
              <BookOpen size={16} strokeWidth={1.8} className="shrink-0" />
              {expanded && <span>{t("platform.docs")}</span>}
            </Link>
          </div>

          <div className={`border-t border-white/[0.06] py-3 ${expanded ? "px-3" : "px-[5px] flex justify-center"}`}>
            <button
              onClick={(e) => { setMenuRect((e.currentTarget).getBoundingClientRect()); setUserMenu(true); }}
              className={`flex items-center gap-2.5 rounded-lg hover:bg-white/[0.04] transition-colors ${
                expanded ? "w-full px-2 py-2" : "h-10 w-10 justify-center"
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.1] text-white/60 text-[11px] font-semibold">{userInitial}</div>
              {expanded && (
                <>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="text-[13px] text-white/70 truncate">{userName}</div>
                    <div className="text-[11px] text-white/30 truncate">{userEmail}</div>
                  </div>
                  <ChevronDown size={14} className="text-white/20 shrink-0" />
                </>
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
        <footer className="shrink-0 flex items-center justify-center gap-6 py-4 border-t border-white/[0.06]">
          <span className="text-[13px] text-white/20">{t("platform.apiStatus")}</span>
          <span className="text-[13px] text-white/20 hover:text-white/40 cursor-pointer transition-colors">{t("platform.helpSupport")}</span>
          <span className="text-[13px] text-white/20 hover:text-white/40 cursor-pointer transition-colors">{t("platform.feedback")}</span>
        </footer>
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
