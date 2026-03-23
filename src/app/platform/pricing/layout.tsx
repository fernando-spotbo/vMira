import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Тарифы и цены",
  description:
    "Тарифные планы Мира AI: бесплатный, Pro и Max. Сравните возможности и выберите подходящий план. Оплата в рублях.",
  keywords: [
    "Мира AI цены",
    "тарифы ИИ ассистента",
    "стоимость AI чата",
    "подписка нейросеть",
    "бесплатный ИИ тариф",
    "Мира Pro",
    "Мира Max",
  ],
  alternates: { canonical: "https://vmira.ai/platform/pricing" },
  openGraph: {
    title: "Тарифы Мира AI — от 0 ₽/мес",
    description: "Бесплатный план, Pro за 199 ₽/мес и Max за 990 ₽/мес. AI-ассистент с поиском в интернете.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
