"use client";

import { useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";

export default function ChatArea() {
  const { activeConversation, activeConversationId, isThinking, isStreaming, loadMoreMessages } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevConvId = useRef<string | null>(null);
  const loadingMore = useRef(false);

  const messages = activeConversation?.messages ?? [];

  // ── Scroll to bottom ──
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // ── On conversation switch: scroll to bottom instantly ──
  useLayoutEffect(() => {
    if (activeConversationId !== prevConvId.current) {
      prevConvId.current = activeConversationId;
      stickToBottom.current = true;
      requestAnimationFrame(() => scrollToBottom("instant"));
    }
  });

  // ── On new messages or streaming: follow bottom if stuck ──
  useEffect(() => {
    if (stickToBottom.current) {
      scrollToBottom("instant");
    }
  }, [messages.length, scrollToBottom]);

  // ── During streaming: keep scrolling to bottom ──
  useEffect(() => {
    if (!isStreaming && !isThinking) return;
    if (!stickToBottom.current) return;

    const observer = new MutationObserver(() => {
      if (stickToBottom.current) {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }
    });

    const el = scrollRef.current;
    if (el) {
      observer.observe(el, { childList: true, subtree: true, characterData: true });
    }

    return () => observer.disconnect();
  }, [isStreaming, isThinking]);

  // ── Scroll handler: detect if user scrolled away from bottom ──
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distFromBottom < 80;

    // Infinite scroll: load older messages when near top
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
  }, [activeConversation?.hasMore, activeConversation?.loadingMore, loadMoreMessages]);

  // Determine last assistant index for streaming indicator
  const lastMsgIdx = messages.length - 1;

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto scroll-smooth"
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
            <div key={message.id}>
              <MessageBubble
                message={message}
                isNew={isNewMsg}
                isStreaming={isLastAssistant && message.id.startsWith("asst-") && (isStreaming || isThinking)}
              />
            </div>
          );
        })}

        {/* Bottom anchor — input bar height worth of space so last message is never hidden */}
        <div ref={bottomRef} className="h-36" aria-hidden="true" />
      </div>
    </div>
  );
}
