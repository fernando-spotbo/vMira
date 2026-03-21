"use client";

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import ThinkingIndicator from "./ThinkingIndicator";

export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming } = useChat();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const prevMsgLenRef = useRef(0);

  // Pin state: true = user message is pinned to top, response builds below
  const [pinned, setPinned] = useState(false);
  // Generation counter — each new pin increments, stale unpins compare and bail
  const pinGenRef = useRef(0);
  // All pending timers — cleared atomically on new pin or conversation switch
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Did the user manually scroll away from the pinned position?
  const userBrokePinRef = useRef(false);

  const messages = activeConversation?.messages ?? [];

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break; }
  }

  const lastMsg = messages[messages.length - 1];

  // ── Timer helpers ──

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => { timersRef.current.delete(t); fn(); }, ms);
    timersRef.current.add(t);
  }, []);

  // ── Conversation switch ──

  useLayoutEffect(() => {
    if (activeConversationId === prevConvIdRef.current) return;

    const wasNull = prevConvIdRef.current === null;
    prevConvIdRef.current = activeConversationId;
    userBrokePinRef.current = false;
    clearTimers();

    // Pin ONLY for genuinely new conversations (just created by user sending a message).
    // Fresh messages have "user-" prefix IDs; loaded/existing ones have server IDs.
    const isFreshNew = wasNull && messages.length === 1 && messages[0]?.id.startsWith("user-");

    if (isFreshNew) {
      pinGenRef.current++;
      setPinned(true);
      prevMsgLenRef.current = 0;
    } else {
      setPinned(false);
      prevMsgLenRef.current = messages.length;
      const el = scrollContainerRef.current;
      if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
  }, [activeConversationId, messages.length, clearTimers]);

  // ── New user message → pin ──

  useEffect(() => {
    const prevLen = prevMsgLenRef.current;
    const curLen = messages.length;
    prevMsgLenRef.current = curLen;
    if (curLen <= prevLen) return;

    const newMsg = messages[curLen - 1];
    if (newMsg?.role === "user") {
      clearTimers();
      pinGenRef.current++;
      setPinned(true);
      userBrokePinRef.current = false;
    }
  }, [messages.length, messages, clearTimers]);

  // ── Keep user message scrolled to top while pinned ──

  useEffect(() => {
    if (!pinned || userBrokePinRef.current) return;
    const container = scrollContainerRef.current;
    const el = lastUserMsgRef.current;
    if (!container || !el) return;

    const raf = requestAnimationFrame(() => {
      container.scrollTo({ top: el.offsetTop - 16, behavior: "instant" as ScrollBehavior });
    });
    return () => cancelAnimationFrame(raf);
  }, [pinned, isThinking, messages.length]);

  // ── Unpin after response completes ──

  useEffect(() => {
    if (!pinned) return;
    // Don't unpin for pre-existing/loaded messages (ids without "asst-" prefix)
    if (lastMsg?.role === "assistant" && !lastMsg.id.startsWith("asst-")) return;
    // Wait for thinking AND streaming to both finish
    if (isThinking || isStreaming) return;
    if (lastMsg?.role !== "assistant") return;

    const gen = pinGenRef.current;

    // Delay before starting the release — let user read the response
    schedule(() => {
      if (pinGenRef.current !== gen) return;
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
      // After scroll animation, remove spacer
      schedule(() => {
        if (pinGenRef.current !== gen) return;
        setPinned(false);
      }, 700);
    }, 1500);

    return () => clearTimers();
  }, [isThinking, isStreaming, lastMsg?.role, lastMsg?.id, pinned, schedule, clearTimers]);

  // ── Detect user scrolling away from pin ──

  const handleScroll = useCallback(() => {
    if (!pinned) return;
    const container = scrollContainerRef.current;
    const el = lastUserMsgRef.current;
    if (!container || !el) return;

    // If user scrolled significantly ABOVE the pinned position, release
    if (container.scrollTop < el.offsetTop - 120) {
      userBrokePinRef.current = true;
      clearTimers();
      setPinned(false);
    }
  }, [pinned, clearTimers]);

  // ── Spacer height: fill remaining space so user msg can sit at top ──

  const getSpacerHeight = () => {
    const container = scrollContainerRef.current;
    const el = lastUserMsgRef.current;
    if (!container || !el) return "80vh";
    const needed = container.clientHeight - el.offsetHeight - 48;
    return `${Math.max(200, needed)}px`;
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
    >
      <div className="mx-auto max-w-3xl px-4 py-4">
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === "assistant" && index === messages.length - 1;
          const isNewMessage =
            message.id.startsWith("user-") || message.id.startsWith("asst-");

          return (
            <div
              key={message.id}
              ref={index === lastUserIdx ? lastUserMsgRef : undefined}
            >
              <MessageBubble
                message={message}
                isNew={isNewMessage}
                isStreaming={isLastAssistant && message.id.startsWith("asst-")}
              />
            </div>
          );
        })}
        {isThinking && <ThinkingIndicator />}
        {pinned && <div style={{ minHeight: getSpacerHeight() }} />}
      </div>
    </div>
  );
}
