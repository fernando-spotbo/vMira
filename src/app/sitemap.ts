import type { MetadataRoute } from "next";
import { HELP_CATEGORIES } from "@/lib/help-data";

const BASE_URL = "https://vmira.ai";

// Use stable dates — update when content actually changes
const LAUNCH_DATE = "2026-03-18";
const CONTENT_UPDATED = "2026-03-23";

export default function sitemap(): MetadataRoute.Sitemap {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/platform/pricing`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/legal`,
      lastModified: LAUNCH_DATE,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: LAUNCH_DATE,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: LAUNCH_DATE,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/usage-policy`,
      lastModified: LAUNCH_DATE,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Help category pages
  const helpCategories: MetadataRoute.Sitemap = HELP_CATEGORIES.map((cat) => ({
    url: `${BASE_URL}/help/${cat.slug}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Help article pages
  const helpArticles: MetadataRoute.Sitemap = HELP_CATEGORIES.flatMap((cat) =>
    cat.articles.map((article) => ({
      url: `${BASE_URL}/help/${cat.slug}/${article.slug}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }))
  );

  return [...staticPages, ...helpCategories, ...helpArticles];
}
