"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap,
  Rocket,
  Gem,
  Check,
  ChevronDown,
  ArrowRight,
  MessageSquare,
  HelpCircle,
} from "lucide-react";

// ---- Data ----

const models = [
  {
    key: "mira",
    label: "Mira Fast",
    icon: Zap,
    color: "#737373",
    speed: "Мгновенно",
    speedIcon: "zap",
    input_1k: "0,05",
    output_1k: "0,15",
    best_for: "Быстрые вопросы, простые задачи",
  },
  {
    key: "mira-pro",
    label: "Mira Pro",
    icon: Rocket,
    color: "#b5b5b5",
    speed: "Продвинутый",
    speedIcon: "rocket",
    input_1k: "0,10",
    output_1k: "0,30",
    best_for: "Сложные рассуждения, код, аналитика",
  },
  {
    key: "mira-max",
    label: "Mira Max",
    icon: Gem,
    color: "#e5e5e5",
    speed: "Максимальный",
    speedIcon: "gem",
    input_1k: "0,25",
    output_1k: "0,75",
    best_for: "Критически важные задачи, исследования",
  },
];

const plans = [
  {
    id: "free",
    name: "Бесплатный",
    price: "0",
    period: "",
    description: "Начните с Мирой бесплатно",
    features: [
      "20 сообщений в день",
      "Только Mira Fast",
      "Стандартная скорость",
      "Текстовый чат",
      "Доступ в интернет",
    ],
    buttonText: "Начать бесплатно",
    buttonHref: "/",
    popular: false,
    current: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "199",
    period: "/мес",
    description: "Для продвинутых пользователей",
    features: [
      "500 сообщений в день",
      "Все модели (Fast, Pro)",
      "Режим размышлений (Pro, Max)",
      "Быстрые ответы",
      "Загрузка файлов",
      "Расширенный контекст",
      "Поиск в интернете",
    ],
    buttonText: "Перейти на Pro",
    buttonHref: "/billing/topup",
    popular: true,
    current: false,
  },
  {
    id: "max",
    name: "Max",
    price: "990",
    period: "/мес",
    description: "Без ограничений",
    features: [
      "Безлимит сообщений",
      "Все модели включая Max",
      "Максимальная скорость",
      "Голосовой ввод и вывод",
      "Понимание изображений",
      "Максимальный контекст",
      "Ранний доступ к функциям",
    ],
    buttonText: "Перейти на Max",
    buttonHref: "/billing/topup",
    popular: false,
    current: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "-1",
    period: "",
    description: "Для команд и компаний",
    features: [
      "Индивидуальные лимиты",
      "Все модели + дообучение",
      "Частное развёртывание (152-ФЗ)",
      "Гарантии SLA 99.9%",
      "SSO / SAML интеграция",
      "Выделенная поддержка",
      "Аудит и контроль доступа",
    ],
    buttonText: "Связаться",
    buttonHref: "mailto:enterprise@vmira.ai",
    popular: false,
    current: false,
  },
];

const faqItems = [
  {
    q: "Как работает оплата?",
    a: "Вы пополняете баланс через банковскую карту, СБП или YooMoney. Средства списываются за использование моделей по тарифу за токен. Минимальная сумма пополнения — 10 ₽.",
  },
  {
    q: "Что такое токен?",
    a: "Токен — это единица текста, примерно 3-4 символа на русском языке. Каждый запрос тратит токены на ввод (ваш вопрос) и вывод (ответ Миры). Средне сообщение — около 300 входных и 500 выходных токенов.",
  },
  {
    q: "Могу ли я отменить подписку?",
    a: "Да, вы можете отменить или изменить тариф в любое время. Неиспользованный баланс сохраняется и не сгорает.",
  },
  {
    q: "Есть ли возвраты?",
    a: "Если произошла ошибка API и ответ не был доставлен, средства автоматически возвращаются на баланс. Для возврата на банковскую карту обратитесь в поддержку.",
  },
  {
    q: "Какие способы оплаты поддерживаются?",
    a: "Банковские карты (Visa, Mastercard, МИР), СБП (Система быстрых платежей), YooMoney. Все платежи обрабатываются через YooKassa с выдачей чека по 54-ФЗ.",
  },
  {
    q: "Есть ли API для разработчиков?",
    a: "Да, Mira API полностью совместим с OpenAI API. Подключите свой API-ключ и используйте модели через REST API. Биллинг за API — отдельный, по тарифу за токен.",
  },
];

// ---- Component ----

export default function PricingPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="max-w-[960px] mx-auto">
      {/* Header */}
      <div className="text-center mb-12 pt-4">
        <h1 className="text-[32px] font-medium text-white mb-3">Цены</h1>
        <p className="text-[16px] text-white/50 max-w-md mx-auto">
          Прозрачная оплата за использование. Платите только за то, что используете.
        </p>
      </div>

      {/* Model comparison table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-12">
        <div className="px-6 py-4 border-b border-white/[0.04] bg-white/[0.02]">
          <h2 className="text-[17px] font-semibold text-white">Стоимость моделей</h2>
          <p className="text-[13px] text-white/40 mt-1">Цена за 1 000 токенов</p>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_120px_120px_120px_1fr] gap-4 px-6 py-3 bg-white/[0.02] border-b border-white/[0.04] text-[11px] font-medium text-white/30 uppercase tracking-wider">
            <span>Модель</span>
            <span>Скорость</span>
            <span className="text-right">Ввод / 1K</span>
            <span className="text-right">Вывод / 1K</span>
            <span>Подходит для</span>
          </div>

          {/* Rows */}
          {models.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className="grid grid-cols-[1fr_120px_120px_120px_1fr] gap-4 items-center px-6 py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: m.color + "18" }}
                  >
                    <Icon size={16} style={{ color: m.color }} />
                  </div>
                  <span className="text-[14px] text-white font-medium">{m.label}</span>
                </div>
                <span className="text-[13px] text-white/50">{m.speed}</span>
                <span className="text-[14px] text-white/80 text-right font-mono">{m.input_1k} &#8381;</span>
                <span className="text-[14px] text-white/80 text-right font-mono">{m.output_1k} &#8381;</span>
                <span className="text-[13px] text-white/40">{m.best_for}</span>
              </div>
            );
          })}
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-white/[0.03]">
          {models.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.key} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: m.color + "18" }}
                  >
                    <Icon size={16} style={{ color: m.color }} />
                  </div>
                  <div>
                    <p className="text-[14px] text-white font-medium">{m.label}</p>
                    <p className="text-[12px] text-white/40">{m.speed}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] text-white/30">Ввод / 1K</p>
                    <p className="text-[14px] text-white/80 font-mono">{m.input_1k} &#8381;</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] text-white/30">Вывод / 1K</p>
                    <p className="text-[14px] text-white/80 font-mono">{m.output_1k} &#8381;</p>
                  </div>
                </div>
                <p className="text-[12px] text-white/30">{m.best_for}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plans comparison */}
      <div className="mb-12">
        <h2 className="text-[20px] font-medium text-white text-center mb-2">Тарифные планы</h2>
        <p className="text-[14px] text-white/40 text-center mb-8">Обновите в любое время. Отмените когда угодно.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-xl border p-6 transition-all ${
                plan.popular
                  ? "border-white/[0.15] bg-white/[0.04]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-0.5 text-[11px] font-semibold text-[#161616]">
                  Популярный
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-[18px] font-semibold text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  {plan.price === "0" ? (
                    <span className="text-[28px] font-medium text-white">Бесплатно</span>
                  ) : plan.price === "-1" ? (
                    <span className="text-[28px] font-medium text-white">Индивидуально</span>
                  ) : (
                    <>
                      <span className="text-[28px] font-medium text-white">{plan.price}</span>
                      <span className="text-[16px] text-white/40">&#8381;{plan.period}</span>
                    </>
                  )}
                </div>
                <p className="text-[13px] text-white/40 mt-1">{plan.description}</p>
              </div>

              <ul className="flex-1 space-y-3 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={14} className="shrink-0 mt-0.5 text-white/60" />
                    <span className="text-[13px] text-white/70">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.buttonHref}
                className={`w-full rounded-xl py-3 text-[14px] font-medium text-center transition-all ${
                  plan.popular
                    ? "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.98]"
                    : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1] border border-white/[0.06]"
                }`}
              >
                {plan.buttonText}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-12">
        <h2 className="text-[20px] font-medium text-white text-center mb-2">Часто задаваемые вопросы</h2>
        <p className="text-[14px] text-white/40 text-center mb-8">Ответы на популярные вопросы о ценах и оплате</p>

        <div className="space-y-2">
          {faqItems.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.06] overflow-hidden transition-colors hover:border-white/[0.1]"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle size={16} className="text-white/30 shrink-0" />
                  <span className="text-[14px] text-white/80 font-medium">{item.q}</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-white/30 shrink-0 transition-transform duration-200 ${
                    expandedFaq === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {expandedFaq === i && (
                <div className="px-6 pb-5 pt-0">
                  <p className="text-[13px] text-white/50 leading-relaxed pl-[28px]">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center mb-4">
        <h3 className="text-[20px] font-medium text-white mb-2">Готовы начать?</h3>
        <p className="text-[14px] text-white/40 mb-6 max-w-md mx-auto">
          Начните бесплатно с 20 сообщениями в день или пополните баланс для полного доступа ко всем моделям.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[14px] font-medium text-[#161616] hover:bg-white/90 transition-colors"
          >
            <MessageSquare size={16} />
            Начать бесплатно
          </Link>
          <Link
            href="/billing/topup"
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-[14px] text-white/70 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all"
          >
            Пополнить баланс
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-[12px] text-white/20 mt-4 mb-2">
        Цены указаны в российских рублях. API тарифицируется отдельно.
        Все платежи обрабатываются через сертифицированную YooKassa.
      </p>
    </div>
  );
}
