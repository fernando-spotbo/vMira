/**
 * Chat API client — real backend calls for conversations and messages.
 */

import { apiCall, getAccessToken } from "./api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

// ---- Messages (SSE streaming) ----

export async function* streamMessage(
  conversationId: string,
  content: string,
  model: string = "mira",
): AsyncGenerator<string, void, undefined> {
  const token = getAccessToken();

  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ content, model }),
  });

  if (!res.ok || !res.body) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        if (data === "[ERROR]") throw new Error("AI response error");
        if (data.startsWith("[")) continue; // Skip error/info messages
        yield data;
      }
    }
  }
}
