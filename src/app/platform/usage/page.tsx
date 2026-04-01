"use client";

export default function UsagePage() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = [0, 0, 0, 0, 0, 0, 0];

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="mb-8">
        <h1 className="text-[22px] font-medium text-white">Usage</h1>
        <p className="text-[15px] text-white/40 mt-2">Monitor your API consumption and costs.</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-8">
        {["Today", "7 days", "30 days", "All time"].map((p, i) => (
          <button
            key={p}
            className={`rounded-xl px-4 py-2 text-[13px] transition-colors ${
              i === 1 ? "bg-white text-[#161616]" : "bg-white/[0.04] text-white/50 hover:bg-white/[0.06]"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total requests", value: "0" },
          { label: "Tokens used", value: "0" },
          { label: "Cost", value: "0,00 ₽" },
          { label: "Avg latency", value: "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] p-5">
            <p className="text-[12px] text-white/40 mb-1">{s.label}</p>
            <p className="text-[22px] font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="rounded-xl border border-white/[0.06] p-6 mb-10">
        <h3 className="text-[15px] font-medium text-white mb-6">Requests this week</h3>
        <div className="flex items-end gap-3 h-[180px]">
          {days.map((d, i) => (
            <div key={d} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-white/[0.04] rounded-t" style={{ height: Math.max(values[i] * 2, 4) }} />
              <span className="text-[11px] text-white/30">{d}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center text-[14px] text-white/30">No usage data yet. Make your first API call to see stats.</div>
      </div>

      {/* Pricing */}
      <h2 className="text-[15px] font-medium text-white mb-4">Pricing</h2>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider">
          <span>Tier</span><span>Price</span><span>Notes</span>
        </div>
        {[
          { tier: "Standard", price: "300 RUB / 1M tokens", note: "~$3.15 USD" },
          { tier: "Batch", price: "150 RUB / 1M tokens", note: "Async, lower priority" },
          { tier: "Free trial", price: "Free", note: "100K tokens for new accounts" },
        ].map((r) => (
          <div key={r.tier} className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-white/[0.03] last:border-0 text-[14px]">
            <span className="font-medium text-white">{r.tier}</span>
            <span className="text-white/80">{r.price}</span>
            <span className="text-white/40">{r.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
