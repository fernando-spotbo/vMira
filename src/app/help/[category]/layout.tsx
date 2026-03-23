import type { Metadata } from "next";
import { findCategory } from "@/lib/help-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = findCategory(category);
  if (!cat) return { title: "Помощь" };

  return {
    title: cat.title,
    description: cat.description,
    keywords: [cat.title, "Мира помощь", "справка AI", cat.slug],
    alternates: { canonical: `https://vmira.ai/help/${cat.slug}` },
  };
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
