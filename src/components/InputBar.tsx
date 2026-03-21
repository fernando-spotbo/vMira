"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, Plus, Image, FileUp, Mic } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import VoiceRecording from "./VoiceRecording";
import VoiceMode from "./VoiceMode";
import { t } from "@/lib/i18n";

interface InputBarProps {
  centered?: boolean;
}

function VoiceModeIcon({ animated = false }: { animated?: boolean }) {
  // Key changes on each hover so SVG remounts, playing the single-cycle animation fresh
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (animated) setKey(k => k + 1);
  }, [animated]);

  if (animated) {
    return (
      <svg key={key} width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="2.5" height="10" rx="1.25" fill="currentColor" opacity="0.7">
          <animate attributeName="height" values="10;5;10" dur="0.5s" repeatCount="1" fill="freeze" />
          <animate attributeName="y" values="7;9.5;7" dur="0.5s" repeatCount="1" fill="freeze" />
        </rect>
        <rect x="7" y="4" width="2.5" height="16" rx="1.25" fill="currentColor" opacity="0.85">
          <animate attributeName="height" values="16;8;16" dur="0.45s" repeatCount="1" fill="freeze" begin="0.05s" />
          <animate attributeName="y" values="4;8;4" dur="0.45s" repeatCount="1" fill="freeze" begin="0.05s" />
        </rect>
        <rect x="12" y="6" width="2.5" height="12" rx="1.25" fill="currentColor">
          <animate attributeName="height" values="12;6;12" dur="0.5s" repeatCount="1" fill="freeze" begin="0.1s" />
          <animate attributeName="y" values="6;9;6" dur="0.5s" repeatCount="1" fill="freeze" begin="0.1s" />
        </rect>
        <rect x="17" y="5" width="2.5" height="14" rx="1.25" fill="currentColor" opacity="0.75">
          <animate attributeName="height" values="14;6;14" dur="0.45s" repeatCount="1" fill="freeze" begin="0.08s" />
          <animate attributeName="y" values="5;9;5" dur="0.45s" repeatCount="1" fill="freeze" begin="0.08s" />
        </rect>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="7" width="2.5" height="10" rx="1.25" fill="currentColor" opacity="0.7" />
      <rect x="7" y="4" width="2.5" height="16" rx="1.25" fill="currentColor" opacity="0.85" />
      <rect x="12" y="6" width="2.5" height="12" rx="1.25" fill="currentColor" />
      <rect x="17" y="5" width="2.5" height="14" rx="1.25" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

export default function InputBar({ centered = false }: InputBarProps) {
  const [input, setInput] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showVoiceRecording, setShowVoiceRecording] = useState(false);
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const [voiceBtnHover, setVoiceBtnHover] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const { activeConversationId, createNewChat, sendMessage: sendChatMessage, cancelMessage, isStreaming, isThinking } = useChat();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // sendChatMessage handles: create conv if needed, add user msg, stream AI response
    sendChatMessage(trimmed).catch((e) => console.error("sendMessage error:", e));
  };

  const handleVoiceSend = (text: string) => {
    setInput(text);
    // Will be sent on next render cycle
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val.replace(/^\s+/, ""));
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.45) + "px";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = input;
    const newVal = current.slice(0, start) + pasted + current.slice(end);
    setInput(newVal.replace(/^\s+/, ""));
    requestAnimationFrame(() => {
      const pos = start + pasted.length;
      el.selectionStart = el.selectionEnd = pos;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.45) + "px";
    });
  };

  const hasText = input.trim().length > 0;
  const isGenerating = isStreaming || isThinking;

  // When centered (empty state), render just the input container without wrapper padding
  const inputElement = (
    <div className="mira-input-container rounded-2xl px-5 pt-4 pb-3 transition-all duration-200">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={t("chat.placeholder")}
        rows={1}
        className="w-full max-h-[45vh] resize-none overflow-y-auto bg-transparent text-[17px] leading-relaxed text-white placeholder-white/25 focus:outline-none"
      />

      <div className="mt-3 flex items-center justify-between">
        <div className="relative" ref={attachMenuRef}>
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors duration-200
              ${showAttachMenu
                ? "bg-black/40 text-white/70"
                : "text-white/30 hover:text-white/60 hover:bg-black/30"
              }`}
            title="Attach"
          >
            <Plus size={22} strokeWidth={1.8} />
          </button>

          <div
            className={`absolute bottom-full left-0 mb-2 w-52 rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)] transition-all duration-200 origin-bottom-left
              ${showAttachMenu
                ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
                : "opacity-0 scale-95 pointer-events-none translate-y-1"
              }`}
          >
            <button
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
              onClick={() => setShowAttachMenu(false)}
            >
              <Image size={16} />
              {t("chat.uploadImage")}
            </button>
            <button
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
              onClick={() => setShowAttachMenu(false)}
            >
              <FileUp size={16} />
              {t("chat.uploadFile")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isGenerating ? (
            <button
              onClick={cancelMessage}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#161616] hover:bg-white/90 active:scale-95 transition-all duration-200"
              title="Stop generating"
            >
              <Square size={14} strokeWidth={0} fill="currentColor" />
            </button>
          ) : hasText ? (
            <button
              onClick={handleSubmit}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#161616] hover:bg-white/90 active:scale-95 transition-all duration-200"
              title="Send message"
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
          ) : (
            <>
              {/* Mic button — voice-to-text dictation */}
              <button
                onClick={() => setShowVoiceRecording(true)}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/40 hover:text-white/70 hover:bg-black/30 transition-all duration-200"
                title="Voice input"
              >
                <Mic size={20} strokeWidth={1.8} />
              </button>

              {/* Waveform button — voice mode (real-time conversation) */}
              <button
                onClick={() => setShowVoiceMode(true)}
                onMouseEnter={() => setVoiceBtnHover(true)}
                onMouseLeave={() => setVoiceBtnHover(false)}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/40 hover:text-white/70 hover:bg-black/30 transition-all duration-200"
                title="Voice mode"
              >
                <VoiceModeIcon animated={voiceBtnHover} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {centered ? (
        inputElement
      ) : (
        <div className="w-full px-3 pb-4 pt-2 md:px-5">
          <div className="mx-auto max-w-3xl">
            {inputElement}
          </div>
        </div>
      )}

      {/* Voice recording overlay */}
      {showVoiceRecording && (
        <VoiceRecording
          onClose={() => setShowVoiceRecording(false)}
          onSend={handleVoiceSend}
        />
      )}

      {/* Voice mode overlay */}
      {showVoiceMode && (
        <VoiceMode onClose={() => setShowVoiceMode(false)} />
      )}
    </>
  );
}
