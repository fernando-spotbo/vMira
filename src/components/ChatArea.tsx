"use client";

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import { ChevronDown } from "lucide-react";

/**
 * Simple approach — no spacer hack:
 * - Messages container uses flex + justify-end so short content sits at bottom
 * - Scroll to bottom on new conversation / new messages
 * - MutationObserver follows streaming
 * - User scrolls up → stop following
 */
export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming, loadMoreMessages } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prevConvId = useRef<string | null>(null);
  const autoFollow = useRef(true);
  const selfScroll = useRef(false);
  const loadingMore = useRef(false);

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

  // Conversation switch → scroll to bottom
  useLayoutEffect(() => {
    if (activeConversationId !== prevConvId.current) {
      prevConvId.current = activeConversationId;
      autoFollow.current = true;
      setShowScrollBtn(false);
      requestAnimationFrame(scrollToEnd);
    }
  });

  // New messages added → scroll if following
  useEffect(() => {
    if (autoFollow.current) scrollToEnd();
  }, [messages.length, scrollToEnd]);

  // Streaming → follow with MutationObserver
  useEffect(() => {
    if (!isStreaming || !autoFollow.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (!autoFollow.current) return;
      selfScroll.current = true;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => { selfScroll.current = false; });
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [isStreaming]);

  // Scroll handler
  const onScroll = useCallback(() => {
    if (selfScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) {
      autoFollow.current = true;
      setShowScrollBtn(false);
    } else {
      autoFollow.current = false;
      if (messages.length > 0) setShowScrollBtn(true);
    }

    // Infinite scroll
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
        {/* Flex container: justify-end pushes short content to bottom naturally */}
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
                <div key={message.id}>
                  <MessageBubble
                    message={message}
                    isNew={isNewMsg}
                    isStreaming={isLastAssistant && message.id.startsWith("asst-") && generating}
                  />
                </div>
              );
            })}

            {/* Small padding so last message isn't flush against input */}
            <div ref={endRef} className="h-6" aria-hidden="true" />
          </div>
        </div>
      </div>

      {showScrollBtn && (
        <button
          onClick={() => { autoFollow.current = true; setShowScrollBtn(false); scrollToEnd(); }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#252525] border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-[#303030] shadow-lg transition-all"
        >
          <ChevronDown size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
