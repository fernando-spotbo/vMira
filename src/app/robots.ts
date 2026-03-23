import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/help", "/legal", "/platform/pricing"],
        disallow: [
          "/chat",
          "/api",
          "/platform/dashboard",
          "/platform/billing",
          "/platform/api-keys",
          "/platform/usage",
          "/platform/docs",
        ],
      },
      {
        userAgent: "Yandex",
        allow: ["/", "/help", "/legal", "/platform/pricing"],
        disallow: [
          "/chat",
          "/api",
          "/platform/dashboard",
          "/platform/billing",
          "/platform/api-keys",
          "/platform/usage",
          "/platform/docs",
        ],
      },
    ],
    sitemap: "https://vmira.ai/sitemap.xml",
    host: "https://vmira.ai",
  };
}
