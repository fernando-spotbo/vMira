"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft, X } from "lucide-react";
import { useAuth, type TelegramAuthData } from "@/context/AuthContext";
import { apiCall } from "@/lib/api-client";
import { t } from "@/lib/i18n";

const YANDEX_CLIENT_ID = "f1fa95b3175d4f498cccc04dd9d29147";

interface AuthModalProps {
  mode: "login" | "register";
  onClose: () => void;
  redirectTo?: string;
}

// Steps: initial → email entered → password (login or register)
type Step = "initial" | "password" | "register" | "forgot" | "forgot-sent";

export default function AuthModal({ onClose, redirectTo }: AuthModalProps) {
  const router = useRouter();
  const { login, register, loginWithTelegram, loginWithYandex } = useAuth();

  const [step, setStep] = useState<Step>("initial");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Focus management
  useEffect(() => {
    if (step === "initial") setTimeout(() => emailRef.current?.focus(), 100);
    if (step === "password" || step === "register") setTimeout(() => passwordRef.current?.focus(), 100);
  }, [step]);

  const close = () => { setVisible(false); setTimeout(onClose, 250); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) close();
  };

  const success = () => {
    setVisible(false);
    setTimeout(() => { onClose(); router.push(redirectTo || "/chat"); }, 250);
  };

  // ── Step 1: Email entered → check if account exists, show password ──
  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");

    // Try to determine if the email exists — attempt login with empty password
    // to get the error type. Or just go to password step directly.
    // Simpler: just show password field. Backend will differentiate login vs register.
    setStep("password");
  };

  // ── Step 2: Login with password ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    if (result.ok) {
      success();
    } else if (result.error?.includes("not found") || result.error?.includes("не найден")) {
      // Account doesn't exist — switch to register
      setStep("register");
      setError("");
    } else {
      setError(result.error || t("auth.invalidCredentials"));
    }
  };

  // ── Step 2b: Register new account ──
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    setError("");
    setSubmitting(true);
    const result = await register(name || email.split("@")[0], email, password, true);
    setSubmitting(false);
    if (result.ok) {
      success();
    } else {
      setError(result.error || t("auth.registrationFailed"));
    }
  };

  // ── Forgot password ──
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    await apiCall("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setStep("forgot-sent");
  };

  // ── Social: Yandex ──
  const handleYandexLogin = useCallback(() => {
    const origin = window.location.origin;
    const redirectUri = `${origin}/auth/yandex-callback`;
    const w = 550, h = 600;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;

    const popup = window.open(
      `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`,
      "YandexAuth",
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
    );
    if (!popup) { setError(t("auth.popupBlocked")); return; }

    const handler = async (e: MessageEvent) => {
      if (e.origin !== origin || e.data?.type !== "yandex-auth") return;
      window.removeEventListener("message", handler);
      setSubmitting(true); setError("");
      const result = await loginWithYandex(e.data.code);
      setSubmitting(false);
      if (result.ok) success(); else setError(result.error || "Yandex login failed");
    };
    window.addEventListener("message", handler);
    const check = setInterval(() => { if (popup.closed) { clearInterval(check); window.removeEventListener("message", handler); } }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginWithYandex]);

  // ── Social: Telegram ──
  const handleTelegramLogin = useCallback(() => {
    const origin = window.location.origin;
    const w = 550, h = 470;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;

    const popup = window.open(
      `https://oauth.telegram.org/auth?bot_id=8335474240&origin=${encodeURIComponent(origin)}&embed=0&request_access=write&return_to=${encodeURIComponent(origin + "/auth/telegram-callback")}`,
      "TelegramAuth",
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
    );
    if (!popup) { setError(t("auth.popupBlocked")); return; }

    const handler = async (e: MessageEvent) => {
      if (e.origin !== origin || e.data?.type !== "telegram-auth") return;
      window.removeEventListener("message", handler);
      const data: TelegramAuthData = e.data.data;
      if (!data?.id || !data?.hash) { setError("Invalid Telegram response"); return; }
      setSubmitting(true); setError("");
      const result = await loginWithTelegram(data);
      setSubmitting(false);
      if (result.ok) success(); else setError(result.error || "Telegram login failed");
    };
    window.addEventListener("message", handler);
    const check = setInterval(() => { if (popup.closed) { clearInterval(check); window.removeEventListener("message", handler); } }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginWithTelegram]);

  const goBack = () => {
    if (step === "register") setStep("password");
    else if (step === "password" || step === "forgot" || step === "forgot-sent") setStep("initial");
    else close();
    setError("");
  };

  const socialBtnClass = "flex w-full items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-[15px] text-white/90 hover:bg-white/[0.07] hover:border-white/[0.14] transition-all active:scale-[0.98]";

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[200] flex items-center justify-center px-4 transition-all duration-250 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-[400px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-all duration-250 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-3"
        }`}
      >
        {/* Close button */}
        <button onClick={close} className="absolute top-4 right-4 z-10 text-white/30 hover:text-white/60 transition-colors">
          <X size={20} />
        </button>

        <div className="p-8 pt-6">
          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
              {error}
            </div>
          )}

          {/* ════════════════════════════════════════════
               INITIAL: Social buttons + email
             ════════════════════════════════════════════ */}
          {step === "initial" && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-[22px] font-semibold text-white leading-tight">
                  {t("auth.signInOrCreate")}
                </h2>
                <p className="mt-2.5 text-[14px] text-white/50 leading-relaxed">
                  {t("auth.signInBenefits")}
                </p>
              </div>

              <div className="space-y-2.5 mb-5">
                <button onClick={handleYandexLogin} disabled={submitting} className={socialBtnClass}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FC3F1D">
                    <path d="M13.63 21.69V2.31h-2.2c-3.3 0-5.03 1.68-5.03 4.12 0 2.1.84 3.24 2.73 4.68l2.31 1.77L8.96 21.7h-2.4l2.9-8.06-1.6-1.2C6.12 11.1 4.88 9.47 4.88 6.56 4.88 3.03 7.2.76 11.43.76h4.56v20.93z"/>
                  </svg>
                  {t("auth.continueWithYandex")}
                </button>

                <button onClick={handleTelegramLogin} disabled={submitting} className={socialBtnClass}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#2AABEE">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  {t("auth.continueWithTelegram")}
                </button>
              </div>

              <div className="flex items-center gap-4 my-5">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[13px] text-white/30">{t("auth.or")}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              <form onSubmit={handleEmailContinue}>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-3.5 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.18] transition-all"
                  autoComplete="email"
                />
                <button
                  type="submit"
                  disabled={!email.trim() || submitting}
                  className={`w-full mt-3 rounded-2xl py-3.5 text-[15px] font-medium transition-all ${
                    !email.trim()
                      ? "bg-white/[0.06] text-white/30 cursor-not-allowed"
                      : "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"
                  }`}
                >
                  {t("auth.continue")}
                </button>
              </form>

              <p className="mt-5 text-center text-[12px] text-white/25 leading-relaxed">
                {t("auth.termsNotice")}{" "}
                <a href="/legal/terms" target="_blank" className="underline hover:text-white/40">{t("auth.terms")}</a>
                {" & "}
                <a href="/legal/privacy" target="_blank" className="underline hover:text-white/40">{t("auth.privacy")}</a>
              </p>
            </>
          )}

          {/* ════════════════════════════════════════════
               PASSWORD: Login with existing account
             ════════════════════════════════════════════ */}
          {step === "password" && (
            <>
              <button onClick={goBack} className="flex items-center gap-1 text-[14px] text-white/40 hover:text-white/70 transition-colors mb-6">
                <ArrowLeft size={15} /> {t("auth.back")}
              </button>

              <div className="mb-6">
                <h2 className="text-[20px] font-semibold text-white">{t("auth.enterPassword")}</h2>
                <p className="mt-1.5 text-[14px] text-white/40">{email}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholderLogin")}
                    className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-3.5 pr-11 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.18] transition-all"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!password || submitting}
                  className={`w-full rounded-2xl py-3.5 text-[15px] font-medium transition-all ${
                    !password || submitting
                      ? "bg-white/[0.06] text-white/30 cursor-not-allowed"
                      : "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"
                  }`}
                >
                  {submitting ? t("auth.loggingIn") : t("auth.continue")}
                </button>
              </form>

              <div className="flex items-center justify-between mt-4">
                <button onClick={() => { setStep("forgot"); setError(""); }} className="text-[13px] text-white/35 hover:text-white/60 transition-colors">
                  {t("auth.forgotPassword")}
                </button>
                <button onClick={() => { setStep("register"); setError(""); }} className="text-[13px] text-white/35 hover:text-white/60 transition-colors">
                  {t("auth.createAccount")}
                </button>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════
               REGISTER: Create new account
             ════════════════════════════════════════════ */}
          {step === "register" && (
            <>
              <button onClick={goBack} className="flex items-center gap-1 text-[14px] text-white/40 hover:text-white/70 transition-colors mb-6">
                <ArrowLeft size={15} /> {t("auth.back")}
              </button>

              <div className="mb-6">
                <h2 className="text-[20px] font-semibold text-white">{t("auth.createAccount")}</h2>
                <p className="mt-1.5 text-[14px] text-white/40">{email}</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("auth.namePlaceholder")}
                  className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-3.5 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.18] transition-all"
                  autoComplete="name"
                />

                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholderRegister")}
                    className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-3.5 pr-11 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.18] transition-all"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!password || password.length < 8 || submitting}
                  className={`w-full rounded-2xl py-3.5 text-[15px] font-medium transition-all ${
                    !password || password.length < 8 || submitting
                      ? "bg-white/[0.06] text-white/30 cursor-not-allowed"
                      : "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"
                  }`}
                >
                  {submitting ? t("auth.creatingAccount") : t("auth.createAccount")}
                </button>
              </form>

              <p className="mt-4 text-center text-[12px] text-white/25 leading-relaxed">
                {t("auth.termsNotice")}{" "}
                <a href="/legal/terms" target="_blank" className="underline hover:text-white/40">{t("auth.terms")}</a>
                {" & "}
                <a href="/legal/privacy" target="_blank" className="underline hover:text-white/40">{t("auth.privacy")}</a>
              </p>
            </>
          )}

          {/* ════════════════════════════════════════════
               FORGOT PASSWORD
             ════════════════════════════════════════════ */}
          {step === "forgot" && (
            <>
              <button onClick={goBack} className="flex items-center gap-1 text-[14px] text-white/40 hover:text-white/70 transition-colors mb-6">
                <ArrowLeft size={15} /> {t("auth.back")}
              </button>

              <div className="mb-6">
                <h2 className="text-[20px] font-semibold text-white">{t("auth.resetPassword")}</h2>
                <p className="mt-1.5 text-[14px] text-white/40">{t("auth.resetSubtitle")}</p>
              </div>

              <form onSubmit={handleForgot} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.08] px-4 py-3.5 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.18] transition-all"
                  autoFocus
                />
                <button type="submit" className="w-full rounded-2xl bg-white py-3.5 text-[15px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all">
                  {t("auth.sendResetLink")}
                </button>
              </form>
            </>
          )}

          {/* ════════════════════════════════════════════
               FORGOT SENT
             ════════════════════════════════════════════ */}
          {step === "forgot-sent" && (
            <div className="text-center py-4">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-white/[0.06] mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="text-[18px] font-medium text-white">{t("auth.checkEmail")}</h2>
              <p className="mt-2 text-[14px] text-white/50">{t("auth.resetSent")} {email}</p>
              <button onClick={() => setStep("initial")} className="mt-6 w-full rounded-2xl bg-white py-3.5 text-[15px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all">
                {t("auth.backToLogin")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
