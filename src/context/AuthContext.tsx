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

  // Try to restore session on mount.
  // 1. Fast path: token in sessionStorage → validate with /auth/me
  // 2. Slow path: cookie-based refresh with retries
  // 3. Both paths retry /auth/me independently to handle transient failures
  useEffect(() => {
    let cancelled = false;

    // Helper: try /auth/me up to 3 times with brief delays
    const fetchMe = async (): Promise<boolean> => {
      for (let i = 0; i < 3; i++) {
        if (cancelled) return false;
        if (i > 0) await new Promise((r) => setTimeout(r, 1000));
        try {
          const meResult = await getMe();
          if (!cancelled && meResult.ok) {
            setUser(meResult.data);
            setLocale(meResult.data.language as Locale);
            return true;
          }
          // 401 means token is invalid — don't retry
          if (meResult.status === 401) return false;
        } catch {
          // Network error — retry
        }
      }
      return false;
    };

    (async () => {
      try {
        // Fast path: token survived reload (sessionStorage)
        const existingToken = getAccessToken();
        if (existingToken) {
          if (await fetchMe()) {
            setLoading(false);
            return;
          }
          // Token was stale — clear it and fall through to refresh
          setAccessToken(null);
        }

        // Slow path: refresh via cookie — retry up to 3 times
        // (backend may be briefly unavailable during deployment)
        const RETRY_DELAYS = [0, 2000, 4000];
        for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
          if (cancelled) return;
          if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));

          try {
            const refreshResult = await refreshTokenApi();
            if (!cancelled && refreshResult.ok) {
              // Refresh succeeded — token is set. Now load user profile.
              if (await fetchMe()) break;
              // fetchMe failed but token is valid — still break to avoid
              // re-refreshing (which would waste the valid token)
              break;
            }
          } catch {
            // Network error — retry
          }
        }
      } catch {
        // No session
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
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
