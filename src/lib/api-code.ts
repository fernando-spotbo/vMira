/**
 * Code API client — remote control sessions (bridge environments).
 */

import { apiCall, getAccessToken } from "./api-client";

const PROXY_URL = "/api/proxy";

export interface ApiRemoteSession {
  id: string;
  environment_id: string;
  machine_name: string;
  directory: string;
  branch?: string | null;
  git_repo_url?: string | null;
  status: "connected" | "reconnecting" | "offline";
  created_at: string;
  updated_at: string;
}

export interface ApiRemoteMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string | null;
  steps?: any[] | null;
  created_at: string;
}

// ---- Sessions ----

export async function fetchRemoteSessions(): Promise<ApiRemoteSession[]> {
  const result = await apiCall<ApiRemoteSession[]>("/code/sessions");
  return result.ok ? result.data : [];
}

export async function fetchRemoteSession(
  id: string,
  limit = 50,
  offset = 0,
): Promise<{
  session: ApiRemoteSession;
  messages: ApiRemoteMessage[];
  totalMessages: number;
  hasMore: boolean;
} | null> {
  const result = await apiCall<
    ApiRemoteSession & {
      messages: ApiRemoteMessage[];
      total_messages: number;
      has_more: boolean;
    }
  >(`/code/sessions/${id}?limit=${limit}&offset=${offset}`);
  if (!result.ok) return null;
  const { messages, total_messages, has_more, ...session } = result.data;
  return { session, messages, totalMessages: total_messages, hasMore: has_more };
}

export async function disconnectRemoteSession(id: string): Promise<boolean> {
  const result = await apiCall(`/code/sessions/${id}`, { method: "DELETE" });
  return result.ok;
}

// ---- Messages (SSE streaming) ----

export type RemoteStreamEvent =
  | { type: "thinking"; content: string }
  | { type: "token"; content: string }
  | { type: "tool_use"; name: string; input: string }
  | { type: "tool_result"; content: string }
  | { type: "done"; usage?: { input_tokens: number; output_tokens: number } }
  | { type: "error"; message: string };

export async function* streamRemoteMessage(
  sessionId: string,
  content: string,
  signal?: AbortSignal,
): AsyncGenerator<RemoteStreamEvent, void, undefined> {
  const token = getAccessToken();

  const res = await fetch(
    `${PROXY_URL}/code/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ content }),
      signal,
    },
  );

  if (!res.ok || !res.body) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const STREAM_TIMEOUT_MS = 120_000;
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

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const json = trimmed.slice(6);
        if (json === "[DONE]") return;
        try {
          yield JSON.parse(json) as RemoteStreamEvent;
        } catch {}
      }
    }
  } finally {
    clearInterval(timeoutChecker);
    reader.releaseLock();
  }
}
