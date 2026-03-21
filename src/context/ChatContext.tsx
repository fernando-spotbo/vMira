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

  // Send message — creates conversation if needed, adds user message, gets AI response
  const sendMessage = useCallback(
    async (content: string) => {
      // Evaluate ONCE at the start — don't re-check mid-function
      const isLive = useLiveApi();
      let convId = activeConversationId;

      // Create conversation if none exists
      if (!convId) {
        if (isLive) {
          const conv = await chatApi.createConversation(content.slice(0, 80));
          if (!conv) return;
          convId = conv.id;
        } else {
          convId = String(Date.now());
        }

        // Add new conversation WITH the user message already inside (atomic)
        const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content };
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
      } else {
        // Existing conversation — just add user message
        const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content };
        addMessage(convId, userMsg);
      }

      // Get AI response — use the same isLive decision from above
      if (isLive) {
        setIsThinking(true);
        const asstId = `asst-${Date.now()}`;
        try {
          addMessage(convId, { id: asstId, role: "assistant", content: "" });
          setIsThinking(false);
          setIsStreaming(true);

          let fullContent = "";
          for await (const chunk of chatApi.streamMessage(convId, content, selectedModel.toLowerCase())) {
            fullContent += chunk;
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? { ...c, messages: c.messages.map((m) => m.id === asstId ? { ...m, content: fullContent } : m) }
                  : c
              )
            );
          }
          setIsStreaming(false);
          // If stream returned nothing, show error in the same bubble
          if (!fullContent.trim()) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? { ...c, messages: c.messages.map((m) => m.id === asstId ? { ...m, content: "Модель не ответила. Попробуйте ещё раз." } : m) }
                  : c
              )
            );
          }
        } catch {
          setIsThinking(false);
          setIsStreaming(false);
          // Update the existing empty bubble instead of adding a new one
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? { ...c, messages: c.messages.map((m) => m.id === asstId ? { ...m, content: "Произошла ошибка. Попробуйте ещё раз." } : m) }
                : c
            )
          );
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
            console.log("MOCK RESPONSE: convId=", mockConvId, "found=", !!found, "convIds=", prev.map(c => c.id));
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
    [activeConversationId, addMessage, selectedModel]
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
