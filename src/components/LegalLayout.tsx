"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LEGAL_PAGES = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/usage-policy", label: "Usage Policy" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 bg-[#F5F0EB] overflow-y-auto z-[9999]">
      {/* Header — Anthropic style */}
      <header className="sticky top-0 z-10 bg-[#F5F0EB]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#1A1A1A]">
              <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
              <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
            </svg>
            <span className="text-[15px] font-semibold tracking-tight text-[#1A1A1A]">MIRA</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-7">
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className={`text-[14px] transition-colors ${
                  pathname === page.href
                    ? "text-[#1A1A1A]"
                    : "text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80"
                }`}
              >
                {page.label}
              </Link>
            ))}
            <Link
              href="/chat"
              className="rounded-full bg-[#1A1A1A] px-5 py-2 text-[13px] font-medium text-[#F5F0EB] hover:bg-[#333] transition-colors"
            >
              Try Mira
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-[680px] px-6 pt-12 pb-24">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1A1A1A]/[0.08] bg-[#F5F0EB]">
        <div className="mx-auto max-w-[1200px] px-8 py-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#1A1A1A]/40">
                <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
                <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
              </svg>
              <span className="text-[13px] font-semibold tracking-tight text-[#1A1A1A]/40">MIRA</span>
            </div>
            <p className="text-[13px] text-[#1A1A1A]/30">AI assistant</p>
          </div>
          <div className="flex gap-16">
            <div>
              <h4 className="text-[12px] font-medium uppercase tracking-wider text-[#1A1A1A]/30 mb-3">Legal</h4>
              <div className="flex flex-col gap-2">
                {LEGAL_PAGES.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    className="text-[13px] text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80 transition-colors"
                  >
                    {page.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[12px] font-medium uppercase tracking-wider text-[#1A1A1A]/30 mb-3">Product</h4>
              <div className="flex flex-col gap-2">
                <Link href="/" className="text-[13px] text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80 transition-colors">Mira Chat</Link>
                <Link href="/chat" className="text-[13px] text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80 transition-colors">Try Mira</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LegalHeading({
  title,
  effectiveDate,
}: {
  title: string;
  effectiveDate: string;
}) {
  return (
    <div className="mb-10">
      <h1 className="font-[var(--font-serif)] text-[42px] font-normal italic text-[#1A1A1A] leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
        {title}
      </h1>
      <div className="mt-5 flex items-center gap-4 text-[14px]">
        <span className="text-[#1A1A1A]/50">Effective {effectiveDate}</span>
        <span className="text-[#1A1A1A]/20">·</span>
        <button className="text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80 underline underline-offset-2 decoration-[#1A1A1A]/20 transition-colors">
          Previous Version
        </button>
        <span className="text-[#1A1A1A]/20">·</span>
        <span className="text-[#1A1A1A]/50">English</span>
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-[18px] font-semibold text-[#1A1A1A] mb-4">{title}</h2>
      <div className="text-[15px] leading-[1.8] text-[#1A1A1A]/70 space-y-4 [&_strong]:text-[#1A1A1A] [&_strong]:font-semibold [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-[#1A1A1A]/20 [&_a]:hover:decoration-[#1A1A1A]/50">
        {children}
      </div>
    </section>
  );
}

export function LegalAccordionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12 rounded-lg bg-[#EFE9E2] p-8">
      <h3 className="text-[22px] font-medium text-[#1A1A1A] mb-2">{title}</h3>
      <div className="h-px bg-[#1A1A1A]/10 mb-2 mt-4" />
      {children}
    </div>
  );
}

export function LegalAccordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#1A1A1A]/[0.08] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-[15px] font-medium text-[#1A1A1A]/80 hover:text-[#1A1A1A] transition-colors"
      >
        <span className="pr-8">{title}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`text-[#1A1A1A]/25 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="pb-6 text-[15px] leading-[1.8] text-[#1A1A1A]/60 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
