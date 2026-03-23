import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Мира — AI-ассистент",
    short_name: "Мира",
    description: "Умный AI-ассистент с поиском в интернете. Задавайте вопросы, получайте точные ответы с источниками.",
    start_url: "/",
    display: "standalone",
    background_color: "#161616",
    theme_color: "#161616",
    lang: "ru",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
