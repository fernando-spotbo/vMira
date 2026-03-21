"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

function CodeExample({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      <div className="flex items-center justify-between px-5 py-3 bg-white/[0.03] border-b border-white/[0.04]">
        <span className="text-[13px] font-medium text-white/50">{title}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-white/20 hover:text-white/50 transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="px-5 py-4 bg-[#0f0f0f] text-[13px] font-mono text-white/70 leading-7 overflow-x-auto">{code}</pre>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="max-w-[740px] mx-auto">
      <div className="mb-10">
        <h1 className="text-[26px] font-bold text-white">Documentation</h1>
        <p className="text-[15px] text-white/40 mt-2">Everything you need to integrate with the Mira API.</p>
      </div>

      {/* Quick start */}
      <section className="mb-12">
        <h2 className="text-[20px] font-bold text-white mb-4">Quick start</h2>
        <p className="text-[15px] text-white/80 leading-[1.8] mb-6">
          The Mira API is compatible with the OpenAI format, making migration easy. Authenticate with your API key and send requests to our endpoints.
        </p>

        <h3 className="text-[16px] font-semibold text-white mb-3">Base URL</h3>
        <code className="block rounded-lg bg-white/[0.03] border border-white/[0.04] px-4 py-3 text-[14px] font-mono text-white mb-6">
          https://api.mira.ai/v1
        </code>

        <h3 className="text-[16px] font-semibold text-white mb-3">Authentication</h3>
        <p className="text-[15px] text-white/80 leading-[1.8] mb-4">
          Include your API key in the <code className="bg-white/[0.03] border border-white/[0.04] px-1.5 py-0.5 rounded text-[13px] font-mono">Authorization</code> header.
        </p>

        <CodeExample
          title="cURL"
          code={`curl https://api.mira.ai/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira",
    "messages": [
      {"role": "user", "content": "Hello, Mira!"}
    ]
  }'`}
        />
      </section>

      {/* Chat completions */}
      <section className="mb-12">
        <h2 className="text-[20px] font-bold text-white mb-4">Chat completions</h2>
        <p className="text-[15px] text-white/80 leading-[1.8] mb-6">
          Send a conversation and receive a response from the model.
        </p>

        <h3 className="text-[16px] font-semibold text-white mb-3">Request body</h3>
        <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
          {[
            { param: "model", type: "string", req: "Required", desc: '"mira"' },
            { param: "messages", type: "array", req: "Required", desc: "Array of message objects" },
            { param: "temperature", type: "number", req: "Optional", desc: "0 to 1, default 0.7" },
            { param: "max_tokens", type: "integer", req: "Optional", desc: "Maximum tokens to generate" },
            { param: "stream", type: "boolean", req: "Optional", desc: "Stream response tokens" },
          ].map((p, i) => (
            <div key={p.param} className={`grid grid-cols-[140px_80px_80px_1fr] gap-4 px-5 py-3 text-[13px] ${i < 4 ? "border-b border-white/[0.03]" : ""}`}>
              <code className="font-mono font-medium text-white">{p.param}</code>
              <span className="text-white/40">{p.type}</span>
              <span className={p.req === "Required" ? "text-white" : "text-white/30"}>{p.req}</span>
              <span className="text-white/50">{p.desc}</span>
            </div>
          ))}
        </div>

        <CodeExample
          title="Python"
          code={`import requests

response = requests.post(
    "https://api.mira.ai/v1/chat/completions",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={
        "model": "mira",
        "messages": [
            {"role": "user", "content": "Explain quantum computing"}
        ]
    }
)

print(response.json()["choices"][0]["message"]["content"])`}
        />

        <CodeExample
          title="JavaScript"
          code={`const response = await fetch("https://api.mira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    messages: [{ role: "user", content: "Hello!" }],
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`}
        />
      </section>

      {/* Models */}
      <section className="mb-12">
        <h2 className="text-[20px] font-bold text-white mb-4">Models</h2>
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="grid grid-cols-3 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider">
            <span>Model</span><span>Description</span><span>Context</span>
          </div>
          {[
            { model: "mira", desc: "Default model, best for most tasks", ctx: "4K tokens" },
            { model: "mira-thinking", desc: "Deep reasoning with thought traces", ctx: "8K tokens" },
          ].map((m) => (
            <div key={m.model} className="grid grid-cols-3 gap-4 px-5 py-4 border-b border-white/[0.03] last:border-0 text-[14px]">
              <code className="font-mono font-medium text-white">{m.model}</code>
              <span className="text-white/50">{m.desc}</span>
              <span className="text-white/40">{m.ctx}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Rate limits */}
      <section className="mb-12">
        <h2 className="text-[20px] font-bold text-white mb-4">Rate limits</h2>
        <p className="text-[15px] text-white/80 leading-[1.8] mb-4">
          Rate limits are applied per API key. If you exceed the limit, requests will return a 429 status code.
        </p>
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          {[
            { tier: "Free trial", limit: "10 requests/minute", tokens: "100K total" },
            { tier: "Standard", limit: "60 requests/minute", tokens: "Unlimited" },
            { tier: "Batch", limit: "No rate limit", tokens: "Unlimited (async)" },
          ].map((r, i) => (
            <div key={r.tier} className={`grid grid-cols-3 gap-4 px-5 py-4 text-[14px] ${i < 2 ? "border-b border-white/[0.03]" : ""}`}>
              <span className="font-medium text-white">{r.tier}</span>
              <span className="text-white/50">{r.limit}</span>
              <span className="text-white/40">{r.tokens}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
