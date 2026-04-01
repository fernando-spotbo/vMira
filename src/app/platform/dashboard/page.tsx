"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, Plus, Key, ArrowUpRight } from "lucide-react";

export default function DashboardPage() {
  const [copied, setCopied] = useState(false);
  const orgId = "org-mira-demo-12345";

  const handleCopy = () => {
    navigator.clipboard.writeText(orgId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-[900px] mx-auto">
      {/* Greeting — centered */}
      <h1 className="text-[22px] font-medium text-white/80 text-center pt-10 pb-10" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
        Good evening, User
      </h1>

      {/* Action buttons — 3 in a row, centered */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <Link
          href="/api-keys"
          className="flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] py-4 text-[15px] text-white/70 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
        >
          <Plus size={16} />
          Create API key
        </Link>
        <Link
          href="/api-keys"
          className="flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] py-4 text-[15px] text-white/70 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
        >
          <Key size={16} />
          View API keys
        </Link>
        <Link
          href="/usage"
          className="flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] py-4 text-[15px] text-white/70 hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
        >
          <ArrowUpRight size={16} />
          View usage
        </Link>
      </div>

      {/* Org ID */}
      <div className="flex items-center gap-3 mb-10 rounded-xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
        <span className="text-[13px] text-white/40">Organization ID</span>
        <code className="text-[13px] font-mono text-white/70 bg-white/[0.06] rounded px-2 py-0.5">{orgId}</code>
        <button onClick={handleCopy} className="text-white/30 hover:text-white/60 transition-colors">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-white/[0.06] p-6">
          <p className="text-[13px] text-white/40 mb-2">API requests today</p>
          <p className="text-[24px] font-semibold text-white">0</p>
          <p className="text-[12px] text-white/25 mt-1">Free trial: 100K tokens</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-6">
          <p className="text-[13px] text-white/40 mb-2">Tokens used</p>
          <p className="text-[24px] font-semibold text-white">0</p>
          <p className="text-[12px] text-white/25 mt-1">of 100,000 free</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-6">
          <p className="text-[13px] text-white/40 mb-2">Active API keys</p>
          <p className="text-[24px] font-semibold text-white">0</p>
        </div>
      </div>
    </div>
  );
}
