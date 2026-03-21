import LegalLayout from "@/components/LegalLayout";
import Link from "next/link";

const pages = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    description: "The agreement between you and Mira AI governing use of our Service.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal information.",
  },
  {
    href: "/legal/usage-policy",
    title: "Usage Policy",
    description: "Guidelines for responsible and acceptable use of Mira.",
  },
];

export default function LegalIndexPage() {
  return (
    <LegalLayout>
      <div className="mb-12">
        <h1 className="text-[42px] font-normal italic text-[#1A1A1A] leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
          Legal
        </h1>
        <p className="mt-4 text-[15px] text-[#1A1A1A]/50 leading-relaxed">
          Policies and agreements governing your use of Mira.
        </p>
      </div>

      <div className="space-y-3">
        {pages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="block rounded-lg bg-[#EFE9E2] p-6 hover:bg-[#EAE3DB] transition-colors"
          >
            <h2 className="text-[17px] font-semibold text-[#1A1A1A]">{page.title}</h2>
            <p className="mt-1.5 text-[14px] text-[#1A1A1A]/45">{page.description}</p>
          </Link>
        ))}
      </div>
    </LegalLayout>
  );
}
