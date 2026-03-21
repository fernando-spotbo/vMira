/**
 * Chat API client — real backend calls for conversations and messages.
 */

import { apiCall, getAccessToken } from "./api-client";

const PROXY_URL = "/api/proxy";

export interface ApiConversation {
  id: string;
  title: string;
  model: string;
  starred: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: any[] | null;
  model: string | null;
  created_at: string;
}

// ---- Conversations ----

export async function fetchConversations(): Promise<ApiConversation[]> {
  const result = await apiCall<ApiConversation[]>("/chat/conversations");
  return result.ok ? result.data : [];
}

export async function createConversation(title: string = "New chat", model: string = "mira"): Promise<ApiConversation | null> {
  const result = await apiCall<ApiConversation>("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ title, model }),
  });
  return result.ok ? result.data : null;
}

export async function fetchConversation(id: string): Promise<{ conversation: ApiConversation; messages: ApiMessage[] } | null> {
  const result = await apiCall<ApiConversation & { messages: ApiMessage[] }>(`/chat/conversations/${id}`);
  if (!result.ok) return null;
  const { messages, ...conversation } = result.data;
  return { conversation, messages };
}

export async function updateConversation(id: string, data: { title?: string; starred?: boolean; archived?: boolean }): Promise<boolean> {
  const result = await apiCall(`/chat/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return result.ok;
}

export async function deleteConversation(id: string): Promise<boolean> {
  const result = await apiCall(`/chat/conversations/${id}`, { method: "DELETE" });
  return result.ok;
}

// ---- SSE Event Types ----

export type StreamEvent =
  | { type: "queue"; position: number; estimated_wait: number }
  | { type: "processing" }
  | { type: "token"; content: string }
  | { type: "done"; usage?: { input_tokens: number; output_tokens: number; total_tokens: number; cost_microcents: number } }
  | { type: "error"; message: string };

// ---- Messages (SSE streaming with queue support) ----

export async function* streamMessage(
  conversationId: string,
  content: string,
  model: string = "mira",
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, undefined> {
  const token = getAccessToken();

  const res = await fetch(`${PROXY_URL}/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ content, model }),
    signal,
  });

  if (!res.ok || !res.body) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const STREAM_TIMEOUT_MS = 120_000; // 2 minutes
  let lastActivity = Date.now();
  const timeoutChecker = setInterval(() => {
    if (Date.now() - lastActivity > STREAM_TIMEOUT_MS) {
      reader.cancel();
      clearInterval(timeoutChecker);
    }
  }, 5000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lastActivity = Date.now();

      buffer += decoder.decode(value, { stream: true });

      const MAX_BUFFER_SIZE = 1_048_576; // 1MB
      if (buffer.length > MAX_BUFFER_SIZE) {
        clearInterval(timeoutChecker);
        reader.cancel();
        yield { type: "error", message: "Response too large" } as StreamEvent;
        return;
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }
          if (data === "[ERROR]") {
            yield { type: "error", message: "AI response error" };
            return;
          }

          // Try to parse as JSON event (new format)
          try {
            const parsed = JSON.parse(data);
            const validTypes = ["queue", "processing", "token", "done", "error"];
            if (parsed && typeof parsed.type === "string" && validTypes.includes(parsed.type)) {
              const event: StreamEvent = parsed.type === "token"
                ? { type: "token", content: String(parsed.content || "") }
                : parsed.type === "queue"
                ? { type: "queue", position: Number(parsed.position || 0), estimated_wait: Number(parsed.estimated_wait || 0) }
                : parsed.type === "done"
                ? { type: "done", usage: parsed.usage }
                : parsed.type === "error"
                ? { type: "error", message: String(parsed.message || "Unknown error") }
                : { type: "processing" };
              yield event;
              continue;
            }
          } catch {
            // Not JSON — treat as raw token text (legacy format)
          }

          // Legacy: raw text chunk
          if (data && !data.startsWith("[")) {
            yield { type: "token", content: data };
          }
        }
      }
    }
  } finally {
    clearInterval(timeoutChecker);
  }
}
