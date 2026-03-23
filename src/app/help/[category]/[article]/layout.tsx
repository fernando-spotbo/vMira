import type { Metadata } from "next";
import { findArticle, findCategory } from "@/lib/help-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; article: string }>;
}): Promise<Metadata> {
  const { category, article: articleSlug } = await params;
  const cat = findCategory(category);
  const art = findArticle(category, articleSlug);
  if (!cat || !art) return { title: "Помощь" };

  const firstParagraph = art.content[0]?.body?.slice(0, 160) || art.description || "";

  return {
    title: `${art.title} — ${cat.title}`,
    description: art.description || firstParagraph,
    keywords: [art.title, cat.title, "Мира помощь", "руководство"],
    alternates: { canonical: `https://vmira.ai/help/${cat.slug}/${art.slug}` },
    openGraph: {
      title: art.title,
      description: art.description || firstParagraph,
      type: "article",
    },
  };
}

export default function ArticleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
