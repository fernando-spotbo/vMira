/**
 * API client for communicating with the Mira backend.
 *
 * All requests go through /api/proxy/* (Next.js API route) which adds
 * HMAC signatures server-side. The browser never talks to the backend directly.
 */

const PROXY_URL = "/api/proxy";

// ---- Auth token management (client-side) ----

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ---- API call helper (client-side, goes through Next.js proxy for HMAC) ----

export async function apiCall<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; ok: boolean; status: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest", // CSRF defense
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Route through Next.js proxy: /api/proxy/auth/login → backend /api/v1/auth/login
  const proxyPath = path.startsWith("/") ? path.slice(1) : path;
  const res = await fetch(`${PROXY_URL}/${proxyPath}`, {
    ...options,
    headers,
    credentials: "include", // Send cookies (refresh token)
  });

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
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    plan: string;
    language: string;
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
  formData.append("audio", audioBlob, "voice.webm");
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

export async function updateReminder(id: string, data: { title?: string; body?: string | null; remind_at?: string; rrule?: string | null }) {
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
  chat_id: number | null;
  linked_at: string | null;
}

export async function getTelegramStatus() {
  return apiCall<TelegramStatus>("/telegram/status");
}

export async function unlinkTelegram() {
  return apiCall("/telegram/unlink", { method: "DELETE" });
}
