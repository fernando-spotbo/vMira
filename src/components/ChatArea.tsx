"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";

export default function ChatArea() {
  const { activeConversation } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMessages =
    activeConversation && activeConversation.messages.length > 0;

  useEffect(() => {
    if (hasMessages) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConversation?.messages, hasMessages]);

  if (!hasMessages) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <h1 className="text-3xl font-semibold text-gpt-gray-100">
          What can I help with?
        </h1>
      </div>
    );
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
