"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";

function MiraLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-white">
      <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
      <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
    </svg>
  );
}

export default function AuthorizePage() {
  const { user, loading: isLoading } = useAuth();
  const isAuthenticated = !!user;
  const [code, setCode] = useState(["", "", "", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "approving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [mounted, setMounted] = useState(false);
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/authorize";

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) {
      const clean = urlCode.replace("-", "").toUpperCase();
      const chars = clean.split("").slice(0, 8);
      const newCode = [...code];
      chars.forEach((c, i) => {
        if (i < 8) newCode[i] = c;
      });
      setCode(newCode);
      const nextEmpty = chars.length < 8 ? chars.length : 7;
      setTimeout(() => inputRefs.current[nextEmpty]?.focus(), 50);
    }
  }, []);

  const handleInput = (index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = char;
    setCode(newCode);

    if (char && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleApprove();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[-\s]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const chars = pasted.split("").slice(0, 8);
    const newCode = Array(8).fill("");
    chars.forEach((c, i) => (newCode[i] = c));
    setCode(newCode);
    const nextIdx = Math.min(chars.length, 7);
    inputRefs.current[nextIdx]?.focus();
  };

  const fullCode = code.join("");
  const formattedCode = fullCode.length === 8 ? `${fullCode.slice(0, 4)}-${fullCode.slice(4)}` : fullCode;

  const handleApprove = async () => {
    if (fullCode.length !== 8) return;

    setStatus("approving");
    setErrorMsg("");

    try {
      const res = await fetch("/api/proxy/auth/device/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({ user_code: formattedCode }),
      });

      const data = await res.json();

      if (data.approved) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Failed to authorize");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#161616] flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-white/[0.08] border-t-white/60 rounded-full" />
      </div>
    );
  }

  // Not authenticated — prompt sign in
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#161616] flex items-center justify-center p-4">
        <div
          className={`max-w-[400px] w-full transition-all duration-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <MiraLogo size={28} />
              </div>
              <h1 className="mt-5 text-[22px] font-medium text-white">Sign in required</h1>
              <p className="mt-2 text-[15px] text-white/50 leading-relaxed">
                You need to be signed in to authorize Mira Code for your terminal.
              </p>
              <button
                onClick={() => setAuthModal("login")}
                className="mt-8 w-full rounded-xl bg-white py-3.5 text-[16px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all duration-200"
              >
                Sign in to Mira
              </button>
              <button
                onClick={() => setAuthModal("register")}
                className="mt-3 w-full rounded-xl bg-white/[0.06] border border-white/[0.08] py-3.5 text-[16px] font-medium text-white hover:bg-white/[0.1] hover:border-white/[0.12] active:scale-[0.98] transition-all duration-200"
              >
                Create account
              </button>
            </div>
          </div>
          <p className="mt-4 text-center text-[13px] text-white/25">
            Only authorize if you initiated this from your terminal.
          </p>
        </div>
        {authModal && (
          <AuthModal
            mode={authModal}
            onClose={() => setAuthModal(null)}
            redirectTo={currentPath}
          />
        )}
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#161616] flex items-center justify-center p-4">
        <div className="max-w-[400px] w-full animate-fade-in-up">
          <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="mt-5 text-[22px] font-medium text-white">Device authorized</h1>
              <p className="mt-2 text-[15px] text-white/50 leading-relaxed">
                You can close this page and return to<br />Mira Code in your terminal.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main authorize form
  return (
    <div className="min-h-screen bg-[#161616] flex items-center justify-center p-4">
      <div
        className={`max-w-[400px] w-full transition-all duration-500 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <MiraLogo size={28} />
            </div>
            <h1 className="mt-5 text-[22px] font-medium text-white">Authorize Mira Code</h1>
            <p className="mt-2 text-[15px] text-white/50">
              Enter the code shown in your terminal.
            </p>
          </div>

          {/* User info */}
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[14px] font-medium text-white/70">
              {user?.name?.[0]?.toUpperCase() || "M"}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-white truncate">{user?.name || "Mira User"}</div>
              {user?.email && (
                <div className="text-[13px] text-white/35 truncate">{user.email}</div>
              )}
            </div>
          </div>

          {/* Code input */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-center gap-1.5" onPaste={handlePaste}>
              {code.map((char, i) => (
                <div key={i} className="flex items-center">
                  <input
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    maxLength={1}
                    value={char}
                    onChange={(e) => handleInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-10 h-12 text-center text-lg font-mono font-semibold bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:border-white/[0.2] focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)] outline-none transition-all duration-200"
                    autoCapitalize="characters"
                  />
                  {i === 3 && (
                    <span className="text-white/20 text-xl font-light mx-1">-</span>
                  )}
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-[14px] text-red-400 text-center">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleApprove}
              disabled={fullCode.length !== 8 || status === "approving"}
              className={`w-full rounded-xl py-3.5 text-[16px] font-medium transition-all duration-200 ${
                fullCode.length !== 8 || status === "approving"
                  ? "bg-white/[0.06] text-white/30 cursor-not-allowed"
                  : "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"
              }`}
            >
              {status === "approving" ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authorizing...
                </span>
              ) : (
                "Authorize device"
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-[13px] text-white/25">
          This will give Mira Code access to your account.
          <br />
          Only authorize if you initiated this from your terminal.
        </p>
      </div>
    </div>
  );
}
