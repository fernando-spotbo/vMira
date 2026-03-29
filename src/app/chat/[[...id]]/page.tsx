"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ChatProvider, useChat } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ChatArea from "@/components/ChatArea";
import InputBar from "@/components/InputBar";
import { MiraHeading } from "@/components/MiraHeading";
import RemindersPage from "@/components/RemindersPage";
import ProjectsPage from "@/components/ProjectsPage";
import ProtectedRoute from "@/components/ProtectedRoute";

function ChatLayout() {
  const {
    conversations,
    activeConversation,
    activeConversationId,
    isThinking,
    createNewChat,
    addMessage,
    sendMessage,
    setActiveConversationId,
    setIsThinking,
    showReminders,
    setShowReminders,
    showProjects,
    setShowProjects,
  } = useChat();
  const params = useParams();
  const searchParams = useSearchParams();
  const initialMessageHandled = useRef(false);
  const urlSyncedRef = useRef(false);

  // Read conversation ID from URL on mount (e.g. /chat/abc123)
  const urlConvId = (params?.id as string[] | undefined)?.[0] ?? null;

  // Set active conversation from URL param — wait for conversations to load
  useEffect(() => {
    if (!urlConvId) return;
    if (urlSyncedRef.current) return;
    if (conversations.length === 0) return; // wait for async load
    urlSyncedRef.current = true;
    const found = conversations.find((c) => c.id === urlConvId);
    if (found) {
      setActiveConversationId(urlConvId);
    }
  }, [urlConvId, conversations, setActiveConversationId]);

  // Sync URL whenever active conversation changes (cosmetic — no navigation)
  useEffect(() => {
    if (!urlSyncedRef.current) return;
    const currentPath = window.location.pathname;
    const targetPath = activeConversationId ? `/chat/${activeConversationId}` : "/chat";
    if (currentPath !== targetPath) {
      window.history.replaceState({}, "", targetPath);
    }
  }, [activeConversationId]);

  // Show chat view whenever a conversation is selected (even if messages are still loading)
  const showChatView = activeConversationId !== null;

  // Handle initial message from landing page
  useEffect(() => {
    if (initialMessageHandled.current) return;
    const q = searchParams.get("q");
    if (!q) return;

    initialMessageHandled.current = true;

    // Create a new chat and send the message
    createNewChat();
  }, [searchParams, createNewChat]);

  // Once a new chat is created from the landing page query, send the message via real API
  useEffect(() => {
    if (!initialMessageHandled.current) return;
    const q = searchParams.get("q");
    if (!q || !activeConversationId) return;
    if (activeConversation && activeConversation.messages.length > 0) return;

    sendMessage(q);
    window.history.replaceState({}, "", "/chat");
  }, [activeConversationId, activeConversation, searchParams, sendMessage]);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#161616]">
      <Sidebar />
      <main className="relative flex flex-1 flex-col min-w-0 min-h-0 h-full overflow-hidden">
        {showReminders ? (
          <RemindersPage onBack={() => setShowReminders(false)} />
        ) : showProjects ? (
          <ProjectsPage onBack={() => setShowProjects(false)} />
        ) : (
          <>
            <TopBar />
            {showChatView ? (
              <>
                <ChatArea />
                <InputBar />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-5 pb-14">
                <MiraHeading />
                <div className="w-full max-w-[660px]">
                  <InputBar centered />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatProvider>
        <ChatLayout />
      </ChatProvider>
    </ProtectedRoute>
  );
}
