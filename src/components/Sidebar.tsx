"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import { Ellipsis, Search, PenLine, Settings, HelpCircle, LogOut, ChevronRight, ChevronDown, Star, Pencil, Trash2, Zap, BookOpen, FileText, Shield, Bug, Keyboard, Clock, FolderPlus, Folder, FolderOpen, CornerDownRight, X } from "lucide-react";
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
    projects,
  } = useChat();
  const { user, logout } = useAuth();

  const userName = user?.name || "User";
  const userEmail = user?.email || user?.phone || "";
  const userInitial = userName.charAt(0).toUpperCase();
  const userPlan = user?.plan || "free";
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
}: SidebarContentProps) {
  const { createProject, renameProject, deleteProject: deleteProjectCb } = useChat();
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const newProjectRef = useRef<HTMLInputElement>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const toggleProjectCollapsed = (id: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (creatingProject && newProjectRef.current) {
      newProjectRef.current.focus();
    }
  }, [creatingProject]);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (name) await createProject(name);
    setNewProjectName("");
    setCreatingProject(false);
  };
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
              onClick={() => { createNewChat(); setShowReminders(false); }}
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
              onClick={() => { createNewChat(); setShowReminders(false); }}
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
              onClick={() => { setShowReminders(true); setActiveConversationId(null); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${showReminders ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
            >
              <Clock size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{t("reminders.title")}</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { createNewChat(); setShowReminders(false); }}
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
              onClick={() => { setShowReminders(true); setActiveConversationId(null); }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${showReminders ? "bg-white/[0.08] text-white" : "text-white hover:bg-white/[0.06]"}`}
              title={t("reminders.title")}
            >
              <Clock size={18} strokeWidth={1.8} />
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
                    <ChatItem key={conv.id} conv={conv} isActive={activeConversationId === conv.id} onSelect={() => { setActiveConversationId(conv.id); setShowReminders(false); }} projects={projects} />
                  ))}
                </div>
              </>
            )}

            {/* Projects */}
            {projects.length > 0 && (
              <>
                <div className="flex items-center px-2 pb-2 pt-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-white/50 flex-1">{t("sidebar.projects")}</span>
                  <button
                    onClick={() => setCreatingProject(true)}
                    className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title={t("project.new")}
                  >
                    <FolderPlus size={12} />
                  </button>
                </div>
                {projects.map((project) => {
                  const convs = projectConversations[project.id] || [];
                  const isCollapsed = collapsedProjects[project.id];
                  return (
                    <ProjectSection
                      key={project.id}
                      project={project}
                      conversations={convs}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleProjectCollapsed(project.id)}
                      activeConversationId={activeConversationId}
                      onSelectConversation={(id) => { setActiveConversationId(id); setShowReminders(false); }}
                      projects={projects}
                    />
                  );
                })}
              </>
            )}

            {/* Create project inline */}
            {creatingProject && (
              <div className="px-1 py-1 mb-2">
                <input
                  ref={newProjectRef}
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProject();
                    if (e.key === "Escape") { setCreatingProject(false); setNewProjectName(""); }
                  }}
                  onBlur={handleCreateProject}
                  placeholder={t("project.new")}
                  className="w-full rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/[0.2]"
                />
              </div>
            )}

            {/* Recents (ungrouped) */}
            <div className="flex items-center px-2 pb-2 pt-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/50 flex-1">{t("sidebar.recents")}</span>
              {projects.length === 0 && (
                <button
                  onClick={() => setCreatingProject(true)}
                  className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                  title={t("project.new")}
                >
                  <FolderPlus size={12} />
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {recentConversations.map((conv) => (
                <ChatItem key={conv.id} conv={conv} isActive={activeConversationId === conv.id} onSelect={() => { setActiveConversationId(conv.id); setShowReminders(false); }} projects={projects} />
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

function ProjectSection({
  project,
  conversations,
  isCollapsed,
  onToggle,
  activeConversationId,
  onSelectConversation,
  projects,
}: {
  project: Project;
  conversations: { id: string; title: string; starred?: boolean; projectId?: string | null }[];
  isCollapsed: boolean;
  onToggle: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  projects: Project[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { renameProject, deleteProject } = useChat();

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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
    const name = renameValue.trim();
    if (name && name !== project.name) renameProject(project.id, name);
    setRenaming(false);
  };

  return (
    <div className="mb-1">
      <div className="relative group">
        {renaming ? (
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
        ) : (
          <button
            onClick={onToggle}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
            {isCollapsed
              ? <Folder size={14} className="shrink-0 text-white/50" />
              : <FolderOpen size={14} className="shrink-0 text-white/50" />
            }
            {project.emoji && <span className="text-sm">{project.emoji}</span>}
            <span className="flex-1 truncate">{project.name}</span>
            <span className="text-[11px] text-white/30">{conversations.length}</span>
          </button>
        )}

        {!renaming && (
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-white opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] transition-all"
          >
            <Ellipsis size={14} />
          </button>
        )}

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          >
            <button
              onClick={() => { setMenuOpen(false); setRenameValue(project.name); setRenaming(true); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
            >
              <Pencil size={15} />
              <span>{t("project.rename")}</span>
            </button>
            <div className="my-1 border-t border-white/[0.06]" />
            <button
              onClick={() => { deleteProject(project.id); setMenuOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/[0.05] transition-colors"
            >
              <Trash2 size={15} />
              <span>{t("project.delete")}</span>
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="ml-4 space-y-0.5">
          {conversations.map((conv) => (
            <ChatItem key={conv.id} conv={conv} isActive={activeConversationId === conv.id} onSelect={() => onSelectConversation(conv.id)} projects={projects} />
          ))}
          {conversations.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-white/25 italic">
              No chats yet
            </div>
          )}
        </div>
      )}
    </div>
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
  const [projectSubmenuOpen, setProjectSubmenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conv.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { renameConversation, deleteConversation, starConversation, moveConversationToProject } = useChat();

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
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
          {projects.length > 0 && (
            <>
              <div className="my-1 border-t border-white/[0.06]" />
              <div
                className="relative"
                onMouseEnter={() => setProjectSubmenuOpen(true)}
                onMouseLeave={() => setProjectSubmenuOpen(false)}
              >
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                >
                  <CornerDownRight size={15} />
                  <span className="flex-1 text-left">{t("menu.moveToProject")}</span>
                  <ChevronRight size={14} className="text-white/40" />
                </button>

                {projectSubmenuOpen && (
                  <div className="absolute left-full top-0 ml-1 w-44 rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { moveConversationToProject(conv.id, p.id); setMenuOpen(false); }}
                        className={`flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors ${
                          conv.projectId === p.id ? "text-white/40" : "text-white hover:bg-white/[0.06]"
                        }`}
                        disabled={conv.projectId === p.id}
                      >
                        <Folder size={13} className="shrink-0" />
                        {p.emoji && <span className="text-xs">{p.emoji}</span>}
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                    {conv.projectId && (
                      <>
                        <div className="my-1 border-t border-white/[0.06]" />
                        <button
                          onClick={() => { moveConversationToProject(conv.id, null); setMenuOpen(false); }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06] transition-colors"
                        >
                          <X size={13} className="shrink-0" />
                          <span>{t("menu.removeFromProject")}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

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
    </div>
  );
}
