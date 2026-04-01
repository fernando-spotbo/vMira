"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, AlertTriangle, Info, Lightbulb } from "lucide-react";

export function CodeBlock({ title, code, language }: { title?: string; code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      {title && (
        <div className="flex items-center justify-between px-5 py-3 bg-white/[0.03] border-b border-white/[0.04]">
          <span className="text-[13px] font-medium text-white/50">{title}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-white/20 hover:text-white/50 transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <pre className="px-5 py-4 bg-[#0f0f0f] text-[13px] font-mono text-white/70 leading-7 overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}

export function Note({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warning" | "tip" }) {
  const config = {
    info: { icon: <Info size={16} />, border: "border-blue-500/20", bg: "bg-blue-500/5", text: "text-blue-400" },
    warning: { icon: <AlertTriangle size={16} />, border: "border-amber-500/20", bg: "bg-amber-500/5", text: "text-amber-400" },
    tip: { icon: <Lightbulb size={16} />, border: "border-emerald-500/20", bg: "bg-emerald-500/5", text: "text-emerald-400" },
  }[type];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 mb-6 flex gap-3`}>
      <span className={`${config.text} shrink-0 mt-0.5`}>{config.icon}</span>
      <div className="text-[14px] text-white/70 leading-relaxed">{children}</div>
    </div>
  );
}

export function ParamTable({ params }: { params: { name: string; type: string; required: boolean; desc: string }[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      {params.map((p, i) => (
        <div
          key={p.name}
          className={`grid grid-cols-[150px_80px_80px_1fr] gap-4 px-5 py-3 text-[13px] ${
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
  return <h1 className="text-[28px] font-bold text-white mb-3">{children}</h1>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[20px] font-bold text-white mb-4 mt-10">{children}</h2>;
}
export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[16px] font-semibold text-white mb-3 mt-6">{children}</h3>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-white/80 leading-[1.8] mb-4">{children}</p>;
}
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/[0.06] border border-white/[0.06] px-1.5 py-0.5 rounded text-[13px] font-mono">
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
          <p className="text-[13px] text-white/40">{c.desc}</p>
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
      <div className={`grid gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider`} style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
        {headers.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className={`grid gap-4 px-5 py-4 text-[14px] ${ri < rows.length - 1 ? "border-b border-white/[0.03]" : ""}`} style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
          {row.map((cell, ci) => (
            <span key={ci} className={ci === 0 ? "font-mono font-medium text-white" : "text-white/50"}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color = method === "GET" ? "text-blue-400 bg-blue-500/10" : method === "POST" ? "text-emerald-400 bg-emerald-500/10" : method === "DELETE" ? "text-red-400 bg-red-500/10" : "text-amber-400 bg-amber-500/10";
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 text-[14px] border-b border-white/[0.03] last:border-b-0">
      <span className={`text-[12px] font-mono font-bold ${color} px-2 py-0.5 rounded`}>{method}</span>
      <code className="font-mono text-white/70">{path}</code>
      <span className="text-white/40 ml-auto">{desc}</span>
    </div>
  );
}
