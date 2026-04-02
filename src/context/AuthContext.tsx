"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiCall, setAccessToken, getAccessToken, refreshToken as refreshTokenApi, logout as logoutApi, getMe } from "@/lib/api-client";
import { setLocale, type Locale } from "@/lib/i18n";

interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  plan: string;
  language: string;
  balance_kopecks: number;
  daily_messages_used: number;
  allow_overage_billing: boolean;
  chat_plan: string;
  chat_plan_expires_at: string | null;
  code_plan: string;
  code_plan_expires_at: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithPhone: (phone: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, email: string, password: string, consent: boolean) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (data: { name?: string; language?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    (async () => {
      try {
        // Try refreshing the token (cookie-based)
        const refreshResult = await refreshTokenApi();
        if (refreshResult.ok) {
          const meResult = await getMe();
          if (meResult.ok) {
            setUser(meResult.data);
            setLocale(meResult.data.language as Locale);
          }
        }
      } catch {
        // No session
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiCall<{ access_token: string; expires_in: number }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!result.ok) {
      return { ok: false, error: (result.data as any)?.detail || "Login failed" };
    }

    setAccessToken(result.data.access_token);

    const meResult = await getMe();
    if (meResult.ok) {
      setUser(meResult.data);
      setLocale(meResult.data.language as Locale);
    }

    return { ok: true };
  }, []);

  const loginWithPhone = useCallback(async (phone: string, code: string) => {
    const result = await apiCall<{ access_token: string }>("/auth/phone/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    });

    if (!result.ok) {
      return { ok: false, error: (result.data as any)?.detail || "Verification failed" };
    }

    setAccessToken(result.data.access_token);

    const meResult = await getMe();
    if (meResult.ok) {
      setUser(meResult.data);
      setLocale(meResult.data.language as Locale);
    }

    return { ok: true };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, consent: boolean) => {
    const result = await apiCall("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, consent_personal_data: consent }),
    });

    if (!result.ok) {
      return { ok: false, error: (result.data as any)?.detail || "Registration failed" };
    }

    // Auto-login after registration
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const meResult = await getMe();
    if (meResult.ok) {
      setUser(meResult.data);
      setLocale(meResult.data.language as Locale);
    }
  }, []);

  const updateUser = useCallback(async (data: { name?: string; language?: string }) => {
    const result = await apiCall<User>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (result.ok) {
      setUser(result.data);
      if (data.language) {
        setLocale(data.language as Locale);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithPhone, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
