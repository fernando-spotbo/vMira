/**
 * Telegram webhook relay — forwards updates from Telegram (HTTPS required)
 * to the Rust backend on the VPS (HTTP).
 *
 * Telegram → https://vmira.ai/api/telegram/webhook → http://178.20.208.89/api/v1/telegram/webhook
 *
 * This relay exists because Telegram requires HTTPS for webhooks and the VPS
 * doesn't have SSL configured yet.
 */

import { NextRequest } from "next/server";

const BACKEND_WEBHOOK_URL = process.env.BACKEND_URL
  ? `${process.env.BACKEND_URL}/api/v1/telegram/webhook`
  : "http://178.20.208.89/api/v1/telegram/webhook";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.text();

    // Forward the secret token header from Telegram
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretToken) {
      headers["x-telegram-bot-api-secret-token"] = secretToken;
    }

    const resp = await fetch(BACKEND_WEBHOOK_URL, {
      method: "POST",
      headers,
      body,
    });

    return new Response(null, { status: resp.status });
  } catch (err) {
    console.error("Telegram webhook relay error:", err);
    return new Response(null, { status: 502 });
  }
}
