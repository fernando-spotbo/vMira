/**
 * API client for communicating with the Mira backend.
 *
 * All requests go through /api/proxy/* (Next.js API route) which adds
 * HMAC signatures server-side. The browser never talks to the backend directly.
 */

import type { ApiProjectFile } from "./api-chat";

const PROXY_URL = "/api/proxy";

// ---- Auth token management (client-side) ----
// Access token lives in memory + sessionStorage (tab-scoped).
// sessionStorage survives page reloads (including deploy-triggered ones)
// but is scoped to the tab, so it doesn't leak across windows.

const TOKEN_KEY = "mira_at";

let accessToken: string | null = (() => {
  try { return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null; }
  catch { return null; }
})();

export function setAccessToken(token: string | null) {
  accessToken = token;
  try {
    if (typeof sessionStorage !== "undefined") {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch { /* SSR or private browsing */ }
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ---- API call helper (client-side, goes through Next.js proxy for HMAC) ----

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const res = await fetch(`${PROXY_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
    credentials: "include",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.access_token) { setAccessToken(data.access_token); return true; }
  }
  return false;
}

export async function apiCall<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; ok: boolean; status: number }> {
  const makeRequest = async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(options.headers as Record<string, string>),
    };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const proxyPath = path.startsWith("/") ? path.slice(1) : path;
    return fetch(`${PROXY_URL}/${proxyPath}`, {
      ...options,
      headers,
      credentials: "include",
    });
  };

  let res = await makeRequest();

  // Auto-refresh on 401 (skip for auth endpoints to avoid loops)
  if (res.status === 401 && !path.includes("/auth/")) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = doRefresh();
    }
    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      res = await makeRequest();
    }
  }

  let data: T;
  try {
    data = await res.json();
  } catch {
    data = {} as T;
  }

  return { data, ok: res.ok, status: res.status };
}

// ---- Auth helpers ----

export async function login(email: string, password: string) {
  const result = await apiCall<{ access_token: string; expires_in: number }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (result.ok) {
    setAccessToken(result.data.access_token);
  }

  return result;
}

export async function register(name: string, email: string, password: string) {
  return apiCall("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function refreshToken() {
  const result = await apiCall<{ access_token: string; expires_in: number }>("/auth/refresh", {
    method: "POST",
  });

  if (result.ok) {
    setAccessToken(result.data.access_token);
  }

  return result;
}

export async function logout() {
  const result = await apiCall("/auth/logout", { method: "POST" });
  setAccessToken(null);
  return result;
}

export async function getMe() {
  return apiCall<{
    id: string;
    name: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    plan: string;
    language: string;
    balance_kopecks: number;
    daily_messages_used: number;
    allow_overage_billing: boolean;
    chat_plan: string;
    chat_plan_expires_at: string | null;
    code_plan: string;
    code_plan_expires_at: string | null;
  }>("/auth/me");
}

// ---- Feedback ----

export interface FeedbackData {
  rating: "good" | "bad";
  severity?: "minor" | "major" | "critical";
  categories?: string[];
  comment?: string;
  correction?: string;
}

export async function submitFeedback(messageId: string, feedback: FeedbackData) {
  return apiCall<{ id: string; rating: string }>(`/chat/messages/${messageId}/feedback`, {
    method: "POST",
    body: JSON.stringify(feedback),
  });
}

// ---- Voice transcription ----

export async function transcribeAudio(
  audioBlob: Blob,
  language?: string,
): Promise<{ text: string; language?: string; duration?: number }> {
  const formData = new FormData();
  // Use correct extension based on blob type (Safari/iOS uses mp4, Chrome uses webm)
  const ext = audioBlob.type.includes("mp4") ? "m4a" : "webm";
  formData.append("audio", audioBlob, `voice.${ext}`);
  if (language) formData.append("language", language);

  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Route through HMAC proxy → Rust backend → local whisper service
  const res = await fetch(`${PROXY_URL}/voice/transcribe`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Transcription failed" }));
    throw new Error(err.detail || "Transcription failed");
  }

  return res.json();
}

// ---- Voice message persistence ----

export async function saveVoiceMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  // Call the backend directly (same as voice WS) — bypasses HMAC proxy
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  fetch(`https://api.vmira.ai/api/v1/voice/save-message/${conversationId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ role, content }),
  }).catch(() => {}); // fire-and-forget
}

// ---- Voice TTS ----

export async function synthesizeAudio(
  text: string,
  language?: string,
): Promise<Blob> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${PROXY_URL}/voice/synthesize`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, language }),
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("TTS synthesis failed");
  }

  return res.blob();
}

// ---- File upload ----

export interface UploadedAttachment {
  id: string;
  conversation_id: string;
  message_id: string | null;
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  compressed_size: number | null;
  width: number | null;
  height: number | null;
  url: string;
  created_at: string;
}

export async function uploadFile(
  conversationId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ data: UploadedAttachment[]; ok: boolean; status: number }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Use XMLHttpRequest for progress tracking
  if (onProgress) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${PROXY_URL}/chat/conversations/${conversationId}/attachments`);

      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        let data: UploadedAttachment[];
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = [] as UploadedAttachment[];
        }
        resolve({ data, ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
      };

      xhr.onerror = () => {
        resolve({ data: [] as UploadedAttachment[], ok: false, status: 0 });
      };

      xhr.send(formData);
    });
  }

  // Simple fetch for no-progress uploads
  const res = await fetch(
    `${PROXY_URL}/chat/conversations/${conversationId}/attachments`,
    {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    },
  );

  let data: UploadedAttachment[];
  try {
    data = await res.json();
  } catch {
    data = [] as UploadedAttachment[];
  }

  return { data, ok: res.ok, status: res.status };
}

// ---- Project file upload ----

export async function uploadProjectFile(
  projectId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ data: ApiProjectFile[]; ok: boolean; status: number }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Use XMLHttpRequest for progress tracking
  if (onProgress) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${PROXY_URL}/chat/projects/${projectId}/files`);

      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        let data: ApiProjectFile[];
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = [] as ApiProjectFile[];
        }
        resolve({ data, ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
      };

      xhr.onerror = () => {
        resolve({ data: [] as ApiProjectFile[], ok: false, status: 0 });
      };

      xhr.send(formData);
    });
  }

  // Simple fetch for no-progress uploads
  const res = await fetch(
    `${PROXY_URL}/chat/projects/${projectId}/files`,
    {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    },
  );

  let data: ApiProjectFile[];
  try {
    data = await res.json();
  } catch {
    data = [] as ApiProjectFile[];
  }

  return { data, ok: res.ok, status: res.status };
}

// ---- Notifications & Reminders ----

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  reminder_id: string | null;
  created_at: string;
}

export interface NotificationsList {
  notifications: NotificationItem[];
  unread_count: number;
}

export async function getNotifications(limit = 20) {
  return apiCall<NotificationsList>(`/notifications?limit=${limit}`);
}

export async function markNotificationRead(id: string) {
  return apiCall(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead() {
  return apiCall("/notifications/read-all", { method: "POST" });
}

export interface ReminderItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  remind_at: string;
  user_timezone: string;
  rrule: string | null;
  status: string;
  channels: string[];
  created_at: string;
  updated_at: string;
}

export async function getReminders(status?: string, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return apiCall<ReminderItem[]>(`/reminders?${params}`);
}

export async function updateReminder(id: string, data: { title?: string; body?: string | null; remind_at?: string; rrule?: string | null; channels?: string[] }) {
  return apiCall(`/reminders/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteReminder(id: string) {
  return apiCall(`/reminders/${id}`, { method: "DELETE" });
}

export async function snoozeReminder(id: string, durationMinutes: number) {
  return apiCall(`/reminders/${id}/snooze`, { method: "POST", body: JSON.stringify({ duration_minutes: durationMinutes }) });
}

export async function getNotificationSettings() {
  return apiCall<{ email_enabled: boolean; telegram_enabled: boolean; timezone: string; quiet_start: string | null; quiet_end: string | null }>("/notification-settings");
}

export async function updateNotificationSettings(data: { email_enabled?: boolean; telegram_enabled?: boolean; timezone?: string; quiet_start?: string; quiet_end?: string }) {
  return apiCall("/notification-settings", { method: "PUT", body: JSON.stringify(data) });
}

// ---- Telegram ----

export interface TelegramLinkToken {
  token: string;
  bot_username: string;
  deep_link: string;
}

export async function generateTelegramLinkToken() {
  return apiCall<TelegramLinkToken>("/telegram/link-token", { method: "POST" });
}

export interface TelegramStatus {
  linked: boolean;
  username: string | null;
  linked_at: string | null;
}

export async function getTelegramStatus() {
  return apiCall<TelegramStatus>("/telegram/status");
}

export async function unlinkTelegram() {
  return apiCall("/telegram/unlink", { method: "DELETE" });
}

// ---- Actions ----

export async function executeAction(id: string) {
  return apiCall<{ id: string; status: string; result?: unknown }>(`/actions/${id}/execute`, { method: "POST" });
}

export async function cancelAction(id: string) {
  return apiCall(`/actions/${id}/cancel`, { method: "POST" });
}

export async function getActionStatus(id: string) {
  return apiCall<{ id: string; status: string }>(`/actions/${id}`);
}

// ── Calendar ──────────────────────────────────────────────────────────────

export async function generateCalendarFeedToken() {
  return apiCall<{ url: string }>("/calendar/feed-token", { method: "POST" });
}

export async function getCalendarFeedStatus() {
  return apiCall<{ active: boolean; created_at: string | null; last_fetched_at: string | null }>("/calendar/feed-token/status");
}

export async function revokeCalendarFeedToken() {
  return apiCall("/calendar/feed-token", { method: "DELETE" });
}

// Generic calendar provider OAuth (google, outlook, yandex)
export async function getCalendarAuthUrl(provider: string) {
  return apiCall<{ url: string }>(`/calendar/${provider}/auth`);
}

export async function getCalendarProviderStatus(provider: string) {
  return apiCall<{ connected: boolean; last_synced_at: string | null }>(`/calendar/${provider}/status`);
}

export async function disconnectCalendarProvider(provider: string) {
  return apiCall(`/calendar/${provider}/disconnect`, { method: "DELETE" });
}

