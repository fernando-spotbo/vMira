/**
 * Telegram webhook relay — forwards updates from Telegram (HTTPS required)
 * to the Rust backend on the VPS (HTTP).
 *
 * Telegram → https://vmira.ai/api/telegram/webhook → VPS backend
 *
 * Security: validates secret token at relay level, enforces body size limit.
 */

import { NextRequest } from "next/server";

const MAX_BODY_SIZE = 262_144; // 256 KB — Telegram payloads are typically < 100 KB

function getBackendWebhookUrl(): string {
  const base = process.env.BACKEND_URL;
  if (!base) throw new Error("BACKEND_URL environment variable is required");
  return `${base}/api/v1/telegram/webhook`;
}

export async function POST(req: NextRequest): Promise<Response> {
  // Validate secret token at relay level (fail fast)
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(null, { status: 403 });
  }

  try {
    const body = await req.text();

    // Enforce body size limit
    if (body.length > MAX_BODY_SIZE) {
      return new Response(null, { status: 413 });
    }

    const resp = await fetch(getBackendWebhookUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": providedSecret,
      },
      body,
    });

    return new Response(null, { status: resp.status });
  } catch (err) {
    console.error("Telegram webhook relay error:", err);
    return new Response(null, { status: 502 });
  }
}
