"use client";

import { useState } from "react";
import { Zap, ArrowUpRight } from "lucide-react";
import MiraCodePricingModal from "@/components/MiraCodePricingModal";
import PricingModal from "@/components/PricingModal";

// ---- Mock usage data (would come from API in production) ----

const miraPlan = {
  name: "Free",
  limit: 20,
  used: 14,
  unit: "сообщений",
  period: "сегодня",
  resetsAt: "00:00 МСК",
};

const codePlan = {
  name: "Free",
  limit: 50,
  used: 32,
  unit: "запросов",
  period: "сегодня",
  resetsAt: "00:00 МСК",
};

const miraHistory = [
  { date: "Пн", used: 18 },
  { date: "Вт", used: 20 },
  { date: "Ср", used: 15 },
  { date: "Чт", used: 20 },
  { date: "Пт", used: 12 },
  { date: "Сб", used: 7 },
  { date: "Вс", used: 14 },
];

const codeHistory = [
  { date: "Пн", used: 42 },
  { date: "Вт", used: 50 },
  { date: "Ср", used: 38 },
  { date: "Чт", used: 47 },
  { date: "Пт", used: 29 },
  { date: "Сб", used: 11 },
  { date: "Вс", used: 32 },
];

// ---- Component ----

function UsageRing({ used, limit, size = 120 }: { used: number; limit: number; size?: number }) {
  const pct = Math.min(used / limit, 1);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const isHigh = pct >= 0.8;

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
        <span className="text-[14px] text-white/25">/ {limit}</span>
      </div>
    </div>
  );
}

function UsageBar({ days, limit }: { days: { date: string; used: number }[]; limit: number }) {
  return (
    <div className="flex items-end gap-1.5 h-[60px]">
      {days.map((d) => {
        const pct = (d.used / limit) * 100;
        const isMax = d.used >= limit;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full relative" style={{ height: `${Math.max(pct, 4)}%` }}>
              <div className={`absolute inset-0 rounded-sm transition-colors ${isMax ? "bg-white/[0.25]" : "bg-white/[0.08] group-hover:bg-white/[0.14]"}`} />
            </div>
            <span className="text-[11px] text-white/20">{d.date}</span>
          </div>
        );
      })}
    </div>
  );
}

function SubscriptionBlock({
  title,
  subtitle,
  plan,
  history,
  onUpgrade,
}: {
  title: string;
  subtitle: string;
  plan: typeof miraPlan;
  history: typeof miraHistory;
  onUpgrade: () => void;
}) {
  const pct = Math.round((plan.used / plan.limit) * 100);
  const isHigh = pct >= 80;

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <div>
          <h2 className="text-[16px] font-medium text-white">{title}</h2>
          <p className="text-[14px] text-white/30 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[14px] text-white/40">
            {plan.name}
          </span>
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
        <UsageRing used={plan.used} limit={plan.limit} />

        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[14px] text-white/50">{plan.used} из {plan.limit} {plan.unit} {plan.period}</span>
              <span className={`text-[14px] tabular-nums ${isHigh ? "text-white/70" : "text-white/30"}`}>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${isHigh ? "bg-white/40" : "bg-white/15"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-[14px] text-white/25 mb-2">За неделю</p>
            <UsageBar days={history} limit={plan.limit} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[14px] text-white/20">Сброс лимита: {plan.resetsAt}</span>
        {plan.limit - plan.used <= 5 && plan.limit - plan.used > 0 && (
          <span className="text-[14px] text-white/40">Осталось {plan.limit - plan.used}</span>
        )}
        {plan.used >= plan.limit && (
          <span className="text-[14px] text-white/50">Лимит исчерпан</span>
        )}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [miraPricingOpen, setMiraPricingOpen] = useState(false);
  const [codePricingOpen, setCodePricingOpen] = useState(false);

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
          plan={miraPlan}
          history={miraHistory}
          onUpgrade={() => setMiraPricingOpen(true)}
        />

        <SubscriptionBlock
          title="Mira Code"
          subtitle="AI для разработчиков"
          plan={codePlan}
          history={codeHistory}
          onUpgrade={() => setCodePricingOpen(true)}
        />
      </div>
    </div>
  );
}
