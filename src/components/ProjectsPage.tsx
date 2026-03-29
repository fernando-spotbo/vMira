"use client";

import { useState, useRef, useEffect } from "react";
import {
  FolderOpen, Folder, Plus, Pencil, Trash2, MessageSquare,
  ChevronRight, ChevronDown, ArrowLeft, MoreHorizontal,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import type { Project } from "@/lib/types";

// ── ProjectsPage ────────────────────────────────────────────────────────

export default function ProjectsPage({ onBack }: { onBack: () => void }) {
  const {
    projects, conversations, createProject, renameProject,
    deleteProject, setActiveConversationId, setShowProjects,
  } = useChat();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors md:hidden"
        >
          <ArrowLeft size={18} />
        </button>
        <FolderOpen size={20} className="text-white/70" />
        <h1 className="text-lg font-semibold text-white">{t("sidebar.projects")}</h1>
        <div className="flex-1" />
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 hover:bg-white/[0.08] hover:text-white transition-colors"
        >
          <Plus size={14} />
          <span>{t("project.new")}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-3">
          {/* Create input */}
          {creating && (
            <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-4">
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                onBlur={handleCreate}
                placeholder={t("project.new")}
                className="w-full rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/[0.25]"
              />
            </div>
          )}

          {/* Project cards */}
          {projects.length === 0 && !creating ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] mb-4">
                <Folder size={24} className="text-white/30" />
              </div>
              <p className="text-white/50 text-sm mb-1">Нет проектов</p>
              <p className="text-white/30 text-xs mb-5">Организуйте чаты в именованные группы</p>
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                <Plus size={14} />
                <span>{t("project.new")}</span>
              </button>
            </div>
          ) : (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                conversations={projectConvs(project.id)}
                onSelectConversation={(id) => {
                  setActiveConversationId(id);
                  setShowProjects(false);
                }}
              />
            ))
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
  conversations: { id: string; title: string; starred?: boolean; updatedAt?: string }[];
  onSelectConversation: (id: string) => void;
}) {
  const { renameProject, deleteProject } = useChat();
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="group relative flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:text-white transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {expanded
          ? <FolderOpen size={18} className="shrink-0 text-white/50" />
          : <Folder size={18} className="shrink-0 text-white/50" />
        }
        {project.emoji && <span className="text-base">{project.emoji}</span>}

        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={handleRename}
            className="flex-1 rounded border border-white/[0.12] bg-white/[0.05] px-2 py-1 text-sm text-white focus:outline-none focus:border-white/[0.25]"
          />
        ) : (
          <span className="flex-1 truncate text-sm font-medium text-white">{project.name}</span>
        )}

        <span className="text-xs text-white/30">
          {conversations.length} {conversations.length === 1 ? "чат" : conversations.length < 5 ? "чата" : "чатов"}
        </span>

        {!renaming && (
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="flex h-7 w-7 items-center justify-center rounded text-white/40 opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] hover:text-white transition-all"
          >
            <MoreHorizontal size={14} />
          </button>
        )}

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-4 top-full z-50 mt-1 w-44 rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
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
              onClick={() => { deleteProject(project.id); setMenuOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/[0.05] transition-colors"
            >
              <Trash2 size={14} />
              <span>{t("project.delete")}</span>
            </button>
          </div>
        )}
      </div>

      {/* Conversation list */}
      {expanded && (
        <div className="border-t border-white/[0.04]">
          {conversations.length === 0 ? (
            <div className="px-4 py-4 text-center text-xs text-white/25 italic">
              Пока нет чатов в этом проекте
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
              >
                <MessageSquare size={14} className="shrink-0 text-white/30" />
                <span className="flex-1 truncate text-sm text-white/70">{conv.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
