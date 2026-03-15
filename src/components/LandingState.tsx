"use client";

import { useChat } from "@/context/ChatContext";

export default function LandingState() {
  const { activeConversation } = useChat();
  const isEmptyState =
    !activeConversation || activeConversation.messages.length === 0;

  if (!isEmptyState) return null;

  return (
    <div className="flex flex-1 items-end justify-center pb-4">
      <h1 className="text-3xl font-semibold text-gpt-gray-100">
        What can I help with?
      </h1>
    </div>
  );
}
