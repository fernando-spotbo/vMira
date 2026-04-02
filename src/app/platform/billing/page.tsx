"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Plus,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { getBalance, getTransactions, type Balance, type Transaction } from "@/lib/api-billing";

// ---- Helpers ----

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${day} ${months[d.getMonth()]}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function fmtRubles(kopecks: number): string {
  const r = Math.abs(kopecks) / 100;
  return r.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- Component ----

export default function BillingPage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [visibleCount, setVisibleCount] = useState(8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [bal, txs] = await Promise.all([
          getBalance(),
          getTransactions(50, 0),
        ]);
        setBalance(bal);
        setTransactions(txs);
      } catch (e) {
        setError("Не удалось загрузить данные биллинга");
        console.error("Billing load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className="max-w-[860px] mx-auto text-center py-20">
        <p className="text-white/40 text-[15px]">{error || "Данные недоступны"}</p>
      </div>
    );
  }

  const spending = balance.spending;
  const stats = [
    { label: "Сегодня", kopecks: spending?.today_kopecks ?? 0 },
    { label: "За неделю", kopecks: spending?.week_kopecks ?? 0 },
    { label: "За месяц", kopecks: spending?.month_kopecks ?? 0 },
  ];

  return (
    <div className="max-w-[860px] mx-auto">

      {/* ── Balance ── */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-[14px] text-white/40 mb-2">Баланс</p>
          <p className="text-[36px] font-medium text-white leading-none tabular-nums tracking-tight">
            {fmtRubles(balance.balance_kopecks)}
            <span className="text-[22px] text-white/30 ml-1.5">₽</span>
          </p>
        </div>
        <Link
          href="/billing/topup"
          className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all"
        >
          <Plus size={16} />
          Пополнить
        </Link>
      </div>

      {/* ── Spend stats ── */}
      <div className="flex gap-8 mb-10 pb-10 border-b border-white/[0.06]">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[14px] text-white/30 mb-1">{s.label}</p>
            <p className="text-[18px] font-medium text-white tabular-nums">
              {fmtRubles(s.kopecks)} <span className="text-[14px] text-white/25">₽</span>
            </p>
          </div>
        ))}
      </div>

      {/* ── Model breakdown ── */}
      {spending?.by_model && spending.by_model.length > 0 && (
        <div className="mb-10">
          <p className="text-[15px] font-medium text-white mb-4">Расходы по моделям</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {spending.by_model.map((m: { model: string; total_kopecks: number; total_requests: number }) => (
              <div key={m.model} className="rounded-xl border border-white/[0.06] px-4 py-3">
                <p className="text-[13px] text-white/30 mb-1">{m.model}</p>
                <p className="text-[16px] font-medium text-white tabular-nums">
                  {fmtRubles(m.total_kopecks)} ₽
                </p>
                <p className="text-[12px] text-white/20 mt-0.5">{m.total_requests} запросов</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Transactions ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-medium text-white">Транзакции</p>
          <span className="text-[14px] text-white/25">{transactions.length}</span>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] px-5 py-8 text-center">
            <p className="text-[14px] text-white/30">Транзакций пока нет</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            {transactions.slice(0, visibleCount).map((tx, i) => {
              const isTopup = tx.type === "topup";
              const isCharge = tx.type === "charge";
              return (
                <div
                  key={tx.id}
                  className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${
                    i < Math.min(visibleCount, transactions.length) - 1 ? "border-b border-white/[0.04]" : ""
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                    {isTopup && <ArrowDownLeft size={15} className="text-white/50" />}
                    {tx.type === "refund" && <RotateCcw size={15} className="text-white/50" />}
                    {isCharge && <ArrowUpRight size={15} className="text-white/35" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-white/60 truncate">{tx.description}</p>
                  </div>
                  <span className="text-[14px] text-white/20 shrink-0 hidden sm:block">{fmtDate(tx.created_at)}</span>
                  <span className={`text-[15px] font-medium tabular-nums shrink-0 w-[100px] text-right ${isCharge ? "text-white/35" : "text-white/70"}`}>
                    {tx.amount_kopecks > 0 ? "+" : ""}{fmtRubles(tx.amount_kopecks)} ₽
                  </span>
                </div>
              );
            })}

            {visibleCount < transactions.length && (
              <button
                onClick={() => setVisibleCount((c) => c + 10)}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-[14px] text-white/30 hover:text-white/50 hover:bg-white/[0.02] transition-colors border-t border-white/[0.04]"
              >
                Показать ещё
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Pricing link ── */}
      <Link
        href="/pricing"
        className="flex items-center justify-between rounded-xl border border-white/[0.06] px-5 py-4 hover:bg-white/[0.02] hover:border-white/[0.08] transition-all"
      >
        <span className="text-[15px] text-white/50">Стоимость моделей</span>
        <ArrowUpRight size={15} className="text-white/25" />
      </Link>
    </div>
  );
}
