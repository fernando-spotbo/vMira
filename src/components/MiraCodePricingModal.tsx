"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Check, Terminal } from "lucide-react";

interface MiraCodePricingModalProps {
  onClose: () => void;
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "",
    description: { ru: "Попробуйте Mira Code", en: "Try Mira Code" },
    features: {
      ru: [
        "50 запросов в день",
        "Модель Mira Fast",
        "Автодополнение кода",
        "Объяснение кода",
      ],
      en: [
        "50 requests per day",
        "Mira Fast model",
        "Code completions",
        "Code explanations",
      ],
    },
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 499,
    period: { ru: "/мес", en: "/mo" },
    description: { ru: "Для разработчиков", en: "For developers" },
    features: {
      ru: [
        "1 000 запросов в день",
        "Все модели (Fast, Pro, Max)",
        "Режим мышления",
        "Рефакторинг и ревью кода",
        "Генерация тестов",
        "Длинный контекст (64K)",
      ],
      en: [
        "1,000 requests per day",
        "All models (Fast, Pro, Max)",
        "Thinking mode",
        "Code refactoring & review",
        "Test generation",
        "Long context (64K)",
      ],
    },
    popular: true,
  },
  {
    id: "max",
    name: "Max",
    price: 990,
    period: { ru: "/мес", en: "/mo" },
    description: { ru: "Без ограничений", en: "Unlimited" },
    features: {
      ru: [
        "Безлимитные запросы",
        "Все модели + приоритет",
        "Режим мышления",
        "Максимальный контекст (128K)",
        "Анализ целых кодовых баз",
        "Приоритетная очередь",
      ],
      en: [
        "Unlimited requests",
        "All models + priority",
        "Thinking mode",
        "Max context (128K)",
        "Full codebase analysis",
        "Priority queue",
      ],
    },
  },
];

function getLocale(): "ru" | "en" {
  if (typeof window === "undefined") return "ru";
  return (localStorage.getItem("mira-locale") as "ru" | "en") || "ru";
}

export default function MiraCodePricingModal({ onClose }: MiraCodePricingModalProps) {
  const [visible, setVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [locale, setLocale] = useState<"ru" | "en">("ru");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocale(getLocale());
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") { setVisible(false); setTimeout(onClose, 250); } },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setVisible(false); setTimeout(onClose, 250);
    }
  };

  const handleSelect = (planId: string) => {
    setSelectedPlan(planId);
    setTimeout(() => { setVisible(false); setTimeout(onClose, 250); }, 800);
  };

  const isRu = locale === "ru";
  const i = (v: { ru: string; en: string }) => v[locale];

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[200] flex items-center justify-center px-4 transition-all duration-250 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-[880px] max-h-[90vh] rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-250 flex flex-col ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
              <Terminal size={18} className="text-white/70" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-white">Mira Code</h2>
              <p className="text-[15px] text-white/50 mt-0.5">
                {isRu ? "AI-помощник для разработчиков в терминале" : "AI assistant for developers in the terminal"}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setVisible(false); setTimeout(onClose, 250); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Plans */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-8 pt-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-5 transition-all duration-200 ${
                  plan.popular
                    ? "border-white/[0.15] bg-white/[0.04]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-0.5 text-[11px] font-semibold text-[#161616]">
                    {isRu ? "Популярный" : "Most popular"}
                  </div>
                )}

                {plan.current && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white/[0.1] border border-white/[0.15] px-3 py-0.5 text-[11px] font-medium text-white/60">
                    {isRu ? "Текущий" : "Current"}
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-[16px] font-medium text-white">{plan.name}</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    {plan.price === 0 ? (
                      <span className="text-2xl font-medium text-white">{isRu ? "Бесплатно" : "Free"}</span>
                    ) : (
                      <>
                        <span className="text-2xl font-medium text-white">{plan.price} ₽</span>
                        <span className="text-[15px] text-white/40">{plan.period ? i(plan.period as { ru: string; en: string }) : ""}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[14px] text-white/50 mt-1">{i(plan.description)}</p>
                </div>

                <ul className="flex-1 space-y-2.5 mb-5">
                  {plan.features[locale].map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check size={14} className="shrink-0 mt-0.5 text-white/60" />
                      <span className="text-[14px] text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !plan.current && handleSelect(plan.id)}
                  disabled={!!plan.current || selectedPlan === plan.id}
                  className={`w-full rounded-xl py-2.5 text-[15px] font-medium transition-all ${
                    selectedPlan === plan.id
                      ? "bg-white/20 text-white cursor-default"
                      : plan.current
                      ? "bg-white/[0.04] text-white/30 cursor-default border border-white/[0.06]"
                      : plan.popular
                      ? "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"
                      : "bg-white/[0.06] text-white/80 hover:bg-white/[0.1] border border-white/[0.06]"
                  }`}
                >
                  {selectedPlan === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check size={14} />
                      {isRu ? "Выбрано" : "Selected"}
                    </span>
                  ) : plan.current ? (
                    isRu ? "Текущий" : "Current plan"
                  ) : (
                    `${isRu ? "Перейти на" : "Upgrade to"} ${plan.name}`
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 text-center border-t border-white/[0.04] shrink-0">
          <p className="text-[14px] text-white/30">
            {isRu
              ? "Тарифицируется отдельно от подписки Мира. Ежемесячная оплата."
              : "Billed separately from Mira subscription. Billed monthly."}
          </p>
        </div>
      </div>
    </div>
  );
}
