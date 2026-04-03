"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useAuth, type TelegramAuthData } from "@/context/AuthContext";
import { apiCall } from "@/lib/api-client";
import { t } from "@/lib/i18n";

type AuthMode = "login" | "register" | "forgot" | "phone";

interface AuthModalProps {
  mode: "login" | "register";
  onClose: () => void;
  redirectTo?: string;
}

function MiraLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white/80">
      <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
      <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
    </svg>
  );
}


function InputField({
  label, type = "text", placeholder, value, onChange, autoFocus,
}: {
  label: string; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void; autoFocus?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-[16px] text-white mb-2">{label}</label>
      <div className="relative">
        <input
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-xl bg-white/[0.06] border border-white/[0.08] px-4 py-3.5 text-[16px] text-white placeholder-white/35 focus:outline-none focus:border-white/[0.2] focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)] transition-all duration-200"
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AuthModal({ mode: initialMode, onClose, redirectTo }: AuthModalProps) {
  const router = useRouter();
  const { login, register, loginWithPhone, loginWithTelegram } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+7");
  const [smsCode, setSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") { setVisible(false); setTimeout(onClose, 250); } },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setVisible(false);
      setTimeout(onClose, 250);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.ok) {
      setVisible(false);
      setTimeout(() => { onClose(); router.push(redirectTo || "/chat"); }, 250);
    } else {
      setError(result.error || "Invalid credentials");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setSubmitting(true);
    const result = await register(name, email, password, consent);
    setSubmitting(false);
    if (result.ok) {
      setVisible(false);
      setTimeout(() => { onClose(); router.push(redirectTo || "/chat"); }, 250);
    } else {
      setError(result.error || "Registration failed");
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    await apiCall("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setForgotSent(true);
  };

  const handleSendSms = async () => {
    if (phone.length < 12) return;
    setError("");
    const result = await apiCall("/auth/phone/send-code", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    if (result.ok) {
      setSmsSent(true);
    } else {
      setError((result.data as any)?.detail || "Failed to send code");
    }
  };

  const handleVerifySms = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await loginWithPhone(phone, smsCode);
    setSubmitting(false);
    if (result.ok) {
      setVisible(false);
      setTimeout(() => { onClose(); router.push(redirectTo || "/chat"); }, 250);
    } else {
      setError(result.error || "Invalid code");
    }
  };

  const handleTelegramLogin = useCallback(() => {
    // Open Telegram Login Widget in a popup
    const botId = "vMiraBot";
    const origin = window.location.origin;
    const w = 550, h = 470;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;

    // Listen for the auth result from the popup
    const handler = async (e: MessageEvent) => {
      if (e.origin !== "https://oauth.telegram.org") return;
      window.removeEventListener("message", handler);

      try {
        // Telegram sends the auth data as a JSON string or structured object
        const data: TelegramAuthData = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!data?.id || !data?.hash) return;

        setSubmitting(true);
        setError("");
        const result = await loginWithTelegram(data);
        setSubmitting(false);

        if (result.ok) {
          setVisible(false);
          setTimeout(() => { onClose(); router.push(redirectTo || "/chat"); }, 250);
        } else {
          setError(result.error || "Telegram login failed");
        }
      } catch {
        setSubmitting(false);
        setError("Telegram login failed");
      }
    };
    window.addEventListener("message", handler);

    // Open the Telegram OAuth widget
    window.open(
      `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(origin)}&embed=0&request_access=write&return_to=${encodeURIComponent(origin)}`,
      "TelegramAuth",
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }, [loginWithTelegram, onClose, redirectTo, router]);

  const switchMode = (newMode: AuthMode) => {
    setContentKey((k) => k + 1);
    setMode(newMode);
    setName(""); setEmail(""); setPassword(""); setPhone("+7"); setSmsCode("");
    setForgotSent(false); setSmsSent(false); setConsent(false); setError("");
  };

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[200] flex items-center justify-center px-4 transition-all duration-250 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0 backdrop-blur-0"
      }`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-all duration-250 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-3"
        }`}
      >
        <div key={contentKey} className="p-8 animate-fade-in-up">
          {/* Error banner */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-[14px] text-red-400">
              {error}
            </div>
          )}

          {/* ---- Forgot password ---- */}
          {mode === "forgot" ? (
            <>
              <button onClick={() => switchMode("login")} className="flex items-center gap-1.5 text-[16px] text-white/60 hover:text-white transition-colors mb-6">
                <ArrowLeft size={16} /> {t("auth.back")}
              </button>
              <div className="flex flex-col items-center mb-8">
                <MiraLogo />
                <h2 className="mt-4 text-[22px] font-medium text-white">{t("auth.resetPassword")}</h2>
                <p className="mt-1.5 text-[16px] text-white/70 text-center">{t("auth.resetSubtitle")}</p>
              </div>
              {forgotSent ? (
                <div className="text-center py-4">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-white/[0.06] mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <p className="text-[16px] text-white">{t("auth.checkEmail")}</p>
                  <p className="text-[16px] text-white/70 mt-1">{t("auth.resetSent")} {email}</p>
                  <button onClick={() => switchMode("login")} className="mt-6 w-full rounded-xl bg-white py-3 text-[16px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all">
                    {t("auth.backToLogin")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <InputField label={t("auth.email")} type="email" placeholder={t("auth.emailPlaceholder")} value={email} onChange={setEmail} autoFocus />
                  <button type="submit" className="w-full rounded-xl bg-white py-3 text-[16px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all">
                    {t("auth.sendResetLink")}
                  </button>
                </form>
              )}
            </>

          /* ---- Phone auth ---- */
          ) : mode === "phone" ? (
            <>
              <button onClick={() => switchMode("login")} className="flex items-center gap-1.5 text-[16px] text-white/60 hover:text-white transition-colors mb-6">
                <ArrowLeft size={16} /> {t("auth.back")}
              </button>
              <div className="flex flex-col items-center mb-8">
                <MiraLogo />
                <h2 className="mt-4 text-[22px] font-medium text-white">{t("auth.phoneLogin")}</h2>
                <p className="mt-1.5 text-[16px] text-white/70 text-center">{t("auth.phoneSubtitle")}</p>
              </div>
              <form onSubmit={handleVerifySms} className="space-y-4">
                <InputField label={t("auth.phoneNumber")} type="tel" placeholder="+7 900 123 4567" value={phone} onChange={setPhone} autoFocus />
                {!smsSent ? (
                  <button type="button" onClick={handleSendSms}
                    className="w-full rounded-xl bg-white py-3 text-[16px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all">
                    {t("auth.sendCode")}
                  </button>
                ) : (
                  <>
                    <InputField label={t("auth.verificationCode")} placeholder="123456" value={smsCode} onChange={setSmsCode} autoFocus />
                    <button type="submit" disabled={submitting}
                      className={`w-full rounded-xl py-3.5 text-[16px] font-medium transition-all ${submitting ? "bg-white/70 text-[#161616] cursor-wait" : "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"}`}>
                      {submitting ? t("auth.verifying") : t("auth.verifyAndLogin")}
                    </button>
                  </>
                )}
              </form>
            </>

          /* ---- Login / Register ---- */
          ) : (
            <>
              <div className="flex flex-col items-center mb-8">
                <MiraLogo />
                <h2 className="mt-4 text-[22px] font-medium text-white">
                  {mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
                </h2>
                <p className="mt-1.5 text-[16px] text-white/70">
                  {mode === "login" ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}
                </p>
              </div>

              <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
                {mode === "register" && (
                  <InputField label={t("auth.name")} placeholder={t("auth.namePlaceholder")} value={name} onChange={setName} autoFocus />
                )}
                <InputField label={t("auth.email")} type="email" placeholder={t("auth.emailPlaceholder")} value={email} onChange={setEmail} autoFocus={mode === "login"} />
                <InputField label={t("auth.password")} type="password" placeholder={mode === "login" ? t("auth.passwordPlaceholderLogin") : t("auth.passwordPlaceholderRegister")} value={password} onChange={setPassword} />

                {mode === "register" && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-white/[0.06] accent-white" />
                    <span className="text-[14px] text-white/60 leading-relaxed">
                      {t("auth.consent")}{" "}
                      <a href="/legal/privacy" target="_blank" className="text-white/80 underline underline-offset-2 hover:text-white">{t("auth.privacyPolicy")}</a>
                    </span>
                  </label>
                )}

                {mode === "login" && (
                  <div className="text-right">
                    <button type="button" onClick={() => switchMode("forgot")} className="text-[16px] text-white/60 hover:text-white transition-colors">
                      {t("auth.forgotPassword")}
                    </button>
                  </div>
                )}

                <button type="submit" disabled={submitting || (mode === "register" && !consent)}
                  className={`w-full rounded-xl py-3.5 text-[16px] font-medium transition-all ${
                    submitting ? "bg-white/70 text-[#161616] cursor-wait"
                    : (mode === "register" && !consent) ? "bg-white/30 text-[#161616]/50 cursor-not-allowed"
                    : "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"
                  }`}>
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {mode === "login" ? t("auth.loggingIn") : t("auth.creatingAccount")}
                    </span>
                  ) : (
                    mode === "login" ? t("auth.login") : t("auth.register")
                  )}
                </button>
              </form>

              <div className="flex items-center gap-4 my-5">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[14px] text-white/40">{t("auth.or")}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              <button
                onClick={handleTelegramLogin}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-[#2AABEE]/10 px-4 py-3 text-[16px] text-white hover:bg-[#2AABEE]/20 hover:border-[#2AABEE]/30 transition-all active:scale-[0.98]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#2AABEE">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                <span>{t("auth.continueWithTelegram")}</span>
              </button>

              <p className="mt-6 text-center text-[16px] text-white/50">
                {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
                <button onClick={() => switchMode(mode === "login" ? "register" : "login")} className="text-white/70 hover:text-white transition-colors">
                  {mode === "login" ? t("auth.signUp") : t("auth.login")}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
