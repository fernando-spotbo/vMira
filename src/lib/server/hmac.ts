/**
 * Server-side HMAC signing for Vercel ↔ Backend communication.
 * This runs ONLY in Next.js server context (API routes / server actions).
 * Never import this from client components.
 */

import { createHmac, randomBytes } from "crypto";

// Lazy-loaded at runtime (not build time) to work with Vercel's env injection
function getHmacSecret(): string {
  const val = process.env.HMAC_SECRET;
  if (!val) {
    throw new Error("HMAC_SECRET environment variable is required");
  }
  return val;
}

function getBackendUrl(): string {
  const val = process.env.BACKEND_URL;
  if (!val) {
    throw new Error("BACKEND_URL environment variable is required");
  }
  return val;
}

export function signRequest(method: string, path: string, body: string): {
  timestamp: string;
  nonce: string;
  signature: string;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");

  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${body}`;
  const signature = createHmac("sha256", getHmacSecret())
    .update(payload)
    .digest("hex");

  return { timestamp, nonce, signature };
}

export async function backendFetch(
  path: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const method = options.method || "GET";
  const body = options.body || "";

  const { timestamp, nonce, signature } = signRequest(method, path, body);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Timestamp": timestamp,
    "X-Request-Nonce": nonce,
    "X-Request-Signature": signature,
    ...options.headers,
  };

  return fetch(`${getBackendUrl()}${path}`, {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });
}

export { getHmacSecret as HMAC_SECRET, getBackendUrl as BACKEND_URL };
