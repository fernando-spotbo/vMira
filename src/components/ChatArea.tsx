"use client";

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import { ChevronDown } from "lucide-react";

export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming, loadMoreMessages } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const prevConvId = useRef<string | null>(null);
  const prevUserMsgId = useRef<string | null>(null);
  const autoFollow = useRef(true);
  const selfScrolling = useRef(false);
  const wasStreaming = useRef(false);
  const loadingMore = useRef(false);

  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messages = activeConversation?.messages ?? [];
  const lastMsgIdx = messages.length - 1;

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break; }
  }
  const lastUserMsg = lastUserIdx >= 0 ? messages[lastUserIdx] : null;
  const generating = isThinking || isStreaming;

  // ── DOM-direct scroll (bypasses React, no re-render) ──

  const doScroll = useCallback((top: number) => {
    const el = scrollRef.current;
    if (!el) return;
    selfScrolling.current = true;
    el.scrollTop = top;
    // Reset after browser processes scroll event
    requestAnimationFrame(() => { selfScrolling.current = false; });
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) doScroll(el.scrollHeight);
  }, [doScroll]);

  // Set spacer size via DOM — no React state, no re-render, no jump
  const setSpacer = useCallback((large: boolean) => {
    if (!spacerRef.current) return;
    spacerRef.current.style.minHeight = large ? "80vh" : "24px";
  }, []);

  const pinUserMsg = useCallback(() => {
    const container = scrollRef.current;
    const el = userMsgRef.current;
    if (!container || !el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const offset = cRect.height * 0.10;
    doScroll(Math.max(0, container.scrollTop + (eRect.top - cRect.top) - offset));
  }, [doScroll]);

  // ── 1. Conversation switch → bottom, small spacer ──

  useLayoutEffect(() => {
    if (activeConversationId !== prevConvId.current) {
      prevConvId.current = activeConversationId;
      autoFollow.current = true;
      setSpacer(false);
      setShowScrollBtn(false);
      requestAnimationFrame(scrollToBottom);
    }
  });

  // ── 2. New user message → large spacer, pin to top ──

  useEffect(() => {
    if (!lastUserMsg) return;
    if (lastUserMsg.id === prevUserMsgId.current) return;
    prevUserMsgId.current = lastUserMsg.id;
    if (!lastUserMsg.id.startsWith("user-")) return;

    autoFollow.current = true;
    setShowScrollBtn(false);
    setSpacer(true);

    setTimeout(pinUserMsg, 10);
    setTimeout(pinUserMsg, 60);
    setTimeout(pinUserMsg, 150);
  }, [lastUserMsg?.id, pinUserMsg, setSpacer]);

  // ── 3. Re-pin on thinking ──

  useEffect(() => {
    if (!autoFollow.current) return;
    if (isThinking) setTimeout(pinUserMsg, 30);
  }, [isThinking, pinUserMsg]);

  // ── 4. Follow bottom during streaming ──

  useEffect(() => {
    if (!isStreaming) return;
    if (!autoFollow.current) return;

    const el = scrollRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (!autoFollow.current) return;
      selfScrolling.current = true;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => { selfScrolling.current = false; });
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [isStreaming]);

  // ── 5. Streaming ends → collapse spacer without jump ──

  useEffect(() => {
    if (generating) {
      wasStreaming.current = true;
      return;
    }
    if (!wasStreaming.current) return;
    wasStreaming.current = false;

    // Collapse spacer and re-anchor in same synchronous block
    // Browser won't paint between these two operations
    const el = scrollRef.current;
    setSpacer(false);
    if (el) {
      selfScrolling.current = true;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => { selfScrolling.current = false; });
    }
  }, [generating, setSpacer]);

  // ── 6. Scroll handler ──

  const onScroll = useCallback(() => {
    if (selfScrolling.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    if (nearBottom) {
      autoFollow.current = true;
      setShowScrollBtn(false);
    } else {
      autoFollow.current = false;
      if (messages.length > 0) setShowScrollBtn(true);
    }

    // Infinite scroll at top
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
        <div className="mx-auto max-w-[52rem] px-4 pt-12">
          {activeConversation?.loadingMore && (
            <div className="flex justify-center py-4">
              <div className="mira-orb" style={{ position: "relative" }} />
            </div>
          )}

          {messages.map((message, index) => {
            const isLastAssistant = message.role === "assistant" && index === lastMsgIdx;
            const isNewMsg = message.id.startsWith("user-") || message.id.startsWith("asst-");
            return (
              <div key={message.id} ref={index === lastUserIdx ? userMsgRef : undefined}>
                <MessageBubble
                  message={message}
                  isNew={isNewMsg}
                  isStreaming={isLastAssistant && message.id.startsWith("asst-") && generating}
                />
              </div>
            );
          })}

          {/* Spacer — sized via DOM ref, not React state. Starts small. */}
          <div ref={spacerRef} style={{ minHeight: "24px" }} aria-hidden="true" />
        </div>
      </div>

      {showScrollBtn && (
        <button
          onClick={() => {
            autoFollow.current = true;
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
