"use client";

import { useState, useEffect } from "react";
import { Plus, Copy, Check, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiCall } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  requests_today: number;
  total_requests: number;
  total_tokens: number;
  last_used_at: string | null;
  created_at: string;
}

interface CreateKeyResponse {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
}

export default function ApiKeysPage() {
  const { user, loading: authLoading } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  const loadKeys = async () => {
    const res = await apiCall<ApiKeyItem[]>("/api-keys");
    if (res.ok) setKeys(res.data);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return; }
    loadKeys();
  }, [user, authLoading]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await apiCall<CreateKeyResponse>("/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewKey(res.data.key);
      setNewName("");
      loadKeys();
    }
    setCreating(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string) => {
    await apiCall(`/api-keys/${id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-medium text-white">API-ключи</h1>
          <p className="text-[15px] text-white/40 mt-2">Управляйте ключами для доступа к Mira API.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setNewKey(null); }}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-medium text-[#161616] hover:bg-white/90 transition-colors"
        >
          <Plus size={16} />
          Создать ключ
        </button>
      </div>

      {/* Newly created key alert */}
      {newKey && (
        <div className="rounded-xl border border-white/[0.15] bg-white/[0.04] p-5 mb-6">
          <p className="text-[14px] text-white/80 mb-3">Ваш новый API-ключ. Сохраните его — он больше не будет показан.</p>
          <div className="flex items-center gap-2 bg-white/[0.06] rounded-lg px-4 py-3">
            <code className="text-[13px] font-mono text-white flex-1 break-all">{newKey}</code>
            <button
              onClick={() => handleCopy(newKey)}
              className="text-white/40 hover:text-white/70 transition-colors shrink-0"
            >
              {copied === newKey ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-[13px] text-white/30 hover:text-white/50 transition-colors"
          >
            Понятно, скрыть
          </button>
        </div>
      )}

      {/* Create key form */}
      {showCreate && !newKey && (
        <div className="rounded-xl border border-white/[0.06] p-6 mb-6 bg-white/[0.03]">
          <h3 className="text-[15px] font-medium text-white mb-4">Создать новый API-ключ</h3>
          <div className="flex gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Название ключа (например, Production, Testing)"
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-all duration-200"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-xl bg-white px-5 py-2.5 text-[14px] font-medium text-[#161616] hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              Создать
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="rounded-xl px-4 py-2.5 text-[14px] text-white/40 hover:text-white transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Keys table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="grid grid-cols-[1fr_2fr_1fr_1fr_60px] gap-4 px-6 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider">
          <span>Название</span>
          <span>Ключ</span>
          <span>Запросы</span>
          <span>Последнее использование</span>
          <span />
        </div>

        {keys.length === 0 ? (
          <div className="px-6 py-12 text-center text-[14px] text-white/30">
            Нет API-ключей. Создайте первый для начала работы.
          </div>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="grid grid-cols-[1fr_2fr_1fr_1fr_60px] gap-4 items-center px-6 py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
              <span className="text-[14px] font-medium text-white">{k.name}</span>
              <div className="flex items-center gap-2">
                <code className="text-[13px] font-mono text-white/50 truncate">
                  {k.key_prefix}{"•".repeat(20)}
                </code>
              </div>
              <span className="text-[13px] text-white/40">{k.total_requests.toLocaleString("ru-RU")}</span>
              <span className="text-[13px] text-white/40">
                {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString("ru-RU") : "Никогда"}
              </span>
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

      <p className="mt-6 text-[13px] text-white/30 leading-relaxed">
        Храните API-ключи в безопасности. Не публикуйте их и не включайте в клиентский код.
        При компрометации ключа удалите его и создайте новый.
      </p>
    </div>
  );
}
