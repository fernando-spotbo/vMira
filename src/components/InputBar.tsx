"use client";

import { useState, useRef, useCallback } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { getRandomMockResponse } from "@/lib/mock-responses";

export default function InputBar() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { activeConversationId, addMessage, replaceMessage, createNewChat } = useChat();

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const convId = activeConversationId;
    if (!convId) {
      createNewChat();
      setInput("");
      return;
    }

    addMessage(convId, {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    });

    // Simulate assistant typing + response
    const typingId = `typing-${Date.now()}`;
    addMessage(convId, {
      id: typingId,
      role: "assistant",
      content: "●●●",
    });

    setTimeout(() => {
      // Replace typing indicator with actual response
      replaceMessage(convId, typingId, {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: getRandomMockResponse(),
      });
    }, 1000 + Math.random() * 1500);

    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, activeConversationId, addMessage, replaceMessage, createNewChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.45) + "px";
  };

  return (
    <div className="w-full px-2 pb-4 pt-2 md:px-4">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end rounded-3xl border border-gpt-gray-600 bg-gpt-gray-700 px-3 py-2 shadow-lg focus-within:border-gpt-gray-500 transition-colors">
          {/* Attachment button */}
          <button
            className="mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gpt-gray-400 hover:bg-gpt-gray-600 transition-colors"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message ChatGPT"
            rows={1}
            className="max-h-[45vh] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-gpt-gray-100 placeholder-gpt-gray-400 focus:outline-none"
          />

          {/* Send button */}
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

        {/* Footer text */}
        <p className="mt-2 text-center text-xs text-gpt-gray-500">
          ChatGPT can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
