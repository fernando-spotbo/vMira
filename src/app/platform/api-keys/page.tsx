"use client";

import { useState } from "react";
import { Plus, Copy, Check, Trash2, Eye, EyeOff } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: "1", name: "Development", key: "sk-mira-dev-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", created: "Mar 15, 2026", lastUsed: "Never" },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const key: ApiKey = {
      id: String(Date.now()),
      name: newName.trim(),
      key: `sk-mira-${newName.trim().toLowerCase().replace(/\s/g, "-")}-${Math.random().toString(36).slice(2, 18)}`,
      created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      lastUsed: "Never",
    };
    setKeys((prev) => [key, ...prev]);
    setNewName("");
    setShowCreate(false);
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-medium text-white">API keys</h1>
          <p className="text-[15px] text-white/40 mt-2">Manage your API keys for accessing the Mira API.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-medium text-[#161616] hover:bg-white/90 transition-colors"
        >
          <Plus size={16} />
          Create new key
        </button>
      </div>

      {/* Create key form */}
      {showCreate && (
        <div className="rounded-xl border border-white/[0.06] p-6 mb-6 bg-white/[0.03]">
          <h3 className="text-[15px] font-medium text-white mb-4">Create a new API key</h3>
          <div className="flex gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Key name (e.g., Production, Testing)"
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-all duration-200"
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="rounded-xl bg-white px-5 py-2.5 text-[14px] font-medium text-[#161616] hover:bg-white/90 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="rounded-xl px-4 py-2.5 text-[14px] text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_2fr_1fr_1fr_80px] gap-4 px-6 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider">
          <span>Name</span>
          <span>Key</span>
          <span>Created</span>
          <span>Last used</span>
          <span />
        </div>

        {/* Rows */}
        {keys.length === 0 ? (
          <div className="px-6 py-12 text-center text-[14px] text-white/30">
            No API keys yet. Create one to get started.
          </div>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="grid grid-cols-[1fr_2fr_1fr_1fr_80px] gap-4 items-center px-6 py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
              <span className="text-[14px] font-medium text-white">{k.name}</span>
              <div className="flex items-center gap-2">
                <code className="text-[13px] font-mono text-white/50 truncate">
                  {revealed === k.id ? k.key : `${k.key.slice(0, 12)}${"•".repeat(24)}`}
                </code>
                <button
                  onClick={() => setRevealed(revealed === k.id ? null : k.id)}
                  className="text-white/20 hover:text-white/50 transition-colors shrink-0"
                >
                  {revealed === k.id ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  onClick={() => handleCopy(k.key)}
                  className="text-white/20 hover:text-white/50 transition-colors shrink-0"
                >
                  {copied === k.key ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <span className="text-[13px] text-white/40">{k.created}</span>
              <span className="text-[13px] text-white/40">{k.lastUsed}</span>
              <button
                onClick={() => handleDelete(k.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:text-red-400 hover:bg-red-400/10 transition-colors ml-auto"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <p className="mt-6 text-[13px] text-white/30 leading-relaxed">
        Keep your API keys secure. Do not share them publicly or include them in client-side code.
        If a key is compromised, delete it immediately and create a new one.
      </p>
    </div>
  );
}
