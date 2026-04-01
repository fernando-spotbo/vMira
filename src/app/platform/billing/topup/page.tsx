"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Smartphone,
  Wallet,
  Shield,
  FileText,
  Zap,
  Brain,
  Rocket,
  Gem,
  Check,
  Loader2,
} from "lucide-react";

// ---- Pricing per 1K tokens (in kopecks) ----

const models = [
  { key: "mira", label: "Mira Fast", icon: Zap, color: "#4ade80", input_1k: 10, output_1k: 30 },
  { key: "mira-thinking", label: "Mira Thinking", icon: Brain, color: "#60a5fa", input_1k: 15, output_1k: 50 },
  { key: "mira-pro", label: "Mira Pro", icon: Rocket, color: "#c084fc", input_1k: 30, output_1k: 90 },
  { key: "mira-max", label: "Mira Max", icon: Gem, color: "#f472b6", input_1k: 150, output_1k: 600 },
];

const presets = [100, 500, 1000, 5000];

type PaymentMethod = "card" | "sbp" | "yoomoney";

const paymentMethods: { id: PaymentMethod; label: string; desc: string; icon: typeof CreditCard }[] = [
  { id: "card", label: "Банковская карта", desc: "Visa, Mastercard, МИР", icon: CreditCard },
  { id: "sbp", label: "СБП", desc: "Система быстрых платежей", icon: Smartphone },
  { id: "yoomoney", label: "YooMoney", desc: "Кошелёк ЮMoney", icon: Wallet },
];

function estimateMessages(amountRubles: number, model: typeof models[number]): string {
  // Average message: ~300 input tokens, ~500 output tokens
  const avgInputTokens = 300;
  const avgOutputTokens = 500;
  const costPerMsg = (avgInputTokens / 1000) * model.input_1k + (avgOutputTokens / 1000) * model.output_1k;
  const costPerMsgRubles = costPerMsg / 100; // kopecks to rubles
  const msgs = Math.floor(amountRubles / costPerMsgRubles);
  if (msgs >= 1000) return `~${(msgs / 1000).toFixed(0)}K`;
  return `~${msgs}`;
}

function formatEstimateTokens(amountRubles: number, model: typeof models[number]): string {
  // How many output tokens you can get for this amount
  const kopecks = amountRubles * 100;
  const tokens = Math.floor(kopecks / model.output_1k * 1000);
  if (tokens >= 1_000_000) return `~${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `~${(tokens / 1000).toFixed(0)}K`;
  return `~${tokens}`;
}

export default function TopupPage() {
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(false);

  const effectiveAmount = isCustom ? (Number(customAmount) || 0) : selectedAmount;

  const handlePreset = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount("");
  }, []);

  const handleCustomFocus = useCallback(() => {
    setIsCustom(true);
  }, []);

  const handlePay = useCallback(async () => {
    if (effectiveAmount < 10) return;
    setLoading(true);
    // In production: const result = await createTopup(effectiveAmount, window.location.origin + "/billing/success");
    // For now, simulate redirect:
    await new Promise((r) => setTimeout(r, 1500));
    window.location.href = "/billing/success";
  }, [effectiveAmount]);

  return (
    <div className="max-w-[640px] mx-auto">
      {/* Back link */}
      <Link
        href="/billing"
        className="inline-flex items-center gap-2 text-[13px] text-white/40 hover:text-white/60 transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Назад к биллингу
      </Link>

      {/* Title */}
      <h1 className="text-[26px] font-bold text-white mb-2">Пополнение баланса</h1>
      <p className="text-[15px] text-white/40 mb-8">Выберите сумму и способ оплаты.</p>

      {/* Amount selection */}
      <div className="rounded-xl border border-white/[0.06] p-6 mb-6">
        <h3 className="text-[14px] font-medium text-white/70 mb-4">Сумма пополнения</h3>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {presets.map((amount) => (
            <button
              key={amount}
              onClick={() => handlePreset(amount)}
              className={`rounded-lg py-3 text-[15px] font-medium transition-all ${
                !isCustom && selectedAmount === amount
                  ? "bg-white text-[#161616] shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                  : "bg-white/[0.04] text-white/60 border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.1]"
              }`}
            >
              {amount.toLocaleString("ru-RU")} &#8381;
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="relative">
          <input
            type="number"
            min="10"
            max="100000"
            placeholder="Другая сумма"
            value={customAmount}
            onChange={(e) => { setCustomAmount(e.target.value); setIsCustom(true); }}
            onFocus={handleCustomFocus}
            className={`w-full rounded-lg border px-4 py-3 text-[15px] text-white placeholder-white/30 bg-white/[0.04] focus:outline-none transition-colors ${
              isCustom
                ? "border-white/[0.15] bg-white/[0.06]"
                : "border-white/[0.06] hover:border-white/[0.1]"
            }`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-white/30">&#8381;</span>
        </div>

        {effectiveAmount > 0 && effectiveAmount < 10 && (
          <p className="text-[12px] text-red-400/70 mt-2">Минимальная сумма: 10 &#8381;</p>
        )}
      </div>

      {/* Payment method */}
      <div className="rounded-xl border border-white/[0.06] p-6 mb-6">
        <h3 className="text-[14px] font-medium text-white/70 mb-4">Способ оплаты</h3>
        <div className="space-y-2">
          {paymentMethods.map((pm) => {
            const active = method === pm.id;
            const Icon = pm.icon;
            return (
              <button
                key={pm.id}
                onClick={() => setMethod(pm.id)}
                className={`w-full flex items-center gap-4 rounded-lg border px-4 py-3.5 transition-all text-left ${
                  active
                    ? "border-white/[0.15] bg-white/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    active ? "bg-white/[0.1]" : "bg-white/[0.04]"
                  }`}
                >
                  <Icon size={18} className={active ? "text-white/80" : "text-white/40"} />
                </div>
                <div className="flex-1">
                  <p className={`text-[14px] font-medium ${active ? "text-white" : "text-white/70"}`}>{pm.label}</p>
                  <p className="text-[12px] text-white/30">{pm.desc}</p>
                </div>
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    active ? "border-white bg-white" : "border-white/20"
                  }`}
                >
                  {active && <Check size={12} className="text-[#161616]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Estimated usage */}
      {effectiveAmount >= 10 && (
        <div className="rounded-xl border border-white/[0.06] p-6 mb-6">
          <h3 className="text-[14px] font-medium text-white/70 mb-4">На что хватит {effectiveAmount.toLocaleString("ru-RU")} &#8381;</h3>
          <div className="grid grid-cols-2 gap-3">
            {models.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.key}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-md"
                      style={{ backgroundColor: m.color + "18" }}
                    >
                      <Icon size={12} style={{ color: m.color }} />
                    </div>
                    <span className="text-[13px] text-white/70 font-medium">{m.label}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[12px] text-white/30">Сообщений</span>
                      <span className="text-[12px] text-white/60 font-medium">{estimateMessages(effectiveAmount, m)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[12px] text-white/30">Токенов (выход)</span>
                      <span className="text-[12px] text-white/60 font-medium">{formatEstimateTokens(effectiveAmount, m)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={loading || effectiveAmount < 10}
        className={`w-full rounded-xl py-4 text-[16px] font-semibold transition-all flex items-center justify-center gap-2 ${
          effectiveAmount >= 10 && !loading
            ? "bg-white text-[#161616] hover:bg-white/90 active:scale-[0.99]"
            : "bg-white/[0.06] text-white/30 cursor-not-allowed"
        }`}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Обработка...
          </>
        ) : (
          <>
            Оплатить {effectiveAmount >= 10 ? `${effectiveAmount.toLocaleString("ru-RU")} \u20BD` : ""}
          </>
        )}
      </button>

      {/* Security badges */}
      <div className="flex items-center justify-center gap-6 mt-6 mb-4">
        <div className="flex items-center gap-1.5 text-[11px] text-white/25">
          <Shield size={12} />
          Безопасная оплата через YooKassa
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-white/25">
          <FileText size={12} />
          Чек по 54-ФЗ
        </div>
      </div>

      <p className="text-center text-[11px] text-white/20 leading-relaxed mb-4">
        Нажимая &laquo;Оплатить&raquo;, вы соглашаетесь с{" "}
        <Link href="/legal/terms" className="underline underline-offset-2 hover:text-white/40 transition-colors">условиями использования</Link>{" "}
        и{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-white/40 transition-colors">политикой конфиденциальности</Link>.
      </p>
    </div>
  );
}
