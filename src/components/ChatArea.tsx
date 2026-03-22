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
    pinTimestamp: 0,     // last time pin() was called — ignore scroll events for 500ms after
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
    state.current.pinTimestamp = Date.now();
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    // Pin user message just below the TopBar area (~4% from top)
    const topOffset = cRect.height * 0.03;
    const target = container.scrollTop + (eRect.top - cRect.top) - topOffset;
    container.scrollTo({ top: Math.max(0, target), behavior: "instant" });

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

  // ── Transition to DISMISSED (smooth) ──
  const dismiss = useCallback(() => {
    state.current.scrollState = "dismissed";
    // Don't remove spacer instantly — shrink it to 0 with CSS transition
    // The spacer stays mounted, just changes height
    setSpacer(false);
    // Clamp scroll to actual content height after spacer collapses
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (el.scrollTop > maxScroll) {
          el.scrollTop = maxScroll;
        }
      });
    }
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
    // Skip if we're programmatically scrolling or just pinned recently
    if (state.current.pinScrolling) return;
    if (Date.now() - state.current.pinTimestamp < 500) return;

    const el = scrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const prev = state.current.lastScrollTop;
    state.current.lastScrollTop = scrollTop;

    if (state.current.scrollState !== "pinned") return;

    const delta = scrollTop - prev;

    // Scrolled UP → dismiss
    if (delta < -10) {
      dismiss();
      return;
    }

    // Scrolled DOWN past the response → dismiss
    if (delta > 5) {
      const lastEl = lastMsgRef.current;
      if (el && lastEl) {
        const cRect = el.getBoundingClientRect();
        const mRect = lastEl.getBoundingClientRect();
        // Last message bottom is visible in viewport
        if (mRect.bottom <= cRect.bottom + 100) {
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

        {/* Thinking state is now shown inline in the assistant message bubble */}

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
