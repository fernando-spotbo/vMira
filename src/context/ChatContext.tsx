"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { Conversation, Message } from "@/lib/types";
import { mockConversations } from "@/lib/mock-data";

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  sidebarOpen: boolean;
  selectedModel: string;
  setActiveConversationId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSelectedModel: (model: string) => void;
  createNewChat: () => void;
  addMessage: (conversationId: string, message: Message) => void;
  replaceMessage: (conversationId: string, messageId: string, newMessage: Message) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] =
    useState<Conversation[]>(mockConversations);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >("1");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("GPT-4o");

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const createNewChat = useCallback(() => {
    const newId = String(Date.now());
    const newConversation: Conversation = {
      id: newId,
      title: "New chat",
      messages: [],
      createdAt: new Date().toISOString().split("T")[0],
    };
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newId);
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

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        sidebarOpen,
        selectedModel,
        setActiveConversationId,
        setSidebarOpen,
        toggleSidebar,
        setSelectedModel,
        createNewChat,
        addMessage,
        replaceMessage,
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
