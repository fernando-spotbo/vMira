"use client";

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import { ChevronDown } from "lucide-react";

/**
 * ChatArea scroll behavior (final, robust):
 *
 * 1. Constant bottom padding (100vh) — never changes. This ensures any message
 *    can be scrolled to the top of the viewport. No dynamic spacer = no jumps.
 *
 * 2. On new user message: scroll so user message is at ~10% from top.
 *
 * 3. During streaming: follow bottom of growing content (MutationObserver).
 *    Only if user hasn't scrolled away.
 *
 * 4. User scrolls up → stop following, show "scroll to bottom" button.
 *    User scrolls back to bottom → resume following.
 *
 * 5. Conversation switch → instant scroll to bottom.
 */
export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming, loadMoreMessages } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const prevConvId = useRef<string | null>(null);
  const prevUserMsgId = useRef<string | null>(null);
  const userScrolled = useRef(false); // true when user manually scrolled away
  const programmatic = useRef(false); // true during our scroll commands
  const loadingMore = useRef(false);

  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messages = activeConversation?.messages ?? [];
  const lastMsgIdx = messages.length - 1;

  // Find last user message
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break; }
  }
  const lastUserMsg = lastUserIdx >= 0 ? messages[lastUserIdx] : null;

  // ── Helpers ──

  const scrollTo = useCallback((top: number) => {
    const el = scrollRef.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTop = top;
    // Reset flag after browser processes the scroll event
    requestAnimationFrame(() => { programmatic.current = false; });
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) scrollTo(el.scrollHeight);
  }, [scrollTo]);

  const scrollUserMsgToTop = useCallback(() => {
    const container = scrollRef.current;
    const el = userMsgRef.current;
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const msgRect = el.getBoundingClientRect();
    const offset = containerRect.height * 0.10; // 10% from top
    const target = container.scrollTop + (msgRect.top - containerRect.top) - offset;
    scrollTo(Math.max(0, target));
  }, [scrollTo]);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // ── 1. Conversation switch → scroll to bottom ──

  useLayoutEffect(() => {
    if (activeConversationId !== prevConvId.current) {
      prevConvId.current = activeConversationId;
      userScrolled.current = false;
      setShowScrollBtn(false);
      requestAnimationFrame(scrollToBottom);
    }
  });

  // ── 2. New user message → pin to top ──

  useEffect(() => {
    if (!lastUserMsg) return;
    if (lastUserMsg.id === prevUserMsgId.current) return;
    prevUserMsgId.current = lastUserMsg.id;
    if (!lastUserMsg.id.startsWith("user-")) return;

    userScrolled.current = false;
    setShowScrollBtn(false);

    // Multiple attempts to pin — DOM may not be ready on first try
    const t1 = setTimeout(scrollUserMsgToTop, 10);
    const t2 = setTimeout(scrollUserMsgToTop, 60);
    const t3 = setTimeout(scrollUserMsgToTop, 150);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [lastUserMsg?.id, scrollUserMsgToTop]);

  // ── 3. Re-pin when thinking starts ──

  useEffect(() => {
    if (userScrolled.current) return;
    if (isThinking) {
      setTimeout(scrollUserMsgToTop, 30);
    }
  }, [isThinking, scrollUserMsgToTop]);

  // ── 4. During streaming → follow bottom ──

  useEffect(() => {
    if (!isStreaming) return;
    if (userScrolled.current) return;

    const el = scrollRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (userScrolled.current) return;
      programmatic.current = true;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => { programmatic.current = false; });
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [isStreaming]);

  // ── 5. Scroll handler ──

  const onScroll = useCallback(() => {
    // Ignore our own scrolls
    if (programmatic.current) return;

    const el = scrollRef.current;
    if (!el) return;

    // User scrolled manually
    if (isNearBottom()) {
      userScrolled.current = false;
      setShowScrollBtn(false);
    } else {
      userScrolled.current = true;
      if (messages.length > 0) setShowScrollBtn(true);
    }

    // Infinite scroll: load more at top
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
  }, [isNearBottom, activeConversation?.hasMore, activeConversation?.loadingMore, loadMoreMessages, messages.length]);

  // ── Render ──

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-[52rem] px-4 pt-12">
          {/* Loading older messages */}
          {activeConversation?.loadingMore && (
            <div className="flex justify-center py-4">
              <div className="mira-orb" style={{ position: "relative" }} />
            </div>
          )}

          {messages.map((message, index) => {
            const isLastAssistant =
              message.role === "assistant" && index === lastMsgIdx;
            const isNewMsg =
              message.id.startsWith("user-") || message.id.startsWith("asst-");

            return (
              <div
                key={message.id}
                ref={index === lastUserIdx ? userMsgRef : undefined}
              >
                <MessageBubble
                  message={message}
                  isNew={isNewMsg}
                  isStreaming={isLastAssistant && message.id.startsWith("asst-") && (isStreaming || isThinking)}
                />
              </div>
            );
          })}

          {/*
            Constant bottom padding. This never changes — it ensures any message
            can be scrolled to the top of the viewport. No dynamic spacer = no jumps.
          */}
          <div className="h-[80vh]" aria-hidden="true" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => {
            userScrolled.current = false;
            setShowScrollBtn(false);
            scrollToBottom();
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#252525] border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-[#303030] shadow-lg transition-all"
        >
          <ChevronDown size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
