import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Страница не найдена",
  description: "Запрашиваемая страница не существует.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#161616] px-6">
      <p className="text-[80px] font-light text-white/10 leading-none mb-4">404</p>
      <p className="text-[18px] text-white/40 mb-8">Страница не найдена</p>
      <Link
        href="/"
        className="text-[16px] text-white/25 border border-white/[0.08] rounded-lg px-5 py-2.5 hover:text-white/40 hover:border-white/[0.15] hover:bg-white/[0.04] transition-all"
      >
        На главную
      </Link>
    </div>
  );
}
