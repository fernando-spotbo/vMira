"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Circle } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { t } from "@/lib/i18n";

interface SearchModalProps {
  onClose: () => void;
}

export default function SearchModal({ onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { conversations, setActiveConversationId, setSidebarOpen } = useChat();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    inputRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const filtered = query
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase())
      )
    : conversations;

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    setSidebarOpen(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-[540px] mx-4 flex flex-col max-h-[60vh] rounded-2xl bg-[#1e1e1e] border border-white/[0.06] shadow-[0_16px_64px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center border-b border-white/[0.06] px-5 py-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent text-[16px] text-white placeholder-white/30 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-[16px] text-white/50 text-center">
              {t("search.noResults")}
            </p>
          ) : (
            <>
              {/* Section header */}
              <div className="px-5 py-2">
                <span className="text-[13px] text-white/50">{t("search.yourChats")}</span>
              </div>

              {filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left text-[16px] text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Circle size={18} className="shrink-0 text-white/40" strokeWidth={1.5} />
                  <span className="truncate">{conv.title}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
