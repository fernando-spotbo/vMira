"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "./AuthModal";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      setShowAuth(true);
    }
  }, [loading, user]);

  // Loading state — show nothing (prevents flash)
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#161616]">
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/40 animate-pulse">
            <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor" />
            <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor" />
          </svg>
        </div>
      </div>
    );
  }

  // Not authenticated — show auth modal over a dark background
  if (!user) {
    return (
      <div className="h-screen w-screen bg-[#161616]">
        {showAuth && (
          <AuthModal
            mode="login"
            onClose={() => {
              // Can't close — must log in. Redirect to landing instead.
              window.location.href = "/";
            }}
          />
        )}
      </div>
    );
  }

  // Authenticated — render children
  return <>{children}</>;
}
