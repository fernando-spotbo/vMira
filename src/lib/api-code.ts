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

// ---- Send prompt to CLI (queued for CLI processing) ----

export async function sendRemotePrompt(
  sessionId: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await apiCall<{ id: string; status: string }>(`/code/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  if (!result.ok) {
    return { ok: false, error: (result.data as any)?.detail || "Failed to send" };
  }
  return { ok: true };
}
