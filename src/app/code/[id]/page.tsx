"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * /code/:id redirects to /chat?code=:id
 * The chat layout reads the query param and opens the Code section
 * with that session selected.
 */
export default function CodeRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string | undefined;

  useEffect(() => {
    if (sessionId) {
      router.replace(`/chat?code=${sessionId}`);
    } else {
      router.replace("/chat");
    }
  }, [sessionId, router]);

  return null;
}
