"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, AlertTriangle, Info, Lightbulb } from "lucide-react";

/*
 * Typography scale (3 sizes only):
 *   Body / code / labels:  15px (prose) · 14px (mono/code) · 13px (table headers only)
 *   Headings:              24px · 18px · 16px
 */

export function CodeBlock({ title, code }: { title?: string; code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      {title && (
        <div className="flex items-center justify-between px-5 py-3 bg-white/[0.03] border-b border-white/[0.04]">
          <span className="text-[14px] font-medium text-white/50">{title}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1.5 text-[14px] text-white/25 hover:text-white/60 transition-colors"
          >
            {copied ? <><Check size={14} /> <span>Copied</span></> : <><Copy size={14} /> <span>Copy</span></>}
          </button>
        </div>
      )}
      <pre className="px-5 py-4 bg-[#0f0f0f] text-[14px] font-mono text-white/70 leading-7 overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}

export function Note({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warning" | "tip" }) {
  const icons = { info: <Info size={16} />, warning: <AlertTriangle size={16} />, tip: <Lightbulb size={16} /> };
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 mb-6 flex gap-3">
      <span className="text-white/40 shrink-0 mt-0.5">{icons[type]}</span>
      <div className="text-[15px] text-white/70 leading-relaxed">{children}</div>
    </div>
  );
}

export function ParamTable({ params }: { params: { name: string; type: string; required: boolean; desc: string }[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      {params.map((p, i) => (
        <div
          key={p.name}
          className={`grid grid-cols-[150px_80px_80px_1fr] gap-4 px-5 py-3.5 text-[14px] ${
            i < params.length - 1 ? "border-b border-white/[0.03]" : ""
          }`}
        >
          <code className="font-mono font-medium text-white">{p.name}</code>
          <span className="text-white/40">{p.type}</span>
          <span className={p.required ? "text-white" : "text-white/30"}>
            {p.required ? "Required" : "Optional"}
          </span>
          <span className="text-white/50">{p.desc}</span>
        </div>
      ))}
    </div>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[24px] font-medium text-white mb-3">{children}</h1>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[18px] font-medium text-white mb-4 mt-10">{children}</h2>;
}
export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[16px] font-medium text-white mb-3 mt-6">{children}</h3>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-white/80 leading-[1.8] mb-4">{children}</p>;
}
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/[0.06] border border-white/[0.06] px-1.5 py-0.5 rounded text-[14px] font-mono">
      {children}
    </code>
  );
}
export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/60 transition-colors">
      {children}
    </Link>
  );
}

export function NavCards({ cards }: { cards: { href: string; title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {cards.map(c => (
        <Link key={c.href} href={c.href} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
          <h3 className="text-[15px] font-medium text-white mb-1">{c.title}</h3>
          <p className="text-[14px] text-white/40">{c.desc}</p>
        </Link>
      ))}
    </div>
  );
}

export function UL({ items }: { items: { bold: string; text: string }[] }) {
  return (
    <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-white/80 leading-relaxed">
      {items.map((item, i) => (
        <li key={i}><strong className="text-white">{item.bold}</strong> — {item.text}</li>
      ))}
    </ul>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      <div className="grid gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[13px] font-medium text-white/40 uppercase tracking-wider" style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
        {headers.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className={`grid gap-4 px-5 py-4 text-[15px] ${ri < rows.length - 1 ? "border-b border-white/[0.03]" : ""}`} style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
          {row.map((cell, ci) => (
            <span key={ci} className={ci === 0 ? "font-mono font-medium text-white" : "text-white/50"}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CostCard({ model, scenario, desc, volume, costs, total }: {
  model: string;
  scenario: string;
  desc: string;
  volume: { label: string; calc: string; result: string }[];
  costs: { label: string; calc: string; result: string }[];
  total: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.03] border-b border-white/[0.04]">
        <span className="text-[14px] font-mono font-medium text-white/60 bg-white/[0.06] px-2.5 py-0.5 rounded">{model}</span>
        <span className="text-[15px] font-medium text-white/80">{scenario}</span>
      </div>

      <div className="px-5 py-4">
        <p className="text-[14px] text-white/40 mb-4">{desc}</p>

        <div className="space-y-2 mb-4">
          {volume.map((v, i) => (
            <div key={i} className="flex items-baseline gap-3 text-[14px] font-mono">
              <span className="text-white/35 w-[56px] shrink-0 text-right">{v.label}</span>
              <span className="text-white/50 flex-1">{v.calc}</span>
              <span className="text-white/60">{v.result}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.04] my-4" />

        <div className="space-y-2 mb-4">
          {costs.map((c, i) => (
            <div key={i} className="flex items-baseline gap-3 text-[14px] font-mono">
              <span className="text-white/35 w-[56px] shrink-0 text-right">{c.label}</span>
              <span className="text-white/50 flex-1">{c.calc}</span>
              <span className="text-white/80 font-medium">{c.result}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] my-4" />

        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-white/40">Total</span>
          <span className="text-[18px] font-medium text-white tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  );
}

export function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 text-[15px] border-b border-white/[0.03] last:border-b-0">
      <span className="text-[14px] font-mono font-medium text-white/60 bg-white/[0.06] px-2.5 py-0.5 rounded">{method}</span>
      <code className="font-mono text-white/70">{path}</code>
      <span className="text-white/40 ml-auto">{desc}</span>
    </div>
  );
}
