"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { findCategory, findArticle, findArticleBySlug } from "@/lib/help-data";
import HelpHeader from "@/components/HelpHeader";
import SupportChat from "@/components/SupportChat";

export default function ArticlePage({
  params,
}: {
  params: Promise<{ category: string; article: string }>;
}) {
  const { category: catSlug, article: artSlug } = use(params);
  const category = findCategory(catSlug);
  const article = findArticle(catSlug, artSlug);

  if (!category || !article) return notFound();

  const relatedArticles = (article.related ?? [])
    .map((slug) => findArticleBySlug(slug))
    .filter(Boolean);

  return (
    <div className="fixed inset-0 bg-white overflow-y-auto z-[9999]">
      <HelpHeader />

      <main className="mx-auto max-w-[960px] px-8 pt-16 pb-24">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px] mb-10 flex-wrap">
          <Link href="/help" className="text-[#555] hover:underline">All Collections</Link>
          <ChevronRight size={14} className="text-black/25" />
          <Link href={`/help/${catSlug}`} className="text-[#555] hover:underline">{category.title}</Link>
          <ChevronRight size={14} className="text-black/25" />
          <span className="text-black/45">{article.title}</span>
        </div>

        {/* Content + sidebar */}
        <div className="flex gap-20">
          {/* Main content */}
          <div className="flex-1 min-w-0 max-w-[640px]">
            <h1 className="text-[30px] font-bold text-[#111] leading-[1.25] mb-4">
              {article.title}
            </h1>
            <p className="text-[14px] text-[#999] mb-14">Updated: {article.updatedAt}</p>

            <div className="space-y-12">
              {article.content.map((section) => (
                <div key={section.heading} id={section.heading.replace(/\s+/g, "-").toLowerCase()}>
                  <h2 className="text-[18px] font-bold text-[#111] mb-4 leading-snug">{section.heading}</h2>
                  <p className="text-[16px] text-[#333] leading-[1.8]">{section.body}</p>
                </div>
              ))}
            </div>

            {relatedArticles.length > 0 && (
              <>
                <div className="h-px bg-black/[0.08] my-14" />
                <h3 className="text-[20px] font-bold text-black mb-6">Related articles</h3>
                <div className="space-y-0">
                  {relatedArticles.map((item) => {
                    if (!item) return null;
                    return (
                      <Link
                        key={item.article.slug}
                        href={`/help/${item.category.slug}/${item.article.slug}`}
                        className="flex items-center gap-4 py-4 border-b border-black/[0.06] hover:bg-black/[0.01] transition-colors group -mx-2 px-2 rounded"
                      >
                        <span className="flex-1 text-[15px] text-black/80 group-hover:text-black transition-colors">{item.article.title}</span>
                        <ChevronRight size={16} className="text-black/15 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Sidebar TOC */}
          <aside className="w-[220px] shrink-0 hidden lg:block">
            <div className="sticky top-28">
              <nav className="space-y-0">
                {article.content.map((section) => (
                  <button
                    key={section.heading}
                    onClick={() => {
                      const id = section.heading.replace(/\s+/g, "-").toLowerCase();
                      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex w-full items-start gap-2 text-left text-[13px] text-black/40 hover:text-black/70 py-2 transition-colors leading-relaxed"
                  >
                    <span className="text-black/20 mt-0.5 shrink-0">&#8226;</span>
                    <span>{section.heading}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </main>

      <SupportChat />
    </div>
  );
}
