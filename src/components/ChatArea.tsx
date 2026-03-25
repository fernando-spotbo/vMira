"use client";

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";
import { ChevronDown } from "lucide-react";

type ScrollMode = "idle" | "pinned" | "free";

export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming, loadMoreMessages } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);

  const mode = useRef<ScrollMode>("idle");
  const prevConvId = useRef<string | null>(null);
  const prevUserMsgId = useRef<string | null>(null);
  const isProgrammaticScroll = useRef(false);
  const loadingMore = useRef(false);

  const [showScrollDown, setShowScrollDown] = useState(false);
  const [largeSpacer, setLargeSpacer] = useState(false);

  const messages = activeConversation?.messages ?? [];

  // Find last user message index
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") { lastUserIdx = i; break; }
  }
  const lastUserMsg = lastUserIdx >= 0 ? messages[lastUserIdx] : null;
  const lastMsgIdx = messages.length - 1;

  // ── Pin user message to top of viewport (~5% from top) ──
  const pinToUser = useCallback(() => {
    const container = scrollRef.current;
    const el = userMsgRef.current;
    if (!container || !el) return;

    isProgrammaticScroll.current = true;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const topOffset = cRect.height * 0.05;
    const target = container.scrollTop + (eRect.top - cRect.top) - topOffset;
    container.scrollTo({ top: Math.max(0, target), behavior: "instant" });

    requestAnimationFrame(() => {
      isProgrammaticScroll.current = false;
    });
  }, []);

  // ── Scroll to bottom ──
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    isProgrammaticScroll.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
    requestAnimationFrame(() => { isProgrammaticScroll.current = false; });
  }, []);

  // ── Conversation switch: scroll to bottom ──
  useLayoutEffect(() => {
    if (activeConversationId !== prevConvId.current) {
      prevConvId.current = activeConversationId;
      mode.current = "idle";
      setLargeSpacer(false);
      setShowScrollDown(false);
      requestAnimationFrame(() => scrollToBottom());
    }
  });

  // ── New user message detected: pin to top ──
  useEffect(() => {
    if (!lastUserMsg) return;
    if (lastUserMsg.id === prevUserMsgId.current) return;
    prevUserMsgId.current = lastUserMsg.id;
    if (!lastUserMsg.id.startsWith("user-")) return;

    mode.current = "pinned";
    setLargeSpacer(true);
    setShowScrollDown(false);
    // Pin after DOM updates
    setTimeout(pinToUser, 20);
    setTimeout(pinToUser, 80);
  }, [lastUserMsg?.id, pinToUser]);

  // ── Re-pin when thinking starts ──
  useEffect(() => {
    if (mode.current !== "pinned") return;
    if (isThinking) setTimeout(pinToUser, 40);
  }, [isThinking, pinToUser]);

  // ── During streaming: follow bottom of growing content ──
  useEffect(() => {
    if (!isStreaming) return;
    if (mode.current === "free") return;

    const el = scrollRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (mode.current === "free") return;
      // Keep the newest content in view
      isProgrammaticScroll.current = true;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => { isProgrammaticScroll.current = false; });
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [isStreaming]);

  // ── When streaming ends: scroll to bottom, then collapse spacer ──
  useEffect(() => {
    if (!isStreaming && !isThinking && mode.current === "pinned") {
      mode.current = "idle";
      // Scroll to bottom first, then shrink spacer so there's no jump
      const el = scrollRef.current;
      if (el) {
        isProgrammaticScroll.current = true;
        el.scrollTop = el.scrollHeight;
        isProgrammaticScroll.current = false;
      }
      // Delay spacer collapse to let scroll settle
      setTimeout(() => {
        setLargeSpacer(false);
        // Re-scroll after spacer shrinks
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            isProgrammaticScroll.current = true;
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            isProgrammaticScroll.current = false;
          }
        });
      }, 50);
    }
  }, [isStreaming, isThinking]);

  // ── Scroll handler ──
  const onScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;

    const el = scrollRef.current;
    if (!el) return;

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    // If user scrolls up during pinned/streaming → go free
    if (mode.current === "pinned") {
      mode.current = "free";
      setShowScrollDown(true);
    }

    // If user scrolls back to bottom → resume
    if (distFromBottom < 50) {
      if (mode.current === "free") {
        mode.current = isStreaming ? "pinned" : "idle";
      }
      setShowScrollDown(false);
    } else if (mode.current === "idle" && messages.length > 0) {
      setShowScrollDown(true);
    }

    // Infinite scroll: load more when near top
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
  }, [activeConversation?.hasMore, activeConversation?.loadingMore, loadMoreMessages, isStreaming, messages.length]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto"
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

        {/* Spacer: when pinned, push content down so user msg stays at top */}
        <div
          className="shrink-0"
          style={{ minHeight: largeSpacer ? "70vh" : "144px" }}
          aria-hidden="true"
        />
      </div>

      {/* Scroll to bottom button */}
      {showScrollDown && (
        <button
          onClick={() => { scrollToBottom(true); setShowScrollDown(false); mode.current = "idle"; }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#2a2a2a] border border-white/[0.1] text-white/50 hover:text-white hover:bg-[#333] shadow-lg transition-all"
        >
          <ChevronDown size={18} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
