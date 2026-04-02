"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getBalance, type Balance } from "@/lib/api-billing";

export default function UsagePage() {
  const { user, loading: authLoading } = useAuth();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    getBalance().then((res) => {
      if (res.ok) setBalance(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    );
  }

  const spending = balance?.spending;
  const today = spending?.today_kopecks ?? 0;
  const week = spending?.week_kopecks ?? 0;
  const month = spending?.month_kopecks ?? 0;
  const models = spending?.by_model ?? [];
  const totalRequests = models.reduce((s, m) => s + m.total_requests, 0);
  const totalTokens = models.reduce((s, m) => s + m.total_input_tokens + m.total_output_tokens, 0);

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="mb-8">
        <h1 className="text-[22px] font-medium text-white">Использование</h1>
        <p className="text-[15px] text-white/40 mt-2">Мониторинг потребления API и расходов.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: "Запросов всего", value: totalRequests.toLocaleString("ru-RU") },
          { label: "Токенов использовано", value: totalTokens.toLocaleString("ru-RU") },
          { label: "Расход сегодня", value: `${(today / 100).toFixed(2)} ₽` },
          { label: "Расход за месяц", value: `${(month / 100).toFixed(2)} ₽` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] p-5">
            <p className="text-[12px] text-white/40 mb-1">{s.label}</p>
            <p className="text-[22px] font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Spending breakdown */}
      <div className="rounded-xl border border-white/[0.06] p-6 mb-10">
        <h3 className="text-[15px] font-medium text-white mb-4">Расход по периодам</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Сегодня", value: today },
            { label: "За неделю", value: week },
            { label: "За месяц", value: month },
          ].map((p) => (
            <div key={p.label} className="rounded-xl bg-white/[0.03] p-4">
              <p className="text-[12px] text-white/40 mb-1">{p.label}</p>
              <p className="text-[18px] font-medium text-white">{(p.value / 100).toFixed(2)} ₽</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-model breakdown */}
      <h2 className="text-[15px] font-medium text-white mb-4">По моделям</h2>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-10">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider">
          <span>Модель</span><span className="text-right">Запросы</span><span className="text-right">Вх. токены</span><span className="text-right">Вых. токены</span><span className="text-right">Расход</span>
        </div>
        {models.length === 0 ? (
          <div className="px-6 py-8 text-center text-[14px] text-white/30">Нет данных об использовании</div>
        ) : (
          models.map((m) => (
            <div key={m.model} className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-white/[0.03] last:border-0 text-[14px]">
              <span className="font-medium text-white">{m.model}</span>
              <span className="text-white/80 text-right">{m.total_requests.toLocaleString("ru-RU")}</span>
              <span className="text-white/60 text-right">{m.total_input_tokens.toLocaleString("ru-RU")}</span>
              <span className="text-white/60 text-right">{m.total_output_tokens.toLocaleString("ru-RU")}</span>
              <span className="text-white/80 text-right">{(m.total_kopecks / 100).toFixed(2)} ₽</span>
            </div>
          ))
        )}
      </div>

      {/* Pricing reference */}
      <h2 className="text-[15px] font-medium text-white mb-4">Тарифы API</h2>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider">
          <span>Модель</span><span className="text-right">Ввод / 1K</span><span className="text-right">Вывод / 1K</span>
        </div>
        {[
          { model: "Mira Fast", input: "0,10 ₽", output: "0,30 ₽" },
          { model: "Mira Pro", input: "0,30 ₽", output: "0,90 ₽" },
          { model: "Mira Max", input: "1,50 ₽", output: "6,00 ₽" },
        ].map((r) => (
          <div key={r.model} className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-white/[0.03] last:border-0 text-[14px]">
            <span className="font-medium text-white">{r.model}</span>
            <span className="text-white/80 text-right font-mono">{r.input}</span>
            <span className="text-white/80 text-right font-mono">{r.output}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
