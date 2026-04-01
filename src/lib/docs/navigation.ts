/**
 * Mira API Docs — Navigation structure with i18n
 *
 * Each section has a heading (i18n) and items.
 * Each item has a slug (URL path), title (i18n), and optional description.
 */

type Locale = "ru" | "en";
type I18n = Record<Locale, string>;

export interface NavItem {
  slug: string;
  title: I18n;
  description?: I18n;
  external?: boolean;
}

export interface NavSection {
  heading: I18n;
  items: NavItem[];
}

export const docsNav: NavSection[] = [
  {
    heading: { en: "Getting started", ru: "Начало работы" },
    items: [
      {
        slug: "introduction",
        title: { en: "Introduction to Mira", ru: "Введение в Мира" },
        description: { en: "Learn what Mira can do and how to get started.", ru: "Узнайте, что может Мира и как начать работу." },
      },
      {
        slug: "quickstart",
        title: { en: "Quickstart", ru: "Быстрый старт" },
        description: { en: "Make your first API call in minutes.", ru: "Сделайте первый API-запрос за считанные минуты." },
      },
    ],
  },
  {
    heading: { en: "Models and pricing", ru: "Модели и цены" },
    items: [
      {
        slug: "models",
        title: { en: "Models overview", ru: "Обзор моделей" },
        description: { en: "Compare Mira models and choose the right one.", ru: "Сравните модели Мира и выберите подходящую." },
      },
      {
        slug: "choosing-a-model",
        title: { en: "Choosing a model", ru: "Выбор модели" },
      },
      {
        slug: "whats-new",
        title: { en: "What's new in Mira", ru: "Что нового в Мира" },
      },
      {
        slug: "pricing",
        title: { en: "Pricing", ru: "Цены" },
      },
    ],
  },
  {
    heading: { en: "Build with Mira", ru: "Создавайте с Мирой" },
    items: [
      {
        slug: "features-overview",
        title: { en: "Features overview", ru: "Обзор возможностей" },
        description: { en: "Explore advanced capabilities available in Mira.", ru: "Изучите расширенные возможности Мира." },
      },
      {
        slug: "messages-api",
        title: { en: "Using the Messages API", ru: "Использование API сообщений" },
      },
      {
        slug: "streaming",
        title: { en: "Streaming responses", ru: "Потоковые ответы" },
      },
      {
        slug: "stop-reasons",
        title: { en: "Handling stop reasons", ru: "Обработка причин остановки" },
      },
      {
        slug: "prompt-engineering",
        title: { en: "Prompt engineering", ru: "Промпт-инженерия" },
        description: { en: "Best practices for getting the most out of Mira.", ru: "Лучшие практики для получения максимума от Мира." },
      },
      {
        slug: "system-prompts",
        title: { en: "System prompts", ru: "Системные промпты" },
      },
      {
        slug: "vision",
        title: { en: "Vision (image input)", ru: "Зрение (ввод изображений)" },
      },
      {
        slug: "tool-use",
        title: { en: "Tool use (function calling)", ru: "Использование инструментов" },
      },
      {
        slug: "extended-thinking",
        title: { en: "Extended thinking", ru: "Расширенное мышление" },
      },
      {
        slug: "json-mode",
        title: { en: "JSON mode", ru: "Режим JSON" },
      },
      {
        slug: "embeddings",
        title: { en: "Text embeddings", ru: "Текстовые эмбеддинги" },
      },
      {
        slug: "batch-processing",
        title: { en: "Batch processing", ru: "Пакетная обработка" },
      },
    ],
  },
  {
    heading: { en: "Model capabilities", ru: "Возможности моделей" },
    items: [
      {
        slug: "thinking-mode",
        title: { en: "Thinking mode", ru: "Режим мышления" },
      },
      {
        slug: "multilingual",
        title: { en: "Multilingual support", ru: "Мультиязычная поддержка" },
      },
      {
        slug: "long-context",
        title: { en: "Long context windows", ru: "Длинный контекст" },
      },
      {
        slug: "code-generation",
        title: { en: "Code generation", ru: "Генерация кода" },
      },
    ],
  },
  {
    heading: { en: "API reference", ru: "Справочник API" },
    items: [
      {
        slug: "api/overview",
        title: { en: "API overview", ru: "Обзор API" },
        description: { en: "Integrate and scale using our API and SDKs.", ru: "Интегрируйте и масштабируйте с помощью нашего API." },
      },
      {
        slug: "api/authentication",
        title: { en: "Authentication", ru: "Аутентификация" },
      },
      {
        slug: "api/chat-completions",
        title: { en: "Chat completions", ru: "Завершение чата" },
      },
      {
        slug: "api/models-list",
        title: { en: "List models", ru: "Список моделей" },
      },
      {
        slug: "api/errors",
        title: { en: "Error handling", ru: "Обработка ошибок" },
      },
      {
        slug: "api/rate-limits",
        title: { en: "Rate limits", ru: "Ограничения запросов" },
      },
      {
        slug: "api/versioning",
        title: { en: "API versioning", ru: "Версионирование API" },
      },
    ],
  },
  {
    heading: { en: "Mira Code", ru: "Mira Code" },
    items: [
      {
        slug: "mira-code/getting-started",
        title: { en: "Getting started with Mira Code", ru: "Начало работы с Mira Code" },
        description: { en: "Get started with Mira Code CLI.", ru: "Начните работу с Mira Code CLI." },
      },
      {
        slug: "mira-code/reference",
        title: { en: "Mira Code reference", ru: "Справочник Mira Code" },
      },
      {
        slug: "mira-code/commands",
        title: { en: "Commands", ru: "Команды" },
      },
      {
        slug: "mira-code/configuration",
        title: { en: "Configuration", ru: "Конфигурация" },
      },
      {
        slug: "mira-code/changelog",
        title: { en: "Changelog", ru: "Журнал изменений" },
      },
      {
        slug: "mira-code/pricing",
        title: { en: "Pricing", ru: "Тарифы" },
      },
    ],
  },
  {
    heading: { en: "Resources", ru: "Ресурсы" },
    items: [
      {
        slug: "sdks",
        title: { en: "SDKs and libraries", ru: "SDK и библиотеки" },
      },
      {
        slug: "security",
        title: { en: "Security best practices", ru: "Безопасность" },
      },
      {
        slug: "changelog",
        title: { en: "Platform changelog", ru: "Журнал изменений платформы" },
        description: { en: "Learn about changes and new features.", ru: "Узнайте об изменениях и новых возможностях." },
      },
      {
        slug: "glossary",
        title: { en: "Glossary", ru: "Глоссарий" },
      },
    ],
  },
];

// Top navigation tabs
export const topNav: { title: I18n; slug: string; external?: boolean }[] = [
  { title: { en: "Developer guide", ru: "Руководство разработчика" }, slug: "" },
  { title: { en: "API reference", ru: "Справочник API" }, slug: "api/overview" },
  { title: { en: "Mira Code", ru: "Mira Code" }, slug: "mira-code/getting-started" },
  { title: { en: "Resources", ru: "Ресурсы" }, slug: "sdks" },
];

// Homepage cards
export interface HomeCard {
  icon: string; // lucide icon name
  title: I18n;
  description: I18n;
  slug: string;
}

export const platformCards: HomeCard[] = [
  { icon: "play", title: { en: "Get started", ru: "Начать" }, description: { en: "Make your first API call in minutes.", ru: "Сделайте первый запрос к API за считанные минуты." }, slug: "quickstart" },
  { icon: "settings", title: { en: "Features overview", ru: "Обзор возможностей" }, description: { en: "Explore advanced capabilities now available in Mira.", ru: "Изучите расширенные возможности Мира." }, slug: "features-overview" },
  { icon: "sparkles", title: { en: "What's new in Mira", ru: "Что нового в Мира" }, description: { en: "Discover the latest advances in Mira models.", ru: "Откройте последние достижения моделей Мира." }, slug: "whats-new" },
  { icon: "code", title: { en: "API reference", ru: "Справочник API" }, description: { en: "Integrate and scale using our API and SDKs.", ru: "Интегрируйте и масштабируйте с нашим API и SDK." }, slug: "api/overview" },
  { icon: "monitor", title: { en: "Console", ru: "Консоль" }, description: { en: "Craft and test powerful prompts in your browser.", ru: "Создавайте и тестируйте промпты в браузере." }, slug: "quickstart" },
  { icon: "star", title: { en: "Changelog", ru: "Журнал изменений" }, description: { en: "Learn about changes and new features in Mira.", ru: "Узнайте об изменениях и новых функциях Мира." }, slug: "changelog" },
];

export const codeCards: HomeCard[] = [
  { icon: "terminal", title: { en: "Mira Code quickstart", ru: "Быстрый старт Mira Code" }, description: { en: "Get started with Mira Code.", ru: "Начните работу с Mira Code." }, slug: "mira-code/getting-started" },
  { icon: "terminal", title: { en: "Mira Code reference", ru: "Справочник Mira Code" }, description: { en: "Full reference documentation for Mira Code CLI.", ru: "Полная справочная документация Mira Code." }, slug: "mira-code/reference" },
  { icon: "star", title: { en: "Mira Code changelog", ru: "Журнал изменений Mira Code" }, description: { en: "Learn about changes and new features.", ru: "Узнайте об изменениях и новых функциях." }, slug: "mira-code/changelog" },
];
