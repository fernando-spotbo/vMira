"use client";

import { useState, useRef, useEffect, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

export default function AuthorizePage() {
  const { user, isAuthenticated, isLoading } = useContext(AuthContext);
  const [code, setCode] = useState(["", "", "", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "approving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Parse code from URL ?code=XXXX-XXXX
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
      // Auto-focus after the pre-filled chars
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
        headers: { "Content-Type": "application/json" },
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Sign in required</h1>
          <p className="text-white/60">You need to be signed in to authorize Mira Code.</p>
          <a
            href="/chat"
            className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
          >
            Sign in to Mira
          </a>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Device authorized</h1>
          <p className="text-white/60">
            You can close this page and return to Mira Code in your terminal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Authorize Mira Code</h1>
          <p className="text-white/60 text-sm">
            Enter the code shown in your terminal to connect Mira Code.
          </p>
        </div>

        {/* User info */}
        <div className="bg-white/5 rounded-xl p-4 flex items-center gap-3 border border-white/10">
          <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-lg">
            {user?.name?.[0]?.toUpperCase() || "M"}
          </div>
          <div>
            <div className="text-white font-medium text-sm">{user?.name || "Mira User"}</div>
            <div className="text-white/40 text-xs">{user?.email || ""}</div>
          </div>
        </div>

        {/* Code input */}
        <div className="space-y-4">
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
                  className="w-11 h-14 text-center text-xl font-mono font-bold bg-white/5 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all"
                  autoCapitalize="characters"
                />
                {i === 3 && (
                  <span className="text-white/30 text-2xl font-light mx-1.5">-</span>
                )}
              </div>
            ))}
          </div>

          {errorMsg && (
            <p className="text-red-400 text-sm text-center">{errorMsg}</p>
          )}

          <button
            onClick={handleApprove}
            disabled={fullCode.length !== 8 || status === "approving"}
            className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-white/5 disabled:text-white/30 text-white rounded-xl font-medium transition-all disabled:cursor-not-allowed"
          >
            {status === "approving" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                Authorizing...
              </span>
            ) : (
              "Authorize device"
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-white/30 text-xs text-center">
          This will give Mira Code access to your account.
          <br />
          Only authorize if you initiated this from your terminal.
        </p>
      </div>
    </div>
  );
}
