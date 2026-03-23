"use client";

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";

type ScrollState = "idle" | "pinned" | "dismissed";

export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming, loadMoreMessages } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);

  const state = useRef({
    scrollState: "idle" as ScrollState,
    prevConvId: null as string | null,
    prevMsgLen: 0,
    prevUserMsgId: null as string | null,
    lastScrollTop: 0,
    pinScrolling: false,
    pinTimestamp: 0,
  });

  const [spacer, setSpacer] = useState(false);

  const messages = activeConversation?.messages ?? [];

  // ── Indexes ──
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break; }
  }
  const lastMsgIdx = messages.length - 1;
  const lastUserMsg = lastUserIdx >= 0 ? messages[lastUserIdx] : null;
  const generating = isThinking || isStreaming;

  // ═══════════════════════════════════════════════════════════
  //  useLayoutEffect: scroll to bottom BEFORE browser paints.
  //  This is the key fix — runs synchronously after DOM update
  //  but before the user sees anything.
  // ═══════════════════════════════════════════════════════════
  useLayoutEffect(() => {
    // Skip if pinned (user sent a message, pin handles scroll)
    if (state.current.scrollState === "pinned") return;

    const el = scrollRef.current;
    if (!el) return;

    const convChanged = activeConversationId !== state.current.prevConvId;
    const msgsLoaded = state.current.prevMsgLen === 0 && messages.length > 0;

    if (convChanged || msgsLoaded) {
      // Scroll to bottom synchronously — before paint
      el.scrollTop = el.scrollHeight;
    }

    state.current.prevConvId = activeConversationId;
    state.current.prevMsgLen = messages.length;
  });

  // ── Pin ──
  const pin = useCallback(() => {
    const container = scrollRef.current;
    const el = userMsgRef.current;
    if (!container || !el) return;

    state.current.pinScrolling = true;
    state.current.pinTimestamp = Date.now();
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const topOffset = cRect.height * 0.03;
    const target = container.scrollTop + (eRect.top - cRect.top) - topOffset;
    container.scrollTo({ top: Math.max(0, target), behavior: "instant" });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.current.pinScrolling = false;
        state.current.lastScrollTop = container.scrollTop;
      });
    });
  }, []);

  const enterPinned = useCallback(() => {
    state.current.scrollState = "pinned";
    setSpacer(true);
    const t1 = setTimeout(pin, 30);
    const t2 = setTimeout(pin, 120);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pin]);

  const dismiss = useCallback(() => {
    state.current.scrollState = "dismissed";
    setSpacer(false);
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (el.scrollTop > maxScroll) el.scrollTop = maxScroll;
      });
    }
  }, []);

  const goIdle = useCallback(() => {
    state.current.scrollState = "idle";
    setSpacer(false);
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  DETECT NEW USER MESSAGE → enter PINNED
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!lastUserMsg) return;
    if (lastUserMsg.id === state.current.prevUserMsgId) return;
    state.current.prevUserMsgId = lastUserMsg.id;
    if (!lastUserMsg.id.startsWith("user-")) return;
    enterPinned();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUserMsg?.id, enterPinned]);

  // ═══════════════════════════════════════════════════════════
  //  CONVERSATION SWITCH → go idle (scroll handled by useLayoutEffect)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // Reset scroll state on conv switch (but don't touch scroll — useLayoutEffect does that)
    if (state.current.scrollState === "pinned") {
      setTimeout(pin, 50);
      return;
    }
    goIdle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // ═══════════════════════════════════════════════════════════
  //  THINKING STARTED → re-pin
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (state.current.scrollState !== "pinned") return;
    if (isThinking) setTimeout(pin, 50);
  }, [isThinking, pin]);

  // ═══════════════════════════════════════════════════════════
  //  SCROLL HANDLER
  // ═══════════════════════════════════════════════════════════
  // Infinite scroll: load older messages when near top
  const loadMoreRef = useRef(false);
  const handleLoadMore = useCallback(() => {
    if (loadMoreRef.current) return;
    if (!activeConversation?.hasMore || activeConversation?.loadingMore) return;
    loadMoreRef.current = true;

    // Save scroll height before loading
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;

    loadMoreMessages().then(() => {
      // Restore scroll position after prepend (maintain visual position)
      requestAnimationFrame(() => {
        if (el) {
          const newHeight = el.scrollHeight;
          el.scrollTop += newHeight - prevHeight;
        }
        loadMoreRef.current = false;
      });
    });
  }, [activeConversation?.hasMore, activeConversation?.loadingMore, loadMoreMessages]);

  const onScroll = useCallback(() => {
    if (state.current.pinScrolling) return;
    if (Date.now() - state.current.pinTimestamp < 500) return;

    const el = scrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const prev = state.current.lastScrollTop;
    state.current.lastScrollTop = scrollTop;

    // Infinite scroll: trigger load when within 200px of top
    if (scrollTop < 200 && state.current.scrollState !== "pinned") {
      handleLoadMore();
    }

    if (state.current.scrollState !== "pinned") return;

    const delta = scrollTop - prev;

    if (delta < -10) {
      dismiss();
      return;
    }

    if (delta > 5) {
      const lastEl = lastMsgRef.current;
      if (el && lastEl) {
        const cRect = el.getBoundingClientRect();
        const mRect = lastEl.getBoundingClientRect();
        if (mRect.bottom <= cRect.bottom + 100) {
          dismiss();
        }
      }
    }
  }, [dismiss, generating, handleLoadMore]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto"
    >
      <div className="mx-auto max-w-3xl px-4 pt-12 pb-4">
        {/* Loading older messages indicator */}
        {activeConversation?.loadingMore && (
          <div className="flex justify-center py-4">
            <div className="mira-orb" style={{ position: "relative" }} />
          </div>
        )}
        {activeConversation?.hasMore && !activeConversation?.loadingMore && messages.length > 0 && (
          <div className="flex justify-center py-2">
            <span className="text-[13px] text-white/15">scroll up for more</span>
          </div>
        )}
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === "assistant" && index === messages.length - 1;
          const isNewMsg =
            message.id.startsWith("user-") || message.id.startsWith("asst-");

          return (
            <div
              key={message.id}
              ref={
                index === lastUserIdx
                  ? userMsgRef
                  : index === lastMsgIdx
                  ? lastMsgRef
                  : undefined
              }
            >
              <MessageBubble
                message={message}
                isNew={isNewMsg}
                isStreaming={isLastAssistant && message.id.startsWith("asst-")}
              />
            </div>
          );
        })}

        <div
          className="shrink-0"
          style={{
            minHeight: spacer ? "85vh" : "0px",
            transition: spacer ? "none" : "min-height 300ms ease-out",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
