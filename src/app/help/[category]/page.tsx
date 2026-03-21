"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Rocket, Wallet, Settings, Shield, Wrench, Code2 } from "lucide-react";
import { findCategory } from "@/lib/help-data";
import HelpHeader from "@/components/HelpHeader";
import SupportChat from "@/components/SupportChat";

const ICONS: Record<string, React.ReactNode> = {
  rocket: <Rocket size={26} />,
  wallet: <Wallet size={26} />,
  tools: <Settings size={26} />,
  shield: <Shield size={26} />,
  wrench: <Wrench size={26} />,
  code: <Code2 size={26} />,
};

export default function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = use(params);
  const category = findCategory(slug);

  if (!category) return notFound();

  return (
    <div className="fixed inset-0 bg-white overflow-y-auto z-[9999]">
      <HelpHeader />

      <main className="mx-auto max-w-[960px] px-8 pt-16 pb-24">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px] mb-10">
          <Link href="/help" className="text-[#555] hover:underline">All collections</Link>
          <ChevronRight size={14} className="text-black/25" />
          <span className="text-black/45">{category.title}</span>
        </div>

        {/* Category header */}
        <div className="flex items-center gap-5 mb-16">
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-2xl bg-[#212121] text-white">
            {ICONS[category.icon] || <Rocket size={26} />}
          </div>
          <div>
            <h1 className="text-[26px] font-medium text-[#111]">{category.title}</h1>
            <p className="text-[15px] text-[#6B6B6B] mt-1">{category.description}</p>
          </div>
        </div>

        {/* Article list — single card with internal dividers */}
        <div className="max-w-[780px] rounded-xl border border-black/[0.1] overflow-hidden">
          {category.articles.map((article, i) => (
            <Link
              key={article.slug}
              href={`/help/${slug}/${article.slug}`}
              className={`flex items-center gap-4 px-6 py-5 hover:bg-black/[0.02] transition-colors group ${
                i < category.articles.length - 1 ? "border-b border-black/[0.07]" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] text-[#111]">{article.title}</h3>
                {article.description && (
                  <p className="text-[14px] text-[#7A7A7A] mt-1.5 leading-relaxed">{article.description}</p>
                )}
              </div>
              <ChevronRight size={18} className="text-black/20 shrink-0 group-hover:text-black/40 transition-colors" />
            </Link>
          ))}
        </div>
      </main>

      <SupportChat />
    </div>
  );
}
