"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Globe, Search } from "lucide-react";
import type { SearchQuery, SearchPhase } from "@/lib/types";
import { t } from "@/lib/i18n";

interface ReasoningBlockProps {
  summary: string;
  thinking?: string;
  searches?: SearchQuery[];
  searchPhase?: SearchPhase;
}

export default function ReasoningBlock({ summary, thinking, searches, searchPhase }: ReasoningBlockProps) {
  const [manualExpand, setManualExpand] = useState<boolean | null>(null);
  const [prevPhase, setPrevPhase] = useState<SearchPhase | undefined>(searchPhase);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const hasSearches = searches && searches.length > 0;
  const hasContent = thinking || hasSearches;
  const isActive = searchPhase === "searching" || searchPhase === "results";

  // Auto-expand when active, auto-collapse when answering
  const expanded = manualExpand !== null ? manualExpand : isActive;

  // Measure actual content height for smooth transitions
  const measureHeight = useCallback(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    measureHeight();
  }, [searches, searchPhase, thinking, measureHeight]);

  // Reset manual override on phase transitions
  useEffect(() => {
    if (searchPhase !== prevPhase) {
      setPrevPhase(searchPhase);
      setManualExpand(null);
    }
  }, [searchPhase, prevPhase]);

  const toggleExpand = () => {
    if (!hasContent) return;
    setManualExpand(expanded ? false : true);
  };

  // ── Plain reasoning (no search) ─────────────────────────
  if (!searchPhase) {
    return (
      <div className="my-3">
        <button
          onClick={toggleExpand}
          className={`flex items-center gap-1.5 text-[13px] text-white/35 transition-colors duration-200 ${
            hasContent ? "hover:text-white/55 cursor-pointer" : "cursor-default"
          }`}
        >
          <span>{summary}</span>
          {hasContent && (
            <ChevronDown
              size={13}
              className={`transition-transform duration-300 ease-out ${expanded ? "rotate-0" : "-rotate-90"}`}
            />
          )}
        </button>
        <div
          className="overflow-hidden transition-all duration-400 ease-out"
          style={{
            maxHeight: expanded && thinking ? "200px" : "0px",
            opacity: expanded && thinking ? 1 : 0,
          }}
        >
          <div className="mt-2 border-l border-white/[0.06] pl-3.5">
            <p className="text-[13px] text-white/30 leading-6 whitespace-pre-wrap">{thinking}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Search-phase block ──────────────────────────────────
  const phaseLabel = (() => {
    if (searchPhase === "searching") return t("search.searching");
    if (searchPhase === "results") {
      const count = searches?.[0]?.resultCount ?? 0;
      return `${t("search.found")} ${count} ${t("search.sources")}`;
    }
    return `${t("search.label")}: «${summary}»`;
  })();

  return (
    <div className="my-2.5">
      {/* ── Header ── */}
      <button
        onClick={toggleExpand}
        className="flex items-center gap-2 py-1 text-[13px] transition-colors duration-200 cursor-pointer group/search"
      >
        {/* Icon */}
        <div className={`shrink-0 transition-all duration-500 ${isActive ? "text-white/50" : "text-white/25"}`}>
          {isActive ? (
            <Globe size={13} className="search-globe-spin" />
          ) : (
            <Search size={13} />
          )}
        </div>

        {/* Label with crossfade */}
        <span
          key={searchPhase}
          className={`search-text-swap transition-colors duration-300 ${isActive ? "text-white/50" : "text-white/35 group-hover/search:text-white/50"}`}
        >
          {phaseLabel}
          {searchPhase === "searching" && <span className="mira-thinking-dots" />}
        </span>

        {/* Chevron */}
        <ChevronDown
          size={13}
          className={`text-white/25 transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${expanded ? "rotate-0" : "-rotate-90"}`}
        />
      </button>

      {/* ── Expandable body ── */}
      <div
        className="overflow-hidden"
        style={{
          height: expanded ? `${contentHeight}px` : "0px",
          opacity: expanded ? 1 : 0,
          transition: expanded
            ? "height 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease 0.05s"
            : "height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
        }}
      >
        <div ref={contentRef} className="pt-2 pb-1 border-l border-white/[0.06] ml-[6px] pl-3.5 space-y-2.5">
          {/* Searching state — pulse + query */}
          {searchPhase === "searching" && (
            <div className="flex items-center gap-3 py-1.5 search-text-swap">
              <div className="search-pulse-ring" />
              <span className="text-[13px] text-white/30 italic">
                «{summary}»
              </span>
            </div>
          )}

          {/* Results */}
          {hasSearches && searches!.map((q, qi) => (
            <div key={qi}>
              {/* Query badge */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <Globe size={11} className="text-white/20 shrink-0" />
                <span className="text-[12px] text-white/30 truncate">{q.query}</span>
                <span className="text-[11px] text-white/15 shrink-0">·</span>
                <span className="text-[11px] text-white/15 shrink-0">{q.resultCount}</span>
              </div>

              {/* Result rows */}
              {q.results.length > 0 && (
                <div className="rounded-lg border border-white/[0.05] overflow-hidden bg-white/[0.01]">
                  {q.results.map((r, ri) => (
                    <a
                      key={ri}
                      href={r.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`search-result-enter flex items-center gap-2 px-3 py-[7px] text-[12.5px] ${
                        ri < q.results.length - 1 ? "border-b border-white/[0.03]" : ""
                      } hover:bg-white/[0.03] transition-colors duration-150 no-underline`}
                      style={{ animationDelay: `${ri * 50 + 80}ms` }}
                    >
                      {/* Favicon placeholder */}
                      <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] bg-white/[0.05] text-[8px] text-white/30 font-semibold uppercase">
                        {r.domain.charAt(0)}
                      </div>
                      <span className="text-white/55 truncate flex-1 leading-snug">{r.title}</span>
                      <span className="text-[10.5px] text-white/15 shrink-0 font-mono">{r.domain}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
