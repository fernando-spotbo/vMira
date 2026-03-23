"use client";

import { useRouter } from "next/navigation";
import { Plus, Image, FileUp, ArrowUp, Mic } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import AuthModal from "./AuthModal";
import { MiraLogo, MiraHeading } from "./MiraHeading";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [input, setInput] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Redirect to chat if already logged in — immediate, no flash
  useEffect(() => {
    if (!loading && user) {
      router.replace("/chat");
    }
  }, [loading, user, router]);

  // Don't render landing while checking auth or if user is logged in (prevents flash)
  if (loading || user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#161616]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/20 animate-pulse">
          <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor" />
          <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor" />
        </svg>
      </div>
    );
  }

  const navigateToChat = () => {
    setLeaving(true);
    setTimeout(() => router.push("/chat"), 300);
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLeaving(true);
    setTimeout(() => router.push(`/chat?q=${encodeURIComponent(trimmed)}`), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val.replace(/^\s+/, ""));
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.45) + "px";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = input;
    const newVal = current.slice(0, start) + pasted + current.slice(end);
    setInput(newVal.replace(/^\s+/, ""));
    requestAnimationFrame(() => {
      const pos = start + pasted.length;
      el.selectionStart = el.selectionEnd = pos;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.45) + "px";
    });
  };

  return (
    <div className={`flex h-screen w-screen flex-col overflow-hidden bg-[#161616] transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}>
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between px-5 md:px-6">
        <div className="flex items-center gap-2.5">
          <MiraLogo size={18} className="text-white" />
          <span className="text-base font-semibold text-white">Mira</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAuthModal("login")}
            className="rounded-lg px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            {t("landing.login")}
          </button>
          <button
            onClick={() => setAuthModal("register")}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#161616] hover:bg-white/90 transition-colors"
          >
            {t("landing.getStarted")}
          </button>
        </div>
      </header>

      {/* Center — pb offsets header for true optical centering */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-14">
        <div className="mira-fade-in">
          <MiraHeading />
        </div>

        {/* Input */}
        <div className="mira-fade-in w-full max-w-[660px]" style={{ animationDelay: "80ms" }}>
          <div className="mira-input-container rounded-2xl px-5 pt-5 pb-3.5 transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t("landing.placeholder")}
              rows={1}
              className="w-full max-h-[45vh] resize-none overflow-y-auto bg-transparent text-[17px] leading-relaxed text-white placeholder-white/25 focus:outline-none"
            />

            {/* Action row */}
            <div className="mt-4 flex items-center justify-between">
              <div className="relative" ref={attachMenuRef}>
                <button
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition-all duration-200
                    ${showAttachMenu
                      ? "bg-black/40 text-white/70"
                      : "text-white/30 hover:text-white/60 hover:bg-black/30"
                    }`}
                  title="Attach"
                >
                  <Plus size={22} strokeWidth={1.8} />
                </button>

                {/* Dropdown */}
                <div
                  className={`absolute bottom-full left-0 mb-2 w-52 rounded-xl border border-white/[0.08] bg-[#1e1e1e] py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)] transition-all duration-200 origin-bottom-left
                    ${showAttachMenu
                      ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
                      : "opacity-0 scale-95 pointer-events-none translate-y-1"
                    }`}
                >
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                    onClick={() => setShowAttachMenu(false)}
                  >
                    <Image size={16} />
                    {t("chat.uploadImage")}
                  </button>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                    onClick={() => setShowAttachMenu(false)}
                  >
                    <FileUp size={16} />
                    {t("chat.uploadFile")}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {input.trim() ? (
                  <button
                    onClick={handleSubmit}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#161616] hover:bg-white/90 active:scale-95 transition-all duration-200"
                    title="Send message"
                  >
                    <ArrowUp size={20} strokeWidth={2.5} />
                  </button>
                ) : (
                  <>
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/40 hover:text-white/70 hover:bg-black/30 transition-all duration-200"
                      title="Voice input"
                    >
                      <Mic size={20} strokeWidth={1.8} />
                    </button>
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white/40 hover:text-white/70 hover:bg-black/30 transition-all duration-200"
                      title="Voice mode"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="7" width="2.5" height="10" rx="1.25" fill="currentColor" opacity="0.7" />
                        <rect x="7" y="4" width="2.5" height="16" rx="1.25" fill="currentColor" opacity="0.85" />
                        <rect x="12" y="6" width="2.5" height="12" rx="1.25" fill="currentColor" />
                        <rect x="17" y="5" width="2.5" height="14" rx="1.25" fill="currentColor" opacity="0.75" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="shrink-0 py-3 text-center text-[13px] text-white/20">
        {t("landing.disclaimer")}
      </p>

      {/* Auth modal */}
      {authModal && (
        <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />
      )}
    </div>
  );
}
