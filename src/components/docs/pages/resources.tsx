"use client";
import Link from "next/link";
import { CodeBlock, Note, H1, H2, H3, P, DocLink, NavCards, UL, Table, InlineCode } from "../shared";
import type { Locale } from "@/lib/i18n";

// ── 1. SDKs & Libraries ────────────────────────────────────

function SdksPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "SDK и библиотеки" : "SDKs & Libraries"}</H1>
      <P>
        {isRu
          ? "API Мира полностью совместим с форматом OpenAI, что позволяет использовать любой существующий OpenAI SDK — достаточно изменить базовый URL. Ниже представлены официальные инструменты и руководства по интеграции с популярными библиотеками."
          : "The Mira API is fully compatible with the OpenAI format, allowing you to use any existing OpenAI SDK — just change the base URL. Below are official tools and guides for integrating with popular libraries."
        }
      </P>

      {/* ── Official CLI ── */}
      <H2>{isRu ? "Официальные инструменты" : "Official Tools"}</H2>

      <H3>Mira Code CLI</H3>
      <P>
        {isRu
          ? "Mira Code — официальный CLI для работы с ИИ прямо в терминале. Установите глобально через npm:"
          : "Mira Code is the official CLI for AI-powered development right in your terminal. Install it globally via npm:"
        }
      </P>
      <CodeBlock title="npm" code="npm install -g mira-code" />
      <P>
        {isRu
          ? "После установки авторизуйтесь через device code flow и начните работу:"
          : "After installation, authenticate via device code flow and start working:"
        }
      </P>
      <CodeBlock title="Terminal" code={`mira auth login\nmira "Explain this codebase"`} />

      <Note type="tip">
        {isRu
          ? "Mira Code автоматически определяет модели, доступные на вашем тарифном плане. Переключайте модели через флаг --model."
          : "Mira Code automatically detects models available on your plan. Switch models using the --model flag."
        }
      </Note>

      {/* ── OpenAI SDK Compatibility ── */}
      <H2>{isRu ? "Совместимость с OpenAI SDK" : "OpenAI SDK Compatibility"}</H2>
      <P>
        {isRu
          ? "Поскольку API Мира реализует формат OpenAI, вы можете использовать официальные OpenAI SDK на любом языке программирования. Просто измените базовый URL на https://api.vmira.ai/v1 и используйте ваш API-ключ Мира."
          : "Since the Mira API implements the OpenAI format, you can use official OpenAI SDKs in any programming language. Simply change the base URL to https://api.vmira.ai/v1 and use your Mira API key."
        }
      </P>

      <H3>Python</H3>
      <P>
        {isRu
          ? "Установите официальный пакет OpenAI Python и укажите базовый URL Мира:"
          : "Install the official OpenAI Python package and point it to the Mira base URL:"
        }
      </P>
      <CodeBlock title="pip" code="pip install openai" />
      <CodeBlock
        title="Python"
        code={`from openai import OpenAI

client = OpenAI(
    api_key="sk-mira-YOUR_API_KEY",
    base_url="https://api.vmira.ai/v1",
)

response = client.chat.completions.create(
    model="mira",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, Mira!"},
    ],
)

print(response.choices[0].message.content)`}
      />

      <H3>JavaScript / TypeScript</H3>
      <P>
        {isRu
          ? "Используйте пакет openai для Node.js с настраиваемым базовым URL:"
          : "Use the openai package for Node.js with a custom base URL:"
        }
      </P>
      <CodeBlock title="npm" code="npm install openai" />
      <CodeBlock
        title="TypeScript"
        code={`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-mira-YOUR_API_KEY",
  baseURL: "https://api.vmira.ai/v1",
});

const completion = await client.chat.completions.create({
  model: "mira",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello, Mira!" },
  ],
});

console.log(completion.choices[0].message.content);`}
      />

      <H3>Go</H3>
      <P>
        {isRu
          ? "Библиотека openai-go поддерживает пользовательский базовый URL через опцию:"
          : "The openai-go library supports a custom base URL via an option:"
        }
      </P>
      <CodeBlock title="Terminal" code="go get github.com/openai/openai-go" />
      <CodeBlock
        title="Go"
        code={`package main

import (
    "context"
    "fmt"
    "github.com/openai/openai-go"
    "github.com/openai/openai-go/option"
)

func main() {
    client := openai.NewClient(
        option.WithAPIKey("sk-mira-YOUR_API_KEY"),
        option.WithBaseURL("https://api.vmira.ai/v1"),
    )

    completion, _ := client.Chat.Completions.New(
        context.Background(),
        openai.ChatCompletionNewParams{
            Model: "mira",
            Messages: []openai.ChatCompletionMessageParamUnion{
                openai.UserMessage("Hello, Mira!"),
            },
        },
    )

    fmt.Println(completion.Choices[0].Message.Content)
}`}
      />

      <H3>Rust</H3>
      <P>
        {isRu
          ? "Библиотека async-openai позволяет задать пользовательский базовый URL через конфигурацию:"
          : "The async-openai library lets you set a custom base URL via configuration:"
        }
      </P>
      <CodeBlock
        title="Cargo.toml"
        code={`[dependencies]\nasync-openai = "0.23"\ntokio = { version = "1", features = ["full"] }`}
      />
      <CodeBlock
        title="Rust"
        code={`use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestUserMessageArgs,
        CreateChatCompletionRequestArgs,
    },
    Client,
};

#[tokio::main]
async fn main() {
    let config = OpenAIConfig::new()
        .with_api_key("sk-mira-YOUR_API_KEY")
        .with_api_base("https://api.vmira.ai/v1");

    let client = Client::with_config(config);

    let request = CreateChatCompletionRequestArgs::default()
        .model("mira")
        .messages(vec![
            ChatCompletionRequestUserMessageArgs::default()
                .content("Hello, Mira!")
                .build()
                .unwrap()
                .into(),
        ])
        .build()
        .unwrap();

    let response = client.chat().create(request).await.unwrap();
    println!("{}", response.choices[0].message.content.as_ref().unwrap());
}`}
      />

      <H3>{isRu ? "Другие языки" : "Other Languages"}</H3>
      <P>
        {isRu
          ? "Любой OpenAI-совместимый SDK работает с Мира. Вот краткий обзор для других языков:"
          : "Any OpenAI-compatible SDK works with Mira. Here is a quick overview for other languages:"
        }
      </P>
      <Table
        headers={[
          isRu ? "Язык" : "Language",
          isRu ? "Пакет" : "Package",
          isRu ? "Параметр базового URL" : "Base URL Setting",
        ]}
        rows={[
          ["Ruby", "ruby-openai", 'OpenAI::Client.new(uri_base: "https://api.vmira.ai/v1")'],
          ["PHP", "openai-php/client", '$client->withBaseUri("https://api.vmira.ai/v1")'],
          ["Java", "openai-java", 'OpenAIClient.builder().baseUrl("https://api.vmira.ai/v1")'],
          [".NET", "OpenAI (NuGet)", 'new OpenAIClientOptions { Endpoint = new Uri("https://api.vmira.ai/v1") }'],
        ]}
      />

      {/* ── Framework Integrations ── */}
      <H2>{isRu ? "Интеграции с фреймворками" : "Framework Integrations"}</H2>

      <H3>LangChain (Python)</H3>
      <P>
        {isRu
          ? "LangChain поддерживает любой OpenAI-совместимый API через класс ChatOpenAI:"
          : "LangChain supports any OpenAI-compatible API through the ChatOpenAI class:"
        }
      </P>
      <CodeBlock title="pip" code="pip install langchain-openai" />
      <CodeBlock
        title="Python"
        code={`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="mira",
    api_key="sk-mira-YOUR_API_KEY",
    base_url="https://api.vmira.ai/v1",
)

response = llm.invoke("Explain quantum computing in simple terms.")
print(response.content)`}
      />

      <H3>LangChain (JavaScript)</H3>
      <P>
        {isRu
          ? "Аналогично, в JavaScript-версии LangChain используйте ChatOpenAI с настройкой:"
          : "Similarly, in the JavaScript version of LangChain, use ChatOpenAI with configuration:"
        }
      </P>
      <CodeBlock title="npm" code="npm install @langchain/openai" />
      <CodeBlock
        title="TypeScript"
        code={`import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  model: "mira",
  apiKey: "sk-mira-YOUR_API_KEY",
  configuration: {
    baseURL: "https://api.vmira.ai/v1",
  },
});

const response = await llm.invoke("Explain quantum computing.");
console.log(response.content);`}
      />

      <H3>LlamaIndex</H3>
      <P>
        {isRu
          ? "LlamaIndex позволяет использовать Мира как LLM-бэкенд через OpenAI-совместимый провайдер:"
          : "LlamaIndex lets you use Mira as an LLM backend through the OpenAI-compatible provider:"
        }
      </P>
      <CodeBlock title="pip" code="pip install llama-index-llms-openai-like" />
      <CodeBlock
        title="Python"
        code={`from llama_index.llms.openai_like import OpenAILike

llm = OpenAILike(
    model="mira",
    api_key="sk-mira-YOUR_API_KEY",
    api_base="https://api.vmira.ai/v1",
    is_chat_model=True,
)

response = llm.complete("Summarize the theory of relativity.")
print(response)`}
      />

      <Note type="info">
        {isRu
          ? "Все интеграции с фреймворками наследуют возможности API Мира: стриминг, tool use, vision и расширенное мышление."
          : "All framework integrations inherit Mira API capabilities: streaming, tool use, vision, and extended thinking."
        }
      </Note>

      {/* ── Community ── */}
      <H2>{isRu ? "Сообщество и вклад" : "Community & Contributions"}</H2>
      <P>
        {isRu
          ? "Если вы разработали библиотеку или инструмент для интеграции с Мира, свяжитесь с нами по адресу developers@vmira.ai — мы будем рады добавить его в этот список."
          : "If you have built a library or tool for Mira integration, contact us at developers@vmira.ai — we would love to add it to this list."
        }
      </P>

      <NavCards cards={[
        {
          href: "/docs/quickstart",
          title: isRu ? "Быстрый старт" : "Quickstart",
          desc: isRu ? "Сделайте первый вызов API за минуты" : "Make your first API call in minutes",
        },
        {
          href: "/docs/api/overview",
          title: isRu ? "Справочник API" : "API Reference",
          desc: isRu ? "Полная документация всех эндпоинтов" : "Complete documentation for all endpoints",
        },
      ]} />
    </>
  );
}

// ── 2. Security Best Practices ──────────────────────────────

function SecurityPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Безопасность" : "Security Best Practices"}</H1>
      <P>
        {isRu
          ? "Безопасность — приоритет платформы Мира. Эта страница описывает рекомендации по безопасной работе с API, обработке данных и защите вашей инфраструктуры."
          : "Security is a top priority for the Mira platform. This page covers recommendations for securely working with the API, handling data, and protecting your infrastructure."
        }
      </P>

      {/* ── API Key Security ── */}
      <H2>{isRu ? "Безопасность API-ключей" : "API Key Security"}</H2>
      <P>
        {isRu
          ? "API-ключи предоставляют полный доступ к вашему аккаунту. Обращайтесь с ними как с паролями."
          : "API keys grant full access to your account. Treat them like passwords."
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Переменные окружения" : "Environment variables",
          text: isRu
            ? "Всегда храните ключи в переменных окружения (MIRA_API_KEY), никогда не хардкодьте их в исходном коде."
            : "Always store keys in environment variables (MIRA_API_KEY), never hardcode them in source code.",
        },
        {
          bold: isRu ? "Клиентский код" : "Client-side code",
          text: isRu
            ? "Никогда не включайте API-ключи в клиентский JavaScript, мобильные приложения или публичные репозитории."
            : "Never include API keys in client-side JavaScript, mobile apps, or public repositories.",
        },
        {
          bold: isRu ? "Ротация ключей" : "Key rotation",
          text: isRu
            ? "Регулярно обновляйте API-ключи. Если ключ скомпрометирован, немедленно отзовите его в панели управления."
            : "Rotate API keys regularly. If a key is compromised, revoke it immediately from the dashboard.",
        },
        {
          bold: isRu ? "Принцип минимальных привилегий" : "Least privilege",
          text: isRu
            ? "Создавайте отдельные ключи для разных сервисов и сред (разработка, продакшн)."
            : "Create separate keys for different services and environments (development, production).",
        },
      ]} />

      <CodeBlock
        title={isRu ? "Правильный способ хранения ключей" : "Correct way to store keys"}
        code={`# .env file (добавьте в .gitignore / add to .gitignore)
MIRA_API_KEY=sk-mira-your-secret-key

# Python
import os
api_key = os.environ["MIRA_API_KEY"]

# Node.js
const apiKey = process.env.MIRA_API_KEY;`}
      />

      <Note type="warning">
        {isRu
          ? "Если вы случайно опубликовали API-ключ (например, в git-коммите), немедленно отзовите его и создайте новый в настройках аккаунта на platform.vmira.ai."
          : "If you accidentally expose an API key (e.g., in a git commit), revoke it immediately and create a new one in your account settings at platform.vmira.ai."
        }
      </Note>

      {/* ── HTTPS & Encryption ── */}
      <H2>{isRu ? "HTTPS и шифрование" : "HTTPS & Encryption"}</H2>
      <P>
        {isRu
          ? "Все коммуникации с API Мира осуществляются через HTTPS с шифрованием TLS 1.2+. Незашифрованные HTTP-запросы автоматически отклоняются."
          : "All communication with the Mira API is conducted over HTTPS with TLS 1.2+ encryption. Unencrypted HTTP requests are automatically rejected."
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Транспортное шифрование" : "Transport encryption",
          text: isRu
            ? "Все данные между вашим приложением и серверами Мира зашифрованы в пути."
            : "All data between your application and Mira servers is encrypted in transit.",
        },
        {
          bold: isRu ? "Проверка сертификатов" : "Certificate validation",
          text: isRu
            ? "Убедитесь, что ваш HTTP-клиент проверяет SSL/TLS-сертификаты. Не отключайте проверку сертификатов."
            : "Ensure your HTTP client validates SSL/TLS certificates. Never disable certificate verification.",
        },
      ]} />

      {/* ── Data Handling ── */}
      <H2>{isRu ? "Обработка данных" : "Data Handling"}</H2>
      <P>
        {isRu
          ? "Мира не использует ваши запросы API для обучения моделей. Ваши данные остаются вашими."
          : "Mira does not use your API requests for model training. Your data remains yours."
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Без обучения на данных" : "No training on your data",
          text: isRu
            ? "Запросы через API не используются для обучения или улучшения моделей."
            : "API requests are not used for training or improving models.",
        },
        {
          bold: isRu ? "Хранение данных" : "Data retention",
          text: isRu
            ? "Логи запросов хранятся не более 30 дней для мониторинга и отладки, затем удаляются."
            : "Request logs are retained for up to 30 days for monitoring and debugging, then deleted.",
        },
        {
          bold: isRu ? "Чувствительные данные" : "Sensitive data",
          text: isRu
            ? "Не отправляйте в API конфиденциальные данные (пароли, номера карт, персональные данные) без необходимости."
            : "Avoid sending sensitive data (passwords, card numbers, personal data) to the API unless necessary.",
        },
      ]} />

      {/* ── Content Filtering ── */}
      <H2>{isRu ? "Фильтрация контента" : "Content Filtering"}</H2>
      <P>
        {isRu
          ? "Мира включает автоматическую модерацию контента для предотвращения генерации вредного материала. Система работает в реальном времени и покрывает:"
          : "Mira includes automatic content moderation to prevent generation of harmful material. The system works in real time and covers:"
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Входная фильтрация" : "Input filtering",
          text: isRu
            ? "Запросы проверяются на наличие вредоносных инструкций перед обработкой."
            : "Requests are checked for malicious instructions before processing.",
        },
        {
          bold: isRu ? "Выходная фильтрация" : "Output filtering",
          text: isRu
            ? "Ответы проверяются на потенциально вредный или неуместный контент."
            : "Responses are checked for potentially harmful or inappropriate content.",
        },
      ]} />

      {/* ── Rate Limiting ── */}
      <H2>{isRu ? "Ограничение запросов" : "Rate Limiting"}</H2>
      <P>
        {isRu
          ? "Ограничения запросов защищают платформу от злоупотреблений и обеспечивают справедливое распределение ресурсов."
          : "Rate limits protect the platform from abuse and ensure fair resource allocation."
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Лимиты по ключу" : "Per-key limits",
          text: isRu
            ? "Каждый API-ключ имеет индивидуальные лимиты в зависимости от тарифного плана."
            : "Each API key has individual limits based on the subscription plan.",
        },
        {
          bold: isRu ? "Заголовки ответа" : "Response headers",
          text: isRu
            ? "Следите за заголовками X-RateLimit-Remaining и Retry-After для управления скоростью запросов."
            : "Monitor X-RateLimit-Remaining and Retry-After headers to manage request rate.",
        },
        {
          bold: isRu ? "Стратегия повторов" : "Retry strategy",
          text: isRu
            ? "Реализуйте экспоненциальную задержку (exponential backoff) при получении ошибки 429."
            : "Implement exponential backoff when receiving a 429 error.",
        },
      ]} />

      {/* ── Authentication Security ── */}
      <H2>{isRu ? "Безопасность аутентификации" : "Authentication Security"}</H2>
      <P>
        {isRu
          ? "Mira Code CLI использует device code flow для аутентификации, что исключает необходимость ввода пароля в терминале."
          : "Mira Code CLI uses device code flow for authentication, eliminating the need to enter passwords in the terminal."
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Device code flow" : "Device code flow",
          text: isRu
            ? "Аутентификация происходит через браузер — CLI получает только JWT-токен после подтверждения."
            : "Authentication happens via the browser — the CLI only receives a JWT token after confirmation.",
        },
        {
          bold: isRu ? "Обработка JWT" : "JWT handling",
          text: isRu
            ? "Токены хранятся в безопасном месте на диске и автоматически обновляются при истечении срока."
            : "Tokens are stored securely on disk and automatically refreshed when they expire.",
        },
        {
          bold: isRu ? "Выход из системы" : "Logout",
          text: isRu
            ? "Используйте mira auth logout для удаления сохранённых токенов."
            : "Use mira auth logout to remove stored tokens.",
        },
      ]} />

      {/* ── Infrastructure ── */}
      <H2>{isRu ? "Инфраструктура" : "Infrastructure"}</H2>
      <P>
        {isRu
          ? "Платформа Мира размещена в защищённых дата-центрах с многоуровневой защитой."
          : "The Mira platform is hosted in secure data centers with multi-layered protection."
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Защита от DDoS" : "DDoS protection",
          text: isRu
            ? "Активная защита от DDoS-атак на уровне сети и приложения."
            : "Active DDoS protection at the network and application level.",
        },
        {
          bold: isRu ? "Мониторинг" : "Monitoring",
          text: isRu
            ? "Круглосуточный мониторинг систем с автоматическим оповещением о подозрительной активности."
            : "24/7 system monitoring with automatic alerting for suspicious activity.",
        },
        {
          bold: isRu ? "Резервное копирование" : "Backups",
          text: isRu
            ? "Регулярное резервное копирование данных с географическим распределением."
            : "Regular data backups with geographic distribution.",
        },
      ]} />

      {/* ── Responsible AI ── */}
      <H2>{isRu ? "Ответственный ИИ" : "Responsible AI"}</H2>
      <P>
        {isRu
          ? "Мира придерживается принципов ответственного использования ИИ, включая безопасность контента и снижение предвзятости."
          : "Mira follows responsible AI principles including content safety and bias mitigation."
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Безопасность контента" : "Content safety",
          text: isRu
            ? "Модели обучены отказываться от генерации вредного, незаконного или опасного контента."
            : "Models are trained to refuse generation of harmful, illegal, or dangerous content.",
        },
        {
          bold: isRu ? "Снижение предвзятости" : "Bias mitigation",
          text: isRu
            ? "Постоянная работа по выявлению и устранению предвзятостей в ответах модели."
            : "Ongoing work to identify and reduce biases in model responses.",
        },
      ]} />

      {/* ── Security Checklist ── */}
      <H2>{isRu ? "Чек-лист безопасности" : "Security Checklist"}</H2>
      <P>
        {isRu
          ? "Используйте этот чек-лист для проверки безопасности вашей интеграции с Мира:"
          : "Use this checklist to verify the security of your Mira integration:"
        }
      </P>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        {[
          isRu ? "API-ключи хранятся в переменных окружения, не в коде" : "API keys stored in environment variables, not in code",
          isRu ? "API-ключи не включены в клиентский JavaScript" : "API keys not included in client-side JavaScript",
          isRu ? ".env файлы добавлены в .gitignore" : ".env files added to .gitignore",
          isRu ? "API-ключи ротируются каждые 90 дней" : "API keys rotated every 90 days",
          isRu ? "Все запросы отправляются через HTTPS" : "All requests sent over HTTPS",
          isRu ? "Реализована обработка ошибок 429 (rate limit)" : "429 (rate limit) error handling implemented",
          isRu ? "Экспоненциальная задержка при повторных попытках" : "Exponential backoff on retries",
          isRu ? "Чувствительные данные не передаются в промптах" : "Sensitive data not passed in prompts",
          isRu ? "Логирование не содержит API-ключей" : "Logging does not contain API keys",
          isRu ? "Версия TLS >= 1.2" : "TLS version >= 1.2",
        ].map((item, i, arr) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-5 py-3 text-[14px] text-white/70 ${
              i < arr.length - 1 ? "border-b border-white/[0.03]" : ""
            }`}
          >
            <span className="text-emerald-400 shrink-0">&#9744;</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* ── Reporting Vulnerabilities ── */}
      <H2>{isRu ? "Сообщение об уязвимостях" : "Reporting Vulnerabilities"}</H2>
      <P>
        {isRu
          ? "Если вы обнаружили уязвимость в безопасности платформы Мира, пожалуйста, сообщите нам по адресу:"
          : "If you discover a security vulnerability in the Mira platform, please report it to:"
        }
      </P>
      <CodeBlock code="security@vmira.ai" />
      <P>
        {isRu
          ? "Мы серьёзно относимся к каждому сообщению о безопасности и ответим в течение 48 часов. Пожалуйста, не публикуйте информацию об уязвимости до её устранения."
          : "We take every security report seriously and will respond within 48 hours. Please do not disclose vulnerability information publicly until it has been resolved."
        }
      </P>

      <Note type="info">
        {isRu
          ? "Для общих вопросов по безопасности и соответствию стандартам обращайтесь на compliance@vmira.ai."
          : "For general security and compliance inquiries, contact compliance@vmira.ai."
        }
      </Note>
    </>
  );
}

// ── 3. Platform Changelog ───────────────────────────────────

function PlatformChangelogPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  const changelog = [
    {
      date: isRu ? "Апрель 2026" : "April 2026",
      title: isRu ? "Документация и Mira Code v0.1.0" : "Documentation & Mira Code v0.1.0",
      items: isRu
        ? [
            "Запуск сайта документации platform.vmira.ai/docs с полной двуязычной поддержкой (EN/RU)",
            "Релиз Mira Code v0.1.0 — стабильная версия CLI для разработчиков",
            "Добавлены страницы SDKs, безопасности, глоссария и истории изменений",
            "Улучшена навигация по документации с разделами и поиском",
            "Добавлены примеры интеграции для LangChain, LlamaIndex и основных SDK",
          ]
        : [
            "Launched documentation site platform.vmira.ai/docs with full bilingual support (EN/RU)",
            "Released Mira Code v0.1.0 — stable CLI version for developers",
            "Added SDKs, security, glossary, and changelog documentation pages",
            "Improved documentation navigation with sections and search",
            "Added integration examples for LangChain, LlamaIndex, and major SDKs",
          ],
    },
    {
      date: isRu ? "Март 2026" : "March 2026",
      title: isRu ? "mira-max и пакетная обработка" : "mira-max & Batch Processing",
      items: isRu
        ? [
            "Запуск модели mira-max — самая мощная модель с контекстным окном 128K токенов",
            "Добавлен API пакетной обработки (Batch API) для массовых запросов со скидкой 50%",
            "Увеличено контекстное окно mira-pro до 64K токенов",
            "Новый эндпоинт /v1/batches для создания и управления пакетными задачами",
            "Улучшена производительность стриминга — уменьшена задержка первого токена на 35%",
            "Добавлена поддержка structured outputs (JSON mode) для всех моделей",
          ]
        : [
            "Launched mira-max model — most capable model with 128K token context window",
            "Added Batch Processing API for bulk requests at 50% discount",
            "Increased mira-pro context window to 64K tokens",
            "New /v1/batches endpoint for creating and managing batch jobs",
            "Improved streaming performance — reduced time-to-first-token by 35%",
            "Added structured outputs (JSON mode) support for all models",
          ],
    },
    {
      date: isRu ? "Февраль 2026" : "February 2026",
      title: isRu ? "Device Code Auth и Mira Code Beta" : "Device Code Auth & Mira Code Beta",
      items: isRu
        ? [
            "Реализована аутентификация через device code flow для CLI-инструментов",
            "Запуск Mira Code Beta — ИИ-ассистент для разработки в терминале",
            "Улучшены лимиты API: увеличены RPM для Pro и Max тарифов",
            "Добавлена поддержка API-ключей с ограниченной областью действия (scoped keys)",
            "Новая панель использования API в личном кабинете с подробной аналитикой",
            "Исправлены редкие ошибки таймаута при длинных стриминговых ответах",
          ]
        : [
            "Implemented device code flow authentication for CLI tools",
            "Launched Mira Code Beta — AI-powered development assistant in the terminal",
            "Improved API rate limits: increased RPM for Pro and Max plans",
            "Added support for scoped API keys with limited permissions",
            "New API usage dashboard with detailed analytics",
            "Fixed rare timeout errors during long streaming responses",
          ],
    },
    {
      date: isRu ? "Январь 2026" : "January 2026",
      title: isRu ? "mira-pro, Vision и Tool Use" : "mira-pro, Vision & Tool Use",
      items: isRu
        ? [
            "Запуск модели mira-pro — продвинутая модель для профессиональных задач",
            "Добавлена поддержка Vision (анализ изображений) для mira-pro и mira-max",
            "Реализован Tool Use / Function Calling для автоматической интеграции с внешними API",
            "Поддержка multi-turn conversations с историей сообщений до 64K токенов",
            "Добавлен эндпоинт /v1/embeddings для генерации векторных представлений текста",
            "Введены тарифные планы Pro и Max с расширенными лимитами",
          ]
        : [
            "Launched mira-pro model — advanced model for professional tasks",
            "Added Vision (image analysis) support for mira-pro and mira-max",
            "Implemented Tool Use / Function Calling for automatic integration with external APIs",
            "Multi-turn conversation support with message history up to 64K tokens",
            "Added /v1/embeddings endpoint for text vector embedding generation",
            "Introduced Pro and Max subscription plans with extended limits",
          ],
    },
    {
      date: isRu ? "Декабрь 2025" : "December 2025",
      title: isRu ? "Запуск платформы" : "Platform Launch",
      items: isRu
        ? [
            "Запуск платформы Мира — api.vmira.ai и platform.vmira.ai",
            "Доступны модели mira (универсальная) и mira-thinking (расширенное мышление)",
            "OpenAI-совместимый API: /v1/chat/completions, /v1/models",
            "Полная поддержка стриминга через Server-Sent Events (SSE)",
            "Регистрация и управление API-ключами через личный кабинет",
            "Документация API и примеры кода для Python, JavaScript и cURL",
            "Бесплатный тариф: 20 запросов в день для ознакомления с платформой",
          ]
        : [
            "Launched the Mira platform — api.vmira.ai and platform.vmira.ai",
            "Available models: mira (general-purpose) and mira-thinking (extended thinking)",
            "OpenAI-compatible API: /v1/chat/completions, /v1/models",
            "Full streaming support via Server-Sent Events (SSE)",
            "Registration and API key management through the dashboard",
            "API documentation and code examples for Python, JavaScript, and cURL",
            "Free tier: 20 requests per day to explore the platform",
          ],
    },
  ];

  return (
    <>
      <H1>{isRu ? "История изменений" : "Platform Changelog"}</H1>
      <P>
        {isRu
          ? "Хронология обновлений платформы Мира, API и инструментов разработчика. Новые записи добавляются в начало списка."
          : "A chronological record of updates to the Mira platform, API, and developer tools. New entries are added at the top."
        }
      </P>

      <Note type="tip">
        {isRu
          ? "Подпишитесь на обновления на platform.vmira.ai, чтобы получать уведомления о новых релизах и изменениях API."
          : "Subscribe to updates at platform.vmira.ai to receive notifications about new releases and API changes."
        }
      </Note>

      {changelog.map((entry, idx) => (
        <div key={idx} className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[13px] font-mono text-white/40 bg-white/[0.04] px-3 py-1 rounded-full">
              {entry.date}
            </span>
          </div>
          <H3>{entry.title}</H3>
          <ul className="list-disc pl-6 mb-4 space-y-2 text-[15px] text-white/80 leading-relaxed">
            {entry.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          {idx < changelog.length - 1 && (
            <div className="border-b border-white/[0.04] mt-8" />
          )}
        </div>
      ))}

      <H2>{isRu ? "Предстоящие обновления" : "Upcoming Updates"}</H2>
      <P>
        {isRu
          ? "Мы постоянно работаем над улучшением платформы. Вот что запланировано на ближайшее время:"
          : "We are continuously working on improving the platform. Here is what is planned for the near future:"
        }
      </P>
      <UL items={[
        {
          bold: isRu ? "Fine-tuning API" : "Fine-tuning API",
          text: isRu
            ? "Возможность дообучения моделей на ваших данных через API."
            : "Ability to fine-tune models on your data through the API.",
        },
        {
          bold: isRu ? "Webhooks" : "Webhooks",
          text: isRu
            ? "Уведомления о завершении пакетных задач и других событиях."
            : "Notifications for batch job completion and other events.",
        },
        {
          bold: isRu ? "Assistants API" : "Assistants API",
          text: isRu
            ? "Создание постоянных ИИ-ассистентов с файловым хранилищем и инструментами."
            : "Create persistent AI assistants with file storage and tools.",
        },
        {
          bold: isRu ? "Расширение моделей" : "Model expansion",
          text: isRu
            ? "Новые специализированные модели для кодирования, анализа и генерации."
            : "New specialized models for coding, analysis, and generation.",
        },
      ]} />
    </>
  );
}

// ── 4. Technical Glossary ───────────────────────────────────

function GlossaryPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  const terms: { term: string; termRu: string; def: string; defRu: string }[] = [
    {
      term: "API Key",
      termRu: "API-ключ",
      def: "A secret token used to authenticate requests to the Mira API. API keys should be stored securely in environment variables and never shared publicly.",
      defRu: "Секретный токен для аутентификации запросов к API Мира. API-ключи следует хранить в переменных окружения и никогда не публиковать.",
    },
    {
      term: "Base URL",
      termRu: "Базовый URL",
      def: "The root URL for all API requests. For Mira, the base URL is https://api.vmira.ai/v1. OpenAI SDKs can be pointed to this URL for compatibility.",
      defRu: "Корневой URL для всех API-запросов. Для Мира базовый URL — https://api.vmira.ai/v1. OpenAI SDK можно настроить на этот URL для совместимости.",
    },
    {
      term: "Chat Completion",
      termRu: "Завершение чата",
      def: "The primary API endpoint for generating model responses. Accepts a list of messages and returns the model's reply. Endpoint: POST /v1/chat/completions.",
      defRu: "Основной эндпоинт API для генерации ответов модели. Принимает список сообщений и возвращает ответ модели. Эндпоинт: POST /v1/chat/completions.",
    },
    {
      term: "Context Window",
      termRu: "Контекстное окно",
      def: "The maximum number of tokens (input + output) a model can process in a single request. Mira models range from 32K to 128K tokens.",
      defRu: "Максимальное количество токенов (ввод + вывод), которое модель может обработать за один запрос. Модели Мира поддерживают от 32K до 128K токенов.",
    },
    {
      term: "Embeddings",
      termRu: "Эмбеддинги",
      def: "Numerical vector representations of text that capture semantic meaning. Used for semantic search, clustering, and similarity comparisons. Endpoint: POST /v1/embeddings.",
      defRu: "Числовые векторные представления текста, отражающие семантическое значение. Используются для семантического поиска, кластеризации и сравнения схожести.",
    },
    {
      term: "Extended Thinking",
      termRu: "Расширенное мышление",
      def: "A capability where the model performs step-by-step reasoning before providing a final answer. Available via the mira-thinking model for complex analytical tasks.",
      defRu: "Возможность модели выполнять пошаговое рассуждение перед итоговым ответом. Доступно через модель mira-thinking для сложных аналитических задач.",
    },
    {
      term: "Few-Shot Learning",
      termRu: "Обучение на нескольких примерах",
      def: "A prompting technique where you provide a few examples of the desired input-output format in the prompt to guide the model's behavior.",
      defRu: "Техника промптинга, при которой в промпте приводятся несколько примеров желаемого формата ввода-вывода для направления поведения модели.",
    },
    {
      term: "Fine-Tuning",
      termRu: "Дообучение",
      def: "The process of further training a base model on a specific dataset to improve its performance for a particular task or domain. Coming soon to the Mira platform.",
      defRu: "Процесс дополнительного обучения базовой модели на специфическом наборе данных для улучшения результатов в конкретной задаче или области. Скоро на платформе Мира.",
    },
    {
      term: "Function Calling",
      termRu: "Вызов функций",
      def: "A feature that allows the model to generate structured JSON arguments for predefined functions, enabling integration with external tools and APIs. Also called Tool Use.",
      defRu: "Функция, позволяющая модели генерировать структурированные JSON-аргументы для предопределённых функций, обеспечивая интеграцию с внешними инструментами и API. Также называется Tool Use.",
    },
    {
      term: "Hallucination",
      termRu: "Галлюцинация",
      def: "When a model generates information that is factually incorrect or fabricated but presented confidently. Mitigated through extended thinking and grounding techniques.",
      defRu: "Ситуация, когда модель генерирует фактически некорректную или вымышленную информацию, представляя её уверенно. Снижается через расширенное мышление и методы заземления.",
    },
    {
      term: "JSON Mode",
      termRu: "Режим JSON",
      def: "A response format option that constrains the model to output only valid JSON. Enabled by setting response_format to { type: \"json_object\" } in the API request.",
      defRu: "Опция формата ответа, ограничивающая вывод модели только валидным JSON. Включается установкой response_format в { type: \"json_object\" } в запросе API.",
    },
    {
      term: "Max Tokens",
      termRu: "Максимум токенов",
      def: "The maximum number of tokens the model will generate in a response. Setting this parameter helps control response length and API costs.",
      defRu: "Максимальное количество токенов, которое модель сгенерирует в ответе. Этот параметр помогает контролировать длину ответа и стоимость API.",
    },
    {
      term: "Messages API",
      termRu: "API сообщений",
      def: "The chat-based API format where conversations are represented as an array of message objects, each with a role (system, user, assistant) and content.",
      defRu: "Формат API на основе чата, где разговоры представлены массивом объектов сообщений, каждый с ролью (system, user, assistant) и содержимым.",
    },
    {
      term: "Model",
      termRu: "Модель",
      def: "A trained AI system that generates responses. Mira offers multiple models (mira, mira-thinking, mira-pro, mira-max) optimized for different use cases.",
      defRu: "Обученная ИИ-система, генерирующая ответы. Мира предлагает несколько моделей (mira, mira-thinking, mira-pro, mira-max), оптимизированных для разных задач.",
    },
    {
      term: "Prompt",
      termRu: "Промпт",
      def: "The input text or instruction sent to the model. A well-crafted prompt is essential for getting accurate and relevant responses.",
      defRu: "Входной текст или инструкция, отправляемая модели. Хорошо составленный промпт необходим для получения точных и релевантных ответов.",
    },
    {
      term: "Prompt Engineering",
      termRu: "Промпт-инжиниринг",
      def: "The practice of designing and optimizing prompts to elicit better responses from AI models. Techniques include few-shot examples, chain-of-thought, and role-playing.",
      defRu: "Практика разработки и оптимизации промптов для получения лучших ответов от ИИ-моделей. Включает техники few-shot примеров, цепочки рассуждений и ролевой игры.",
    },
    {
      term: "RAG (Retrieval-Augmented Generation)",
      termRu: "RAG (генерация с дополнением извлечением)",
      def: "A technique that combines information retrieval with text generation. The model is given relevant context retrieved from a knowledge base before generating a response.",
      defRu: "Техника, объединяющая извлечение информации с генерацией текста. Модели предоставляется релевантный контекст из базы знаний перед генерацией ответа.",
    },
    {
      term: "Rate Limit",
      termRu: "Ограничение запросов",
      def: "The maximum number of API requests allowed within a time period. Exceeding the limit returns a 429 status code. Limits vary by subscription plan.",
      defRu: "Максимальное количество API-запросов, разрешённых за период времени. Превышение лимита возвращает код статуса 429. Лимиты зависят от тарифного плана.",
    },
    {
      term: "Response Format",
      termRu: "Формат ответа",
      def: "A parameter that controls the output structure of the model's response. Options include plain text and JSON mode for structured outputs.",
      defRu: "Параметр, управляющий структурой вывода ответа модели. Варианты включают обычный текст и режим JSON для структурированного вывода.",
    },
    {
      term: "Sampling Temperature",
      termRu: "Температура сэмплирования",
      def: "A parameter (0.0 to 2.0) controlling randomness in the model's output. Lower values (e.g., 0.1) produce more deterministic responses; higher values (e.g., 1.0) produce more creative ones.",
      defRu: "Параметр (0.0–2.0), управляющий случайностью в выводе модели. Низкие значения (напр., 0.1) дают более детерминированные ответы; высокие (напр., 1.0) — более креативные.",
    },
    {
      term: "Semantic Search",
      termRu: "Семантический поиск",
      def: "Search that understands the meaning of queries rather than matching exact keywords. Powered by embeddings and vector similarity comparisons.",
      defRu: "Поиск, понимающий смысл запросов, а не совпадение точных ключевых слов. Основан на эмбеддингах и сравнении векторной схожести.",
    },
    {
      term: "Server-Sent Events (SSE)",
      termRu: "Server-Sent Events (SSE)",
      def: "A web standard for streaming data from server to client over HTTP. Used by the Mira API for streaming responses token by token in real time.",
      defRu: "Веб-стандарт для потоковой передачи данных от сервера к клиенту через HTTP. Используется API Мира для стриминга ответов токен за токеном в реальном времени.",
    },
    {
      term: "Stop Sequence",
      termRu: "Стоп-последовательность",
      def: "A string or set of strings that, when generated, causes the model to stop producing further tokens. Useful for controlling where a response ends.",
      defRu: "Строка или набор строк, при генерации которых модель прекращает вывод дальнейших токенов. Полезно для управления окончанием ответа.",
    },
    {
      term: "Streaming",
      termRu: "Стриминг",
      def: "A mode where the API sends response tokens incrementally as they are generated, rather than waiting for the complete response. Enabled by setting stream: true.",
      defRu: "Режим, при котором API отправляет токены ответа по мере их генерации, не дожидаясь полного ответа. Включается установкой stream: true.",
    },
    {
      term: "System Prompt",
      termRu: "Системный промпт",
      def: "A special message with role \"system\" that sets the behavior, personality, and constraints for the AI model throughout the conversation.",
      defRu: "Специальное сообщение с ролью \"system\", задающее поведение, персонажа и ограничения для ИИ-модели на протяжении всего разговора.",
    },
    {
      term: "Token",
      termRu: "Токен",
      def: "The basic unit of text processing for language models. A token is roughly 3-4 characters in English or 1-2 characters in Russian. API pricing is based on token count.",
      defRu: "Базовая единица обработки текста для языковых моделей. Один токен — примерно 3–4 символа на английском или 1–2 символа на русском. Тарификация API основана на количестве токенов.",
    },
    {
      term: "Tool Use",
      termRu: "Использование инструментов",
      def: "The ability for a model to call external tools (functions) during a conversation. The model generates tool call arguments, your code executes the tool, and the result is fed back to the model.",
      defRu: "Способность модели вызывать внешние инструменты (функции) во время разговора. Модель генерирует аргументы вызова, ваш код выполняет инструмент, и результат передаётся обратно модели.",
    },
    {
      term: "Top-P (Nucleus Sampling)",
      termRu: "Top-P (ядерное сэмплирование)",
      def: "A sampling parameter that restricts token selection to the smallest set of tokens whose cumulative probability exceeds P. An alternative to temperature for controlling randomness.",
      defRu: "Параметр сэмплирования, ограничивающий выбор токенов наименьшим набором, чья суммарная вероятность превышает P. Альтернатива температуре для управления случайностью.",
    },
    {
      term: "Vector Database",
      termRu: "Векторная база данных",
      def: "A database optimized for storing and querying high-dimensional vectors (embeddings). Used in RAG systems for efficient semantic search over large document collections.",
      defRu: "База данных, оптимизированная для хранения и запросов многомерных векторов (эмбеддингов). Используется в RAG-системах для эффективного семантического поиска по большим коллекциям документов.",
    },
    {
      term: "Zero-Shot Learning",
      termRu: "Обучение с нуля (Zero-Shot)",
      def: "The ability of a model to perform a task without any examples in the prompt. The model relies solely on its pre-trained knowledge and the task description.",
      defRu: "Способность модели выполнять задачу без каких-либо примеров в промпте. Модель опирается исключительно на предобученные знания и описание задачи.",
    },
  ];

  return (
    <>
      <H1>{isRu ? "Глоссарий" : "Technical Glossary"}</H1>
      <P>
        {isRu
          ? "Справочник терминов, используемых в документации платформы Мира и в области ИИ/ML. Термины расположены в алфавитном порядке по английскому названию."
          : "A reference of terms used throughout the Mira platform documentation and in the AI/ML field. Terms are listed in alphabetical order."
        }
      </P>

      <Note type="tip">
        {isRu
          ? "Используйте поиск в браузере (Ctrl+F / Cmd+F) для быстрого нахождения нужного термина."
          : "Use your browser's search (Ctrl+F / Cmd+F) to quickly find a specific term."
        }
      </Note>

      <div className="space-y-1 mb-8">
        {terms.map((t, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-baseline gap-3 mb-2">
              <h3 className="text-[16px] font-medium text-white font-mono">
                {isRu ? t.termRu : t.term}
              </h3>
              {isRu && (
                <span className="text-[14px] text-white/30 font-mono">{t.term}</span>
              )}
            </div>
            <p className="text-[15px] text-white/70 leading-relaxed">
              {isRu ? t.defRu : t.def}
            </p>
          </div>
        ))}
      </div>

      <H2>{isRu ? "Не нашли термин?" : "Term not listed?"}</H2>
      <P>
        {isRu
          ? "Если вы встретили незнакомый термин в нашей документации, напишите нам на support@vmira.ai — мы добавим определение."
          : "If you encounter an unfamiliar term in our documentation, email us at support@vmira.ai and we will add a definition."
        }
      </P>

      <NavCards cards={[
        {
          href: "/docs/introduction",
          title: isRu ? "Введение" : "Introduction",
          desc: isRu ? "Начните знакомство с платформой Мира" : "Start learning about the Mira platform",
        },
        {
          href: "/docs/api/overview",
          title: isRu ? "Справочник API" : "API Reference",
          desc: isRu ? "Подробная документация всех эндпоинтов" : "Detailed documentation for all endpoints",
        },
      ]} />
    </>
  );
}

// ── Exports ─────────────────────────────────────────────────

export const resourcesContent: Record<string, React.FC<{ locale: Locale }>> = {
  "sdks": SdksPage,
  "security": SecurityPage,
  "changelog": PlatformChangelogPage,
  "glossary": GlossaryPage,
};
