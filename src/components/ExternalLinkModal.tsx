"use client";

import { useCallback, useEffect } from "react";
import { ExternalLink, Shield } from "lucide-react";
import { t } from "@/lib/i18n";

interface ExternalLinkModalProps {
  url: string;
  domain: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ExternalLinkModal({ url, domain, onConfirm, onClose }: ExternalLinkModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm();
    },
    [onClose, onConfirm]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-[400px] mx-4 rounded-2xl bg-[#1e1e1e] border border-white/[0.06] shadow-[0_16px_64px_rgba(0,0,0,0.6)] overflow-hidden mira-fade-in">
        {/* Icon + message */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]">
              <ExternalLink size={18} className="text-white/50" />
            </div>
            <div>
              <p className="text-[16px] text-white">{t("external.title")}</p>
              <p className="text-[16px] text-white/30">{t("external.subtitle")}</p>
            </div>
          </div>

          {/* URL preview */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={13} className="text-white/25 shrink-0" />
              <span className="text-[16px] text-white/60 font-medium">{domain}</span>
            </div>
            <p className="text-[16px] text-white/25 truncate break-all leading-relaxed">{url}</p>
          </div>
        </div>

        <div className="border-t border-white/[0.04]" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-[16px] text-white/40 hover:text-white/60 transition-colors"
          >
            {t("external.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-white px-6 py-2.5 text-[16px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            {t("external.go")}
          </button>
        </div>
      </div>
    </div>
  );
}
