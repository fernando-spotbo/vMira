"use client";

import { useChat } from "@/context/ChatContext";
import ModelSelector from "./ModelSelector";
import { Plus } from "lucide-react";

export default function TopBar() {
  const { sidebarOpen, toggleSidebar, createNewChat } = useChat();

  return (
    <header className="flex h-14 items-center justify-between px-3 md:px-4">
      <div className="flex items-center gap-1">
        {!sidebarOpen && (
          <>
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gpt-gray-400 hover:bg-gpt-gray-700 transition-colors"
              title="Open sidebar"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            <button
              onClick={createNewChat}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gpt-gray-400 hover:bg-gpt-gray-700 transition-colors"
              title="New chat"
            >
              <Plus size={20} />
            </button>
          </>
        )}
        <ModelSelector />
      </div>

      {/* Placeholder for share/profile on right */}
      <div />
    </header>
  );
}
