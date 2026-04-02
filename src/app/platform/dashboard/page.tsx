"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Check, Plus, Key, ArrowUpRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getBalance, type Balance } from "@/lib/api-billing";

export default function DashboardPage() {
  const [copied, setCopied] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [balance, setBalance] = useState<Balance | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    getBalance().then((res) => { if (res.ok) setBalance(res.data); });
  }, [user, authLoading]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  })();

  const userName = user?.name || "User";
  const userId = user?.id || "";
  const balanceRubles = balance ? (balance.balance_kopecks / 100).toFixed(2) : "0.00";
  const todaySpent = balance?.spending?.today_kopecks
    ? (balance.spending.today_kopecks / 100).toFixed(2)
    : "0.00";

  return (
    <div className="max-w-[900px] mx-auto">
      {/* Greeting */}
      <h1 className="text-[22px] font-medium text-white/80 text-center pt-10 pb-10" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
        {greeting}, {userName}
      </h1>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <Link
          href="/api-keys"
          className="flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] py-4 text-[15px] text-white/70 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
        >
          <Plus size={16} />
          Создать API-ключ
        </Link>
        <Link
          href="/api-keys"
          className="flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] py-4 text-[15px] text-white/70 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
        >
          <Key size={16} />
          API-ключи
        </Link>
        <Link
          href="/usage"
          className="flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] py-4 text-[15px] text-white/70 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
        >
          <ArrowUpRight size={16} />
          Использование
        </Link>
      </div>

      {/* User ID */}
      {userId && (
        <div className="flex items-center gap-3 mb-10 rounded-xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
          <span className="text-[13px] text-white/40">User ID</span>
          <code className="text-[13px] font-mono text-white/70 bg-white/[0.06] rounded px-2 py-0.5">{userId}</code>
          <button onClick={() => handleCopy(userId)} className="text-white/30 hover:text-white/60 transition-colors">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-white/[0.06] p-6">
          <p className="text-[13px] text-white/40 mb-2">Баланс</p>
          <p className="text-[24px] font-semibold text-white">{balanceRubles} ₽</p>
          <Link href="/billing/topup" className="text-[12px] text-white/25 hover:text-white/50 mt-1 inline-block transition-colors">
            Пополнить →
          </Link>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-6">
          <p className="text-[13px] text-white/40 mb-2">Расход сегодня</p>
          <p className="text-[24px] font-semibold text-white">{todaySpent} ₽</p>
          <p className="text-[12px] text-white/25 mt-1">API-токены</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-6">
          <p className="text-[13px] text-white/40 mb-2">Сообщений сегодня</p>
          <p className="text-[24px] font-semibold text-white">{user?.daily_messages_used ?? 0}</p>
          <p className="text-[12px] text-white/25 mt-1">Чат: {user?.chat_plan ?? "free"}</p>
        </div>
      </div>
    </div>
  );
}
