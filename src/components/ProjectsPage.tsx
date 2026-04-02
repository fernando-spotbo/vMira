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
  X,
  FileUp,
  ArrowUp,
  Clock,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import { uploadProjectFile } from "@/lib/api-client";
import { fetchProjectFiles, deleteProjectFile } from "@/lib/api-chat";
import type { Project, ProjectFile } from "@/lib/types";
import InputBar from "./InputBar";
import NewProjectModal from "./NewProjectModal";

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
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
  const { projects, conversations } = useChat();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");

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
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between h-14">
          <h1 className="text-[18px] font-semibold text-white">
            {t("sidebar.projects")}
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2 text-[14px] font-medium text-white/80 hover:bg-white/[0.10] hover:text-white transition-colors"
          >
            <Plus size={15} strokeWidth={2} />
            <span>{t("project.new")}</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-5 pb-10">
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

          {/* Empty state */}
          {projects.length === 0 ? (
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

                      {convs.length > 0 ? (
                        <div className="space-y-1.5">
                          {convs.slice(0, 3).map((c) => (
                            <p key={c.id} className="text-[13px] text-white/30 truncate leading-snug">
                              {c.title}
                            </p>
                          ))}
                          {convs.length > 3 && (
                            <p className="text-[13px] text-white/15">+{convs.length - 3} more</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[13px] text-white/15 italic">No chats yet</p>
                      )}

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

      {/* New Project Modal */}
      {showCreateModal && (
        <NewProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => onSelectProject(id)}
        />
      )}
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
    activeConversationId,
    setPendingProjectId,
    updateProjectInstructions,
  } = useChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions || "");
  const [instructionsEditing, setInstructionsEditing] = useState(false);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevConvIdRef = useRef(activeConversationId);

  const projectConvs = useMemo(
    () => conversations.filter((c) => c.projectId === project.id),
    [conversations, project.id]
  );

  // Set pending project ID so any new chat gets assigned to this project
  useEffect(() => {
    setPendingProjectId(project.id);
    return () => setPendingProjectId(null);
  }, [project.id, setPendingProjectId]);

  // Auto-close when a new conversation is created (via InputBar send)
  useEffect(() => {
    if (activeConversationId && activeConversationId !== prevConvIdRef.current) {
      setShowProjects(false);
    }
    prevConvIdRef.current = activeConversationId;
  }, [activeConversationId, setShowProjects]);

  // Load project files
  useEffect(() => {
    fetchProjectFiles(project.id).then((apiFiles) => {
      setFiles(
        apiFiles.map((f) => ({
          id: f.id,
          projectId: f.project_id,
          filename: f.filename,
          originalFilename: f.original_filename,
          mimeType: f.mime_type,
          sizeBytes: f.size_bytes,
          url: f.url,
          createdAt: f.created_at,
        }))
      );
    });
  }, [project.id]);

  // Sync instructions from project prop
  useEffect(() => {
    setInstructions(project.instructions || "");
  }, [project.instructions]);

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

  useEffect(() => {
    if (instructionsEditing && instructionsRef.current) {
      instructionsRef.current.focus();
    }
  }, [instructionsEditing]);

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

  const handleInstructionsSave = () => {
    setInstructionsEditing(false);
    const trimmed = instructions.trim();
    if (trimmed !== (project.instructions || "").trim()) {
      updateProjectInstructions(project.id, trimmed);
    }
  };

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      try {
        const result = await uploadProjectFile(project.id, file);
        if (result.ok && result.data.length > 0) {
          const f = result.data[0];
          setFiles((prev) => [
            ...prev,
            {
              id: f.id,
              projectId: f.project_id,
              filename: f.filename,
              originalFilename: f.original_filename,
              mimeType: f.mime_type,
              sizeBytes: f.size_bytes,
              url: f.url,
              createdAt: f.created_at,
            },
          ]);
        }
      } catch (e) {
        console.error("File upload failed:", e);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileDelete = async (fileId: string) => {
    const ok = await deleteProjectFile(project.id, fileId);
    if (ok) setFiles((prev) => prev.filter((f) => f.id !== fileId));
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
        <div className="max-w-4xl mx-auto px-5 pb-10">
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
              {/* Reuse the real InputBar component */}
              <div className="mb-6">
                <InputBar centered />
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
                  <h3 className="text-[15px] font-medium text-white">Instructions</h3>
                  {!instructionsEditing && (
                    <button
                      onClick={() => setInstructionsEditing(true)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
                    >
                      {instructions ? <Pencil size={14} strokeWidth={1.8} /> : <Plus size={16} strokeWidth={1.8} />}
                    </button>
                  )}
                </div>

                {instructionsEditing ? (
                  <div className="px-4 pb-4">
                    <textarea
                      ref={instructionsRef}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      onBlur={handleInstructionsSave}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleInstructionsSave();
                      }}
                      placeholder="Add instructions to tailor Mira's responses for this project..."
                      rows={4}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder-white/20 leading-relaxed resize-none focus:outline-none focus:border-white/[0.15] transition-colors"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleInstructionsSave}
                        className="text-[12px] text-white/40 hover:text-white/70 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : instructions ? (
                  <div className="px-4 pb-4">
                    <p className="text-[13px] text-white/40 leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {instructions}
                    </p>
                  </div>
                ) : (
                  <div className="px-4 pb-4">
                    <p className="text-[13px] text-white/20">
                      Add instructions to tailor responses
                    </p>
                  </div>
                )}
              </div>

              {/* Files */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <h3 className="text-[15px] font-medium text-white">Files</h3>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                  >
                    <Plus size={16} strokeWidth={1.8} />
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />

                <div className="px-4 pb-4">
                  {files.length > 0 ? (
                    <div className="space-y-1.5">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="group/file flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-white/[0.02] border border-white/[0.04]"
                        >
                          <FileText size={14} strokeWidth={1.8} className="text-white/25 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-white/60 truncate">{file.originalFilename}</p>
                            <p className="text-[11px] text-white/20">{formatFileSize(file.sizeBytes)}</p>
                          </div>
                          <button
                            onClick={() => handleFileDelete(file.id)}
                            className="shrink-0 opacity-0 group-hover/file:opacity-100 flex h-6 w-6 items-center justify-center rounded text-white/20 hover:text-red-400 transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] flex flex-col items-center justify-center py-8 px-4 cursor-pointer hover:border-white/[0.1] hover:bg-white/[0.02] transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileUp size={20} strokeWidth={1.4} className="text-white/15 mb-2.5" />
                      <p className="text-[13px] text-white/25 text-center leading-relaxed">
                        Add PDFs, documents, or text files to reference in this project.
                      </p>
                    </div>
                  )}

                  {uploading && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                      <span className="text-[12px] text-white/30">Uploading...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
