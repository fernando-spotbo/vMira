"use client";

import { useEffect } from "react";

/**
 * Telegram OAuth callback page.
 *
 * After the user authorizes in the Telegram popup, Telegram redirects
 * here with the auth result in the URL hash: #tgAuthResult=<base64 JSON>
 *
 * This page extracts the data and sends it back to the opener window
 * via postMessage, then closes itself.
 */
export default function TelegramCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash;

    if (hash.includes("tgAuthResult=")) {
      const encoded = hash.split("tgAuthResult=")[1];
      if (encoded && window.opener) {
        try {
          const jsonStr = atob(decodeURIComponent(encoded));
          const data = JSON.parse(jsonStr);
          // Send auth data to the opener (AuthModal)
          window.opener.postMessage(
            { type: "telegram-auth", data },
            window.location.origin
          );
        } catch (e) {
          console.error("Failed to parse Telegram auth result:", e);
        }
      }
      // Close popup after sending data
      window.close();
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#161616] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-6 h-6 border-2 border-white/[0.08] border-t-white/60 rounded-full mx-auto" />
        <p className="mt-4 text-[14px] text-white/40">Completing login...</p>
      </div>
    </div>
  );
}
