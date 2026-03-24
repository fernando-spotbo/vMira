"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { Conversation, Message, Attachment, MessageStep, MessageError, SearchQuery } from "@/lib/types";
import { t } from "@/lib/i18n";
import * as chatApi from "@/lib/api-chat";
import { getAccessToken, uploadFile } from "@/lib/api-client";

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
  pendingFiles: File[];
  setPendingFiles: (files: File[]) => void;
  addPendingFiles: (files: File[]) => void;
  removePendingFile: (index: number) => void;
  sendMessage: (content: string) => Promise<void>;
  resendMessage: (content: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  ensureConversation: (id: string, title: string) => void;
  cancelMessage: () => void;
  showReminders: boolean;
  setShowReminders: (show: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const sendingRef = useRef(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [selectedModel, setSelectedModel] = useState("Mira");
  const [showReminders, setShowReminders] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  // Load conversations from API on mount
  useEffect(() => {
    if (!getAccessToken()) return;
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

  // Helper: map API messages to frontend Message type
  function mapApiMessages(apiMessages: chatApi.ApiMessage[]): Message[] {
    return apiMessages.map((m) => {
      // Extract reminder data from steps if present
      const reminderStep = m.steps?.find((s: any) => s.type === "reminder_created");
      const reminder = reminderStep ? {
        id: reminderStep.id || "",
        title: reminderStep.title || "",
        body: reminderStep.body || null,
        remind_at: reminderStep.remind_at || "",
        rrule: reminderStep.rrule || null,
      } : undefined;

      return {
        id: m.id,
        role: m.role,
        content: m.content,
        steps: m.steps?.filter((s: any) => s.type !== "reminder_created").map((step: any) => {
          if (step.type === "reasoning") {
            return {
              type: "reasoning" as const,
              summary: step.summary || "",
              thinking: step.thinking,
              searches: step.searches?.map((sq: any) => ({
                query: sq.query || "",
                resultCount: sq.resultCount || sq.results?.length || 0,
                results: (sq.results || []).map((r: any) => ({
                  title: r.title || "",
                  domain: r.domain || "",
                  url: r.url,
                })),
              })),
              searchPhase: "done" as const,
            };
          }
          return { type: "text" as const, content: step.content || "" };
        }) ?? undefined,
        attachments: m.attachments?.map((a) => ({
          id: a.id,
          filename: a.filename,
          original_filename: a.original_filename,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
          width: a.width ?? undefined,
          height: a.height ?? undefined,
          url: a.url,
        })) ?? undefined,
        reminder,
      };
    });
  }

  // Load messages when switching to a conversation (live mode only)
  useEffect(() => {
    if (!activeConversationId || !getAccessToken()) return;
    const conv = conversations.find((c) => c.id === activeConversationId);
    // Skip if messages already loaded OR conversation not in list yet
    if (conv && conv.messages.length > 0) return;
    (async () => {
      const data = await chatApi.fetchConversation(activeConversationId, 50, 0);
      if (!data) return;
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === activeConversationId);
        if (exists) {
          return prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages: mapApiMessages(data.messages), totalMessages: data.totalMessages, hasMore: data.hasMore }
              : c
          );
        }
        // Conversation not in list yet — add it
        return [
          { id: activeConversationId, title: data.messages[0]?.content?.slice(0, 60) || "Chat", messages: mapApiMessages(data.messages), createdAt: new Date().toISOString().split("T")[0], totalMessages: data.totalMessages, hasMore: data.hasMore },
          ...prev,
        ];
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, conversations.length]);

  // Load older messages (infinite scroll)
  const loadMoreMessages = useCallback(async () => {
    if (!activeConversationId || !getAccessToken()) return;
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv || !conv.hasMore || conv.loadingMore) return;

    // Mark as loading
    setConversations((prev) =>
      prev.map((c) => c.id === activeConversationId ? { ...c, loadingMore: true } : c)
    );

    const offset = conv.messages.length;
    const data = await chatApi.fetchConversation(activeConversationId, 50, offset);
    if (!data) {
      setConversations((prev) =>
        prev.map((c) => c.id === activeConversationId ? { ...c, loadingMore: false } : c)
      );
      return;
    }

    const olderMessages = mapApiMessages(data.messages);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              // Prepend older messages (they come in chronological order)
              messages: [...olderMessages, ...c.messages],
              hasMore: data.hasMore,
              loadingMore: false,
            }
          : c
      )
    );
  }, [activeConversationId, conversations]);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  const addPendingFiles = useCallback((files: File[]) => {
    setPendingFiles((prev) => {
      const combined = [...prev, ...files];
      return combined.slice(0, 10); // max 10 files per message
    });
  }, []);

  // Add a conversation to the sidebar list if it doesn't exist (used by voice mode)
  const ensureConversation = useCallback((id: string, title: string) => {
    setConversations((prev) => {
      if (prev.find((c) => c.id === id)) return prev;
      return [{ id, title, messages: [], createdAt: new Date().toISOString().split("T")[0] }, ...prev];
    });
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
      if (getAccessToken()) {
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
      if (getAccessToken()) {
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
      if (getAccessToken()) {
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

  // Helper: set error on a message (replaces content with error state)
  const setMessageError = useCallback((convId: string, msgId: string, error: MessageError) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: c.messages.map((m) => m.id === msgId ? { ...m, content: "", error } : m) }
          : c
      )
    );
  }, []);

  // Send message — optimistic UI: show instantly, stream in background
  const sendMessage = useCallback(
    async (content: string) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
      const isLive = true; // always live — mock data removed
      let convId = activeConversationId;

      // Capture and clear pending files
      const filesToUpload = [...pendingFiles];
      setPendingFiles([]);

      // Build optimistic attachments from pending files (local previews)
      const optimisticAttachments: Attachment[] = filesToUpload.map((f, i) => ({
        id: `pending-${Date.now()}-${i}`,
        filename: f.name,
        original_filename: f.name,
        mime_type: f.type,
        size_bytes: f.size,
        url: "",
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        progress: 0,
      }));

      // Optimistic: show user message IMMEDIATELY (before any API call)
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        attachments: optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
      };

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

        // Create real conversation in background, swap ID (skip for guests)
        if (isLive && getAccessToken()) {
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

      // Upload files BEFORE sending message so we can link them — skip for guests
      const uploadedIds: string[] = [];
      if (isLive && getAccessToken() && filesToUpload.length > 0 && convId) {
        const results = await Promise.allSettled(
          filesToUpload.map((file) => uploadFile(convId!, file))
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.ok) {
            for (const att of r.value.data) {
              uploadedIds.push(att.id);
            }
          } else if (r.status === "rejected") {
            console.error("File upload failed:", r.reason);
          }
        }
      }

      if (isLive) {
        const isGuest = !getAccessToken();
        const controller = new AbortController();
        setAbortController(controller);
        setIsThinking(true);
        setQueuePosition(null);
        const asstId = `asst-${Date.now()}`;

        // Optimistic: show empty assistant bubble IMMEDIATELY
        addMessage(convId, { id: asstId, role: "assistant", content: "" });

        try {
          let fullContent = "";
          let streamingStarted = false;
          const searches: SearchQuery[] = [];
          let currentSearchQuery = "";

          const ALLOWED_MODELS = ["mira", "mira-thinking"];
          const modelName = selectedModel.toLowerCase().replace(/\s+/g, "-");
          const safeModel = ALLOWED_MODELS.includes(modelName) ? modelName : "mira";

          // Guest: use anonymous endpoint (no auth, no storage, 5/day limit)
          const eventStream = isGuest
            ? chatApi.streamAnonymous(content, controller.signal)
            : chatApi.streamMessage(convId, content, safeModel, controller.signal, false, uploadedIds);

          for await (const event of eventStream) {
            switch (event.type) {
              case "queue":
                setQueuePosition(event.position);
                setIsThinking(true);
                break;

              case "processing":
                setQueuePosition(null);
                setIsThinking(true);
                break;

              case "search":
                // Model is searching the web — show animated search indicator
                currentSearchQuery = event.query;
                setIsThinking(true);
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === asstId
                              ? {
                                  ...m,
                                  steps: [
                                    { type: "reasoning" as const, summary: event.query, searches: [], searchPhase: "searching" as const },
                                  ],
                                }
                              : m
                          ),
                        }
                      : c
                  )
                );
                break;

              case "search_results":
                // Search results arrived — store for display
                searches.push({
                  query: event.query,
                  resultCount: event.results.length,
                  results: event.results.map((r) => ({
                    title: r.title,
                    domain: r.domain,
                    url: r.url,
                  })),
                });
                // Update the message to show search results with animation
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === asstId
                              ? {
                                  ...m,
                                  steps: [
                                    { type: "reasoning" as const, summary: event.query, searches: [...searches], searchPhase: "results" as const },
                                  ],
                                }
                              : m
                          ),
                        }
                      : c
                  )
                );
                break;

              case "token":
                if (!streamingStarted) {
                  streamingStarted = true;
                  setIsThinking(false);
                  setIsStreaming(true);
                }
                fullContent += event.content;
                // Update message: include steps (search) + content
                const phase = streamingStarted && fullContent.length < 20 ? "answering" as const : "done" as const;
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === asstId
                              ? {
                                  ...m,
                                  content: fullContent,
                                  steps: searches.length > 0
                                    ? [
                                        { type: "reasoning" as const, summary: searches.map(s => s.query).join(", "), searches: [...searches], searchPhase: phase },
                                        { type: "text" as const, content: fullContent },
                                      ]
                                    : undefined,
                                }
                              : m
                          ),
                        }
                      : c
                  )
                );
                break;

              case "reminder_created":
                // Attach reminder info to the current assistant message
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === asstId
                              ? {
                                  ...m,
                                  reminder: {
                                    id: event.id,
                                    title: event.title,
                                    remind_at: event.remind_at,
                                    rrule: event.rrule,
                                  },
                                }
                              : m
                          ),
                        }
                      : c
                  )
                );
                break;

              case "done":
                break;

              case "error":
                setMessageError(convId!, asstId, {
                  type: "generic",
                  message: event.message || t("error.generic"),
                });
                break;
            }
          }

          setIsStreaming(false);
          setIsThinking(false);
          setQueuePosition(null);

          if (!fullContent.trim()) {
            setMessageError(convId, asstId, {
              type: "generic",
              message: t("error.noResponse"),
            });
          }
        } catch (err: any) {
          setIsThinking(false);
          setIsStreaming(false);
          setQueuePosition(null);
          if (err?.name === "AbortError") {
            setMessageError(convId, asstId, {
              type: "cancelled",
              message: t("error.cancelled"),
            });
          } else if (err?.status === 429) {
            const isGuest = !getAccessToken();
            if (isGuest) {
              setMessageError(convId, asstId, {
                type: "rate_limit",
                message: t("error.guestLimit"),
              });
            } else {
              const mins = err.retryAfter ? Math.ceil(err.retryAfter / 60) : null;
              setMessageError(convId, asstId, {
                type: "rate_limit",
                message: t("error.rateLimit"),
                retryAfterMinutes: mins ?? undefined,
              });
            }
          } else if (err?.status === 402) {
            setMessageError(convId, asstId, {
              type: "payment",
              message: t("error.payment"),
            });
          } else {
            setMessageError(convId, asstId, {
              type: "generic",
              message: t("error.generic"),
            });
          }
        } finally {
          setAbortController(null);
        }
      }
      } finally {
        sendingRef.current = false;
      }
    },
    [activeConversationId, addMessage, selectedModel, updateMessageContent, pendingFiles]
  );

  // Resend: for edited messages — skips user message creation, just streams a new AI response
  const resendMessage = useCallback(
    async (content: string) => {
      if (sendingRef.current) return;
      if (!activeConversationId) return;
      sendingRef.current = true;
      const convId = activeConversationId;

      try {
        if (!getAccessToken()) return;

        const controller = new AbortController();
        setAbortController(controller);
        setIsThinking(true);
        setQueuePosition(null);
        const asstId = `asst-${Date.now()}`;

        addMessage(convId, { id: asstId, role: "assistant", content: "" });

        let fullContent = "";
        let streamingStarted = false;
        const searches: SearchQuery[] = [];

        const ALLOWED_MODELS = ["mira", "mira-thinking"];
        const modelName = selectedModel.toLowerCase().replace(/\s+/g, "-");
        const safeModel = ALLOWED_MODELS.includes(modelName) ? modelName : "mira";

        try {
          for await (const event of chatApi.streamMessage(convId, content, safeModel, controller.signal, false, [], true)) {
            switch (event.type) {
              case "queue":
                setQueuePosition(event.position);
                break;
              case "processing":
                setQueuePosition(null);
                break;
              case "search":
                setConversations((prev) =>
                  prev.map((c) => c.id === convId ? { ...c, messages: c.messages.map((m) => m.id === asstId ? { ...m, steps: [{ type: "reasoning" as const, summary: event.query, searches: [], searchPhase: "searching" as const }] } : m) } : c)
                );
                break;
              case "search_results":
                searches.push({ query: event.query, resultCount: event.results.length, results: event.results.map((r) => ({ title: r.title, domain: r.domain, url: r.url })) });
                setConversations((prev) =>
                  prev.map((c) => c.id === convId ? { ...c, messages: c.messages.map((m) => m.id === asstId ? { ...m, steps: [{ type: "reasoning" as const, summary: event.query, searches: [...searches], searchPhase: "results" as const }] } : m) } : c)
                );
                break;
              case "token":
                if (!streamingStarted) { streamingStarted = true; setIsThinking(false); setIsStreaming(true); }
                fullContent += event.content;
                const phase = fullContent.length < 20 ? "answering" as const : "done" as const;
                setConversations((prev) =>
                  prev.map((c) => c.id === convId ? { ...c, messages: c.messages.map((m) => m.id === asstId ? { ...m, content: fullContent, steps: searches.length > 0 ? [{ type: "reasoning" as const, summary: searches.map(s => s.query).join(", "), searches: [...searches], searchPhase: phase }, { type: "text" as const, content: fullContent }] : undefined } : m) } : c)
                );
                break;
              case "error":
                setMessageError(convId, asstId, { type: "generic", message: event.message || t("error.generic") });
                break;
            }
          }
          setIsStreaming(false);
          setIsThinking(false);
          setQueuePosition(null);
          if (!fullContent.trim()) {
            setMessageError(convId, asstId, { type: "generic", message: t("error.noResponse") });
          }
        } catch (err: any) {
          setIsThinking(false);
          setIsStreaming(false);
          setQueuePosition(null);
          if (err?.name === "AbortError") {
            setMessageError(convId, asstId, { type: "cancelled", message: t("error.cancelled") });
          } else if (err?.status === 429) {
            const mins = err.retryAfter ? Math.ceil(err.retryAfter / 60) : null;
            setMessageError(convId, asstId, { type: "rate_limit", message: t("error.rateLimit"), retryAfterMinutes: mins ?? undefined });
          } else if (err?.status === 402) {
            setMessageError(convId, asstId, { type: "payment", message: t("error.payment") });
          } else {
            setMessageError(convId, asstId, { type: "generic", message: t("error.generic") });
          }
        } finally {
          setAbortController(null);
        }
      } finally {
        sendingRef.current = false;
      }
    },
    [activeConversationId, addMessage, selectedModel, setMessageError]
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
        pendingFiles,
        setPendingFiles,
        addPendingFiles,
        removePendingFile,
        sendMessage,
        resendMessage,
        loadMoreMessages,
        ensureConversation,
        cancelMessage,
        queuePosition,
        showReminders,
        setShowReminders,
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
