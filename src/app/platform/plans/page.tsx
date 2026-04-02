"use client";

import { useState, useEffect } from "react";
import { Zap, Loader2 } from "lucide-react";
import MiraCodePricingModal from "@/components/MiraCodePricingModal";
import PricingModal from "@/components/PricingModal";
import { apiCall } from "@/lib/api-client";

// ---- Types ----

interface UserInfo {
  plan: string;
  balance_kopecks: number;
  daily_messages_used: number;
  allow_overage_billing: boolean;
}

// ---- Plan config ----

function planConfig(plan: string) {
  switch (plan) {
    case "pro": return { name: "Pro", chatLimit: 5000, apiLimit: 500 };
    case "max": return { name: "Max", chatLimit: -1, apiLimit: -1 };
    case "enterprise": return { name: "Enterprise", chatLimit: -1, apiLimit: -1 };
    default: return { name: "Free", chatLimit: 1000, apiLimit: 20 };
  }
}

// ---- Components ----

function UsageRing({ used, limit, size = 120 }: { used: number; limit: number; size?: number }) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0.05 : Math.min(used / limit, 1);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const isHigh = !isUnlimited && pct >= 0.8;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={isHigh ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)"}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[24px] font-medium text-white tabular-nums">{used}</span>
        <span className="text-[14px] text-white/25">{isUnlimited ? "/ ∞" : `/ ${limit}`}</span>
      </div>
    </div>
  );
}

function SubscriptionBlock({
  title,
  subtitle,
  planName,
  used,
  limit,
  unit,
  onUpgrade,
}: {
  title: string;
  subtitle: string;
  planName: string;
  used: number;
  limit: number;
  unit: string;
  onUpgrade: () => void;
}) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : Math.round((used / limit) * 100);
  const isHigh = !isUnlimited && pct >= 80;

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <div>
          <h2 className="text-[16px] font-medium text-white">{title}</h2>
          <p className="text-[14px] text-white/30 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[14px] text-white/40">{planName}</span>
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3.5 py-2 text-[14px] text-white/60 hover:bg-white/[0.1] hover:text-white/80 transition-all"
          >
            <Zap size={14} />
            Сменить план
          </button>
        </div>
      </div>

      {/* Usage */}
      <div className="px-6 py-6 flex items-center gap-8">
        <UsageRing used={used} limit={limit} />
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[14px] text-white/50">
                {used} {isUnlimited ? "" : `из ${limit}`} {unit} сегодня
              </span>
              {!isUnlimited && (
                <span className={`text-[14px] tabular-nums ${isHigh ? "text-white/70" : "text-white/30"}`}>{pct}%</span>
              )}
              {isUnlimited && (
                <span className="text-[14px] text-white/30">Безлимит</span>
              )}
            </div>
            {!isUnlimited && (
              <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${isHigh ? "bg-white/40" : "bg-white/15"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[14px] text-white/20">Сброс лимита: 00:00 UTC</span>
        {!isUnlimited && limit - used <= 5 && limit - used > 0 && (
          <span className="text-[14px] text-white/40">Осталось {limit - used}</span>
        )}
        {!isUnlimited && used >= limit && (
          <span className="text-[14px] text-white/50">Лимит исчерпан</span>
        )}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [miraPricingOpen, setMiraPricingOpen] = useState(false);
  const [codePricingOpen, setCodePricingOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiCall<UserInfo>("/auth/me");
        if (res.ok) setUser(res.data);
      } catch (e) {
        console.error("Failed to load user info:", e);
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

  const plan = planConfig(user?.plan ?? "free");

  return (
    <div className="max-w-[860px] mx-auto">
      {miraPricingOpen && <PricingModal onClose={() => setMiraPricingOpen(false)} />}
      {codePricingOpen && <MiraCodePricingModal onClose={() => setCodePricingOpen(false)} />}

      <div className="mb-8">
        <h1 className="text-[24px] font-medium text-white">Подписки</h1>
        <p className="text-[15px] text-white/40 mt-2">Использование лимитов и управление тарифами.</p>
      </div>

      <div className="space-y-6">
        <SubscriptionBlock
          title="Мира"
          subtitle="AI-ассистент"
          planName={plan.name}
          used={user?.daily_messages_used ?? 0}
          limit={plan.chatLimit}
          unit="сообщений"
          onUpgrade={() => setMiraPricingOpen(true)}
        />

        <SubscriptionBlock
          title="Mira Code"
          subtitle="AI для разработчиков"
          planName={plan.name}
          used={0}
          limit={plan.apiLimit}
          unit="запросов"
          onUpgrade={() => setCodePricingOpen(true)}
        />
      </div>

      {/* ── Overage billing opt-in ── */}
      <div className="mt-6 rounded-xl border border-white/[0.06] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <h3 className="text-[15px] font-medium text-white">Продолжить за баланс</h3>
            <p className="text-[13px] text-white/30 mt-1 leading-relaxed">
              Когда дневной лимит исчерпан, продолжить использование за счёт баланса по тарифу за токен.
              {(user?.balance_kopecks ?? 0) > 0 && (
                <span className="text-white/40"> Баланс: {((user?.balance_kopecks ?? 0) / 100).toFixed(2)} ₽</span>
              )}
            </p>
          </div>
          <button
            onClick={async () => {
              if (!user) return;
              const newValue = !user.allow_overage_billing;
              try {
                await apiCall("/auth/me", {
                  method: "PATCH",
                  body: JSON.stringify({ allow_overage_billing: newValue }),
                });
                setUser({ ...user, allow_overage_billing: newValue });
              } catch (e) {
                console.error("Failed to toggle overage billing:", e);
              }
            }}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
              user?.allow_overage_billing ? "bg-white/30" : "bg-white/[0.08]"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                user?.allow_overage_billing ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
