"use client";

import { useState } from "react";
import { Send, Mail, Check, X, Loader2, AlertCircle } from "lucide-react";
import { t } from "@/lib/i18n";
import { executeAction, cancelAction } from "@/lib/api-client";

interface ActionCardProps {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
}

function TelegramIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case "send_telegram": return <TelegramIcon size={16} className="text-white/50" />;
    case "send_email": return <Mail size={16} strokeWidth={1.8} className="text-white/50" />;
    default: return <Send size={16} strokeWidth={1.8} className="text-white/50" />;
  }
}

function ActionLabel({ type }: { type: string }) {
  switch (type) {
    case "send_telegram": return "Telegram";
    case "send_email": return "Email";
    default: return type;
  }
}

export default function ActionCard({ id, actionType, payload }: ActionCardProps) {
  const [status, setStatus] = useState<"proposed" | "executing" | "executed" | "cancelled" | "failed">("proposed");

  const description = String(payload.description || "");
  const to = String(payload.to || "");
  const message = String(payload.message || payload.body || "");
  const subject = String(payload.subject || "");

  const handleConfirm = async () => {
    setStatus("executing");
    const result = await executeAction(id);
    if (result.ok) {
      setStatus(result.data.status as typeof status);
    } else {
      setStatus("failed");
    }
  };

  const handleCancel = async () => {
    setStatus("cancelled");
    await cancelAction(id);
  };

  return (
    <div className="my-3 max-w-[480px]">
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[0.02]">
          <ActionIcon type={actionType} />
          <span className="text-[14px] text-white/50"><ActionLabel type={actionType} /></span>
          {status === "executed" && <Check size={14} strokeWidth={2} className="text-white/40 ml-auto" />}
          {status === "failed" && <AlertCircle size={14} strokeWidth={1.8} className="text-red-400/60 ml-auto" />}
          {status === "cancelled" && <X size={14} strokeWidth={1.8} className="text-white/20 ml-auto" />}
        </div>

        {/* Content preview */}
        <div className="px-4 py-3">
          {to && (
            <p className="text-[13px] text-white/40 mb-1">{to}{subject ? ` · ${subject}` : ""}</p>
          )}
          {message && (
            <p className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap">{message}</p>
          )}
          {!message && description && (
            <p className="text-[15px] text-white/80 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Actions */}
        {status === "proposed" && (
          <div className="flex border-t border-white/[0.06]">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-[14px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
            >
              {t("reminders.cancel")}
            </button>
            <div className="w-px bg-white/[0.06]" />
            <button
              onClick={handleConfirm}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-[14px] text-white hover:bg-white/[0.04] transition-colors font-medium"
            >
              {t("action.confirm")}
            </button>
          </div>
        )}

        {status === "executing" && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-white/[0.06]">
            <Loader2 size={14} className="text-white/30 animate-spin" />
            <span className="text-[14px] text-white/30">{t("action.executing")}</span>
          </div>
        )}

        {status === "executed" && (
          <div className="flex items-center justify-center gap-2 py-2.5 border-t border-white/[0.06]">
            <span className="text-[13px] text-white/25">{t("action.done")}</span>
          </div>
        )}

        {status === "cancelled" && (
          <div className="flex items-center justify-center gap-2 py-2.5 border-t border-white/[0.06]">
            <span className="text-[13px] text-white/20">{t("action.cancelled")}</span>
          </div>
        )}

        {status === "failed" && (
          <div className="flex items-center justify-center gap-2 py-2.5 border-t border-white/[0.06]">
            <span className="text-[13px] text-red-400/60">{t("action.failed")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
