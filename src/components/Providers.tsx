"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { I18nProvider } from "@/lib/i18n";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider initialLocale="ru">
      <AuthProvider>
        {children}
      </AuthProvider>
    </I18nProvider>
  );
}
