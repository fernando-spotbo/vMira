"use client";

import { useRouter } from "next/navigation";
import { Paperclip, Globe, GraduationCap, ImagePlus, AudioLines, ArrowUp, CircleHelp } from "lucide-react";
import { useState, useRef } from "react";

const actionChips = [
  { icon: Paperclip, label: "Attach" },
  { icon: Globe, label: "Search" },
  { icon: GraduationCap, label: "Study" },
  { icon: ImagePlus, label: "Create image" },
];

export default function LandingPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    router.push("/chat");
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gpt-gray-800">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between px-3 md:px-4">
        <div className="flex items-center gap-2">
          {/* OpenAI logo */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-gpt-gray-100">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
          </svg>
          <span className="text-lg font-semibold text-gpt-gray-100">ChatGPT</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/chat")}
            className="rounded-full border border-gpt-gray-500 px-4 py-1.5 text-sm font-medium text-gpt-gray-100 hover:bg-gpt-gray-700 transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => router.push("/chat")}
            className="rounded-full border border-gpt-gray-500 bg-gpt-gray-100 px-4 py-1.5 text-sm font-medium text-gpt-gray-900 hover:bg-gpt-gray-200 transition-colors"
          >
            Sign up
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-gpt-gray-400 hover:bg-gpt-gray-700 transition-colors">
            <CircleHelp size={20} />
          </button>
        </div>
      </header>

      {/* Centered content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <h1 className="mb-8 text-3xl font-semibold text-gpt-gray-100">
          What can I help with?
        </h1>

        {/* Input bar */}
        <div className="w-full max-w-3xl">
          <div className="rounded-3xl border border-gpt-gray-600 bg-gpt-gray-700 px-4 py-3 shadow-lg focus-within:border-gpt-gray-500 transition-colors">
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
