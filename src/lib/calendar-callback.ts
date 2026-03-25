import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BACKEND_URL = process.env.BACKEND_URL;
const HMAC_SECRET = process.env.HMAC_SECRET || "";

export async function handleCalendarCallback(req: NextRequest, provider: string) {
  if (!BACKEND_URL) {
    return new NextResponse("Backend not configured", { status: 500 });
  }

  const url = new URL(req.url);
  const backendPath = `/api/v1/calendar/${provider}/callback${url.search}`;
  const backendUrl = `${BACKEND_URL}${backendPath}`;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(`${timestamp}:${backendPath}:`)
    .digest("hex");

  const resp = await fetch(backendUrl, {
    headers: {
      "X-HMAC-Timestamp": timestamp,
      "X-HMAC-Signature": signature,
    },
  });

  const html = await resp.text();
  return new NextResponse(html, {
    status: resp.status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
