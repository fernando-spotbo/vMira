/**
 * Catch-all API proxy — signs requests with HMAC before forwarding to backend.
 *
 * Browser → /api/proxy/auth/login → HMAC signed → api.vmira.ai/api/v1/auth/login
 *
 * This ensures:
 * 1. HMAC secret never leaves the server
 * 2. All requests are authenticated at the transport level
 * 3. Cookies (refresh tokens) are forwarded transparently
 * 4. SSE streams are proxied without buffering
 */

import { NextRequest, NextResponse } from "next/server";
import { signRequest, BACKEND_URL, HMAC_SECRET } from "@/lib/server/hmac";

const API_PREFIX = "/api/v1";

async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const backendPath = `${API_PREFIX}/${path.join("/")}`;
  const method = req.method;

  // Read body for non-GET requests
  let body = "";
  if (method !== "GET" && method !== "HEAD") {
    body = await req.text();
  }

  // Sign the request
  const { timestamp, nonce, signature } = signRequest(method, backendPath, body);

  // Build headers — forward auth and cookies
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") || "application/json",
    "X-Request-Timestamp": timestamp,
    "X-Request-Nonce": nonce,
    "X-Request-Signature": signature,
  };

  // Forward Authorization header (JWT access token)
  const auth = req.headers.get("authorization");
  if (auth) {
    headers["Authorization"] = auth;
  }

  // Forward cookies (refresh token)
  const cookie = req.headers.get("cookie");
  if (cookie) {
    headers["Cookie"] = cookie;
  }

  // Forward client IP
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  headers["X-Forwarded-For"] = clientIp;

  const backendUrl = `${BACKEND_URL}${backendPath}`;

  const res = await fetch(backendUrl, {
    method,
    headers,
    body: method !== "GET" && method !== "HEAD" ? body : undefined,
  });

  // Check if this is an SSE stream
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream") && res.body) {
    // Stream SSE without buffering
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        // Forward set-cookie headers (refresh token rotation)
        ...forwardCookieHeaders(res),
      },
    });
  }

  // Regular JSON response — forward status, body, and cookies
  const responseBody = await res.text();
  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", contentType || "application/json");

  // Forward Set-Cookie headers for refresh token
  const setCookies = res.headers.getSetCookie?.() || [];
  for (const cookie of setCookies) {
    responseHeaders.append("Set-Cookie", cookie);
  }

  // Forward cache control
  const cacheControl = res.headers.get("cache-control");
  if (cacheControl) {
    responseHeaders.set("Cache-Control", cacheControl);
  }

  // Forward rate limit headers
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    responseHeaders.set("Retry-After", retryAfter);
  }

  return new Response(responseBody, {
    status: res.status,
    headers: responseHeaders,
  });
}

function forwardCookieHeaders(res: Response): Record<string, string> {
  const result: Record<string, string> = {};
  const setCookies = res.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) {
    // Note: Headers API doesn't support multiple Set-Cookie well,
    // but the Response constructor handles it via the headers object
    result["Set-Cookie"] = setCookies.join(", ");
  }
  return result;
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
