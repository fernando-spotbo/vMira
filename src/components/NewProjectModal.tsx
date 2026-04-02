"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FolderOpen, X } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { t } from "@/lib/i18n";

interface NewProjectModalProps {
  onClose: () => void;
  /** Called after project is created — receives the new project ID */
  onCreated?: (projectId: string) => void;
}

export default function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { createProject } = useChat();

  useEffect(() => {
    // Focus after mount animation
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const project = await createProject(trimmed);
    setSubmitting(false);
    if (project) {
      onCreated?.(project.id);
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 animate-fade-in-up" style={{ animationDuration: "0.2s" }} />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-fade-in-up"
        style={{ animationDuration: "0.25s" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04]">
              <FolderOpen size={16} strokeWidth={1.8} className="text-white/40" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-white">{t("project.new")}</h2>
              <p className="text-[13px] text-white/30 mt-0.5">Organize chats and add context</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <label className="block text-[13px] font-medium text-white/50 mb-2">
            Project name
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="e.g. Marketing Campaign, Research Paper..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[15px] text-white placeholder-white/20 focus:outline-none focus:border-white/[0.18] transition-colors"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 pb-5">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[14px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="rounded-lg bg-white px-5 py-2 text-[14px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            {submitting ? "Creating..." : "Create project"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
