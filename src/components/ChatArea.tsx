"use client";

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import { ChevronDown } from "lucide-react";

/**
 * Chat scroll strategy:
 * - When a NEW message arrives (user sends), scroll to show it at top of view
 * - During streaming, do NOT auto-scroll — user reads from the top down
 * - If user manually scrolls to bottom, re-enable follow mode
 * - "Scroll to bottom" button appears when not at bottom
 */
export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming, loadMoreMessages } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prevConvId = useRef<string | null>(null);
  const prevMsgCount = useRef(0);
  const selfScroll = useRef(false);
  const loadingMore = useRef(false);
  const streamStartedRef = useRef(false);

  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messages = activeConversation?.messages ?? [];
  const lastMsgIdx = messages.length - 1;
  const generating = isThinking || isStreaming;

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    selfScroll.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => { selfScroll.current = false; });
  }, []);

  // Scroll so the last user message is near the top of the viewport
  const scrollToLastUserMessage = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Find the last user message element
    const userMsgs = el.querySelectorAll("[data-role='user']");
    const lastUser = userMsgs[userMsgs.length - 1] as HTMLElement | undefined;
    if (lastUser) {
      selfScroll.current = true;
      // Position the user message near the top with some padding
      const targetTop = lastUser.offsetTop - 24;
      el.scrollTop = targetTop;
      requestAnimationFrame(() => { selfScroll.current = false; });
    } else {
      scrollToEnd();
    }
  }, [scrollToEnd]);

  // Conversation switch → scroll to bottom
  useLayoutEffect(() => {
    if (activeConversationId !== prevConvId.current) {
      prevConvId.current = activeConversationId;
      prevMsgCount.current = messages.length;
      streamStartedRef.current = false;
      setShowScrollBtn(false);
      requestAnimationFrame(scrollToEnd);
    }
  });

  // New message added → scroll to show the user message at top
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      prevMsgCount.current = messages.length;
      // When user sends a message, scroll so their message + the assistant bubble are visible
      requestAnimationFrame(scrollToLastUserMessage);
    }
  }, [messages.length, scrollToLastUserMessage]);

  // When streaming starts, do one scroll to pin the user message at top — then stop
  useEffect(() => {
    if (generating && !streamStartedRef.current) {
      streamStartedRef.current = true;
      // Small delay to let the assistant bubble render
      setTimeout(() => scrollToLastUserMessage(), 100);
    }
    if (!generating) {
      streamStartedRef.current = false;
    }
  }, [generating, scrollToLastUserMessage]);

  // NO MutationObserver auto-scroll — user controls their own scroll during streaming

  // Scroll handler
  const onScroll = useCallback(() => {
    if (selfScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setShowScrollBtn(!nearBottom && messages.length > 0);

    // Infinite scroll — load older messages
    if (el.scrollTop < 200 && !loadingMore.current) {
      if (activeConversation?.hasMore && !activeConversation?.loadingMore) {
        loadingMore.current = true;
        const prevHeight = el.scrollHeight;
        loadMoreMessages().then(() => {
          requestAnimationFrame(() => {
            el.scrollTop += el.scrollHeight - prevHeight;
            loadingMore.current = false;
          });
        });
      }
    }
  }, [activeConversation?.hasMore, activeConversation?.loadingMore, loadMoreMessages, messages.length]);

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-[52rem] px-4 min-h-full flex flex-col justify-end">
          <div className="pt-12">
            {activeConversation?.loadingMore && (
              <div className="flex justify-center py-4">
                <div className="mira-orb" style={{ position: "relative" }} />
              </div>
            )}

            {messages.map((message, index) => {
              const isLastAssistant = message.role === "assistant" && index === lastMsgIdx;
              const isNewMsg = message.id.startsWith("user-") || message.id.startsWith("asst-");
              return (
                <div key={message.id} data-role={message.role}>
                  <MessageBubble
                    message={message}
                    isNew={isNewMsg}
                    isStreaming={isLastAssistant && message.id.startsWith("asst-") && generating}
                  />
                </div>
              );
            })}

            <div ref={endRef} className="h-6" aria-hidden="true" />
          </div>
        </div>
      </div>

      {showScrollBtn && (
        <button
          onClick={() => { setShowScrollBtn(false); scrollToEnd(); }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#252525] border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-[#303030] shadow-lg transition-all"
        >
          <ChevronDown size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
