"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function YandexCallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");

    if (code && window.opener) {
      window.opener.postMessage(
        { type: "yandex-auth", code },
        window.location.origin
      );
      window.close();
    }
  }, [searchParams]);

  return null;
}

export default function YandexCallbackPage() {
  return (
    <div className="min-h-screen bg-[#161616] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-6 h-6 border-2 border-white/[0.08] border-t-white/60 rounded-full mx-auto" />
        <p className="mt-4 text-[14px] text-white/40">Completing login...</p>
      </div>
      <Suspense>
        <YandexCallbackInner />
      </Suspense>
    </div>
  );
}
