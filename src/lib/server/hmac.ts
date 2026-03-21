/**
 * Server-side HMAC signing for Vercel ↔ Backend communication.
 * This runs ONLY in Next.js server context (API routes / server actions).
 * Never import this from client components.
 */

import { createHmac, randomBytes } from "crypto";

function getRequiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`${name} environment variable is required`);
  }
  return val;
}

const HMAC_SECRET = getRequiredEnv("HMAC_SECRET");
const BACKEND_URL = getRequiredEnv("BACKEND_URL");

export function signRequest(method: string, path: string, body: string): {
  timestamp: string;
  nonce: string;
  signature: string;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");

  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${body}`;
  const signature = createHmac("sha256", HMAC_SECRET)
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

  return fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });
}

export function getBackendUrl(): string {
  return BACKEND_URL;
}

export { HMAC_SECRET, BACKEND_URL };
