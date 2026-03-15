"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import ThinkingIndicator from "./ThinkingIndicator";

export default function ChatArea() {
  const { activeConversation, isThinking } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMessages =
    activeConversation && activeConversation.messages.length > 0;

  useEffect(() => {
    if (hasMessages || isThinking) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConversation?.messages, hasMessages, isThinking]);

  if (!hasMessages && !isThinking) {
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
        {activeConversation?.messages.map((message, index) => {
          const isLastAssistant =
            message.role === "assistant" &&
            index === (activeConversation?.messages.length ?? 0) - 1;
          const isNewMessage = message.id.startsWith("user-") || message.id.startsWith("asst-");

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isNew={isNewMessage}
              isStreaming={isLastAssistant && message.id.startsWith("asst-")}
            />
          );
        })}
        {isThinking && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
