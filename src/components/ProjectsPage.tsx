"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  ChevronRight,
  MoreHorizontal,
  Search,
  FolderOpen,
  Clock,
  Star,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import type { Project } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────

/** Deterministic accent color from project id */
function projectAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [210, 260, 330, 160, 30, 190, 280, 350, 140, 50];
  const hue = hues[Math.abs(hash) % hues.length];
  return `hsl(${hue}, 50%, 60%)`;
}

function timeAgo(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

// ── ProjectsPage ────────────────────────────────────────────────────────

export default function ProjectsPage({ onBack }: { onBack: () => void }) {
  const {
    projects,
    conversations,
    createProject,
    renameProject,
    deleteProject,
    setActiveConversationId,
    setShowProjects,
  } = useChat();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (name) await createProject(name);
    setNewName("");
    setCreating(false);
  };

  const projectConvs = (projectId: string) =>
    conversations.filter((c) => c.projectId === projectId);

  // Filter projects by search
  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      // Also search conversation titles within projects
      return projectConvs(p.id).some((c) =>
        c.title.toLowerCase().includes(q)
      );
    });
  }, [projects, conversations, search]);

  const totalConversations = useMemo(
    () => conversations.filter((c) => c.projectId).length,
    [conversations]
  );

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* ── Header — matches RemindersPage ── */}
      <div className="shrink-0 px-5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between h-14">
          <h1 className="text-[18px] font-semibold text-white">
            {t("sidebar.projects")}
          </h1>
          <button
            onClick={() => setCreating(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <Plus size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 pb-10">
          {/* Search — shown when 2+ projects exist */}
          {projects.length >= 2 && (
            <div className="mb-4">
              <div className="relative">
                <Search
                  size={14}
                  strokeWidth={1.8}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none"
                />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] pl-9 pr-4 py-2.5 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-white/[0.12] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Create input */}
          {creating && (
            <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                onBlur={handleCreate}
                placeholder="Project name"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[14px] text-white placeholder-white/25 focus:outline-none focus:border-white/[0.18] transition-colors"
              />
            </div>
          )}

          {/* Empty state — matches RemindersPage */}
          {projects.length === 0 && !creating ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] mb-5">
                <FolderOpen
                  size={28}
                  strokeWidth={1.4}
                  className="text-white/15"
                />
              </div>
              <p className="text-[16px] text-white/25">No projects yet</p>
              <p className="text-[14px] text-white/15 mt-1.5">
                Organize your chats into named groups
              </p>
            </div>
          ) : (
            <>
              {/* Section label */}
              {!search && (
                <p className="text-[13px] font-medium text-white/50 mb-3 px-2">
                  {projects.length}{" "}
                  {projects.length === 1 ? "project" : "projects"}
                  <span className="text-white/25 font-normal">
                    {" "}
                    &middot; {totalConversations}{" "}
                    {totalConversations === 1 ? "chat" : "chats"}
                  </span>
                </p>
              )}

              {search && filtered.length === 0 && (
                <div className="flex flex-col items-center py-16">
                  <Search
                    size={20}
                    strokeWidth={1.4}
                    className="text-white/15 mb-3"
                  />
                  <p className="text-[14px] text-white/25">
                    No projects match &ldquo;{search}&rdquo;
                  </p>
                </div>
              )}

              {/* Project list */}
              <div className="space-y-1.5">
                {filtered.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    conversations={projectConvs(project.id)}
                    onSelectConversation={(id) => {
                      setActiveConversationId(id);
                      setShowProjects(false);
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ProjectCard ─────────────────────────────────────────────────────────

function ProjectCard({
  project,
  conversations,
  onSelectConversation,
}: {
  project: Project;
  conversations: {
    id: string;
    title: string;
    starred?: boolean;
    createdAt: string;
  }[];
  onSelectConversation: (id: string) => void;
}) {
  const { renameProject, deleteProject } = useChat();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const accent = projectAccent(project.id);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleRename = () => {
    const name = renameValue.trim();
    if (name && name !== project.name) renameProject(project.id, name);
    setRenaming(false);
  };

  const lastActivity = conversations.length > 0
    ? conversations.reduce((latest, c) =>
        new Date(c.createdAt) > new Date(latest.createdAt) ? c : latest
      ).createdAt
    : project.updatedAt;

  return (
    <div className="group/card relative rounded-xl hover:bg-white/[0.02] transition-colors">
      {/* ── Project row ── */}
      <div
        className="relative flex items-center gap-3 py-3.5 px-2 -mx-2 rounded-xl cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Color accent bar */}
        <div
          className="w-[3px] h-8 rounded-full shrink-0"
          style={{ backgroundColor: accent, opacity: 0.5 }}
        />

        {/* Icon */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors"
          style={{
            backgroundColor: `${accent}08`,
            border: `1px solid ${accent}12`,
          }}
        >
          <FolderOpen
            size={16}
            strokeWidth={1.8}
            style={{ color: `${accent}` }}
            className="opacity-50"
          />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          {renaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              onBlur={handleRename}
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[14px] text-white focus:outline-none focus:border-white/[0.2] transition-colors"
            />
          ) : (
            <>
              <p className="text-[15px] text-white truncate leading-tight">
                {project.name}
              </p>
              <p className="text-[12px] text-white/25 mt-0.5 flex items-center gap-1.5">
                <MessageSquare size={10} strokeWidth={1.8} />
                <span>
                  {conversations.length}{" "}
                  {conversations.length === 1 ? "chat" : "chats"}
                </span>
                {lastActivity && (
                  <>
                    <span className="text-white/10">&middot;</span>
                    <Clock size={10} strokeWidth={1.8} className="text-white/15" />
                    <span className="text-white/15">{timeAgo(lastActivity)}</span>
                  </>
                )}
              </p>
            </>
          )}
        </div>

        {/* Expand chevron */}
        {conversations.length > 0 && !renaming && (
          <ChevronRight
            size={14}
            strokeWidth={1.8}
            className={`shrink-0 text-white/20 transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
          />
        )}

        {/* Menu button */}
        {!renaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-white/20 opacity-0 group-hover/card:opacity-100 hover:bg-white/[0.06] hover:text-white/50 transition-all"
          >
            <MoreHorizontal size={14} />
          </button>
        )}

        {/* Context menu */}
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                setRenameValue(project.name);
                setRenaming(true);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
            >
              <Pencil size={14} />
              <span>{t("project.rename")}</span>
            </button>
            <div className="my-1 border-t border-white/[0.06]" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteProject(project.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/[0.05] transition-colors"
            >
              <Trash2 size={14} />
              <span>{t("project.delete")}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Conversation list ── */}
      {expanded && conversations.length > 0 && (
        <div className="ml-[18px] pl-4 border-l border-white/[0.04] mb-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className="flex w-full items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left group/conv"
            >
              {conv.starred ? (
                <Star
                  size={13}
                  strokeWidth={1.8}
                  className="shrink-0 text-white/30 fill-white/20"
                />
              ) : (
                <MessageSquare
                  size={13}
                  strokeWidth={1.8}
                  className="shrink-0 text-white/20"
                />
              )}
              <span className="flex-1 truncate text-[14px] text-white/60 group-hover/conv:text-white/80 transition-colors">
                {conv.title}
              </span>
              <span className="text-[11px] text-white/15 shrink-0">
                {timeAgo(conv.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Empty project */}
      {expanded && conversations.length === 0 && (
        <div className="ml-[18px] pl-4 border-l border-white/[0.04] mb-2">
          <p className="py-3 px-2 text-[13px] text-white/15 italic">
            No chats in this project
          </p>
        </div>
      )}
    </div>
  );
}
