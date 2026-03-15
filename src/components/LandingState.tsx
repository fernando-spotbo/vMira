"use client";

import { useChat } from "@/context/ChatContext";
import { Paperclip, Globe, GraduationCap, ImagePlus, AudioLines, ArrowUp, CircleHelp } from "lucide-react";
import { useState, useRef } from "react";

const actionChips = [
  { icon: Paperclip, label: "Attach" },
  { icon: Globe, label: "Search" },
  { icon: GraduationCap, label: "Study" },
  { icon: ImagePlus, label: "Create image" },
];

export default function LandingState() {
  const { activeConversation, activeConversationId, addMessage, createNewChat } = useChat();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmptyState =
    !activeConversation || activeConversation.messages.length === 0;

  if (!isEmptyState) return null;

  const handleSubmit = () => {
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

    setTimeout(() => {
      addMessage(convId, {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content:
          "This is a mock response. In a real implementation, this would be connected to an AI API.",
      });
    }, 500);

    setInput("");
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
    <div className="flex flex-1 flex-col">
      {/* Centered content area */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <h1 className="mb-8 text-3xl font-semibold text-gpt-gray-100">
          What can I help with?
        </h1>

        {/* Input bar */}
        <div className="w-full max-w-3xl">
          <div className="rounded-3xl border border-gpt-gray-600 bg-gpt-gray-700 px-4 py-3 shadow-lg focus-within:border-gpt-gray-500 transition-colors">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything"
              rows={1}
              className="w-full max-h-[45vh] resize-none bg-transparent text-[15px] text-gpt-gray-100 placeholder-gpt-gray-400 focus:outline-none"
            />

            {/* Bottom row: chips + voice/send */}
            <div className="mt-2 flex items-center justify-between">
              {/* Action chips */}
              <div className="flex items-center gap-2">
                {actionChips.map((chip) => (
                  <button
                    key={chip.label}
                    className="flex items-center gap-1.5 rounded-full border border-gpt-gray-600 px-3 py-1.5 text-xs text-gpt-gray-300 hover:bg-gpt-gray-600 transition-colors"
                  >
                    <chip.icon size={14} />
                    <span className="hidden sm:inline">{chip.label}</span>
                  </button>
                ))}
              </div>

              {/* Voice / Send button */}
              <div className="flex items-center gap-2">
                {input.trim() ? (
                  <button
                    onClick={handleSubmit}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gpt-gray-900 hover:bg-gpt-gray-200 transition-colors"
                    title="Send message"
                  >
                    <ArrowUp size={18} strokeWidth={2.5} />
                  </button>
                ) : (
                  <button
                    className="flex items-center gap-1.5 rounded-full bg-gpt-gray-800 px-3 py-1.5 text-sm text-gpt-gray-300 hover:bg-gpt-gray-600 transition-colors"
                    title="Voice"
                  >
                    <AudioLines size={16} />
                    <span className="hidden sm:inline">Voice</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <p className="py-3 text-center text-xs text-gpt-gray-500">
        By sending a message to ChatGPT, you agree to our{" "}
        <span className="underline cursor-pointer">Terms</span> and confirm you have read our{" "}
        <span className="underline cursor-pointer">Privacy Policy</span>.
      </p>
    </div>
  );
}
