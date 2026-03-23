import type { Metadata, Viewport } from "next";
import { DM_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const SITE_URL = "https://vmira.ai";
const SITE_NAME = "Мира";
const SITE_TITLE = "Мира — AI-ассистент с поиском в интернете";
const SITE_DESC =
  "Умный AI-ассистент на русском языке. Задавайте вопросы, получайте точные ответы с источниками. Поиск в интернете, анализ, генерация текста и кода.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#161616",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  keywords: [
    // Primary Russian keywords
    "ИИ ассистент",
    "AI помощник",
    "нейросеть чат",
    "искусственный интеллект",
    "чат бот на русском",
    "умный чат",
    "AI на русском языке",
    // Feature keywords
    "поиск в интернете ИИ",
    "генерация текста",
    "ответы на вопросы",
    "анализ документов",
    "помощник с источниками",
    // Brand
    "Мира",
    "Mira AI",
    "vmira",
  ],
  authors: [{ name: "Spotbo", url: "https://spotbo.com" }],
  creator: "Spotbo",
  publisher: "Spotbo",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "ru": SITE_URL,
    },
  },

  // Open Graph — image auto-injected from opengraph-image.tsx
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESC,
  },

  // Twitter — image auto-injected from opengraph-image.tsx
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
  },

  // Icons — SVG for modern browsers, apple-icon.tsx generates PNG
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },

  // Verification
  verification: {
    yandex: "74e453ae49930821",
    other: {
      "yandex-tableau-widget": `${SITE_URL}/manifest.json`,
    },
  },

  // Category
  category: "technology",

  other: {
    "content-language": "ru",
  },
};

// JSON-LD structured data — enhanced for Yandex software rich snippets + GEO
function JsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Мира",
        alternateName: ["Mira AI", "vMira", "Мира AI"],
        url: SITE_URL,
        description: SITE_DESC,
        applicationCategory: "UtilitiesApplication",
        applicationSubCategory: "AI Assistant",
        operatingSystem: "Web",
        availableOnDevice: "Web",
        browserRequirements: "Requires JavaScript. Modern browser (Chrome, Firefox, Safari, Yandex Browser).",
        softwareVersion: "1.0",
        inLanguage: ["ru", "en"],
        countriesSupported: "RU",
        featureList: [
          "Поиск актуальной информации в интернете с источниками",
          "Генерация и анализ текста на русском языке",
          "Написание и объяснение кода",
          "Ответы на вопросы с цитированием источников",
          "Загрузка и анализ изображений и файлов",
          "Режим мышления для сложных задач",
          "Голосовой ввод",
        ],
        screenshot: `${SITE_URL}/opengraph-image`,
        offers: [
          {
            "@type": "Offer",
            name: "Бесплатный",
            price: "0",
            priceCurrency: "RUB",
            description: "20 сообщений в день, базовая модель",
          },
          {
            "@type": "Offer",
            name: "Pro",
            price: "199",
            priceCurrency: "RUB",
            billingDuration: "P1M",
            description: "500 сообщений в день, продвинутые модели, загрузка файлов",
          },
          {
            "@type": "Offer",
            name: "Max",
            price: "990",
            priceCurrency: "RUB",
            billingDuration: "P1M",
            description: "Безлимитные сообщения, все модели, приоритетная очередь",
          },
        ],
        creator: { "@id": `${SITE_URL}/#org` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "Spotbo",
        url: "https://spotbo.com",
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon.svg`,
          width: 512,
          height: 512,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESC,
        publisher: { "@id": `${SITE_URL}/#org` },
        inLanguage: "ru",
        // Yandex sitelinks search box
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/chat?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <head>
        <JsonLd />
      </head>
      <body className={`${dmSans.className} ${sourceSerif.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
