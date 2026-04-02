"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Zap,
  Rocket,
  Gem,
  Loader2,
  Bitcoin,
} from "lucide-react";
import { createTopup } from "@/lib/api-billing";

// ---- Pricing per 1K tokens (in kopecks, matching model_pricing table) ----

const models = [
  { key: "mira", label: "Mira Fast", icon: Zap, color: "#737373", input_1k: 10, output_1k: 30 },
  { key: "mira-pro", label: "Mira Pro", icon: Rocket, color: "#b5b5b5", input_1k: 30, output_1k: 90 },
  { key: "mira-max", label: "Mira Max", icon: Gem, color: "#e5e5e5", input_1k: 150, output_1k: 600 },
];

const presets = [100, 500, 1000, 5000];

function estimateMessages(amountRubles: number, model: typeof models[number]): string {
  const avgInputTokens = 300;
  const avgOutputTokens = 500;
  const costPerMsg = (avgInputTokens / 1000) * model.input_1k + (avgOutputTokens / 1000) * model.output_1k;
  const costPerMsgRubles = costPerMsg / 100;
  const msgs = Math.floor(amountRubles / costPerMsgRubles);
  if (msgs >= 1000) return `~${(msgs / 1000).toFixed(0)}K`;
  return `~${msgs}`;
}

function formatEstimateTokens(amountRubles: number, model: typeof models[number]): string {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount = isCustom ? (Number(customAmount) || 0) : selectedAmount;

  const handlePreset = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount("");
    setError(null);
  }, []);

  const handleCustomFocus = useCallback(() => {
    setIsCustom(true);
    setError(null);
  }, []);

  const handlePay = useCallback(async () => {
    if (effectiveAmount < 10) return;
    setLoading(true);
    setError(null);

    try {
      const result = await createTopup(effectiveAmount, window.location.origin + "/billing");
      // Redirect to CryptoCloud payment page
      window.location.href = result.payment_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка при создании платежа");
      setLoading(false);
    }
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
      <h1 className="text-[26px] font-medium text-white mb-2">Пополнение баланса</h1>
      <p className="text-[15px] text-white/40 mb-8">Оплата криптовалютой: BTC, ETH, USDT, TON и другие.</p>

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

      {/* Crypto info */}
      <div className="rounded-xl border border-white/[0.06] p-6 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
            <Bitcoin size={18} className="text-white/60" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-white/80">Оплата криптовалютой</p>
            <p className="text-[12px] text-white/30">BTC, ETH, USDT, USDC, TON, SOL, LTC, BNB и другие</p>
          </div>
        </div>
        <p className="text-[13px] text-white/25 leading-relaxed">
          После нажатия &laquo;Оплатить&raquo; вы будете перенаправлены на страницу CryptoCloud,
          где сможете выбрать криптовалюту и оплатить. Баланс зачисляется автоматически.
          Первое пополнение автоматически активирует план Pro.
        </p>
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

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 mb-4">
          <p className="text-[13px] text-red-400">{error}</p>
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
            Создание платежа...
          </>
        ) : (
          <>
            Оплатить {effectiveAmount >= 10 ? `${effectiveAmount.toLocaleString("ru-RU")} \u20BD` : ""}
          </>
        )}
      </button>

      {/* Security badge */}
      <div className="flex items-center justify-center gap-6 mt-6 mb-4">
        <div className="flex items-center gap-1.5 text-[11px] text-white/25">
          <Shield size={12} />
          Безопасная оплата через CryptoCloud
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
