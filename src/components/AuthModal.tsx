"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiCall } from "@/lib/api-client";
import { t } from "@/lib/i18n";

type AuthMode = "login" | "register" | "forgot" | "phone";

interface AuthModalProps {
  mode: "login" | "register";
  onClose: () => void;
}

function MiraLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white/80">
      <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
      <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
    </svg>
  );
}

function VkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.547 7H16.86a.47.47 0 0 0-.395.213c-.668 1.003-1.404 1.936-2.2 2.79-.16.17-.36.276-.483.178-.17-.138-.191-.44-.191-.44V7.5A.5.5 0 0 0 13.09 7H10.91a.75.75 0 0 0-.607.328c-.197.277-.053.462.1.557.434.27.525.776.525.776v3.062s.038.662-.376.78c-.283.082-.672-.091-1.549-1.436A17.6 17.6 0 0 1 7.197 7.54.38.38 0 0 0 6.84 7H4.558a.39.39 0 0 0-.37.536s1.72 4.04 3.665 6.07c1.782 1.862 3.81 1.738 3.81 1.738h.907a.45.45 0 0 0 .432-.478v-.994s-.043-.6.262-.688c.293-.084.67.555 1.07 1.003.3.338.72.703.72.703l1.76.02s1.19.075.627-.97c-.032-.06-.24-.6-1.23-1.695-.413-.457-.358-.383.14-1.175.753-1.197 1.332-1.93 1.513-2.542.19-.647-.198-.546-.198-.546z" />
    </svg>
  );
}

function YandexIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.63 21.69V2.31h-2.2c-3.3 0-5.03 1.68-5.03 4.12 0 2.1.84 3.24 2.73 4.68l2.31 1.77L8.96 21.7h-2.4l2.9-8.06-1.6-1.2C6.12 11.1 4.88 9.47 4.88 6.56 4.88 3.03 7.2.76 11.43.76h4.56v20.93z"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
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

export default function AuthModal({ mode: initialMode, onClose }: AuthModalProps) {
  const router = useRouter();
  const { login, register, loginWithPhone } = useAuth();
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
      setTimeout(() => { onClose(); router.push("/chat"); }, 250);
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
      setTimeout(() => { onClose(); router.push("/chat"); }, 250);
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
      setTimeout(() => { onClose(); router.push("/chat"); }, 250);
    } else {
      setError(result.error || "Invalid code");
    }
  };

  const handleSocialLogin = (provider: string) => {
    // TODO: Implement OAuth redirect flow for VK/Yandex/Google
    // For now, show a message
    setError(`${provider} login coming soon`);
  };

  const switchMode = (newMode: AuthMode) => {
    setContentKey((k) => k + 1);
    setMode(newMode);
    setName(""); setEmail(""); setPassword(""); setPhone("+7"); setSmsCode("");
    setForgotSent(false); setSmsSent(false); setConsent(false); setError("");
  };

  const socialBtnClass = "flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[16px] text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all";

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

              {/* Social logins */}
              <div className="space-y-2.5">
                <button onClick={() => handleSocialLogin("VK")} className={socialBtnClass}>
                  <VkIcon /><span>{t("auth.continueVk")}</span>
                </button>
                <button onClick={() => handleSocialLogin("Yandex")} className={socialBtnClass}>
                  <YandexIcon /><span>{t("auth.continueYandex")}</span>
                </button>
                <div className="flex gap-2.5">
                  <button onClick={() => switchMode("phone")} className={`${socialBtnClass} flex-1`}>
                    <Phone size={18} /><span>{t("auth.phone")}</span>
                  </button>
                  <button onClick={() => handleSocialLogin("Google")} className={`${socialBtnClass} flex-1`}>
                    <GoogleIcon /><span>{t("auth.google")}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[14px] text-white/40">{t("auth.or")}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
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
