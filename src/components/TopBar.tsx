"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@/context/ChatContext";
import ModelSelector from "./ModelSelector";
import { ChevronDown, Star, Pencil, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";

export default function TopBar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    activeConversation,
    renameConversation,
    deleteConversation,
    starConversation,
  } = useChat();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleStartRename = () => {
    if (!activeConversation) return;
    setRenameValue(activeConversation.title);
    setRenaming(true);
    setDropdownOpen(false);
  };

  const handleConfirmRename = () => {
    if (activeConversation && renameValue.trim()) {
      renameConversation(activeConversation.id, renameValue.trim());
    }
    setRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirmRename();
    if (e.key === "Escape") setRenaming(false);
  };

  const handleDelete = () => {
    if (activeConversation) {
      deleteConversation(activeConversation.id);
    }
    setDropdownOpen(false);
  };

  const handleStar = () => {
    if (activeConversation) {
      starConversation(activeConversation.id);
    }
    setDropdownOpen(false);
  };

  const hasConversation = activeConversation && activeConversation.messages.length > 0;

  return (
    <header className="absolute top-0 left-0 right-0 flex h-12 items-center justify-between px-3 md:px-4 z-10 pointer-events-none">
      <div className="flex items-center gap-1 pointer-events-auto">
        {/* Mobile sidebar toggle */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        )}

        {/* Chat title with dropdown OR model selector */}
        {hasConversation ? (
          <div ref={dropdownRef} className="relative">
            {renaming ? (
              <input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleConfirmRename}
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/[0.2]"
              />
            ) : (
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:bg-white/[0.06] transition-colors"
              >
                {activeConversation.starred && (
                  <Star size={14} fill="currentColor" className="text-white" />
                )}
                <span className="max-w-[240px] truncate">{activeConversation.title}</span>
                <ChevronDown
                  size={14}
                  className={`text-white/40 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
                <button
                  onClick={handleStar}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Star size={15} className={activeConversation.starred ? "fill-current" : ""} />
                  <span>{activeConversation.starred ? t("topbar.unstar") : t("topbar.star")}</span>
                </button>
                <button
                  onClick={handleStartRename}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Pencil size={15} />
                  <span>{t("topbar.rename")}</span>
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/[0.06] transition-colors"
                >
                  <Trash2 size={15} />
                  <span>{t("topbar.delete")}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <ModelSelector />
        )}
      </div>

      <div />
    </header>
  );
}
