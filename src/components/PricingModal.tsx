"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { X, Check, Zap, Brain, Rocket, Gem, ArrowRight, ExternalLink } from "lucide-react";
import { t } from "@/lib/i18n";

interface PricingModalProps {
  onClose: () => void;
}

// ---- Per-token model pricing ----

const modelPricing = [
  { key: "mira", label: "Mira Fast", icon: Zap, color: "#4ade80", input_1k: "0,10 \u20BD", output_1k: "0,30 \u20BD" },
  { key: "mira-thinking", label: "Mira Thinking", icon: Brain, color: "#60a5fa", input_1k: "0,15 \u20BD", output_1k: "0,50 \u20BD" },
  { key: "mira-pro", label: "Mira Pro", icon: Rocket, color: "#c084fc", input_1k: "0,30 \u20BD", output_1k: "0,90 \u20BD" },
  { key: "mira-max", label: "Mira Max", icon: Gem, color: "#f472b6", input_1k: "1,50 \u20BD", output_1k: "6,00 \u20BD" },
];

function getPlans() {
  return [
    {
      id: "free",
      name: t("plan.free"),
      price: 0,
      currency: "",
      period: "",
      description: t("pricing.freeDesc"),
      features: [
        t("pricing.f.free.1"),
        t("pricing.f.free.2"),
        t("pricing.f.free.3"),
        t("pricing.f.free.4"),
      ],
      models: ["Mira Fast"],
      buttonText: t("pricing.currentPlan"),
      current: true,
    },
    {
      id: "pro",
      name: t("plan.pro"),
      price: 199,
      currency: "\u20BD",
      period: t("pricing.mo"),
      description: t("pricing.proDesc"),
      features: [
        t("pricing.f.pro.1"),
        t("pricing.f.pro.2"),
        t("pricing.f.pro.3"),
        t("pricing.f.pro.4"),
        t("pricing.f.pro.5"),
        t("pricing.f.pro.6"),
        t("pricing.f.pro.7"),
      ],
      models: ["Mira Fast", "Mira Thinking", "Mira Pro"],
      buttonText: `${t("pricing.upgrade")} Pro`,
      popular: true,
    },
    {
      id: "max",
      name: t("plan.max"),
      price: 990,
      currency: "\u20BD",
      period: t("pricing.mo"),
      description: t("pricing.maxDesc"),
      features: [
        t("pricing.f.max.1"),
        t("pricing.f.max.2"),
        t("pricing.f.max.3"),
        t("pricing.f.max.4"),
        t("pricing.f.max.5"),
        t("pricing.f.max.6"),
        t("pricing.f.max.7"),
      ],
      models: ["Mira Fast", "Mira Thinking", "Mira Pro", "Mira Max"],
      buttonText: `${t("pricing.upgrade")} Max`,
    },
    {
      id: "enterprise",
      name: t("plan.enterprise"),
      price: -1,
      currency: "",
      period: "",
      description: t("pricing.enterpriseDesc"),
      features: [
        t("pricing.f.ent.1"),
        t("pricing.f.ent.2"),
        t("pricing.f.ent.3"),
        t("pricing.f.ent.4"),
        t("pricing.f.ent.5"),
        t("pricing.f.ent.6"),
        t("pricing.f.ent.7"),
      ],
      models: ["Все модели", "Дообучение"],
      buttonText: t("pricing.contactSales"),
    },
  ];
}

export default function PricingModal({ onClose }: PricingModalProps) {
  const [visible, setVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showTokenPricing, setShowTokenPricing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

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

  const plans = getPlans();

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[200] flex items-center justify-center px-4 transition-all duration-250 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-[1100px] max-h-[90vh] rounded-2xl bg-[#1a1a1a] border border-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-250 flex flex-col ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-2 shrink-0">
          <div>
            <h2 className="text-xl font-medium text-white">{t("pricing.title")}</h2>
            <p className="text-[16px] text-white/70 mt-1">{t("pricing.subtitle")}</p>
          </div>
          <button
            onClick={() => { setVisible(false); setTimeout(onClose, 250); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Plans grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-8 pt-6">
            {plans.map((plan) => (
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
                    {t("pricing.popular")}
                  </div>
                )}

                {plan.current && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white/[0.1] border border-white/[0.15] px-3 py-0.5 text-[11px] font-medium text-white/60">
                    {t("pricing.currentPlan")}
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-[16px] font-medium text-white">{plan.name}</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    {plan.price === 0 ? (
                      <span className="text-2xl font-semibold text-white">{t("plan.free")}</span>
                    ) : plan.price === -1 ? (
                      <span className="text-2xl font-semibold text-white">{t("pricing.custom")}</span>
                    ) : (
                      <>
                        <span className="text-2xl font-semibold text-white">{plan.price} {plan.currency}</span>
                        <span className="text-[16px] text-white/50">{plan.period}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[14px] text-white/60 mt-1">{plan.description}</p>
                </div>

                <ul className="flex-1 space-y-2.5 mb-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check size={14} className="shrink-0 mt-0.5 text-white" />
                      <span className="text-[14px] text-white">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !plan.current && handleSelect(plan.id)}
                  disabled={!!plan.current || selectedPlan === plan.id}
                  className={`w-full rounded-xl py-2.5 text-[16px] font-medium transition-all ${
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
                      {t("pricing.selected")}
                    </span>
                  ) : (
                    plan.buttonText
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Per-token pricing toggle */}
          <div className="px-8 pb-6">
            <button
              onClick={() => setShowTokenPricing(!showTokenPricing)}
              className="flex items-center gap-2 text-[13px] text-white/40 hover:text-white/60 transition-colors mb-4"
            >
              <span>{showTokenPricing ? "Скрыть цены за токен" : "Показать цены за токен"}</span>
              <ArrowRight size={12} className={`transition-transform duration-200 ${showTokenPricing ? "rotate-90" : ""}`} />
            </button>

            {showTokenPricing && (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-4">
                <div className="grid grid-cols-[1fr_100px_100px] gap-4 px-5 py-2.5 bg-white/[0.02] border-b border-white/[0.04] text-[11px] font-medium text-white/30 uppercase tracking-wider">
                  <span>Модель</span>
                  <span className="text-right">Ввод / 1K</span>
                  <span className="text-right">Вывод / 1K</span>
                </div>
                {modelPricing.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.key}
                      className="grid grid-cols-[1fr_100px_100px] gap-4 items-center px-5 py-3 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: m.color + "18" }}>
                          <Icon size={12} style={{ color: m.color }} />
                        </div>
                        <span className="text-[13px] text-white/80 font-medium">{m.label}</span>
                      </div>
                      <span className="text-[13px] text-white/60 text-right font-mono">{m.input_1k}</span>
                      <span className="text-[13px] text-white/60 text-right font-mono">{m.output_1k}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top-up link */}
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
              <div>
                <p className="text-[13px] text-white/60">Нужно пополнить баланс?</p>
                <p className="text-[11px] text-white/30 mt-0.5">Банковские карты, СБП, YooMoney</p>
              </div>
              <Link
                href="/platform/billing/topup"
                onClick={() => { setVisible(false); setTimeout(onClose, 250); }}
                className="flex items-center gap-2 rounded-lg bg-white/[0.06] border border-white/[0.08] px-4 py-2 text-[13px] text-white/60 hover:bg-white/[0.1] hover:text-white/80 transition-all"
              >
                Пополнить
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 text-center border-t border-white/[0.04] shrink-0">
          <p className="text-[13px] text-white/40">
            {t("pricing.footer")}
            {" "}
            <Link
              href="/platform/pricing"
              onClick={() => { setVisible(false); setTimeout(onClose, 250); }}
              className="underline underline-offset-2 hover:text-white/60 transition-colors"
            >
              Подробнее о ценах
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
