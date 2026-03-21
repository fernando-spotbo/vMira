"use client";

import Link from "next/link";
import { Rocket, Wallet, Wrench, Shield, Code2, Settings } from "lucide-react";
import { HELP_CATEGORIES } from "@/lib/help-data";
import HelpHeader from "@/components/HelpHeader";
import SupportChat from "@/components/SupportChat";

const ICONS: Record<string, React.ReactNode> = {
  rocket: <Rocket size={22} />,
  wallet: <Wallet size={22} />,
  tools: <Settings size={22} />,
  shield: <Shield size={22} />,
  wrench: <Wrench size={22} />,
  code: <Code2 size={22} />,
};

export default function HelpPage() {
  return (
    <div className="fixed inset-0 bg-white overflow-y-auto z-[9999]">
      <HelpHeader />

      <main className="mx-auto max-w-[960px] px-8 pt-16 pb-24">
        <div className="grid grid-cols-3 gap-x-12 gap-y-16">
          {HELP_CATEGORIES.map((cat) => (
            <Link key={cat.slug} href={`/help/${cat.slug}`} className="group flex items-start gap-5">
              <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl bg-[#212121] text-white">
                <div className="group-hover:scale-110 transition-transform duration-200">
                  {ICONS[cat.icon] || <Rocket size={22} />}
                </div>
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-[17px] font-bold text-[#111] leading-snug">{cat.title}</h2>
                <p className="text-[14px] text-[#6B6B6B] mt-2 leading-[1.6]">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <SupportChat />
    </div>
  );
}
