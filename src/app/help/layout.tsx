import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Помощь и поддержка",
  description: "Справочный центр Мира AI. Ответы на вопросы, руководства по использованию, решение проблем.",
  keywords: [
    "Мира помощь",
    "AI ассистент справка",
    "как пользоваться Мирой",
    "поддержка Мира",
  ],
  alternates: { canonical: "https://vmira.ai/help" },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
