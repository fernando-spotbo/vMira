"use client";

import { ChatProvider, useChat } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ChatArea from "@/components/ChatArea";
import InputBar from "@/components/InputBar";
import LandingState from "@/components/LandingState";

function AppLayout() {
  const { activeConversation } = useChat();
  const isEmptyState =
    !activeConversation || activeConversation.messages.length === 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gpt-gray-800">
      {/* Hide sidebar on landing */}
      {!isEmptyState && <Sidebar />}

      <main className="flex flex-1 flex-col min-w-0">
        <TopBar />
        {isEmptyState ? (
          <LandingState />
        ) : (
          <>
            <ChatArea />
            <InputBar />
          </>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <ChatProvider>
      <AppLayout />
    </ChatProvider>
  );
}
