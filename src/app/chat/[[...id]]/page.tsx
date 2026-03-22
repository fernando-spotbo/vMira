"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ChatProvider, useChat } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ChatArea from "@/components/ChatArea";
import InputBar from "@/components/InputBar";
import { MiraHeading } from "@/components/MiraHeading";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getRandomMockResponse, getRandomSteppedResponse } from "@/lib/mock-responses";

function ChatLayout() {
  const {
    conversations,
    activeConversation,
    activeConversationId,
    isThinking,
    createNewChat,
    addMessage,
    setActiveConversationId,
    setIsThinking,
  } = useChat();
  const params = useParams();
  const searchParams = useSearchParams();
  const initialMessageHandled = useRef(false);
  const urlSyncedRef = useRef(false);

  // Read conversation ID from URL on mount (e.g. /chat/abc123)
  const urlConvId = (params?.id as string[] | undefined)?.[0] ?? null;

  // Set active conversation from URL param on first load
  useEffect(() => {
    if (urlSyncedRef.current) return;
    urlSyncedRef.current = true;
    if (urlConvId && conversations.length > 0) {
      const found = conversations.find((c) => c.id === urlConvId);
      if (found) {
        setActiveConversationId(urlConvId);
      }
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

  // Once a new chat is created from the landing page query, send the message
  useEffect(() => {
    if (!initialMessageHandled.current) return;
    const q = searchParams.get("q");
    if (!q || !activeConversationId) return;
    // Check if this conversation already has messages (avoid double-send)
    if (activeConversation && activeConversation.messages.length > 0) return;

    // Send the user message
    addMessage(activeConversationId, {
      id: `user-${Date.now()}`,
      role: "user",
      content: q,
    });

    // Simulate AI response
    setIsThinking(true);
    const stepped = getRandomSteppedResponse();
    const thinkingDuration = 1500 + Math.random() * 2000;

    if (stepped) {
      setTimeout(() => {
        setIsThinking(false);
        addMessage(activeConversationId, {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: stepped.content,
          steps: stepped.steps,
        });
      }, thinkingDuration);
    } else {
      const response = getRandomMockResponse();
      setTimeout(() => {
        setIsThinking(false);
        addMessage(activeConversationId, {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: response,
        });
      }, thinkingDuration);
    }

    // Clean the URL
    window.history.replaceState({}, "", "/chat");
  }, [activeConversationId, activeConversation, searchParams, addMessage, setIsThinking]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#161616]">
      <Sidebar />
      <main className="relative flex flex-1 flex-col min-w-0 min-h-0 h-full overflow-hidden">
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
