"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  ArrowLeft,
  MoreHorizontal,
  Search,
  FolderOpen,
  Star,
  FileText,
  BookOpen,
  ArrowUp,
  Clock,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import type { Project } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function lastUpdated(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return "Updated just now";
    if (m < 60) return `Updated ${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Updated ${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Updated yesterday";
    if (d < 30) return `Updated ${d} days ago`;
    return `Updated ${new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ── ProjectsPage (router between list and detail)
// ═══════════════════════════════════════════════════════════════════════

export default function ProjectsPage({ onBack }: { onBack: () => void }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const { projects } = useChat();

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  if (activeProject) {
    return (
      <ProjectDetail
        project={activeProject}
        onBack={() => setActiveProjectId(null)}
      />
    );
  }

  return (
    <ProjectList
      onSelectProject={(id) => setActiveProjectId(id)}
      onBack={onBack}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Project List View
// ═══════════════════════════════════════════════════════════════════════

function ProjectList({
  onSelectProject,
  onBack,
}: {
  onSelectProject: (id: string) => void;
  onBack: () => void;
}) {
  const { projects, conversations, createProject } = useChat();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (name) {
      const project = await createProject(name);
      if (project) onSelectProject(project.id);
    }
    setNewName("");
    setCreating(false);
  };

  const projectConvs = useCallback(
    (pid: string) => conversations.filter((c) => c.projectId === pid),
    [conversations]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        projectConvs(p.id).some((c) => c.title.toLowerCase().includes(q))
    );
  }, [projects, search, projectConvs]);

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
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            <span>{t("project.new")}</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 pb-10">
          {/* Search */}
          {projects.length >= 1 && (
            <div className="mb-5">
              <div className="relative">
                <Search
                  size={15}
                  strokeWidth={1.8}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.025] pl-10 pr-4 py-2.5 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-white/[0.12] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Create inline */}
          {creating && (
            <div className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[13px] text-white/40 mb-2.5">New project</p>
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
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
                <FolderOpen size={28} strokeWidth={1.4} className="text-white/15" />
              </div>
              <p className="text-[16px] text-white/25">No projects yet</p>
              <p className="text-[14px] text-white/15 mt-1.5 text-center max-w-xs">
                Projects let you organize chats, add instructions, and attach reference files
              </p>
            </div>
          ) : (
            <>
              {/* Search empty */}
              {search && filtered.length === 0 && (
                <div className="flex flex-col items-center py-16">
                  <Search size={20} strokeWidth={1.4} className="text-white/15 mb-3" />
                  <p className="text-[14px] text-white/25">No results for &ldquo;{search}&rdquo;</p>
                </div>
              )}

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map((project) => {
                  const convs = projectConvs(project.id);
                  const latestConv = convs.length > 0
                    ? convs.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b))
                    : null;
                  const updated = latestConv?.createdAt || project.updatedAt;

                  return (
                    <button
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      className="group relative text-left rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] p-5 transition-all duration-200"
                    >
                      <h3 className="text-[15px] font-medium text-white leading-snug mb-1.5 pr-2 line-clamp-2">
                        {project.name}
                      </h3>

                      <p className="text-[13px] text-white/25 mb-4">{lastUpdated(updated)}</p>

                      {/* Preview of recent conversations */}
                      {convs.length > 0 ? (
                        <div className="space-y-1.5">
                          {convs.slice(0, 3).map((c) => (
                            <p key={c.id} className="text-[13px] text-white/30 truncate leading-snug">
                              {c.title}
                            </p>
                          ))}
                          {convs.length > 3 && (
                            <p className="text-[13px] text-white/15">
                              +{convs.length - 3} more
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[13px] text-white/15 italic">No chats yet</p>
                      )}

                      {/* Bottom meta */}
                      <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center gap-1.5">
                        <MessageSquare size={12} strokeWidth={1.8} className="text-white/20" />
                        <span className="text-[13px] text-white/20">
                          {convs.length} {convs.length === 1 ? "conversation" : "conversations"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Project Detail View
// ═══════════════════════════════════════════════════════════════════════

function ProjectDetail({
  project,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  const {
    conversations,
    renameProject,
    deleteProject,
    setActiveConversationId,
    setShowProjects,
    sendMessage,
    moveConversationToProject,
    activeConversationId,
  } = useChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [input, setInput] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track when we launch a chat from this project so we can auto-assign it
  const pendingProjectAssign = useRef<string | null>(null);

  const projectConvs = useMemo(
    () => conversations.filter((c) => c.projectId === project.id),
    [conversations, project.id]
  );

  // When active conversation changes and we have a pending project assign, do it
  useEffect(() => {
    if (pendingProjectAssign.current && activeConversationId) {
      const pid = pendingProjectAssign.current;
      pendingProjectAssign.current = null;
      const timer = setTimeout(() => {
        moveConversationToProject(activeConversationId, pid);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeConversationId, moveConversationToProject]);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  const handleRename = () => {
    const name = renameValue.trim();
    if (name && name !== project.name) renameProject(project.id, name);
    setRenaming(false);
  };

  const handleDelete = () => {
    deleteProject(project.id);
    setMenuOpen(false);
    onBack();
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    pendingProjectAssign.current = project.id;
    setShowProjects(false);
    requestAnimationFrame(() => {
      sendMessage(text);
    });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value.replace(/^\s+/, ""));
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const openConversation = (convId: string) => {
    setActiveConversationId(convId);
    setShowProjects(false);
  };

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center h-14">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={1.8} />
            All projects
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 pb-10">
          {/* Project title row */}
          <div className="flex items-start gap-3 mb-8">
            <div className="flex-1 min-w-0">
              {renaming ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  onBlur={handleRename}
                  className="w-full text-[22px] font-semibold text-white bg-transparent border-b border-white/[0.12] focus:border-white/[0.25] focus:outline-none pb-1 transition-colors"
                />
              ) : (
                <h1 className="text-[22px] font-semibold text-white leading-tight">
                  {project.name}
                </h1>
              )}
            </div>

            {!renaming && (
              <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                  >
                    <MoreHorizontal size={16} strokeWidth={1.8} />
                  </button>
                  {menuOpen && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
                    >
                      <button
                        onClick={() => { setMenuOpen(false); setRenameValue(project.name); setRenaming(true); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Pencil size={14} />
                        <span>{t("project.rename")}</span>
                      </button>
                      <div className="my-1 border-t border-white/[0.06]" />
                      <button
                        onClick={handleDelete}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/[0.05] transition-colors"
                      >
                        <Trash2 size={14} />
                        <span>{t("project.delete")}</span>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
                >
                  <Star size={16} strokeWidth={1.8} />
                </button>
              </div>
            )}
          </div>

          {/* ── Two-column layout ── */}
          <div className="flex gap-6 flex-col lg:flex-row">
            {/* ── Left: Chat + Conversations ── */}
            <div className="flex-1 min-w-0">
              {/* Embedded chat input — matches mira-input-container */}
              <div className="mira-input-container rounded-2xl px-5 pt-4 pb-3 mb-6">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="How can I help you today?"
                  rows={1}
                  className="w-full max-h-[160px] resize-none overflow-y-auto bg-transparent text-[17px] leading-relaxed text-white placeholder-white/25 focus:outline-none"
                />
                <div className="flex items-center justify-between mt-3">
                  <button className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/30 hover:text-white/60 hover:bg-black/30 transition-colors">
                    <Plus size={22} strokeWidth={1.8} />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition-all duration-200 ${
                      input.trim()
                        ? "bg-white text-[#161616] hover:bg-white/90 active:scale-95"
                        : "text-white/15"
                    }`}
                  >
                    <ArrowUp size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Conversations list */}
              {projectConvs.length > 0 ? (
                <div>
                  {projectConvs.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv.id)}
                      className="flex w-full items-center gap-3 py-3.5 px-2 -mx-2 rounded-xl hover:bg-white/[0.06] transition-colors text-left group/conv border-b border-white/[0.03] last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-white group-hover/conv:text-white truncate transition-colors leading-snug">
                          {conv.title}
                        </p>
                        <p className="text-[13px] text-white/30 mt-0.5 flex items-center gap-1.5">
                          Last message {timeAgo(conv.createdAt)}
                        </p>
                      </div>
                      {conv.starred && (
                        <Star size={12} strokeWidth={1.8} className="text-white/25 fill-white/15 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-white/20">
                    No conversations in this project yet
                  </p>
                </div>
              )}
            </div>

            {/* ── Right: Instructions + Files ── */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              {/* Instructions */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <h3 className="text-[15px] font-medium text-white">Instructions</h3>
                    <p className="text-[13px] text-white/30 mt-0.5">
                      Add instructions to tailor responses
                    </p>
                  </div>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors">
                    <Plus size={16} strokeWidth={1.8} />
                  </button>
                </div>
              </div>

              {/* Files */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <h3 className="text-[15px] font-medium text-white">Files</h3>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors">
                    <Plus size={16} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="px-4 pb-4">
                  <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] flex flex-col items-center justify-center py-10 px-4">
                    <div className="flex items-center gap-1 mb-3">
                      <div className="w-8 h-10 rounded border border-white/[0.08] bg-white/[0.03] flex items-center justify-center">
                        <FileText size={14} className="text-white/15" />
                      </div>
                      <div className="w-8 h-10 rounded border border-white/[0.08] bg-white/[0.03] flex items-center justify-center -ml-1.5">
                        <BookOpen size={14} className="text-white/15" />
                      </div>
                      <div className="w-8 h-10 rounded border border-dashed border-white/[0.1] bg-white/[0.02] flex items-center justify-center -ml-1.5">
                        <Plus size={14} className="text-white/15" />
                      </div>
                    </div>
                    <p className="text-[13px] text-white/25 text-center leading-relaxed">
                      Add PDFs, documents, or other text to reference in this project.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
