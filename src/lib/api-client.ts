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
