"use client";

import { useState } from "react";
import { ChevronRight, Globe } from "lucide-react";
import type { SearchQuery } from "@/lib/types";

interface ReasoningBlockProps {
  summary: string;
  thinking?: string;
  searches?: SearchQuery[];
}

export default function ReasoningBlock({ summary, thinking, searches }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSearches = searches && searches.length > 0;
  const hasContent = thinking || hasSearches;

  return (
    <div className="my-3">
      <button
        onClick={() => hasContent && setExpanded(!expanded)}
        className={`flex items-center gap-1.5 text-[14px] text-white/40 transition-colors ${
          hasContent ? "hover:text-white/60 cursor-pointer" : "cursor-default"
        }`}
      >
        <span>{summary}</span>
        {hasContent && (
          <ChevronRight
            size={14}
            className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          />
        )}
      </button>

      {expanded && (
        <div className="mt-2 border-l-2 border-white/[0.06] pl-4 space-y-3">
          {/* Thinking text */}
          {thinking && (
            <p className="text-[14px] text-white/40 leading-6 whitespace-pre-wrap">{thinking}</p>
          )}

          {/* Search queries + results */}
          {hasSearches && searches!.map((q, qi) => (
            <div key={qi}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe size={14} className="text-white/30 shrink-0" />
                  <span className="text-[14px] text-white/50 truncate">{q.query}</span>
                </div>
                <span className="text-[13px] text-white/30 shrink-0 ml-3">
                  {q.resultCount} result{q.resultCount !== 1 ? "s" : ""}
                </span>
              </div>

              {q.results.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] overflow-hidden max-h-[160px] overflow-y-auto">
                  {q.results.map((r, ri) => (
                    <div
                      key={ri}
                      className={`flex items-center justify-between px-4 py-2.5 text-[14px] ${
                        ri < q.results.length - 1 ? "border-b border-white/[0.04]" : ""
                      } hover:bg-white/[0.03] transition-colors cursor-pointer`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/[0.06] text-[10px] text-white/40 font-medium">
                          {r.domain.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white/70 truncate">{r.title}</span>
                      </div>
                      <span className="text-[13px] text-white/30 ml-3 shrink-0">{r.domain}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
