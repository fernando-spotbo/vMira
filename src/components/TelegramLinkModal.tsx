"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Check, Loader2 } from "lucide-react";
import { generateTelegramLinkToken, getTelegramStatus, unlinkTelegram } from "@/lib/api-client";

interface TelegramLinkModalProps {
  onClose: () => void;
  onLinked?: () => void;
}

function TelegramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

export default function TelegramLinkModal({ onClose, onLinked }: TelegramLinkModalProps) {
  const [step, setStep] = useState<"loading" | "link" | "linked" | "error">("loading");
  const [deepLink, setDeepLink] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    if (pollRef.current) clearInterval(pollRef.current);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Check if already linked, otherwise generate token
  useEffect(() => {
    (async () => {
      const status = await getTelegramStatus();
      if (status.ok && status.data.linked) {
        setUsername(status.data.username);
        setStep("linked");
        return;
      }

      const result = await generateTelegramLinkToken();
      if (result.ok) {
        setDeepLink(result.data.deep_link);
        setStep("link");

        // Poll for link status every 3s
        pollRef.current = setInterval(async () => {
          const s = await getTelegramStatus();
          if (s.ok && s.data.linked) {
            setUsername(s.data.username);
            setStep("linked");
            if (pollRef.current) clearInterval(pollRef.current);
            onLinked?.();
          }
        }, 3000);
      } else {
        setStep("error");
      }
    })();

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [onLinked]);

  const handleUnlink = async () => {
    const result = await unlinkTelegram();
    if (result.ok) {
      setStep("loading");
      const token = await generateTelegramLinkToken();
      if (token.ok) {
        setDeepLink(token.data.deep_link);
        setStep("link");
      }
    }
  };

  return createPortal(
    <div
      onMouseDown={(e) => { if (modalRef.current && !modalRef.current.contains(e.target as Node)) close(); }}
      className={`fixed inset-0 z-[300] flex items-center justify-center px-4 transition-all duration-200 ${visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"}`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-[380px] rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-200 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <TelegramIcon size={18} />
            <h2 className="text-[16px] font-medium text-white">Telegram</h2>
          </div>
          <button onClick={close} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 pb-5">
          {step === "loading" && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-white/30 animate-spin" />
            </div>
          )}

          {step === "link" && (
            <div>
              <p className="text-[14px] text-white/50 mb-4">
                Откройте ссылку, чтобы привязать Telegram. После привязки вы сможете получать напоминания и общаться с Мирой.
              </p>
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-white/[0.08] border border-white/[0.08] px-4 py-3 text-[14px] text-white hover:bg-white/[0.12] transition-colors"
              >
                <TelegramIcon size={16} />
                Открыть в Telegram
              </a>
              <p className="text-[12px] text-white/20 mt-3 text-center">
                Ссылка действует 10 минут. Страница обновится автоматически.
              </p>
            </div>
          )}

          {step === "linked" && (
            <div>
              <div className="flex items-center gap-3 py-3 px-3 rounded-xl bg-white/[0.04] mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08]">
                  <Check size={16} className="text-white/70" />
                </div>
                <div>
                  <p className="text-[14px] text-white">Подключен</p>
                  {username && <p className="text-[13px] text-white/40">@{username}</p>}
                </div>
              </div>
              <p className="text-[13px] text-white/40 mb-4">
                Напоминания будут приходить в Telegram. Также можно писать Мире прямо в чат бота.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={close}
                  className="flex-1 rounded-xl bg-white/[0.08] px-4 py-2.5 text-[14px] text-white hover:bg-white/[0.12] transition-colors"
                >
                  Готово
                </button>
                <button
                  onClick={handleUnlink}
                  className="rounded-xl border border-white/[0.06] px-4 py-2.5 text-[13px] text-white/30 hover:text-red-400 hover:border-red-500/20 transition-colors"
                >
                  Отвязать
                </button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div>
              <p className="text-[14px] text-white/50 py-4">Не удалось создать ссылку. Попробуйте позже.</p>
              <button onClick={close} className="w-full rounded-xl bg-white/[0.08] px-4 py-2.5 text-[14px] text-white hover:bg-white/[0.12] transition-colors">
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
