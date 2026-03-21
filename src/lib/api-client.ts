/**
 * API client for communicating with the Mira backend.
 * Handles HMAC signing, CSRF headers, and auth token management.
 *
 * IMPORTANT: HMAC signing runs server-side only (Next.js API routes / server actions).
 * For client components, use the /api proxy routes instead.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

  const res = await fetch(`${API_URL}${path}`, {
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

// ---- SSE streaming helper ----

export async function* streamMessage(
  conversationId: string,
  content: string,
  model: string = "mira",
): AsyncGenerator<string, void, undefined> {
  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ content, model }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`API error: ${res.status}`);
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
        yield data;
      }
    }
  }
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
