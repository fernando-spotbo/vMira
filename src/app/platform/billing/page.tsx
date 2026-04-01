"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Plus,
  ChevronDown,
} from "lucide-react";

// ---- Mock data ----

const mockBalance = {
  balance_kopecks: 234500,
  balance_rubles: "2 345,00",
};

const mockTransactions = [
  { id: "1", type: "topup" as const, amount_rubles: "+5 000,00", description: "Пополнение через SBP", created_at: "2026-03-21T10:00:00Z" },
  { id: "2", type: "charge" as const, amount_rubles: "-0,36", description: "Mira Thinking — 2 400 токенов", created_at: "2026-03-21T09:30:00Z" },
  { id: "3", type: "charge" as const, amount_rubles: "-0,12", description: "Mira Fast — 1 100 токенов", created_at: "2026-03-21T09:15:00Z" },
  { id: "4", type: "charge" as const, amount_rubles: "-1,46", description: "Mira Pro — 6 200 токенов", created_at: "2026-03-21T08:45:00Z" },
  { id: "5", type: "refund" as const, amount_rubles: "+0,50", description: "Возврат за ошибку API", created_at: "2026-03-20T22:10:00Z" },
  { id: "6", type: "charge" as const, amount_rubles: "-7,00", description: "Mira Max — 12 000 токенов", created_at: "2026-03-20T20:30:00Z" },
  { id: "7", type: "topup" as const, amount_rubles: "+1 000,00", description: "Пополнение банковской картой", created_at: "2026-03-20T18:00:00Z" },
  { id: "8", type: "charge" as const, amount_rubles: "-0,23", description: "Mira Thinking — 1 500 токенов", created_at: "2026-03-20T16:45:00Z" },
  { id: "9", type: "charge" as const, amount_rubles: "-0,07", description: "Mira Fast — 600 токенов", created_at: "2026-03-20T15:20:00Z" },
  { id: "10", type: "charge" as const, amount_rubles: "-5,10", description: "Mira Max — 8 400 токенов", created_at: "2026-03-19T23:50:00Z" },
  { id: "11", type: "topup" as const, amount_rubles: "+2 000,00", description: "Пополнение через YooMoney", created_at: "2026-03-19T12:00:00Z" },
  { id: "12", type: "charge" as const, amount_rubles: "-0,90", description: "Mira Pro — 3 800 токенов", created_at: "2026-03-19T10:30:00Z" },
];

const mockSpendingDays = [
  { date: "15 мар", kopecks: 570 },
  { date: "16 мар", kopecks: 1330 },
  { date: "17 мар", kopecks: 2010 },
  { date: "18 мар", kopecks: 910 },
  { date: "19 мар", kopecks: 1930 },
  { date: "20 мар", kopecks: 3170 },
  { date: "21 мар", kopecks: 1053 },
];

const mockStats = { today: "10,53", week: "109,80", month: "152,67" };

// ---- Helpers ----

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${day} ${months[d.getMonth()]}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// ---- Component ----

export default function BillingPage() {
  const [visibleCount, setVisibleCount] = useState(8);
  const maxSpend = Math.max(...mockSpendingDays.map((d) => d.kopecks), 1);

  return (
    <div className="max-w-[860px] mx-auto">

      {/* ── Balance ── */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-[14px] text-white/40 mb-2">Баланс</p>
          <p className="text-[36px] font-medium text-white leading-none tabular-nums tracking-tight">
            {mockBalance.balance_rubles}
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
        {[
          { label: "Сегодня", value: mockStats.today },
          { label: "За неделю", value: mockStats.week },
          { label: "За месяц", value: mockStats.month },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-[14px] text-white/30 mb-1">{s.label}</p>
            <p className="text-[18px] font-medium text-white tabular-nums">{s.value} <span className="text-[14px] text-white/25">₽</span></p>
          </div>
        ))}
      </div>

      {/* ── Weekly chart ── */}
      <div className="mb-10">
        <p className="text-[15px] font-medium text-white mb-6">Расходы за неделю</p>
        <div className="flex items-end gap-2 h-[140px]">
          {mockSpendingDays.map((day) => {
            const pct = (day.kopecks / maxSpend) * 100;
            const rubles = (day.kopecks / 100).toFixed(0);
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group">
                <span className="text-[14px] text-white/0 group-hover:text-white/50 transition-colors tabular-nums">
                  {rubles} ₽
                </span>
                <div className="w-full relative" style={{ height: `${Math.max(pct, 4)}%` }}>
                  <div className="absolute inset-0 rounded-md bg-white/[0.10] group-hover:bg-white/[0.18] transition-colors" />
                </div>
                <span className="text-[14px] text-white/30">{day.date}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Transactions ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-medium text-white">Транзакции</p>
          <span className="text-[14px] text-white/25">{mockTransactions.length}</span>
        </div>

        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          {mockTransactions.slice(0, visibleCount).map((tx, i) => {
            const isTopup = tx.type === "topup";
            const isCharge = tx.type === "charge";
            return (
              <div
                key={tx.id}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${
                  i < Math.min(visibleCount, mockTransactions.length) - 1 ? "border-b border-white/[0.04]" : ""
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
                  {tx.amount_rubles} ₽
                </span>
              </div>
            );
          })}

          {visibleCount < mockTransactions.length && (
            <button
              onClick={() => setVisibleCount((c) => c + 10)}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-[14px] text-white/30 hover:text-white/50 hover:bg-white/[0.02] transition-colors border-t border-white/[0.04]"
            >
              Показать ещё
              <ChevronDown size={14} />
            </button>
          )}
        </div>
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
