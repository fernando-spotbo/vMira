"use client";

import { useState } from "react";
import Link from "next/link";
import { CodeBlock, Note, H1, H2, H3, P, DocLink, NavCards, UL, Table, InlineCode } from "./shared";
import { buildFeaturesContent } from "./pages/build-features";
import { buildAdvancedContent } from "./pages/build-advanced";
import { modelsCapabilitiesContent } from "./pages/models-capabilities";
import { apiReferenceContent } from "./pages/api-reference";
import { miraCodeContent } from "./pages/mira-code";
import { resourcesContent } from "./pages/resources";
import type { Locale } from "@/lib/i18n";

// ── Existing content pages ──────────────────────────────────

function IntroductionPage({ locale }: { locale: Locale }) {
  if (locale === "ru") {
    return (
      <>
        <H1>Введение в Мира</H1>
        <P>
          Мира — семейство мощных языковых моделей, разработанных для помощи в широком спектре задач.
          От генерации кода до анализа данных, от творческого письма до технической документации —
          Мира адаптируется к вашим потребностям.
        </P>
        <H2>Что может Мира</H2>
        <P>
          Мира обучена понимать контекст, следовать сложным инструкциям и генерировать
          полезные, точные ответы. Вот основные возможности:
        </P>
        <UL items={[
          { bold: "Генерация и анализ кода", text: "написание, отладка, рефакторинг на множестве языков программирования" },
          { bold: "Мультиязычность", text: "свободное общение на русском, английском и других языках" },
          { bold: "Анализ изображений", text: "понимание и описание визуального контента" },
          { bold: "Расширенное мышление", text: "пошаговое решение сложных задач с цепочкой рассуждений" },
          { bold: "Использование инструментов", text: "вызов функций и интеграция с внешними сервисами" },
          { bold: "Длинный контекст", text: "обработка объёмных документов и кодовых баз" },
        ]} />
        <H2>Начало работы</H2>
        <P>Готовы начать? Выберите подходящий путь:</P>
        <NavCards cards={[
          { href: "/docs/quickstart", title: "Быстрый старт API", desc: "Сделайте первый запрос за минуты" },
          { href: "/docs/mira-code/getting-started", title: "Mira Code CLI", desc: "Кодирование с ИИ в терминале" },
        ]} />
      </>
    );
  }
  return (
    <>
      <H1>Introduction to Mira</H1>
      <P>
        Mira is a family of powerful language models designed to assist with a wide range of tasks.
        From code generation to data analysis, from creative writing to technical documentation —
        Mira adapts to your needs.
      </P>
      <H2>What Mira can do</H2>
      <P>
        Mira is trained to understand context, follow complex instructions, and generate
        helpful, accurate responses. Here are its core capabilities:
      </P>
      <UL items={[
        { bold: "Code generation and analysis", text: "write, debug, refactor across many programming languages" },
        { bold: "Multilingual", text: "fluent in Russian, English, and other languages" },
        { bold: "Image understanding", text: "analyze and describe visual content" },
        { bold: "Extended thinking", text: "step-by-step reasoning for complex problems" },
        { bold: "Tool use", text: "call functions and integrate with external services" },
        { bold: "Long context", text: "process large documents and codebases" },
      ]} />
      <H2>Get started</H2>
      <P>Ready to begin? Choose your path:</P>
      <NavCards cards={[
        { href: "/docs/quickstart", title: "API quickstart", desc: "Make your first API call in minutes" },
        { href: "/docs/mira-code/getting-started", title: "Mira Code CLI", desc: "AI-powered coding in your terminal" },
      ]} />
    </>
  );
}

function QuickstartPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Быстрый старт" : "Quickstart"}</H1>
      <P>
        {isRu
          ? "Этот гайд поможет вам сделать первый вызов API Мира за считанные минуты."
          : "This guide will help you make your first Mira API call in minutes."
        }
      </P>

      <H2>{isRu ? "Предварительные требования" : "Prerequisites"}</H2>
      <P>
        {isRu
          ? "Вам понадобится API-ключ Мира. Получите его, зарегистрировавшись на "
          : "You'll need a Mira API key. Get one by signing up at "
        }
        <DocLink href="https://platform.vmira.ai">platform.vmira.ai</DocLink>.
      </P>

      <H2>{isRu ? "Установка" : "Installation"}</H2>
      <H3>cURL</H3>
      <P>{isRu ? "Не требуется установка — cURL доступен в большинстве систем." : "No installation needed — cURL is available on most systems."}</P>

      <H3>Python</H3>
      <CodeBlock title="pip" code="pip install requests" />

      <H3>JavaScript / Node.js</H3>
      <CodeBlock title="npm" code="npm install node-fetch" />

      <H3>Mira Code CLI</H3>
      <CodeBlock title="npm" code="npm install -g mira-code" />

      <H2>{isRu ? "Сделайте первый вызов" : "Make your first API call"}</H2>

      <H3>{isRu ? "Базовый URL" : "Base URL"}</H3>
      <CodeBlock code="https://api.vmira.ai/v1" />

      <H3>cURL</H3>
      <CodeBlock
        title="cURL"
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira",
    "messages": [
      {"role": "user", "content": "${isRu ? "Привет, Мира!" : "Hello, Mira!"}"}
    ]
  }'`}
      />

      <H3>Python</H3>
      <CodeBlock
        title="Python"
        code={`import requests

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={
        "model": "mira",
        "messages": [
            {"role": "user", "content": "${isRu ? "Объясни квантовые вычисления" : "Explain quantum computing"}"}
        ]
    }
)

print(response.json()["choices"][0]["message"]["content"])`}
      />

      <H3>JavaScript</H3>
      <CodeBlock
        title="JavaScript"
        code={`const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    messages: [{ role: "user", content: "${isRu ? "Привет!" : "Hello!"}" }],
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`}
      />

      <H3>{isRu ? "Использование OpenAI SDK" : "Using the OpenAI SDK"}</H3>
      <P>
        {isRu
          ? "Поскольку API Мира совместим с OpenAI, вы можете использовать официальный OpenAI SDK, просто изменив базовый URL:"
          : "Since the Mira API is OpenAI-compatible, you can use the official OpenAI SDK by simply changing the base URL:"
        }
      </P>
      <CodeBlock
        title="Python (OpenAI SDK)"
        code={`from openai import OpenAI

client = OpenAI(
    api_key="sk-mira-YOUR_API_KEY",
    base_url="https://api.vmira.ai/v1"
)

response = client.chat.completions.create(
    model="mira",
    messages=[{"role": "user", "content": "${isRu ? "Привет!" : "Hello!"}"}]
)

print(response.choices[0].message.content)`}
      />
      <CodeBlock
        title="JavaScript (OpenAI SDK)"
        code={`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-mira-YOUR_API_KEY",
  baseURL: "https://api.vmira.ai/v1",
});

const response = await client.chat.completions.create({
  model: "mira",
  messages: [{ role: "user", content: "${isRu ? "Привет!" : "Hello!"}" }],
});

console.log(response.choices[0].message.content);`}
      />

      <H2>{isRu ? "Ответ API" : "API response"}</H2>
      <P>{isRu ? "Успешный ответ выглядит так:" : "A successful response looks like this:"}</P>
      <CodeBlock
        title="JSON"
        code={`{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1711000000,
  "model": "mira",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "${isRu ? "Привет! Я Мира, ваш ИИ-ассистент. Чем могу помочь?" : "Hello! I'm Mira, your AI assistant. How can I help you?"}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 18,
    "total_tokens": 30
  }
}`}
      />

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        { href: "/docs/models", title: isRu ? "Обзор моделей" : "Models overview", desc: isRu ? "Сравните модели и выберите подходящую" : "Compare models and choose the right one" },
        { href: "/docs/streaming", title: isRu ? "Потоковые ответы" : "Streaming", desc: isRu ? "Получайте ответы в реальном времени" : "Get responses in real-time" },
        { href: "/docs/sdks", title: isRu ? "SDK и библиотеки" : "SDKs and libraries", desc: isRu ? "Интеграция с вашим языком программирования" : "Integrate with your programming language" },
      ]} />
    </>
  );
}

function ModelsPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Обзор моделей" : "Models overview"}</H1>
      <P>
        {isRu
          ? "Мира — семейство языковых моделей, оптимизированных для различных задач. Это руководство поможет сравнить доступные модели и выбрать подходящую."
          : "Mira is a family of language models optimized for different tasks. This guide helps you compare available models and choose the right one."
        }
      </P>

      <H2>{isRu ? "Текущие модели" : "Current models"}</H2>
      <Table
        headers={[isRu ? "Модель" : "Model", isRu ? "Описание" : "Description", isRu ? "Контекст" : "Context", isRu ? "Макс. вывод" : "Max output"]}
        rows={[
          ["mira", isRu ? "Универсальная модель для большинства задач" : "General-purpose model for most tasks", "32K", "4K"],
          ["mira-thinking", isRu ? "Расширенное мышление для сложных задач" : "Extended thinking for complex tasks", "32K", "8K"],
          ["mira-pro", isRu ? "Продвинутая модель для профессионального использования" : "Advanced model for professional use", "64K", "8K"],
          ["mira-max", isRu ? "Самая мощная модель с максимальным контекстом" : "Most capable model with maximum context", "128K", "16K"],
        ]}
      />

      <Note type="tip">
        {isRu
          ? "Список моделей доступен программно через эндпоинт GET /api/v1/models. Ответ включает context_window и max_output_tokens для каждой модели."
          : "The model list is available programmatically via the GET /api/v1/models endpoint. The response includes context_window and max_output_tokens for each model."
        }
      </Note>

      <H2>{isRu ? "Выбор модели" : "Choosing a model"}</H2>
      <P>
        {isRu
          ? "Если вы не уверены, какую модель выбрать, начните с mira для большинства задач. Для задач, требующих глубоких рассуждений, используйте mira-thinking."
          : "If you're unsure which model to use, start with mira for most tasks. For tasks requiring deep reasoning, use mira-thinking."
        }
      </P>
      <UL items={[
        { bold: "mira", text: isRu ? "Лучший баланс скорости и качества. Идеален для чатов, генерации контента, простых задач кодирования." : "Best balance of speed and quality. Ideal for chat, content generation, simple coding tasks." },
        { bold: "mira-thinking", text: isRu ? "Рассуждает шаг за шагом. Лучше для математики, логики, сложного анализа." : "Reasons step by step. Better for math, logic, complex analysis." },
        { bold: "mira-pro", text: isRu ? "Профессиональный уровень. Для корпоративных задач, длинных документов, сложного кодирования." : "Professional grade. For enterprise tasks, long documents, complex coding." },
        { bold: "mira-max", text: isRu ? "Максимальные возможности. Для самых сложных задач, огромных кодовых баз, исследований." : "Maximum capabilities. For the most complex tasks, large codebases, research." },
      ]} />

      <H2>{isRu ? "Цены" : "Pricing"}</H2>
      <Table
        headers={[isRu ? "Модель" : "Model", isRu ? "Ввод" : "Input", isRu ? "Вывод" : "Output"]}
        rows={[
          ["mira", "$0.50 / 1M tokens", "$1.50 / 1M tokens"],
          ["mira-thinking", "$1.00 / 1M tokens", "$3.00 / 1M tokens"],
          ["mira-pro", "$2.00 / 1M tokens", "$6.00 / 1M tokens"],
          ["mira-max", "$5.00 / 1M tokens", "$15.00 / 1M tokens"],
        ]}
      />

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        { href: "/docs/choosing-a-model", title: isRu ? "Как выбрать модель" : "Choosing a model", desc: isRu ? "Подробное руководство по выбору" : "Detailed guide to model selection" },
        { href: "/docs/pricing", title: isRu ? "Подробные цены" : "Detailed pricing", desc: isRu ? "Тарифные планы и калькулятор стоимости" : "Pricing tiers and cost calculator" },
      ]} />
    </>
  );
}

function ApiOverviewPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Обзор API" : "API overview"}</H1>
      <P>
        {isRu
          ? "API Мира совместим с форматом OpenAI, что упрощает миграцию. Аутентифицируйтесь с помощью API-ключа и отправляйте запросы к нашим эндпоинтам."
          : "The Mira API is compatible with the OpenAI format, making migration easy. Authenticate with your API key and send requests to our endpoints."
        }
      </P>

      <H2>{isRu ? "Базовый URL" : "Base URL"}</H2>
      <CodeBlock code="https://api.vmira.ai/v1" />

      <H2>{isRu ? "Аутентификация" : "Authentication"}</H2>
      <P>
        {isRu
          ? "Включите ваш API-ключ в заголовок Authorization:"
          : "Include your API key in the Authorization header:"
        }
      </P>
      <CodeBlock
        title="Header"
        code="Authorization: Bearer sk-mira-YOUR_API_KEY"
      />

      <Note type="warning">
        {isRu
          ? "Никогда не передавайте API-ключ в клиентском коде или публичных репозиториях. Храните ключи в переменных окружения."
          : "Never expose your API key in client-side code or public repositories. Store keys in environment variables."
        }
      </Note>

      <H2>{isRu ? "OpenAI-совместимость" : "OpenAI compatibility"}</H2>
      <P>
        {isRu
          ? "API Мира полностью совместим с форматом OpenAI. Если вы уже используете OpenAI SDK, достаточно изменить базовый URL и API-ключ:"
          : "The Mira API is fully compatible with the OpenAI format. If you're already using the OpenAI SDK, just change the base URL and API key:"
        }
      </P>
      <CodeBlock
        title={isRu ? "Миграция с OpenAI" : "Migration from OpenAI"}
        code={`# ${isRu ? "Было (OpenAI)" : "Before (OpenAI)"}
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1

# ${isRu ? "Стало (Мира)" : "After (Mira)"}
OPENAI_API_KEY=sk-mira-xxx
OPENAI_BASE_URL=https://api.vmira.ai/v1`}
      />

      <H2>{isRu ? "Доступные эндпоинты" : "Available endpoints"}</H2>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        {[
          { method: "POST", path: "/v1/chat/completions", desc: isRu ? "Создать завершение чата" : "Create a chat completion" },
          { method: "GET", path: "/api/v1/models", desc: isRu ? "Список доступных моделей" : "List available models" },
          { method: "POST", path: "/v1/embeddings", desc: isRu ? "Создать эмбеддинги текста" : "Create text embeddings" },
          { method: "POST", path: "/api/v1/api-keys", desc: isRu ? "Создать API-ключ" : "Create an API key" },
          { method: "GET", path: "/api/v1/auth/me/usage", desc: isRu ? "Получить данные об использовании" : "Get usage data" },
        ].map((e, i, arr) => (
          <div key={e.path} className={`flex items-center gap-4 px-5 py-3.5 text-[14px] ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
            <span className={`text-[12px] font-mono font-bold px-2 py-0.5 rounded ${e.method === "GET" ? "text-blue-400 bg-blue-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>{e.method}</span>
            <code className="font-mono text-white/70">{e.path}</code>
            <span className="text-white/40 ml-auto">{e.desc}</span>
          </div>
        ))}
      </div>

      <H2>{isRu ? "Ограничения запросов" : "Rate limits"}</H2>
      <P>
        {isRu
          ? "Ограничения запросов применяются на уровне API-ключа. При превышении лимита запросы вернут статус 429."
          : "Rate limits are applied per API key. If you exceed the limit, requests will return a 429 status code."
        }
      </P>
      <Table
        headers={[isRu ? "Тарифный план" : "Tier", isRu ? "Лимит" : "Limit"]}
        rows={[
          [isRu ? "Бесплатный" : "Free", isRu ? "20 запросов/день" : "20 requests/day"],
          ["Pro", isRu ? "500 запросов/день" : "500 requests/day"],
          ["Max", isRu ? "Без ограничений" : "Unlimited"],
        ]}
      />

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        { href: "/docs/api/authentication", title: isRu ? "Аутентификация" : "Authentication", desc: isRu ? "Подробнее о ключах и авторизации" : "Learn more about keys and authorization" },
        { href: "/docs/api/chat-completions", title: isRu ? "Chat Completions" : "Chat Completions", desc: isRu ? "Полная документация эндпоинта" : "Full endpoint documentation" },
        { href: "/docs/sdks", title: isRu ? "SDK и библиотеки" : "SDKs and libraries", desc: isRu ? "Интеграция с вашим языком" : "Integrate with your language" },
      ]} />
    </>
  );
}

// ── Placeholder for pages not yet written ───────────────────

function PlaceholderPage({ slug, locale }: { slug: string; locale: Locale }) {
  const isRu = locale === "ru";
  const { docsNav } = require("@/lib/docs/navigation");
  let title = slug;
  for (const section of docsNav) {
    const item = section.items.find((i: any) => i.slug === slug);
    if (item) {
      title = (locale === "ru" ? item.title.ru : item.title.en) || slug;
      break;
    }
  }

  return (
    <>
      <H1>{title}</H1>
      <P>
        {isRu
          ? "Эта страница документации находится в разработке. Пожалуйста, проверьте позже."
          : "This documentation page is under development. Please check back soon."
        }
      </P>
      <Note type="info">
        {isRu
          ? "Мы активно работаем над расширением документации. Если у вас есть вопросы, свяжитесь с нами через support@vmira.ai."
          : "We're actively working on expanding the documentation. If you have questions, reach out to us at support@vmira.ai."
        }
      </Note>
    </>
  );
}

// ── Content map — merge all section maps ────────────────────

const coreContent: Record<string, React.FC<{ locale: Locale }>> = {
  "introduction": IntroductionPage,
  "quickstart": QuickstartPage,
  "models": ModelsPage,
  "api/overview": ApiOverviewPage,
};

const contentMap: Record<string, React.FC<{ locale: Locale }>> = {
  ...coreContent,
  ...buildFeaturesContent,
  ...buildAdvancedContent,
  ...modelsCapabilitiesContent,
  ...apiReferenceContent,
  ...miraCodeContent,
  ...resourcesContent,
};

export function DocsContent({ slug, locale }: { slug: string; locale: Locale }) {
  const PageComponent = contentMap[slug];

  if (PageComponent) {
    return <PageComponent locale={locale} />;
  }

  return <PlaceholderPage slug={slug} locale={locale} />;
}
