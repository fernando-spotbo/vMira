"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from "react";
import { Conversation, Message } from "@/lib/types";
import { mockConversations } from "@/lib/mock-data";
import { getRandomMockResponse, getRandomSteppedResponse } from "@/lib/mock-responses";
import * as chatApi from "@/lib/api-chat";
import { getAccessToken } from "@/lib/api-client";

// Live API only when both: env var set AND user has a token
function useLiveApi() {
  return !!(process.env.NEXT_PUBLIC_API_URL && getAccessToken());
}

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  sidebarOpen: boolean;
  selectedModel: string;
  isThinking: boolean;
  isStreaming: boolean;
  queuePosition: number | null;
  setActiveConversationId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSelectedModel: (model: string) => void;
  setIsThinking: (thinking: boolean) => void;
  createNewChat: () => void;
  addMessage: (conversationId: string, message: Message) => void;
  replaceMessage: (conversationId: string, messageId: string, newMessage: Message) => void;
  replaceMessageAndTruncate: (conversationId: string, messageId: string, newMessage: Message) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  starConversation: (id: string) => void;
  sendMessage: (content: string) => Promise<void>;
  cancelMessage: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(
    useLiveApi() ? [] : mockConversations
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("Mira");
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  // Load conversations from API on mount
  useEffect(() => {
    if (!useLiveApi()) return;
    (async () => {
      const convs = await chatApi.fetchConversations();
      setConversations(
        convs.map((c) => ({
          id: c.id,
          title: c.title,
          messages: [],
          createdAt: c.created_at.split("T")[0],
          starred: c.starred,
        }))
      );
    })();
  }, []);

  // Load messages when switching to a conversation that has no messages loaded (live mode only)
  useEffect(() => {
    if (!activeConversationId) return;
    // Only fetch from API if: live mode AND conversation has 0 messages (not yet loaded)
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv || conv.messages.length > 0 || !useLiveApi()) return;
    (async () => {
      const data = await chatApi.fetchConversation(activeConversationId);
      if (!data || data.messages.length === 0) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                messages: data.messages.map((m) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  steps: m.steps ?? undefined,
                })),
              }
            : c
        )
      );
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  const createNewChat = useCallback(() => {
    // Don't create a conversation object — just go to empty state.
    // The actual conversation is created when the user sends the first message.
    setActiveConversationId(null);
  }, []);

  const addMessage = useCallback(
    (conversationId: string, message: Message) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, message] }
            : c
        )
      );
    },
    []
  );

  const replaceMessage = useCallback(
    (conversationId: string, messageId: string, newMessage: Message) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? newMessage : m
                ),
              }
            : c
        )
      );
    },
    []
  );

  const replaceMessageAndTruncate = useCallback(
    (conversationId: string, messageId: string, newMessage: Message) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const idx = c.messages.findIndex((m) => m.id === messageId);
          if (idx === -1) return c;
          const kept = c.messages.slice(0, idx);
          return { ...c, messages: [...kept, newMessage] };
        })
      );
    },
    []
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      if (useLiveApi()) {
        await chatApi.updateConversation(id, { title });
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (useLiveApi()) {
        await chatApi.deleteConversation(id);
      }
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (activeConversationId === id) {
          const next = filtered[0];
          setActiveConversationId(next?.id ?? null);
        }
        return filtered;
      });
    },
    [activeConversationId]
  );

  const starConversation = useCallback(
    async (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return;
      const newStarred = !conv.starred;
      if (useLiveApi()) {
        await chatApi.updateConversation(id, { starred: newStarred });
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, starred: newStarred } : c
        )
      );
    },
    [conversations]
  );

  // Cancel current streaming request
  const cancelMessage = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsThinking(false);
    setIsStreaming(false);
    setQueuePosition(null);
  }, [abortController]);

  // Helper: update a message in a conversation (optimistic, no re-render delay)
  const updateMessageContent = useCallback((convId: string, msgId: string, content: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: c.messages.map((m) => m.id === msgId ? { ...m, content } : m) }
          : c
      )
    );
  }, []);

  // Send message — optimistic UI: show instantly, stream in background
  const sendMessage = useCallback(
    async (content: string) => {
      const isLive = useLiveApi();
      let convId = activeConversationId;

      // Optimistic: show user message IMMEDIATELY (before any API call)
      const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content };

      if (!convId) {
        convId = `optimistic-${Date.now()}`;
        // Show conversation immediately with optimistic ID
        setConversations((prev) => [
          {
            id: convId!,
            title: content.slice(0, 80),
            messages: [userMsg],
            createdAt: new Date().toISOString().split("T")[0],
          },
          ...prev,
        ]);
        setActiveConversationId(convId);

        // Create real conversation in background, swap ID
        if (isLive) {
          const conv = await chatApi.createConversation(content.slice(0, 80));
          if (!conv) return;
          const oldId = convId;
          convId = conv.id;
          // Swap optimistic ID with real ID (seamless, no flicker)
          setConversations((prev) =>
            prev.map((c) => c.id === oldId ? { ...c, id: conv.id } : c)
          );
          setActiveConversationId(conv.id);
        }
      } else {
        addMessage(convId, userMsg);
      }

      if (isLive) {
        const controller = new AbortController();
        setAbortController(controller);
        setIsThinking(true);
        setQueuePosition(null);
        const asstId = `asst-${Date.now()}`;

        // Optimistic: show empty assistant bubble IMMEDIATELY
        addMessage(convId, { id: asstId, role: "assistant", content: "" });

        try {
          let fullContent = "";

          for await (const event of chatApi.streamMessage(convId, content, selectedModel.toLowerCase(), controller.signal)) {
            switch (event.type) {
              case "queue":
                // Show queue position — user sees their place in line
                setQueuePosition(event.position);
                setIsThinking(true);
                break;

              case "processing":
                // GPU slot acquired — switch from "queued" to "thinking"
                setQueuePosition(null);
                setIsThinking(true);
                break;

              case "token":
                // First token: switch from thinking to streaming
                if (!isStreaming) {
                  setIsThinking(false);
                  setIsStreaming(true);
                }
                fullContent += event.content;
                // Update message content — batched by React, no extra re-renders
                updateMessageContent(convId!, asstId, fullContent);
                break;

              case "done":
                // Stream complete
                break;

              case "error":
                updateMessageContent(convId!, asstId, event.message || "Произошла ошибка.");
                break;
            }
          }

          setIsStreaming(false);
          setIsThinking(false);
          setQueuePosition(null);

          if (!fullContent.trim()) {
            updateMessageContent(convId, asstId, "Модель не ответила. Попробуйте ещё раз.");
          }
        } catch (err: any) {
          setIsThinking(false);
          setIsStreaming(false);
          setQueuePosition(null);
          if (err?.name === "AbortError") {
            updateMessageContent(convId, asstId, "Запрос отменён.");
          } else {
            updateMessageContent(convId, asstId, "Произошла ошибка. Попробуйте ещё раз.");
          }
        } finally {
          setAbortController(null);
        }
      } else {
        // Mock response
        setIsThinking(true);
        const stepped = getRandomSteppedResponse();
        const mockConvId = convId;

        setTimeout(() => {
          setIsThinking(false);
          const asstMsg: Message = stepped
            ? { id: `asst-${Date.now()}`, role: "assistant", content: stepped.content, steps: stepped.steps }
            : { id: `asst-${Date.now()}`, role: "assistant", content: getRandomMockResponse() };

          setConversations((prev) => {
            const found = prev.find((c) => c.id === mockConvId);
            if (!found) return prev;
            return prev.map((c) =>
              c.id === mockConvId
                ? { ...c, messages: [...c.messages, asstMsg] }
                : c
            );
          });
        }, 2000);
      }
    },
    [activeConversationId, addMessage, selectedModel, isStreaming, updateMessageContent]
  );

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        sidebarOpen,
        selectedModel,
        isThinking,
        isStreaming,
        setActiveConversationId,
        setSidebarOpen,
        toggleSidebar,
        setSelectedModel,
        setIsThinking,
        createNewChat,
        addMessage,
        replaceMessage,
        replaceMessageAndTruncate,
        renameConversation,
        deleteConversation,
        starConversation,
        sendMessage,
        cancelMessage,
        queuePosition,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
}
