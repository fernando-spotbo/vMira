"use client";

import { useState } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import MiraCodePricingModal from "@/components/MiraCodePricingModal";

const MIRA_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "",
    features: ["20 сообщений/день", "Модель Mira Fast", "Текстовый чат", "Доступ в интернет"],
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "199",
    period: "/мес",
    features: ["500 сообщений/день", "Все модели + мышление", "Загрузка файлов", "Расширенный контекст", "Быстрые ответы"],
    popular: true,
  },
  {
    id: "max",
    name: "Max",
    price: "990",
    period: "/мес",
    features: ["Безлимит сообщений", "Все модели + приоритет", "Голосовой ввод/вывод", "Максимальный контекст", "Ранний доступ"],
  },
];

const CODE_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "",
    features: ["50 запросов/день", "Модель Mira Fast", "Автодополнение кода", "Объяснение кода"],
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "499",
    period: "/мес",
    features: ["1 000 запросов/день", "Все модели + мышление", "Рефакторинг и ревью", "Генерация тестов", "Контекст 64K"],
    popular: true,
  },
  {
    id: "max",
    name: "Max",
    price: "990",
    period: "/мес",
    features: ["Безлимитные запросы", "Все модели + приоритет", "Анализ кодовых баз", "Контекст 128K", "Приоритетная очередь"],
  },
];

function PlanCard({ plan }: { plan: typeof MIRA_PLANS[0] }) {
  return (
    <div className={`flex flex-col rounded-xl border p-5 transition-all ${
      plan.popular ? "border-white/[0.15] bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"
    } ${plan.current ? "relative" : ""}`}>
      {plan.popular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-0.5 text-[11px] font-semibold text-[#161616]">
          Популярный
        </div>
      )}
      {plan.current && !plan.popular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-white/[0.1] border border-white/[0.15] px-3 py-0.5 text-[11px] font-medium text-white/60">
          Текущий
        </div>
      )}

      <div className="mb-4">
        <span className="text-[15px] font-medium text-white">{plan.name}</span>
        <div className="flex items-baseline gap-1 mt-2">
          {plan.price === "0" ? (
            <span className="text-[22px] font-medium text-white">Бесплатно</span>
          ) : (
            <>
              <span className="text-[22px] font-medium text-white">{plan.price} ₽</span>
              <span className="text-[14px] text-white/40">{plan.period}</span>
            </>
          )}
        </div>
      </div>

      <ul className="flex-1 space-y-2 mb-5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check size={14} className="shrink-0 mt-0.5 text-white/50" />
            <span className="text-[14px] text-white/70">{f}</span>
          </li>
        ))}
      </ul>

      <button
        disabled={!!plan.current}
        className={`w-full rounded-xl py-2.5 text-[15px] font-medium transition-all ${
          plan.current
            ? "bg-white/[0.04] text-white/30 cursor-default border border-white/[0.06]"
            : plan.popular
            ? "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"
            : "bg-white/[0.06] text-white/80 hover:bg-white/[0.1] border border-white/[0.06]"
        }`}
      >
        {plan.current ? "Текущий" : `Перейти на ${plan.name}`}
      </button>
    </div>
  );
}

export default function PlansPage() {
  const [codePricingOpen, setCodePricingOpen] = useState(false);

  return (
    <div className="max-w-[860px] mx-auto">
      {codePricingOpen && <MiraCodePricingModal onClose={() => setCodePricingOpen(false)} />}

      <div className="mb-10">
        <h1 className="text-[24px] font-medium text-white">Тарифы</h1>
        <p className="text-[15px] text-white/40 mt-2">Управляйте подписками Мира и Mira Code.</p>
      </div>

      {/* Mira Chat */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[18px] font-medium text-white">Мира — AI-ассистент</h2>
            <p className="text-[14px] text-white/35 mt-1">Чат, поиск, анализ документов</p>
          </div>
          <a href="https://vmira.ai/chat" target="_blank" className="flex items-center gap-1.5 text-[14px] text-white/30 hover:text-white/50 transition-colors">
            Открыть чат <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MIRA_PLANS.map((p) => <PlanCard key={p.id} plan={p} />)}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-10" />

      {/* Mira Code */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[18px] font-medium text-white">Mira Code — AI для разработчиков</h2>
            <p className="text-[14px] text-white/35 mt-1">Терминал, автодополнение, рефакторинг</p>
          </div>
          <button
            onClick={() => setCodePricingOpen(true)}
            className="flex items-center gap-1.5 text-[14px] text-white/30 hover:text-white/50 transition-colors"
          >
            Подробнее <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CODE_PLANS.map((p) => <PlanCard key={p.id + "-code"} plan={p} />)}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-[14px] text-white/20 text-center">
        Подписки тарифицируются отдельно. Ежемесячная оплата. Отменить можно в любой момент.
      </p>
    </div>
  );
}
