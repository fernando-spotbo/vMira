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

type Step = "initial" | "password" | "register" | "forgot" | "forgot-sent";

export default function AuthModal({ onClose, redirectTo }: AuthModalProps) {
  const router = useRouter();
  const { login, register, loginWithTelegram, loginWithYandex } = useAuth();

  const [step, setStep] = useState<Step>("initial");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

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

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setStep("password");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.ok) {
      success();
    } else if (result.error?.includes("not found") || result.error?.includes("не найден")) {
      setStep("register");
      setError("");
    } else {
      setError(result.error || t("auth.invalidCredentials"));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError(t("auth.passwordTooShort")); return; }
    setError("");
    setSubmitting(true);
    const result = await register(name || email.split("@")[0], email, password, true);
    setSubmitting(false);
    if (result.ok) success(); else setError(result.error || t("auth.registrationFailed"));
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    await apiCall("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    setStep("forgot-sent");
  };

  const handleYandexLogin = useCallback(() => {
    const origin = window.location.origin;
    const redirectUri = `${origin}/auth/yandex-callback`;
    const w = 550, h = 600, left = (screen.width - w) / 2, top = (screen.height - h) / 2;
    const popup = window.open(
      `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`,
      "YandexAuth", `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
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

  const handleTelegramLogin = useCallback(() => {
    const origin = window.location.origin;
    const w = 550, h = 470, left = (screen.width - w) / 2, top = (screen.height - h) / 2;
    const popup = window.open(
      `https://oauth.telegram.org/auth?bot_id=8335474240&origin=${encodeURIComponent(origin)}&embed=0&request_access=write&return_to=${encodeURIComponent(origin + "/auth/telegram-callback")}`,
      "TelegramAuth", `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
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

  // ── Shared styles matching reference ──
  const pillInput = "w-full rounded-full bg-[#2a2a2a] border border-white/[0.08] px-5 py-3.5 text-[16px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.16] transition-all";
  const pillBtnWhite = "w-full rounded-full py-3.5 text-[16px] font-medium transition-all active:scale-[0.98]";
  const pillBtnDisabled = "bg-white/[0.06] text-white/25 cursor-not-allowed";
  const pillBtnActive = "bg-white text-[#161616] hover:bg-white/90";

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[200] flex items-center justify-center px-4 transition-all duration-250 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
    >
      <div
        ref={modalRef}
        className={`relative w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-all duration-250 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-3"
        }`}
      >
        {/* Close button */}
        <button onClick={close} className="absolute top-5 right-5 z-10 text-white/25 hover:text-white/50 transition-colors">
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="px-8 pb-8 pt-10">
          {/* Error */}
          {error && (
            <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/15 px-4 py-3 text-[14px] text-red-400">
              {error}
            </div>
          )}

          {/* ═══════ INITIAL ═══════ */}
          {step === "initial" && (
            <>
              {/* Title + subtitle — generous spacing like reference */}
              <div className="text-center mb-10">
                <h2 className="text-[24px] font-bold text-white leading-snug">
                  {t("auth.signInOrCreate")}
                </h2>
                <p className="mt-3 text-[15px] text-white/45 leading-relaxed max-w-[300px] mx-auto">
                  {t("auth.signInBenefits")}
                </p>
              </div>

              {/* Social buttons — pill-shaped, generous spacing */}
              <div className="space-y-3 mb-6">
                <button
                  onClick={handleYandexLogin}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-3 rounded-full border border-white/[0.08] bg-transparent px-5 py-3.5 text-[16px] text-white/90 hover:bg-white/[0.05] hover:border-white/[0.14] transition-all active:scale-[0.98]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FC3F1D" className="shrink-0">
                    <path d="M13.63 21.69V2.31h-2.2c-3.3 0-5.03 1.68-5.03 4.12 0 2.1.84 3.24 2.73 4.68l2.31 1.77L8.96 21.7h-2.4l2.9-8.06-1.6-1.2C6.12 11.1 4.88 9.47 4.88 6.56 4.88 3.03 7.2.76 11.43.76h4.56v20.93z"/>
                  </svg>
                  {t("auth.continueWithYandex")}
                </button>

                <button
                  onClick={handleTelegramLogin}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-3 rounded-full border border-white/[0.08] bg-transparent px-5 py-3.5 text-[16px] text-white/90 hover:bg-white/[0.05] hover:border-white/[0.14] transition-all active:scale-[0.98]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#2AABEE" className="shrink-0">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  {t("auth.continueWithTelegram")}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[14px] text-white/25">{t("auth.or")}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Email + Continue */}
              <form onSubmit={handleEmailContinue} className="space-y-3">
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  className={pillInput}
                  autoComplete="email"
                />
                <button
                  type="submit"
                  disabled={!email.trim() || submitting}
                  className={`${pillBtnWhite} ${!email.trim() ? pillBtnDisabled : pillBtnActive}`}
                >
                  {t("auth.continue")}
                </button>
              </form>

              <p className="mt-6 text-center text-[12px] text-white/20 leading-relaxed">
                {t("auth.termsNotice")}{" "}
                <a href="/legal/terms" target="_blank" className="underline hover:text-white/35">{t("auth.terms")}</a>
                {" & "}
                <a href="/legal/privacy" target="_blank" className="underline hover:text-white/35">{t("auth.privacy")}</a>
              </p>
            </>
          )}

          {/* ═══════ PASSWORD ═══════ */}
          {step === "password" && (
            <>
              <button onClick={goBack} className="flex items-center gap-1.5 text-[14px] text-white/35 hover:text-white/60 transition-colors mb-8">
                <ArrowLeft size={16} /> {t("auth.back")}
              </button>

              <div className="text-center mb-8">
                <h2 className="text-[22px] font-bold text-white">{t("auth.enterPassword")}</h2>
                <p className="mt-2 text-[14px] text-white/35">{email}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholderLogin")}
                    className={`${pillInput} pr-12`}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!password || submitting}
                  className={`${pillBtnWhite} ${!password || submitting ? pillBtnDisabled : pillBtnActive}`}
                >
                  {submitting ? t("auth.loggingIn") : t("auth.continue")}
                </button>
              </form>

              <div className="flex items-center justify-between mt-5">
                <button onClick={() => { setStep("forgot"); setError(""); }} className="text-[13px] text-white/30 hover:text-white/50 transition-colors">
                  {t("auth.forgotPassword")}
                </button>
                <button onClick={() => { setStep("register"); setError(""); }} className="text-[13px] text-white/30 hover:text-white/50 transition-colors">
                  {t("auth.createAccount")}
                </button>
              </div>
            </>
          )}

          {/* ═══════ REGISTER ═══════ */}
          {step === "register" && (
            <>
              <button onClick={goBack} className="flex items-center gap-1.5 text-[14px] text-white/35 hover:text-white/60 transition-colors mb-8">
                <ArrowLeft size={16} /> {t("auth.back")}
              </button>

              <div className="text-center mb-8">
                <h2 className="text-[22px] font-bold text-white">{t("auth.createAccount")}</h2>
                <p className="mt-2 text-[14px] text-white/35">{email}</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("auth.namePlaceholder")}
                  className={pillInput}
                  autoComplete="name"
                />
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholderRegister")}
                    className={`${pillInput} pr-12`}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!password || password.length < 8 || submitting}
                  className={`${pillBtnWhite} ${!password || password.length < 8 || submitting ? pillBtnDisabled : pillBtnActive}`}
                >
                  {submitting ? t("auth.creatingAccount") : t("auth.createAccount")}
                </button>
              </form>

              <p className="mt-5 text-center text-[12px] text-white/20 leading-relaxed">
                {t("auth.termsNotice")}{" "}
                <a href="/legal/terms" target="_blank" className="underline hover:text-white/35">{t("auth.terms")}</a>
                {" & "}
                <a href="/legal/privacy" target="_blank" className="underline hover:text-white/35">{t("auth.privacy")}</a>
              </p>
            </>
          )}

          {/* ═══════ FORGOT ═══════ */}
          {step === "forgot" && (
            <>
              <button onClick={goBack} className="flex items-center gap-1.5 text-[14px] text-white/35 hover:text-white/60 transition-colors mb-8">
                <ArrowLeft size={16} /> {t("auth.back")}
              </button>

              <div className="text-center mb-8">
                <h2 className="text-[22px] font-bold text-white">{t("auth.resetPassword")}</h2>
                <p className="mt-2 text-[14px] text-white/35">{t("auth.resetSubtitle")}</p>
              </div>

              <form onSubmit={handleForgot} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  className={pillInput}
                  autoFocus
                />
                <button type="submit" className={`${pillBtnWhite} ${pillBtnActive}`}>
                  {t("auth.sendResetLink")}
                </button>
              </form>
            </>
          )}

          {/* ═══════ FORGOT SENT ═══════ */}
          {step === "forgot-sent" && (
            <div className="text-center py-6">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-white/[0.05] mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="text-[20px] font-bold text-white">{t("auth.checkEmail")}</h2>
              <p className="mt-2 text-[14px] text-white/40">{t("auth.resetSent")} {email}</p>
              <button onClick={() => setStep("initial")} className={`mt-8 ${pillBtnWhite} ${pillBtnActive}`}>
                {t("auth.backToLogin")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
