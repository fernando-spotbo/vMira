"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import { Ellipsis, Search, PenLine, Settings, HelpCircle, LogOut, ChevronRight, ChevronDown, Star, Pencil, Trash2, Zap, BookOpen, FileText, Shield, Bug, Keyboard, Clock, Folder, FolderOpen, CornerDownRight, X, Plus, Terminal, Building2 } from "lucide-react";
import SearchModal from "./SearchModal";
import SettingsModal from "./SettingsModal";
import PricingModal from "./PricingModal";

function MiraLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
      <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
    </svg>
  );
}

function UserMenuPopup({
  anchorRect,
  onClose,
  onOpenSettings,
  onOpenPricing,
  onLogout,
  userName,
  userEmail,
  userInitial,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenPricing: () => void;
  onLogout: () => void;
  userName: string;
  userEmail: string;
  userInitial: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const [submenu, setSubmenu] = useState<"help" | "learn" | null>(null);
  const submenuTimeout = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <div ref={menuRef} className="fixed z-[150] flex gap-1" style={{ left: anchorRect.left, bottom: window.innerHeight - anchorRect.top + 8 }}>
      {/* Main menu */}
      <div className="w-[240px] rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
        {/* User info */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.15] text-white text-sm font-semibold">{userInitial}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{userName}</div>
              <div className="text-xs text-white/70 truncate">{userEmail}</div>
            </div>
          </div>
        </div>

        {/* Primary actions */}
        <button
          onClick={() => { onClose(); setTimeout(onOpenSettings, 50); }}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
        >
          <Settings size={16} />
          <span className="flex-1 text-left">{t("user.settings")}</span>
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

        {/* Plans & extras */}
        <button
          onClick={() => { onClose(); setTimeout(onOpenPricing, 50); }}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
        >
          <Zap size={16} /><span className="flex-1 text-left">{t("user.plans")}</span>
        </button>
        <button
          onMouseEnter={() => openSubmenu("learn")}
          onMouseLeave={closeSubmenuDelayed}
          onClick={() => setSubmenu(submenu === "learn" ? null : "learn")}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
        >
          <HelpCircle size={16} /><span className="flex-1 text-left">{t("user.learnMore")}</span><ChevronRight size={14} className="text-white/40" />
        </button>

        <div className="my-1 border-t border-white/[0.06]" />

        {/* Log out */}
        <button onClick={() => { onClose(); onLogout(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors">
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
                  onClick={onClose}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={item.label}
                onClick={onClose}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    sidebarOpen,
    setSidebarOpen,
    createNewChat,
    showReminders,
    setShowReminders,
    showProjects,
    setShowProjects,
    showCode,
    setShowCode,
    showOrgSettings,
    setShowOrgSettings,
    reloadData,
    projects,
  } = useChat();
  const { user, logout, switchOrg } = useAuth();

  const userName = user?.name || "User";
  const userEmail = user?.email || user?.phone || "";
  const userInitial = userName.charAt(0).toUpperCase();
  const userPlan = user?.chat_plan || user?.plan || "free";
  const planLabels: Record<string, string> = { free: t("plan.free"), pro: t("plan.pro"), max: t("plan.max"), enterprise: t("plan.enterprise") };

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userMenuRect, setUserMenuRect] = useState<DOMRect | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const starredConversations = conversations.filter((c) => c.starred);
  const recentConversations = conversations.filter((c) => !c.starred && !c.projectId);
  const projectConversations = useMemo(() => {
    const map: Record<string, typeof conversations> = {};
    for (const p of projects) map[p.id] = [];
    for (const c of conversations) {
      if (c.projectId && !c.starred && map[c.projectId]) {
        map[c.projectId].push(c);
      }
    }
    return map;
  }, [conversations, projects]);

  const handleOpenUserMenu = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setUserMenuRect(rect);
    setShowUserMenu(true);
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Search modal */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}

      {/* Settings modal */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {/* Pricing modal */}
      {pricingOpen && <PricingModal onClose={() => setPricingOpen(false)} />}

      {/* User menu — rendered as fixed portal, outside sidebar overflow */}
      {showUserMenu && userMenuRect && (
        <UserMenuPopup
          anchorRect={userMenuRect}
          onClose={() => setShowUserMenu(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenPricing={() => setPricingOpen(true)}
          onLogout={async () => { await logout(); window.location.href = "/"; }}
          userName={userName}
          userEmail={userEmail}
          userInitial={userInitial}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-full w-[280px] max-w-[85vw] flex-col bg-[#131313]
          pt-[env(safe-area-inset-top)]
          transition-transform duration-300 ease-in-out md:hidden
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          (e.currentTarget as any)._touchStartX = touch.clientX;
        }}
        onTouchEnd={(e) => {
          const startX = (e.currentTarget as any)._touchStartX;
          if (startX === undefined) return;
          const endX = e.changedTouches[0].clientX;
          if (startX - endX > 60) setSidebarOpen(false); // swipe left to close
        }}
      >
        <SidebarContent
          expanded
          conversations={conversations}
          starredConversations={starredConversations}
          recentConversations={recentConversations}
          projects={projects}
          projectConversations={projectConversations}
          activeConversationId={activeConversationId}
          setActiveConversationId={(id) => { setActiveConversationId(id); setSidebarOpen(false); }}
          setSidebarOpen={setSidebarOpen}
          createNewChat={() => { createNewChat(); setSidebarOpen(false); }}
          setSearchOpen={setSearchOpen}
          onOpenUserMenu={handleOpenUserMenu}
          onOpenPricing={() => setPricingOpen(true)}
          userName={userName}
          userInitial={userInitial}
          userPlanLabel={planLabels[userPlan] || userPlan}
          showReminders={showReminders}
          setShowReminders={setShowReminders}
          showProjects={showProjects}
          setShowProjects={setShowProjects}
          showCode={showCode}
          setShowCode={setShowCode}
          showOrgSettings={showOrgSettings}
          setShowOrgSettings={setShowOrgSettings}
        />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex h-full shrink-0 flex-col bg-[#131313] transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: sidebarOpen ? 260 : 50 }}
      >
        <SidebarContent
          expanded={sidebarOpen}
          conversations={conversations}
          starredConversations={starredConversations}
          recentConversations={recentConversations}
          projects={projects}
          projectConversations={projectConversations}
          activeConversationId={activeConversationId}
          setActiveConversationId={setActiveConversationId}
          setSidebarOpen={setSidebarOpen}
          createNewChat={createNewChat}
          setSearchOpen={setSearchOpen}
          onOpenUserMenu={handleOpenUserMenu}
          onOpenPricing={() => setPricingOpen(true)}
          userName={userName}
          userInitial={userInitial}
          userPlanLabel={planLabels[userPlan] || userPlan}
          showReminders={showReminders}
          setShowReminders={setShowReminders}
          showProjects={showProjects}
          setShowProjects={setShowProjects}
          showCode={showCode}
          setShowCode={setShowCode}
          showOrgSettings={showOrgSettings}
          setShowOrgSettings={setShowOrgSettings}
        />
      </aside>
    </>
  );
}

interface SidebarContentProps {
  expanded: boolean;
  conversations: ReturnType<typeof useChat>["conversations"];
  starredConversations: ReturnType<typeof useChat>["conversations"];
  recentConversations: ReturnType<typeof useChat>["conversations"];
  projects: ReturnType<typeof useChat>["projects"];
  projectConversations: Record<string, ReturnType<typeof useChat>["conversations"]>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  createNewChat: () => void;
  setSearchOpen: (open: boolean) => void;
  onOpenUserMenu: (e: React.MouseEvent) => void;
  onOpenPricing: () => void;
  userName: string;
  userInitial: string;
  userPlanLabel: string;
  showReminders: boolean;
  setShowReminders: (show: boolean) => void;
  showProjects: boolean;
  setShowProjects: (show: boolean) => void;
  showCode: boolean;
  setShowCode: (show: boolean) => void;
  showOrgSettings: boolean;
  setShowOrgSettings: (show: boolean) => void;
}

function SidebarContent({
  expanded,
  starredConversations,
  recentConversations,
  projects,
  projectConversations,
  activeConversationId,
  setActiveConversationId,
  setSidebarOpen,
  createNewChat,
  setSearchOpen,
  onOpenUserMenu,
  onOpenPricing,
  userName,
  userInitial,
  userPlanLabel,
  showReminders,
  setShowReminders,
  showProjects,
  setShowProjects,
  showCode,
  setShowCode,
  showOrgSettings,
  setShowOrgSettings,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col" style={{ minWidth: expanded ? 260 : 50 }}>
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center px-[5px]">
        <button
          onClick={() => setSidebarOpen(!expanded)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
          title={expanded ? "Collapse" : "Expand"}
        >
          <MiraLogo size={16} />
        </button>

        {expanded && (
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
              title="Collapse"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            <button
              onClick={() => { createNewChat(); setShowReminders(false); setShowProjects(false); setShowCode(false); setShowOrgSettings(false); }}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
              title="New chat"
            >
              <PenLine size={18} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={expanded ? "px-3 pb-3 space-y-0.5" : "flex flex-col items-center gap-1 px-[5px]"}>
        {expanded ? (
          <>
            <button
              onClick={() => { createNewChat(); setShowReminders(false); setShowProjects(false); setShowCode(false); setShowOrgSettings(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-white hover:bg-white/[0.06] transition-colors"
            >
              <PenLine size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{t("sidebar.newChat")}</span>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-white hover:bg-white/[0.06] transition-colors"
            >
              <Search size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{t("sidebar.search")}</span>
            </button>
            <button
              onClick={() => { setShowReminders(true); setShowProjects(false); setShowCode(false); setShowOrgSettings(false); setActiveConversationId(null); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${showReminders ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
            >
              <Clock size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{t("reminders.title")}</span>
            </button>
            <button
              onClick={() => { setShowProjects(true); setShowReminders(false); setShowCode(false); setShowOrgSettings(false); setActiveConversationId(null); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${showProjects ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
            >
              <FolderOpen size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{t("sidebar.projects")}</span>
            </button>
            <button
              onClick={() => { setShowCode(true); setShowReminders(false); setShowProjects(false); setShowOrgSettings(false); setActiveConversationId(null); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${showCode ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
            >
              <Terminal size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{t("sidebar.code")}</span>
            </button>
            <button
              onClick={() => { setShowOrgSettings(true); setShowReminders(false); setShowProjects(false); setShowCode(false); setActiveConversationId(null); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${showOrgSettings ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
            >
              <Building2 size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{t("org.settings")}</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { createNewChat(); setShowReminders(false); setShowProjects(false); setShowCode(false); setShowOrgSettings(false); }}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
              title="New chat"
            >
              <PenLine size={18} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
              title="Search"
            >
              <Search size={18} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => { setShowReminders(true); setShowProjects(false); setShowCode(false); setShowOrgSettings(false); setActiveConversationId(null); }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${showReminders ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
              title={t("reminders.title")}
            >
              <Clock size={18} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => { setShowProjects(true); setShowReminders(false); setShowCode(false); setShowOrgSettings(false); setActiveConversationId(null); }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${showProjects ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
              title={t("sidebar.projects")}
            >
              <FolderOpen size={18} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => { setShowCode(true); setShowReminders(false); setShowProjects(false); setShowOrgSettings(false); setActiveConversationId(null); }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${showCode ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
              title={t("sidebar.code")}
            >
              <Terminal size={18} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => { setShowOrgSettings(true); setShowReminders(false); setShowProjects(false); setShowCode(false); setActiveConversationId(null); }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${showOrgSettings ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
              title={t("org.settings")}
            >
              <Building2 size={18} strokeWidth={1.8} />
            </button>
          </>
        )}
      </div>

      {/* Chat list */}
      {expanded ? (
        <>
          <div className="mx-3 border-t border-white/[0.06]" />
          <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-2">
            {/* Starred */}
            {starredConversations.length > 0 && (
              <>
                <div className="px-2 pb-2 pt-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">{t("sidebar.starred")}</span>
                </div>
                <div className="space-y-0.5 mb-4">
                  {starredConversations.map((conv) => (
                    <ChatItem key={conv.id} conv={conv} isActive={activeConversationId === conv.id} onSelect={() => { setActiveConversationId(conv.id); setShowReminders(false); setShowProjects(false); }} projects={projects} />
                  ))}
                </div>
              </>
            )}

            {/* Recents (all non-starred) */}
            <div className="flex items-center px-2 pb-2 pt-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/50 flex-1">{t("sidebar.recents")}</span>
            </div>
            <div className="space-y-0.5">
              {recentConversations.map((conv) => (
                <ChatItem key={conv.id} conv={conv} isActive={activeConversationId === conv.id} onSelect={() => { setActiveConversationId(conv.id); setShowReminders(false); setShowProjects(false); }} projects={projects} />
              ))}
            </div>
          </nav>
        </>
      ) : (
        <div className="flex-1" />
      )}

      {/* User */}
      <div className={`shrink-0 ${expanded ? "border-t border-white/[0.06] p-2" : "pb-3 flex justify-center"}`}>
        <button
          onClick={(e) => expanded && onOpenUserMenu(e)}
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
              <div className="text-[11px] text-white/70">
                {userPlanLabel}
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

import type { Project } from "@/lib/types";
import NewProjectModal from "./NewProjectModal";

/**
 * ProjectPickerModal — full-screen modal for moving a conversation to a project.
 * Searchable list with current project highlighted, "Remove" option, and "New project".
 */
function ProjectPickerModal({
  projects,
  currentProjectId,
  onSelect,
  onNewProject,
  onClose,
}: {
  projects: Project[];
  currentProjectId: string | null;
  onSelect: (projectId: string | null) => void;
  onNewProject: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) close();
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return createPortal(
    <div
      onClick={handleBackdrop}
      className={`fixed inset-0 z-[200] flex items-center justify-center px-4 transition-all duration-200 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-[380px] rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-200 ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[15px] font-medium text-white mb-3">Move to project</h3>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-2.5 text-[14px] text-white placeholder-white/25 focus:outline-none focus:border-white/[0.12] transition-colors"
            />
          </div>
        </div>

        {/* Project list */}
        <div className="max-h-[320px] overflow-y-auto px-2 pb-2">
          {/* Remove from project */}
          {currentProjectId && (
            <button
              onClick={() => onSelect(null)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/50 hover:bg-white/[0.04] transition-colors mb-1"
            >
              <X size={15} className="shrink-0 text-white/30" />
              <span>Remove from project</span>
            </button>
          )}

          {filtered.length === 0 && search && (
            <div className="px-3 py-6 text-center text-[13px] text-white/25">
              No projects found
            </div>
          )}

          {filtered.map((p) => {
            const isCurrent = p.id === currentProjectId;
            return (
              <button
                key={p.id}
                onClick={() => { if (!isCurrent) onSelect(p.id); }}
                disabled={isCurrent}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors ${
                  isCurrent
                    ? "text-white/30 cursor-default bg-white/[0.02]"
                    : "text-white hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-[16px] shrink-0">{p.emoji || "📁"}</span>
                <span className="flex-1 text-left truncate">{p.name}</span>
                {isCurrent && (
                  <span className="text-[11px] text-white/20 uppercase tracking-wide">Current</span>
                )}
              </button>
            );
          })}

          {/* New project */}
          <div className="mt-1 pt-1 border-t border-white/[0.04]">
            <button
              onClick={onNewProject}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <Plus size={15} className="shrink-0" />
              <span>New project</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ChatItem({
  conv,
  isActive,
  onSelect,
  projects,
}: {
  conv: { id: string; title: string; starred?: boolean; projectId?: string | null };
  isActive: boolean;
  onSelect: () => void;
  projects: Project[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conv.title);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { renameConversation, deleteConversation, starConversation, moveConversationToProject } = useChat();

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleRenameConfirm = () => {
    if (renameValue.trim()) renameConversation(conv.id, renameValue.trim());
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="px-1 py-0.5">
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameConfirm();
            if (e.key === "Escape") setRenaming(false);
          }}
          onBlur={handleRenameConfirm}
          className="w-full rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/[0.2]"
        />
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[15px] transition-colors
          ${isActive ? "bg-white/[0.08] text-white font-medium" : "text-white hover:bg-white/[0.06]"}
        `}
      >
        {conv.starred && <Star size={12} fill="currentColor" className="shrink-0 text-white" />}
        <span className="flex-1 truncate">{conv.title}</span>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-white opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] transition-all"
      >
        <Ellipsis size={16} />
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-1 w-48 overflow-visible rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
        >
          <button
            onClick={() => { starConversation(conv.id); setMenuOpen(false); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
          >
            <Star size={15} className={conv.starred ? "fill-current" : ""} />
            <span>{conv.starred ? t("menu.unstar") : t("menu.star")}</span>
          </button>
          <button
            onClick={() => { setMenuOpen(false); setRenameValue(conv.title); setRenaming(true); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
          >
            <Pencil size={15} />
            <span>{t("menu.rename")}</span>
          </button>

          {/* Move to project */}
          <div className="my-1 border-t border-white/[0.06]" />
          <button
            onClick={() => { setMenuOpen(false); setShowProjectPicker(true); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
          >
            <CornerDownRight size={15} />
            <span className="flex-1 text-left">{t("menu.moveToProject")}</span>
          </button>

          <div className="my-1 border-t border-white/[0.06]" />
          <button
            onClick={() => { deleteConversation(conv.id); setMenuOpen(false); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/[0.05] transition-colors"
          >
            <Trash2 size={15} />
            <span>{t("menu.delete")}</span>
          </button>
        </div>
      )}

      {/* Project picker modal */}
      {showProjectPicker && (
        <ProjectPickerModal
          projects={projects}
          currentProjectId={conv.projectId ?? null}
          onSelect={(projectId) => {
            moveConversationToProject(conv.id, projectId);
            setShowProjectPicker(false);
          }}
          onNewProject={() => {
            setShowProjectPicker(false);
            setShowNewProjectModal(true);
          }}
          onClose={() => setShowProjectPicker(false)}
        />
      )}

      {/* New Project Modal — auto-assigns this conversation to the new project */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreated={(projectId) => {
            moveConversationToProject(conv.id, projectId);
          }}
        />
      )}
    </div>
  );
}
