"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import ThinkingIndicator from "./ThinkingIndicator";

/**
 * ChatArea scroll behavior:
 *
 * 1. User sends message → pin user message near top, spacer below
 * 2. Response streams → user reads top-to-bottom, no auto-scroll
 * 3. User scrolls DOWN to the response end → spacer collapses (new max scroll)
 * 4. User scrolls UP from pin → spacer collapses immediately
 * 5. Response completes, user hasn't scrolled → spacer stays, no movement
 * 6. Conversation switch → scroll to bottom
 */
export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null); // last actual message (for detecting "reached end")

  const prevConvId = useRef<string | null>("__init__");
  const wasPinned = useRef(false);
  const userDismissed = useRef(false);
  const lastScrollTop = useRef(0);
  const [spacerVisible, setSpacerVisible] = useState(false);

  const messages = activeConversation?.messages ?? [];

  // ── Find indexes ──
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break; }
  }
  const lastMsgIdx = messages.length - 1;

  // ── Derived state ──
  const lastUserMsg = lastUserIdx >= 0 ? messages[lastUserIdx] : null;
  const hasFreshUserMsg = lastUserMsg?.id.startsWith("user-") ?? false;
  const generating = isThinking || isStreaming;
  const lastMsg = messages[messages.length - 1];

  // ── Auto-pin when generation starts ──
  if (hasFreshUserMsg && (generating || (lastMsg?.role === "assistant" && lastMsg.id.startsWith("asst-"))) && !wasPinned.current && !userDismissed.current) {
    wasPinned.current = true;
    if (!spacerVisible) setSpacerVisible(true);
  }

  // ── Scroll helpers ──
  const pinUserMsg = useCallback(() => {
    const container = scrollRef.current;
    const el = userMsgRef.current;
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetScroll = container.scrollTop + (elRect.top - containerRect.top) - 12;
    container.scrollTo({ top: targetScroll, behavior: "instant" });
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  }, []);

  // Check if last message is visible in viewport
  const isLastMsgVisible = useCallback(() => {
    const container = scrollRef.current;
    const el = lastMsgRef.current;
    if (!container || !el) return false;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // The bottom of the last message is within or above the viewport bottom
    return elRect.bottom <= containerRect.bottom + 50;
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  CONVERSATION SWITCH
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const convChanged = activeConversationId !== prevConvId.current;
    prevConvId.current = activeConversationId;
    if (!convChanged) return;

    if (wasPinned.current) {
      userDismissed.current = false;
      const timers = [30, 100, 200].map(d => setTimeout(pinUserMsg, d));
      return () => timers.forEach(clearTimeout);
    } else {
      wasPinned.current = false;
      userDismissed.current = false;
      setSpacerVisible(false);
      setTimeout(scrollToBottom, 50);
    }
  }, [activeConversationId, spacerVisible, pinUserMsg, scrollToBottom]);

  // ═══════════════════════════════════════════════════════════
  //  MESSAGES LOADED ASYNC
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (wasPinned.current || spacerVisible) return;
    if (messages.length > 0) {
      setTimeout(scrollToBottom, 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length > 0]);

  // ═══════════════════════════════════════════════════════════
  //  PIN ACTIVE → scroll user msg to top
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!wasPinned.current || !hasFreshUserMsg) return;
    const timers = [30, 100, 200].map(d =>
      setTimeout(() => { if (wasPinned.current) pinUserMsg(); }, d)
    );
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFreshUserMsg, generating, messages.length, pinUserMsg]);

  // ═══════════════════════════════════════════════════════════
  //  THINKING → re-pin
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!wasPinned.current || !isThinking) return;
    setTimeout(pinUserMsg, 50);
  }, [isThinking, pinUserMsg]);

  // ═══════════════════════════════════════════════════════════
  //  SCROLL HANDLER:
  //  - Scroll UP → release pin, collapse spacer
  //  - Scroll DOWN to last message → collapse spacer (new max)
  // ═══════════════════════════════════════════════════════════
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;

    if (spacerVisible) {
      // User scrolled UP → dismiss pin
      if (wasPinned.current && scrollTop < lastScrollTop.current - 30) {
        wasPinned.current = false;
        userDismissed.current = true;
        setSpacerVisible(false);
      }
      // User scrolled DOWN to see the last message → collapse spacer
      else if (scrollTop > lastScrollTop.current + 10 && !generating && isLastMsgVisible()) {
        wasPinned.current = false;
        userDismissed.current = true;
        setSpacerVisible(false);
      }
    }

    lastScrollTop.current = scrollTop;
  }, [spacerVisible, generating, isLastMsgVisible]);

  // ═══════════════════════════════════════════════════════════
  //  GENERATION COMPLETE + last msg visible → auto-collapse
  //  (handles case where response is short and fits on screen)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!spacerVisible || generating) return;
    // Check if the response is short enough that it's already visible
    const t = setTimeout(() => {
      if (isLastMsgVisible()) {
        wasPinned.current = false;
        userDismissed.current = true;
        setSpacerVisible(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [generating, spacerVisible, isLastMsgVisible]);

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

        {spacerVisible && <div className="shrink-0" style={{ minHeight: "60vh" }} aria-hidden="true" />}

        <div ref={endRef} aria-hidden="true" />
      </div>
    </div>
  );
}
