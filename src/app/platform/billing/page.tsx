"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Plus,
  TrendingUp,
  Clock,
  CalendarDays,
  ChevronRight,
  Zap,
  Brain,
  Rocket,
  Gem,
} from "lucide-react";

// ---- Mock data ----

const mockBalance = {
  balance_kopecks: 234500,
  balance_rubles: "2 345,00",
};

const mockTransactions = [
  {
    id: "1",
    type: "topup" as const,
    amount_kopecks: 500000,
    amount_rubles: "+5 000,00",
    description: "Пополнение через SBP",
    payment_method: "sbp",
    created_at: "2026-03-21T10:00:00Z",
  },
  {
    id: "2",
    type: "charge" as const,
    amount_kopecks: -1250,
    amount_rubles: "-12,50",
    description: "Mira Thinking — 2 400 токенов",
    model: "mira-thinking",
    input_tokens: 800,
    output_tokens: 1600,
    created_at: "2026-03-21T09:30:00Z",
  },
  {
    id: "3",
    type: "charge" as const,
    amount_kopecks: -350,
    amount_rubles: "-3,50",
    description: "Mira Fast — 1 100 токенов",
    model: "mira",
    input_tokens: 500,
    output_tokens: 600,
    created_at: "2026-03-21T09:15:00Z",
  },
  {
    id: "4",
    type: "charge" as const,
    amount_kopecks: -4800,
    amount_rubles: "-48,00",
    description: "Mira Pro — 6 200 токенов",
    model: "mira-pro",
    input_tokens: 2000,
    output_tokens: 4200,
    created_at: "2026-03-21T08:45:00Z",
  },
  {
    id: "5",
    type: "refund" as const,
    amount_kopecks: 1500,
    amount_rubles: "+15,00",
    description: "Возврат за ошибку API",
    created_at: "2026-03-20T22:10:00Z",
  },
  {
    id: "6",
    type: "charge" as const,
    amount_kopecks: -18500,
    amount_rubles: "-185,00",
    description: "Mira Max — 12 000 токенов",
    model: "mira-max",
    input_tokens: 4000,
    output_tokens: 8000,
    created_at: "2026-03-20T20:30:00Z",
  },
  {
    id: "7",
    type: "topup" as const,
    amount_kopecks: 100000,
    amount_rubles: "+1 000,00",
    description: "Пополнение банковской картой",
    payment_method: "card",
    created_at: "2026-03-20T18:00:00Z",
  },
  {
    id: "8",
    type: "charge" as const,
    amount_kopecks: -750,
    amount_rubles: "-7,50",
    description: "Mira Thinking — 1 500 токенов",
    model: "mira-thinking",
    input_tokens: 500,
    output_tokens: 1000,
    created_at: "2026-03-20T16:45:00Z",
  },
  {
    id: "9",
    type: "charge" as const,
    amount_kopecks: -200,
    amount_rubles: "-2,00",
    description: "Mira Fast — 600 токенов",
    model: "mira",
    input_tokens: 200,
    output_tokens: 400,
    created_at: "2026-03-20T15:20:00Z",
  },
  {
    id: "10",
    type: "charge" as const,
    amount_kopecks: -9200,
    amount_rubles: "-92,00",
    description: "Mira Max — 8 400 токенов",
    model: "mira-max",
    input_tokens: 2400,
    output_tokens: 6000,
    created_at: "2026-03-19T23:50:00Z",
  },
  {
    id: "11",
    type: "topup" as const,
    amount_kopecks: 200000,
    amount_rubles: "+2 000,00",
    description: "Пополнение через YooMoney",
    payment_method: "yoomoney",
    created_at: "2026-03-19T12:00:00Z",
  },
  {
    id: "12",
    type: "charge" as const,
    amount_kopecks: -2700,
    amount_rubles: "-27,00",
    description: "Mira Pro — 3 800 токенов",
    model: "mira-pro",
    input_tokens: 1200,
    output_tokens: 2600,
    created_at: "2026-03-19T10:30:00Z",
  },
];

const mockSpendingDays = [
  { date: "15 мар", amount_kopecks: 3500 },
  { date: "16 мар", amount_kopecks: 8200 },
  { date: "17 мар", amount_kopecks: 12400 },
  { date: "18 мар", amount_kopecks: 5600 },
  { date: "19 мар", amount_kopecks: 11900 },
  { date: "20 мар", amount_kopecks: 19550 },
  { date: "21 мар", amount_kopecks: 6490 },
];

const mockModelSpending = [
  {
    model: "mira",
    label: "Mira Fast",
    icon: Zap,
    amount_kopecks: 5500,
    amount_rubles: "55,00",
    input_tokens: 7200,
    output_tokens: 12400,
    color: "#4ade80",
  },
  {
    model: "mira-thinking",
    label: "Mira Thinking",
    icon: Brain,
    amount_kopecks: 20000,
    amount_rubles: "200,00",
    input_tokens: 13000,
    output_tokens: 26000,
    color: "#60a5fa",
  },
  {
    model: "mira-pro",
    label: "Mira Pro",
    icon: Rocket,
    amount_kopecks: 75500,
    amount_rubles: "755,00",
    input_tokens: 32000,
    output_tokens: 68000,
    color: "#c084fc",
  },
  {
    model: "mira-max",
    label: "Mira Max",
    icon: Gem,
    amount_kopecks: 277000,
    amount_rubles: "2 770,00",
    input_tokens: 64000,
    output_tokens: 140000,
    color: "#f472b6",
  },
];

const mockUsageStats = {
  today_kopecks: 6490,
  today_rubles: "64,90",
  week_kopecks: 67640,
  week_rubles: "676,40",
  month_kopecks: 378000,
  month_rubles: "3 780,00",
};

// ---- Helpers ----

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month}, ${hours}:${minutes}`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toString();
}

// ---- Component ----

export default function BillingPage() {
  const [visibleCount, setVisibleCount] = useState(8);

  const maxSpend = Math.max(...mockSpendingDays.map((d) => d.amount_kopecks), 1);
  const totalModelSpend = mockModelSpending.reduce((s, m) => s + m.amount_kopecks, 0);

  return (
    <div className="max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[26px] font-bold text-white">Биллинг</h1>
          <p className="text-[15px] text-white/40 mt-2">Баланс, расходы и история транзакций.</p>
        </div>
        <Link
          href="/platform/billing/topup"
          className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[14px] font-medium text-[#161616] hover:bg-white/90 transition-colors"
        >
          <Plus size={16} />
          Пополнить
        </Link>
      </div>

      {/* Balance + usage stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Balance — prominent */}
        <div className="md:col-span-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                <Wallet size={16} className="text-white/60" />
              </div>
              <span className="text-[13px] text-white/40">Баланс</span>
            </div>
            <p className="text-[28px] font-bold text-white leading-tight">{mockBalance.balance_rubles} <span className="text-[20px] font-normal text-white/50">&#8381;</span></p>
          </div>
          <Link
            href="/platform/billing/topup"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-white/[0.06] border border-white/[0.08] px-4 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.1] hover:border-white/[0.12] transition-all"
          >
            <Plus size={14} />
            Пополнить баланс
          </Link>
        </div>

        {/* Usage stats */}
        <div className="rounded-xl border border-white/[0.06] p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-white/30" />
            <span className="text-[12px] text-white/40">Сегодня</span>
          </div>
          <p className="text-[22px] font-semibold text-white">{mockUsageStats.today_rubles} <span className="text-[14px] font-normal text-white/40">&#8381;</span></p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-white/30" />
            <span className="text-[12px] text-white/40">За неделю</span>
          </div>
          <p className="text-[22px] font-semibold text-white">{mockUsageStats.week_rubles} <span className="text-[14px] font-normal text-white/40">&#8381;</span></p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={14} className="text-white/30" />
            <span className="text-[12px] text-white/40">За месяц</span>
          </div>
          <p className="text-[22px] font-semibold text-white">{mockUsageStats.month_rubles} <span className="text-[14px] font-normal text-white/40">&#8381;</span></p>
        </div>
      </div>

      {/* Spending chart */}
      <div className="rounded-xl border border-white/[0.06] p-6 mb-8">
        <h3 className="text-[15px] font-medium text-white mb-6">Расходы за неделю</h3>
        <div className="flex items-end gap-3 h-[160px]">
          {mockSpendingDays.map((day) => {
            const pct = (day.amount_kopecks / maxSpend) * 100;
            const rubles = (day.amount_kopecks / 100).toFixed(0);
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group">
                <span className="text-[11px] text-white/0 group-hover:text-white/60 transition-colors mb-1">
                  {rubles} &#8381;
                </span>
                <div className="w-full relative" style={{ height: `${Math.max(pct, 3)}%` }}>
                  <div
                    className="absolute inset-0 rounded-t-md bg-white/[0.12] group-hover:bg-white/[0.2] transition-colors"
                  />
                </div>
                <span className="text-[11px] text-white/40 mt-auto">{day.date}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model spending breakdown */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-white/[0.04]">
          <h3 className="text-[15px] font-medium text-white">Расходы по моделям</h3>
        </div>

        {/* Stacked bar */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {mockModelSpending.map((m) => (
              <div
                key={m.model}
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max((m.amount_kopecks / totalModelSpend) * 100, 2)}%`,
                  backgroundColor: m.color,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 mb-2">
            {mockModelSpending.map((m) => (
              <div key={m.model} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color, opacity: 0.7 }} />
                <span className="text-[11px] text-white/40">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_100px_110px] gap-4 px-6 py-3 bg-white/[0.02] border-t border-b border-white/[0.04] text-[11px] font-medium text-white/30 uppercase tracking-wider">
          <span>Модель</span>
          <span className="text-right">Токены (вход)</span>
          <span className="text-right">Токены (выход)</span>
          <span className="text-right">Расход</span>
        </div>

        {/* Table rows */}
        {mockModelSpending.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.model}
              className="grid grid-cols-[1fr_100px_100px_110px] gap-4 items-center px-6 py-3.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: m.color + "18" }}>
                  <Icon size={14} style={{ color: m.color }} />
                </div>
                <span className="text-[14px] text-white font-medium">{m.label}</span>
              </div>
              <span className="text-[13px] text-white/50 text-right font-mono">{formatTokens(m.input_tokens)}</span>
              <span className="text-[13px] text-white/50 text-right font-mono">{formatTokens(m.output_tokens)}</span>
              <span className="text-[13px] text-white/80 text-right font-medium">{m.amount_rubles} &#8381;</span>
            </div>
          );
        })}
      </div>

      {/* Transaction history */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
          <h3 className="text-[15px] font-medium text-white">История транзакций</h3>
          <span className="text-[12px] text-white/30">{mockTransactions.length} транзакций</span>
        </div>

        {/* Transaction list */}
        <div className="divide-y divide-white/[0.03]">
          {mockTransactions.slice(0, visibleCount).map((tx) => {
            const isTopup = tx.type === "topup";
            const isRefund = tx.type === "refund";
            const isCharge = tx.type === "charge";

            return (
              <div
                key={tx.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                {/* Icon */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isTopup
                      ? "bg-emerald-500/10"
                      : isRefund
                      ? "bg-blue-500/10"
                      : "bg-red-500/10"
                  }`}
                >
                  {isTopup && <ArrowDownLeft size={16} className="text-emerald-400" />}
                  {isRefund && <RotateCcw size={16} className="text-blue-400" />}
                  {isCharge && <ArrowUpRight size={16} className="text-red-400" />}
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-white/80 truncate">{tx.description}</p>
                  <p className="text-[12px] text-white/30 mt-0.5">{formatDate(tx.created_at)}</p>
                </div>

                {/* Tokens (if charge) */}
                {tx.input_tokens !== undefined && (
                  <div className="hidden sm:block text-right mr-2">
                    <p className="text-[11px] text-white/25 font-mono">
                      {formatTokens(tx.input_tokens)} / {formatTokens(tx.output_tokens!)}
                    </p>
                  </div>
                )}

                {/* Amount */}
                <div className="text-right shrink-0">
                  <p
                    className={`text-[14px] font-medium tabular-nums ${
                      isCharge ? "text-red-400/80" : isRefund ? "text-blue-400/80" : "text-emerald-400/80"
                    }`}
                  >
                    {tx.amount_rubles} &#8381;
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load more */}
        {visibleCount < mockTransactions.length && (
          <button
            onClick={() => setVisibleCount((c) => c + 10)}
            className="w-full flex items-center justify-center gap-2 py-4 text-[13px] text-white/40 hover:text-white/60 hover:bg-white/[0.02] transition-colors border-t border-white/[0.04]"
          >
            Показать ещё
            <ChevronRight size={14} className="rotate-90" />
          </button>
        )}
      </div>

      {/* Pricing link */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 flex items-center justify-between">
        <div>
          <p className="text-[14px] text-white/70">Хотите узнать стоимость моделей?</p>
          <p className="text-[12px] text-white/30 mt-1">Подробная информация о ценах за токен для каждой модели</p>
        </div>
        <Link
          href="/platform/pricing"
          className="flex items-center gap-2 rounded-lg bg-white/[0.06] border border-white/[0.08] px-4 py-2.5 text-[13px] text-white/60 hover:bg-white/[0.1] hover:text-white/80 transition-all"
        >
          Цены
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
