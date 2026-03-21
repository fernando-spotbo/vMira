"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { HELP_CATEGORIES } from "@/lib/help-data";

export default function HelpHeader() {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const router = useRouter();

  const allArticles = HELP_CATEGORIES.flatMap((cat) =>
    cat.articles.map((a) => ({ ...a, category: cat }))
  );

  const filtered = query
    ? allArticles.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          (a.description && a.description.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  return (
    <>
      <header className="mx-auto max-w-[960px] px-8 flex items-center justify-between h-[80px]">
        <Link href="/help">
          <span className="text-[32px] font-bold text-black tracking-tight">Mira</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="rounded-full border border-black/15 px-4 py-1.5 text-[13px] text-[#555]">English</span>
          <Link href="/chat" className="text-[14px] font-medium text-black hover:underline">Login</Link>
        </div>
      </header>

      <div className="mx-auto max-w-[960px] px-8 pt-6 pb-4 relative">
        <div className="flex items-center gap-3 pb-4 border-b border-black/80">
          <Search size={20} className="text-[#333] shrink-0" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => query && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="Search for articles..."
            className="flex-1 bg-transparent text-[17px] text-black placeholder-[#555] focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setShowResults(false); }} className="text-black/30 hover:text-black/60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {showResults && filtered.length > 0 && (
          <div className="absolute left-10 right-10 top-full mt-2 z-50 rounded-xl border border-black/[0.08] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] max-h-[400px] overflow-y-auto">
            {filtered.map((a) => (
              <button
                key={`${a.category.slug}-${a.slug}`}
                onMouseDown={() => router.push(`/help/${a.category.slug}/${a.slug}`)}
                className="flex w-full flex-col gap-1 px-6 py-4 text-left border-b border-black/[0.04] last:border-0 hover:bg-black/[0.02] transition-colors"
              >
                <span className="text-[15px] font-semibold text-black">{a.title}</span>
                {a.description && <span className="text-[13px] text-black/45">{a.description}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
