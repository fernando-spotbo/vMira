"use client";

import { useParams, useRouter } from "next/navigation";
import CodePage from "@/components/CodePage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function CodeSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string | undefined;

  return (
    <ProtectedRoute>
      <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#161616]">
        <main className="relative flex flex-1 flex-col min-w-0 min-h-0 h-full overflow-hidden">
          <CodePage
            onBack={() => router.push("/chat")}
            initialSessionId={sessionId}
          />
        </main>
      </div>
    </ProtectedRoute>
  );
}
