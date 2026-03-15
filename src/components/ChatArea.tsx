"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";

export default function ChatArea() {
  const { activeConversation } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const isEmptyState =
    !activeConversation || activeConversation.messages.length === 0;

  useEffect(() => {
    if (!isEmptyState) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConversation?.messages, isEmptyState]);

  if (isEmptyState) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto hide-scrollbar">
      <div className="mx-auto max-w-3xl px-4 py-4">
        {activeConversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
