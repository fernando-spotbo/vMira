"use client";

import { useChat } from "@/context/ChatContext";
import { Plus, MessageSquare, Ellipsis, X } from "lucide-react";

export default function Sidebar() {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    sidebarOpen,
    setSidebarOpen,
    createNewChat,
  } = useChat();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-full w-[260px] flex-col bg-gpt-gray-850
          transition-transform duration-300 ease-in-out
          md:relative md:z-auto md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:hidden"}
        `}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-3">
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gpt-gray-400 hover:bg-gpt-gray-700"
            title="Close sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <button
            onClick={() => {
              createNewChat();
              setSidebarOpen(false);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gpt-gray-400 hover:bg-gpt-gray-700"
            title="New chat"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-2 pb-2">
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConversationId(conv.id);
                  setSidebarOpen(false);
                }}
                className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
                  ${
                    activeConversationId === conv.id
                      ? "bg-gpt-gray-700 text-gpt-gray-100"
                      : "text-gpt-gray-300 hover:bg-gpt-gray-700/50"
                  }
                `}
              >
                <span className="flex-1 truncate">{conv.title}</span>
                {activeConversationId === conv.id && (
                  <Ellipsis
                    size={16}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gpt-gray-400"
                  />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* User menu */}
        <div className="border-t border-gpt-gray-700 p-2">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-gpt-gray-300 hover:bg-gpt-gray-700/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gpt-green text-white text-xs font-semibold">
              U
            </div>
            <span>User</span>
          </button>
        </div>
      </aside>
    </>
  );
}
