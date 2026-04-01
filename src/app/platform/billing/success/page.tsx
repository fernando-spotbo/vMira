"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Wallet, ArrowRight, MessageSquare } from "lucide-react";

export default function PaymentSuccessPage() {
  const [show, setShow] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Staggered entrance animation
  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 100);
    const t2 = setTimeout(() => setShowDetails(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Mock — in production, read balance from API or URL params
  const newBalance = "7 345,00";
  const topupAmount = "5 000,00";

  return (
    <div className="max-w-[480px] mx-auto flex flex-col items-center pt-16 pb-10 text-center">
      {/* Animated checkmark */}
      <div
        className={`relative mb-8 transition-all duration-700 ease-out ${
          show ? "opacity-100 scale-100" : "opacity-0 scale-50"
        }`}
      >
        {/* Outer glow ring */}
        <div className="absolute inset-0 -m-4 rounded-full bg-emerald-500/10 animate-pulse" />
        <div className="absolute inset-0 -m-8 rounded-full bg-emerald-500/5" />

        {/* Icon circle */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/20">
          <CheckCircle2 size={40} className="text-emerald-400" strokeWidth={1.5} />
        </div>
      </div>

      {/* Main text */}
      <div
        className={`transition-all duration-500 delay-200 ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="text-[24px] font-medium text-white mb-2">Оплата прошла успешно!</h1>
        <p className="text-[15px] text-white/50 mb-1">Баланс обновлён.</p>
      </div>

      {/* Balance card */}
      <div
        className={`w-full mt-8 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden transition-all duration-500 ${
          showDetails ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Top-up amount */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-[13px] text-white/40">Зачислено</p>
              <p className="text-[16px] font-semibold text-emerald-400">+{topupAmount} &#8381;</p>
            </div>
          </div>
        </div>

        {/* New balance */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06]">
              <Wallet size={16} className="text-white/60" />
            </div>
            <div className="text-left">
              <p className="text-[13px] text-white/40">Текущий баланс</p>
              <p className="text-[22px] font-medium text-white">{newBalance} &#8381;</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div
        className={`w-full mt-8 space-y-3 transition-all duration-500 delay-100 ${
          showDetails ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-[15px] font-medium text-[#161616] hover:bg-white/90 transition-colors"
        >
          <MessageSquare size={16} />
          Вернуться в чат
        </Link>

        <Link
          href="/billing"
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] py-3.5 text-[15px] text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
        >
          История транзакций
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Receipt note */}
      <p
        className={`mt-8 text-[12px] text-white/20 transition-all duration-500 delay-200 ${
          showDetails ? "opacity-100" : "opacity-0"
        }`}
      >
        Электронный чек отправлен на вашу почту. Если чек не пришёл, проверьте папку &laquo;Спам&raquo;.
      </p>
    </div>
  );
}
