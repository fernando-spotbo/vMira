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
import { signRequest, BACKEND_URL } from "@/lib/server/hmac";

const API_PREFIX = "/api/v1";
const MAX_BODY_SIZE = 1_048_576; // 1MB
const MAX_UPLOAD_SIZE = 10_485_760; // 10MB

async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const joinedPath = path.join("/");

  // Reject path traversal
  if (joinedPath.includes("..") || joinedPath.includes("//") || joinedPath.includes("\\")) {
    return new Response(JSON.stringify({ detail: "Invalid path" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Allowlist of valid API prefixes
  const ALLOWED_PREFIXES = ["auth/", "chat/", "api-keys/", "sessions/", "admin/", "billing/", "attachments/", "voice/", "notifications/", "reminders/", "notification-settings/"];
  if (!ALLOWED_PREFIXES.some(prefix => joinedPath.startsWith(prefix))) {
    return new Response(JSON.stringify({ detail: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const backendPath = `${API_PREFIX}/${joinedPath}`;
  const method = req.method;

  // CSRF protection — require XMLHttpRequest header on state-changing methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (!req.headers.get("x-requested-with")?.includes("XMLHttpRequest")) {
      return new Response(JSON.stringify({ detail: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Detect multipart uploads (file attachments)
  const contentType = req.headers.get("content-type") || "";
  const isMultipart = contentType.startsWith("multipart/");
  const sizeLimit = isMultipart ? MAX_UPLOAD_SIZE : MAX_BODY_SIZE;

  // Read body for non-GET requests with size limit
  let bodyText = "";
  let bodyBinary: ArrayBuffer | null = null;
  if (method !== "GET" && method !== "HEAD") {
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > sizeLimit) {
      return new Response(JSON.stringify({ detail: "Request too large" }), {
        status: 413, headers: { "Content-Type": "application/json" },
      });
    }
    if (isMultipart) {
      // Read as binary for multipart — preserve file data
      bodyBinary = await req.arrayBuffer();
      if (bodyBinary.byteLength > sizeLimit) {
        return new Response(JSON.stringify({ detail: "Request too large" }), {
          status: 413, headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      bodyText = await req.text();
      if (bodyText.length > sizeLimit) {
        return new Response(JSON.stringify({ detail: "Request too large" }), {
          status: 413, headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  // Sign the request — multipart uses a placeholder instead of the binary body
  const signBody = isMultipart ? "<multipart>" : bodyText;
  const { timestamp, nonce, signature } = signRequest(method, backendPath, signBody);

  // Build headers — forward auth and cookies
  const headers: Record<string, string> = {
    "Content-Type": contentType || "application/json",
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
    req.headers.get("x-vercel-forwarded-for") ||
    (req as any).ip ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  headers["X-Forwarded-For"] = clientIp;

  const searchParams = req.nextUrl.searchParams.toString();
  const queryString = searchParams ? `?${searchParams}` : "";
  const backendUrl = `${BACKEND_URL()}${backendPath}${queryString}`;

  const fetchController = new AbortController();
  const fetchTimeout = setTimeout(() => fetchController.abort(), 30_000);

  try {
    const res = await fetch(backendUrl, {
      method,
      headers,
      body: method !== "GET" && method !== "HEAD"
        ? (isMultipart ? bodyBinary : bodyText)
        : undefined,
      signal: fetchController.signal,
    });
    clearTimeout(fetchTimeout);

    // Sanitize 5xx errors — don't leak backend details
    if (res.status >= 500) {
      return new Response(JSON.stringify({ detail: "Internal server error" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isLocalhost = req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1";

    // Check if this is an SSE stream
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream") && res.body) {
      // Stream SSE without buffering
      const responseHeaders = new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      const sseSetCookies = res.headers.getSetCookie?.() || [];
      for (let cookie of sseSetCookies) {
        if (isLocalhost) cookie = cookie.replace(/;\s*Secure/gi, "");
        responseHeaders.append("Set-Cookie", cookie);
      }
      return new Response(res.body, { status: res.status, headers: responseHeaders });
    }

    // Binary audio response — pass through without text conversion
    if (contentType.startsWith("audio/")) {
      const audioBuffer = await res.arrayBuffer();
      const audioHeaders = new Headers();
      audioHeaders.set("Content-Type", contentType);
      const audioSetCookies = res.headers.getSetCookie?.() || [];
      for (let cookie of audioSetCookies) {
        if (isLocalhost) cookie = cookie.replace(/;\s*Secure/gi, "");
        audioHeaders.append("Set-Cookie", cookie);
      }
      return new Response(audioBuffer, { status: res.status, headers: audioHeaders });
    }

    // Regular JSON response — forward status, body, and cookies
    const responseBody = await res.text();
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType || "application/json");

    // Forward Set-Cookie headers — strip Secure flag on localhost (HTTP)
    const setCookies = res.headers.getSetCookie?.() || [];
    for (let cookie of setCookies) {
      if (isLocalhost) cookie = cookie.replace(/;\s*Secure/gi, "");
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
  } catch (err: any) {
    clearTimeout(fetchTimeout);
    if (err?.name === "AbortError") {
      return new Response(JSON.stringify({ detail: "Backend timeout" }), {
        status: 504, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ detail: "Backend unavailable" }), {
      status: 502, headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleOptions(req: NextRequest): Promise<Response> {
  const ALLOWED_ORIGINS = [
    "https://vmira.ai",
    "https://www.vmira.ai",
    "http://localhost:3000",
  ];
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = handleOptions;
