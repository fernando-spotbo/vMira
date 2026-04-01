"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, ChevronRight, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { Locale } from "@/lib/i18n";

// ── Reusable components ─────────────────────────────────────

function CodeBlock({ title, code, language }: { title?: string; code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      {title && (
        <div className="flex items-center justify-between px-5 py-3 bg-white/[0.03] border-b border-white/[0.04]">
          <span className="text-[13px] font-medium text-white/50">{title}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="text-white/20 hover:text-white/50 transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <pre className="px-5 py-4 bg-[#0f0f0f] text-[13px] font-mono text-white/70 leading-7 overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}

function Note({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warning" | "tip" }) {
  const config = {
    info: { icon: <Info size={16} />, border: "border-blue-500/20", bg: "bg-blue-500/5", text: "text-blue-400" },
    warning: { icon: <AlertTriangle size={16} />, border: "border-amber-500/20", bg: "bg-amber-500/5", text: "text-amber-400" },
    tip: { icon: <Lightbulb size={16} />, border: "border-emerald-500/20", bg: "bg-emerald-500/5", text: "text-emerald-400" },
  }[type];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 mb-6 flex gap-3`}>
      <span className={`${config.text} shrink-0 mt-0.5`}>{config.icon}</span>
      <div className="text-[14px] text-white/70 leading-relaxed">{children}</div>
    </div>
  );
}

function ParamTable({ params }: { params: { name: string; type: string; required: boolean; desc: string }[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
      {params.map((p, i) => (
        <div
          key={p.name}
          className={`grid grid-cols-[150px_80px_80px_1fr] gap-4 px-5 py-3 text-[13px] ${
            i < params.length - 1 ? "border-b border-white/[0.03]" : ""
          }`}
        >
          <code className="font-mono font-medium text-white">{p.name}</code>
          <span className="text-white/40">{p.type}</span>
          <span className={p.required ? "text-white" : "text-white/30"}>
            {p.required ? "Required" : "Optional"}
          </span>
          <span className="text-white/50">{p.desc}</span>
        </div>
      ))}
    </div>
  );
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[28px] font-bold text-white mb-3">{children}</h1>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[20px] font-bold text-white mb-4 mt-10">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[16px] font-semibold text-white mb-3 mt-6">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-white/80 leading-[1.8] mb-4">{children}</p>;
}
function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/[0.06] border border-white/[0.06] px-1.5 py-0.5 rounded text-[13px] font-mono">
      {children}
    </code>
  );
}
function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/60 transition-colors">
      {children}
    </Link>
  );
}

// ── Content pages ───────────────────────────────────────────

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
        <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-white/80 leading-relaxed">
          <li><strong className="text-white">Генерация и анализ кода</strong> — написание, отладка, рефакторинг на множестве языков программирования</li>
          <li><strong className="text-white">Мультиязычность</strong> — свободное общение на русском, английском и других языках</li>
          <li><strong className="text-white">Анализ изображений</strong> — понимание и описание визуального контента</li>
          <li><strong className="text-white">Расширенное мышление</strong> — пошаговое решение сложных задач с цепочкой рассуждений</li>
          <li><strong className="text-white">Использование инструментов</strong> — вызов функций и интеграция с внешними сервисами</li>
          <li><strong className="text-white">Длинный контекст</strong> — обработка объёмных документов и кодовых баз</li>
        </ul>
        <H2>Начало работы</H2>
        <P>
          Готовы начать? Выберите подходящий путь:
        </P>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Link href="/docs/quickstart" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
            <h3 className="text-[15px] font-medium text-white mb-1">Быстрый старт API</h3>
            <p className="text-[13px] text-white/40">Сделайте первый запрос за минуты</p>
          </Link>
          <Link href="/docs/mira-code/getting-started" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
            <h3 className="text-[15px] font-medium text-white mb-1">Mira Code CLI</h3>
            <p className="text-[13px] text-white/40">Кодирование с ИИ в терминале</p>
          </Link>
        </div>
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
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-white/80 leading-relaxed">
        <li><strong className="text-white">Code generation and analysis</strong> — write, debug, refactor across many programming languages</li>
        <li><strong className="text-white">Multilingual</strong> — fluent in Russian, English, and other languages</li>
        <li><strong className="text-white">Image understanding</strong> — analyze and describe visual content</li>
        <li><strong className="text-white">Extended thinking</strong> — step-by-step reasoning for complex problems</li>
        <li><strong className="text-white">Tool use</strong> — call functions and integrate with external services</li>
        <li><strong className="text-white">Long context</strong> — process large documents and codebases</li>
      </ul>
      <H2>Get started</H2>
      <P>
        Ready to begin? Choose your path:
      </P>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Link href="/docs/quickstart" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
          <h3 className="text-[15px] font-medium text-white mb-1">API quickstart</h3>
          <p className="text-[13px] text-white/40">Make your first API call in minutes</p>
        </Link>
        <Link href="/docs/mira-code/getting-started" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
          <h3 className="text-[15px] font-medium text-white mb-1">Mira Code CLI</h3>
          <p className="text-[13px] text-white/40">AI-powered coding in your terminal</p>
        </Link>
      </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Link href="/docs/models" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
          <h3 className="text-[15px] font-medium text-white mb-1">{isRu ? "Обзор моделей" : "Models overview"}</h3>
          <p className="text-[13px] text-white/40">{isRu ? "Сравните модели и выберите подходящую" : "Compare models and choose the right one"}</p>
        </Link>
        <Link href="/docs/streaming" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
          <h3 className="text-[15px] font-medium text-white mb-1">{isRu ? "Потоковые ответы" : "Streaming"}</h3>
          <p className="text-[13px] text-white/40">{isRu ? "Получайте ответы в реальном времени" : "Get responses in real-time"}</p>
        </Link>
      </div>
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
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        <div className="grid grid-cols-4 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider">
          <span>{isRu ? "Модель" : "Model"}</span>
          <span>{isRu ? "Описание" : "Description"}</span>
          <span>{isRu ? "Контекст" : "Context"}</span>
          <span>{isRu ? "Макс. вывод" : "Max output"}</span>
        </div>
        {[
          { model: "mira", desc: isRu ? "Универсальная модель для большинства задач" : "General-purpose model for most tasks", ctx: "32K", out: "4K" },
          { model: "mira-thinking", desc: isRu ? "Расширенное мышление для сложных задач" : "Extended thinking for complex tasks", ctx: "32K", out: "8K" },
          { model: "mira-pro", desc: isRu ? "Продвинутая модель для профессионального использования" : "Advanced model for professional use", ctx: "64K", out: "8K" },
          { model: "mira-max", desc: isRu ? "Самая мощная модель с максимальным контекстом" : "Most capable model with maximum context", ctx: "128K", out: "16K" },
        ].map((m, i, arr) => (
          <div key={m.model} className={`grid grid-cols-4 gap-4 px-5 py-4 text-[14px] ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
            <code className="font-mono font-medium text-white">{m.model}</code>
            <span className="text-white/50">{m.desc}</span>
            <span className="text-white/40">{m.ctx}</span>
            <span className="text-white/40">{m.out}</span>
          </div>
        ))}
      </div>

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

      <H2>{isRu ? "Цены" : "Pricing"}</H2>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        <div className="grid grid-cols-3 gap-4 px-5 py-3 bg-white/[0.03] border-b border-white/[0.04] text-[12px] font-medium text-white/40 uppercase tracking-wider">
          <span>{isRu ? "Модель" : "Model"}</span>
          <span>{isRu ? "Ввод" : "Input"}</span>
          <span>{isRu ? "Вывод" : "Output"}</span>
        </div>
        {[
          { model: "mira", input: "$0.50 / 1M tokens", output: "$1.50 / 1M tokens" },
          { model: "mira-thinking", input: "$1.00 / 1M tokens", output: "$3.00 / 1M tokens" },
          { model: "mira-pro", input: "$2.00 / 1M tokens", output: "$6.00 / 1M tokens" },
          { model: "mira-max", input: "$5.00 / 1M tokens", output: "$15.00 / 1M tokens" },
        ].map((m, i, arr) => (
          <div key={m.model} className={`grid grid-cols-3 gap-4 px-5 py-4 text-[14px] ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
            <code className="font-mono font-medium text-white">{m.model}</code>
            <span className="text-white/40">{m.input}</span>
            <span className="text-white/40">{m.output}</span>
          </div>
        ))}
      </div>
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

      <H2>{isRu ? "Доступные эндпоинты" : "Available endpoints"}</H2>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        {[
          { method: "POST", path: "/v1/chat/completions", desc: isRu ? "Создать завершение чата" : "Create a chat completion" },
          { method: "GET", path: "/api/v1/models", desc: isRu ? "Список доступных моделей" : "List available models" },
          { method: "POST", path: "/api/v1/api-keys", desc: isRu ? "Создать API-ключ" : "Create an API key" },
          { method: "GET", path: "/api/v1/auth/me/usage", desc: isRu ? "Получить данные об использовании" : "Get usage data" },
        ].map((e, i, arr) => (
          <div key={e.path} className={`flex items-center gap-4 px-5 py-3.5 text-[14px] ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
            <span className="text-[12px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{e.method}</span>
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
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        {[
          { tier: isRu ? "Бесплатный" : "Free", limit: isRu ? "20 запросов/день" : "20 requests/day" },
          { tier: "Pro", limit: isRu ? "500 запросов/день" : "500 requests/day" },
          { tier: "Max", limit: isRu ? "Без ограничений" : "Unlimited" },
        ].map((r, i, arr) => (
          <div key={r.tier} className={`grid grid-cols-2 gap-4 px-5 py-3.5 text-[14px] ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
            <span className="font-medium text-white">{r.tier}</span>
            <span className="text-white/50">{r.limit}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// Placeholder for pages that aren't fully written yet
function PlaceholderPage({ slug, locale }: { slug: string; locale: Locale }) {
  const isRu = locale === "ru";
  // Find title from nav
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

// ── Main content router ─────────────────────────────────────

const contentMap: Record<string, React.FC<{ locale: Locale }>> = {
  "introduction": IntroductionPage,
  "quickstart": QuickstartPage,
  "models": ModelsPage,
  "api/overview": ApiOverviewPage,
};

export function DocsContent({ slug, locale }: { slug: string; locale: Locale }) {
  const PageComponent = contentMap[slug];

  if (PageComponent) {
    return <PageComponent locale={locale} />;
  }

  return <PlaceholderPage slug={slug} locale={locale} />;
}
