"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import ThinkingIndicator from "./ThinkingIndicator";

/**
 * ChatArea scroll — clean implementation.
 *
 * States:
 *   IDLE      — free scrolling, no spacer
 *   PINNED    — user msg at top, spacer active, response grows below
 *   DISMISSED — user scrolled away, spacer collapsed
 *
 * Transitions:
 *   IDLE → PINNED:     new fresh user message detected
 *   PINNED → DISMISSED: user scrolls up OR scrolls down past response
 *   DISMISSED → IDLE:   next new user message resets
 *   any → IDLE:         conversation switch
 */

type ScrollState = "idle" | "pinned" | "dismissed";

export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);

  // All mutable state in a single ref to avoid stale closures
  const state = useRef({
    scrollState: "idle" as ScrollState,
    prevConvId: null as string | null,
    prevUserMsgId: null as string | null,
    lastScrollTop: 0,
    pinScrolling: false, // true while pinUserMsg is executing (ignore onScroll)
  });

  const [spacer, setSpacer] = useState(false);

  const messages = activeConversation?.messages ?? [];

  // ── Indexes ──
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break; }
  }
  const lastMsgIdx = messages.length - 1;

  // ── Derived ──
  const lastUserMsg = lastUserIdx >= 0 ? messages[lastUserIdx] : null;
  const hasFresh = lastUserMsg?.id.startsWith("user-") ?? false;
  const generating = isThinking || isStreaming;
  const lastMsg = messages[lastMsgIdx];
  const hasEmptyAsst = lastMsg?.role === "assistant" && lastMsg.id.startsWith("asst-") && lastMsg.content.trim() === "";

  // ── Pin: scroll user message to viewport top ──
  const pin = useCallback(() => {
    const container = scrollRef.current;
    const el = userMsgRef.current;
    if (!container || !el) return;

    state.current.pinScrolling = true;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const target = container.scrollTop + (eRect.top - cRect.top) - 12;
    container.scrollTo({ top: target, behavior: "instant" });

    // Unlock after browser processes the scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.current.pinScrolling = false;
        state.current.lastScrollTop = container.scrollTop;
      });
    });
  }, []);

  // ── Transition to PINNED ──
  const enterPinned = useCallback(() => {
    state.current.scrollState = "pinned";
    setSpacer(true);
    // Pin with retries
    const t1 = setTimeout(pin, 30);
    const t2 = setTimeout(pin, 120);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pin]);

  // ── Transition to DISMISSED ──
  const dismiss = useCallback(() => {
    state.current.scrollState = "dismissed";
    setSpacer(false);
  }, []);

  // ── Transition to IDLE ──
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

    // Only pin for fresh (optimistic) user messages
    if (!lastUserMsg.id.startsWith("user-")) return;

    // Reset dismissed state for new message
    enterPinned();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUserMsg?.id, enterPinned]);

  // ═══════════════════════════════════════════════════════════
  //  CONVERSATION SWITCH → IDLE + scroll to bottom
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (activeConversationId === state.current.prevConvId) return;
    const wasNull = state.current.prevConvId === null || state.current.prevConvId === "__init__";
    state.current.prevConvId = activeConversationId;

    // If pinned (user just created a new conv), re-pin
    if (state.current.scrollState === "pinned") {
      setTimeout(pin, 50);
      return;
    }

    // Otherwise scroll to bottom
    goIdle();
    setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }, [activeConversationId, pin, goIdle]);

  // ═══════════════════════════════════════════════════════════
  //  MESSAGES LOADED ASYNC → scroll to bottom (unless pinned)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (state.current.scrollState === "pinned") return;
    if (messages.length > 0) {
      setTimeout(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length > 0]);

  // ═══════════════════════════════════════════════════════════
  //  THINKING STARTED → re-pin to adjust for indicator
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (state.current.scrollState !== "pinned") return;
    if (isThinking) setTimeout(pin, 50);
  }, [isThinking, pin]);

  // ═══════════════════════════════════════════════════════════
  //  SCROLL HANDLER
  // ═══════════════════════════════════════════════════════════
  const onScroll = useCallback(() => {
    // Skip if we're programmatically scrolling
    if (state.current.pinScrolling) return;

    const el = scrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const prev = state.current.lastScrollTop;
    state.current.lastScrollTop = scrollTop;

    if (state.current.scrollState !== "pinned") return;

    const delta = scrollTop - prev;

    // Scrolled UP significantly → dismiss
    if (delta < -40) {
      dismiss();
      return;
    }

    // Scrolled DOWN past the response → check if last message is visible
    if (delta > 15 && !generating) {
      const container = scrollRef.current;
      const lastEl = lastMsgRef.current;
      if (container && lastEl) {
        const cRect = container.getBoundingClientRect();
        const mRect = lastEl.getBoundingClientRect();
        if (mRect.bottom <= cRect.bottom + 80) {
          dismiss();
        }
      }
    }
  }, [dismiss, generating]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto"
    >
      <div className="mx-auto max-w-3xl px-4 pt-12 pb-4">
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

        {isThinking && <ThinkingIndicator />}

        {spacer && <div className="shrink-0" style={{ minHeight: "60vh" }} aria-hidden="true" />}
      </div>
    </div>
  );
}
