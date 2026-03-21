"use client";

import { t } from "@/lib/i18n";

export function MiraLogo({ size = 28, className = "text-white/70" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor" />
      <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor" />
    </svg>
  );
}

export function MiraHeading() {
  return (
    <h1 className="mb-9 flex items-center justify-center gap-3 text-3xl font-normal text-white">
      <MiraLogo />
      {t("landing.heading")}
    </h1>
  );
}
