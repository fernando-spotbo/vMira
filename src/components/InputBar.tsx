"use client";

import { useState, useRef } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { getRandomMockResponse } from "@/lib/mock-responses";

export default function InputBar() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { activeConversationId, addMessage, createNewChat } = useChat();

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const convId = activeConversationId;
    if (!convId) {
      createNewChat();
      setInput("");
      return;
    }

    // Add user message
    addMessage(convId, {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    });

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Add mock assistant response after delay
    const response = getRandomMockResponse();
    setTimeout(() => {
      addMessage(convId, {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: response,
      });
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.45) + "px";
  };

  return (
    <div className="w-full px-2 pb-4 pt-2 md:px-4">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end rounded-3xl border border-gpt-gray-600 bg-gpt-gray-700 px-3 py-2 shadow-lg focus-within:border-gpt-gray-500 transition-colors">
          <button
            className="mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gpt-gray-400 hover:bg-gpt-gray-600 transition-colors"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message ChatGPT"
            rows={1}
            className="max-h-[45vh] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-gpt-gray-100 placeholder-gpt-gray-400 focus:outline-none"
          />

          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className={`mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors
              ${
                input.trim()
                  ? "bg-white text-gpt-gray-900 hover:bg-gpt-gray-200"
                  : "bg-gpt-gray-500 text-gpt-gray-700 cursor-not-allowed"
              }
            `}
            title="Send message"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>

        <p className="mt-2 text-center text-xs text-gpt-gray-500">
          ChatGPT can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
