"use client";
import Link from "next/link";
import { CodeBlock, Note, H1, H2, H3, P, DocLink, NavCards, UL, Table, ParamTable, InlineCode, EndpointRow } from "../shared";
import type { Locale } from "@/lib/i18n";

// ────────────────────────────────────────────────────────────────
// 1. AuthenticationPage
// ────────────────────────────────────────────────────────────────

function AuthenticationPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <>
      <H1>{isRu ? "Аутентификация" : "Authentication"}</H1>
      <P>
        {isRu
          ? "API Mira использует ключи API для аутентификации запросов. Каждый запрос к защищённым эндпоинтам должен содержать действительный API-ключ в заголовке Authorization."
          : "The Mira API uses API keys to authenticate requests. Every request to protected endpoints must include a valid API key in the Authorization header."}
      </P>

      <H2>{isRu ? "Формат API-ключа" : "API key format"}</H2>
      <P>
        {isRu
          ? "API-ключи Mira имеют фиксированный формат: префикс sk-mira-, за которым следуют 40 шестнадцатеричных символов. Общая длина ключа составляет 48 символов."
          : "Mira API keys follow a fixed format: the prefix sk-mira- followed by 40 hexadecimal characters. The total key length is 48 characters."}
      </P>
      <CodeBlock title={isRu ? "Формат ключа" : "Key format"} code="sk-mira-{40 hex characters}" />
      <P>
        {isRu
          ? "Пример: sk-mira-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
          : "Example: sk-mira-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"}
      </P>

      <H2>{isRu ? "Получение API-ключа" : "Obtaining an API key"}</H2>
      <P>
        {isRu
          ? "Существует два способа получить API-ключ Mira:"
          : "There are two ways to obtain a Mira API key:"}
      </P>
      <UL items={[
        {
          bold: isRu ? "Веб-панель" : "Web dashboard",
          text: isRu
            ? "Войдите на platform.vmira.ai, перейдите в раздел \"API-ключи\" и нажмите \"Создать ключ\". Ключ отображается только один раз — сохраните его в безопасном месте."
            : "Sign in at platform.vmira.ai, navigate to the \"API Keys\" section, and click \"Create key\". The key is shown only once — store it in a secure location.",
        },
        {
          bold: "Mira Code CLI",
          text: isRu
            ? "Запустите mira auth login в терминале. CLI использует поток авторизации устройства (device code flow) для привязки CLI к вашей учётной записи и автоматического получения ключа."
            : "Run mira auth login in your terminal. The CLI uses the device code authorization flow to link the CLI to your account and automatically obtain a key.",
        },
      ]} />

      <H2>{isRu ? "Включение ключа в запросы" : "Including the key in requests"}</H2>
      <P>
        {isRu
          ? "Передавайте API-ключ в HTTP-заголовке Authorization с использованием схемы Bearer:"
          : "Pass the API key in the HTTP Authorization header using the Bearer scheme:"}
      </P>
      <CodeBlock title="Header" code="Authorization: Bearer sk-mira-YOUR_API_KEY" />

      <H3>cURL</H3>
      <CodeBlock
        title="cURL"
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer $MIRA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`}
      />

      <H3>Python</H3>
      <CodeBlock
        title="Python"
        code={`import os
import requests

api_key = os.environ["MIRA_API_KEY"]

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    json={
        "model": "mira",
        "messages": [{"role": "user", "content": "Hello"}],
    },
)

print(response.json())`}
      />

      <H3>JavaScript</H3>
      <CodeBlock
        title="JavaScript (Node.js)"
        code={`const apiKey = process.env.MIRA_API_KEY;

const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${apiKey}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    messages: [{ role: "user", content: "Hello" }],
  }),
});

const data = await response.json();
console.log(data);`}
      />

      <H2>{isRu ? "Переменные окружения" : "Environment variables"}</H2>
      <P>
        {isRu
          ? "Рекомендуемый способ хранения API-ключа — переменная окружения MIRA_API_KEY. Это предотвращает случайное попадание ключа в систему контроля версий."
          : "The recommended way to store your API key is the MIRA_API_KEY environment variable. This prevents accidental exposure in version control."}
      </P>
      <CodeBlock
        title={isRu ? "Установка переменной окружения" : "Setting the environment variable"}
        code={`# Linux / macOS
export MIRA_API_KEY="sk-mira-your-key-here"

# Windows (PowerShell)
$env:MIRA_API_KEY = "sk-mira-your-key-here"

# .env file (for frameworks like Next.js, Vite, etc.)
MIRA_API_KEY=sk-mira-your-key-here`}
      />

      <H2>{isRu ? "Лучшие практики безопасности" : "Security best practices"}</H2>
      <UL items={[
        {
          bold: isRu ? "Никогда не вставляйте ключи в клиентский код" : "Never embed keys in client-side code",
          text: isRu
            ? "API-ключи должны использоваться только на сервере. Браузерный JavaScript, мобильные приложения и публичные репозитории не должны содержать ключей."
            : "API keys should only be used server-side. Browser JavaScript, mobile apps, and public repositories must never contain keys.",
        },
        {
          bold: isRu ? "Используйте переменные окружения" : "Use environment variables",
          text: isRu
            ? "Храните ключи в .env файлах, которые добавлены в .gitignore, или в секретах CI/CD."
            : "Store keys in .env files that are listed in .gitignore, or in CI/CD secrets.",
        },
        {
          bold: isRu ? "Ротируйте ключи регулярно" : "Rotate keys regularly",
          text: isRu
            ? "Периодически создавайте новые ключи и отзывайте старые через панель на platform.vmira.ai."
            : "Periodically generate new keys and revoke old ones via the dashboard at platform.vmira.ai.",
        },
        {
          bold: isRu ? "Используйте отдельные ключи для разных сред" : "Use separate keys per environment",
          text: isRu
            ? "Создавайте отдельные ключи для разработки, тестирования и продакшена."
            : "Create dedicated keys for development, staging, and production.",
        },
        {
          bold: isRu ? "Отзовите скомпрометированные ключи немедленно" : "Revoke compromised keys immediately",
          text: isRu
            ? "Если ключ попал в открытый доступ, немедленно отзовите его в панели управления и создайте новый."
            : "If a key is exposed publicly, immediately revoke it in the dashboard and generate a replacement.",
        },
      ]} />
      <Note type="warning">
        {isRu
          ? "Если вы случайно опубликовали API-ключ (например, в коммит на GitHub), считайте его скомпрометированным. Немедленно отзовите его и создайте новый."
          : "If you accidentally publish an API key (e.g., in a GitHub commit), treat it as compromised. Revoke it immediately and create a new one."}
      </Note>

      <H2>{isRu ? "Поток авторизации устройства (Device Code Flow)" : "Device code flow"}</H2>
      <P>
        {isRu
          ? "Mira Code CLI использует поток авторизации устройства OAuth 2.0 для аутентификации пользователей. Это позволяет CLI получить API-ключ без необходимости вводить его вручную."
          : "The Mira Code CLI uses the OAuth 2.0 device authorization flow to authenticate users. This allows the CLI to obtain an API key without requiring manual entry."}
      </P>

      <H3>{isRu ? "Шаг 1: Запрос кода устройства" : "Step 1: Request a device code"}</H3>
      <CodeBlock
        title="POST /api/v1/auth/device/code"
        code={`curl -X POST https://api.vmira.ai/api/v1/auth/device/code`}
      />
      <P>{isRu ? "Ответ:" : "Response:"}</P>
      <CodeBlock
        title="JSON"
        code={`{
  "device_code": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "user_code": "AB3D-7FGH",
  "verification_uri": "https://platform.vmira.ai/authorize",
  "expires_in": 600,
  "interval": 5
}`}
      />

      <H3>{isRu ? "Шаг 2: Пользователь авторизует устройство" : "Step 2: User authorizes the device"}</H3>
      <P>
        {isRu
          ? "Пользователь открывает verification_uri в браузере и вводит user_code (формат XXXX-XXXX) для подтверждения авторизации."
          : "The user opens the verification_uri in a browser and enters the user_code (format XXXX-XXXX) to confirm authorization."}
      </P>

      <H3>{isRu ? "Шаг 3: Опрос для получения токена" : "Step 3: Poll for the token"}</H3>
      <CodeBlock
        title="POST /api/v1/auth/device/token"
        code={`curl -X POST https://api.vmira.ai/api/v1/auth/device/token \\
  -H "Content-Type: application/json" \\
  -d '{"device_code": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"}'`}
      />
      <P>
        {isRu
          ? "CLI опрашивает этот эндпоинт каждые interval секунд. До авторизации статус \"pending\". После авторизации возвращается API-ключ:"
          : "The CLI polls this endpoint every interval seconds. Before authorization, status is \"pending\". After authorization, it returns the API key:"}
      </P>
      <CodeBlock
        title={isRu ? "Ожидание" : "Pending"}
        code={`{"status": "pending"}`}
      />
      <CodeBlock
        title={isRu ? "Успешный ответ" : "Success response"}
        code={`{
  "status": "approved",
  "access_token": "sk-mira-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "token_type": "bearer",
  "expires_in": 2592000
}`}
      />

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/api/chat-completions",
          title: isRu ? "Завершения чата" : "Chat completions",
          desc: isRu ? "Узнайте, как делать запросы к API" : "Learn how to make API requests",
        },
        {
          href: "/docs/api/rate-limits",
          title: isRu ? "Лимиты запросов" : "Rate limits",
          desc: isRu ? "Понимание ограничений и тарифных планов" : "Understand limits and plan tiers",
        },
      ]} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// 2. ChatCompletionsPage
// ────────────────────────────────────────────────────────────────

function ChatCompletionsPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <>
      <H1>{isRu ? "Завершения чата" : "Chat completions"}</H1>
      <P>
        {isRu
          ? "Эндпоинт завершений чата — основной способ взаимодействия с моделями Mira. Он принимает список сообщений (диалог) и возвращает ответ модели. API полностью совместим с форматом OpenAI."
          : "The chat completions endpoint is the primary way to interact with Mira models. It accepts a list of messages (a conversation) and returns a model-generated response. The API is fully compatible with the OpenAI format."}
      </P>

      <H2>{isRu ? "Эндпоинт" : "Endpoint"}</H2>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        <EndpointRow method="POST" path="/v1/chat/completions" desc={isRu ? "Создать завершение чата" : "Create a chat completion"} />
      </div>

      <H2>{isRu ? "Параметры запроса" : "Request parameters"}</H2>
      <ParamTable params={[
        { name: "model", type: "string", required: true, desc: isRu ? "Идентификатор модели: mira, mira-thinking, mira-pro или mira-max" : "Model ID: mira, mira-thinking, mira-pro, or mira-max" },
        { name: "messages", type: "array", required: true, desc: isRu ? "Массив сообщений диалога (макс. 200). Каждое сообщение содержит role и content." : "Array of conversation messages (max 200). Each message has a role and content." },
        { name: "temperature", type: "float", required: false, desc: isRu ? "Степень случайности (0-2). Меньшие значения делают ответы более детерминированными. По умолчанию 0.7." : "Randomness (0-2). Lower values make responses more deterministic. Default 0.7." },
        { name: "max_tokens", type: "integer", required: false, desc: isRu ? "Максимальное количество токенов в ответе. По умолчанию 4096, максимум 16384." : "Maximum number of tokens in the response. Default 4096, max 16384." },
        { name: "stream", type: "boolean", required: false, desc: isRu ? "Включить потоковую передачу ответа через Server-Sent Events. По умолчанию false." : "Enable streaming via Server-Sent Events. Default false." },
      ]} />
      <Note type="info">
        {isRu
          ? "Каждое сообщение ограничено 32 000 символами. Дополнительные параметры OpenAI API (top_p, stop, tools, response_format и др.) планируются в будущих версиях."
          : "Each message is limited to 32,000 characters. Additional OpenAI API parameters (top_p, stop, tools, response_format, etc.) are planned for future releases."}
      </Note>

      <H2>{isRu ? "Формат сообщений" : "Message format"}</H2>
      <P>
        {isRu
          ? "Каждое сообщение в массиве messages содержит два обязательных поля:"
          : "Each message in the messages array contains two required fields:"}
      </P>
      <ParamTable params={[
        { name: "role", type: "string", required: true, desc: isRu ? "Роль автора: \"system\", \"user\" или \"assistant\"" : "The author's role: \"system\", \"user\", or \"assistant\"" },
        { name: "content", type: "string", required: true, desc: isRu ? "Текстовое содержание сообщения" : "The text content of the message" },
      ]} />
      <UL items={[
        {
          bold: "system",
          text: isRu
            ? "Системное сообщение задаёт поведение модели. Обычно ставится первым в массиве."
            : "The system message sets the model's behavior. Typically placed first in the array.",
        },
        {
          bold: "user",
          text: isRu
            ? "Сообщения пользователя — ввод, на который модель должна ответить."
            : "User messages are the input the model should respond to.",
        },
        {
          bold: "assistant",
          text: isRu
            ? "Предыдущие ответы модели. Используются для продолжения диалога."
            : "Previous model responses. Used to continue a conversation.",
        },
      ]} />

      <H2>{isRu ? "Полный пример запроса" : "Full request example"}</H2>

      <H3>cURL</H3>
      <CodeBlock
        title="cURL"
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer $MIRA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira",
    "messages": [
      {"role": "system", "content": "${isRu ? "Ты полезный ассистент." : "You are a helpful assistant."}"},
      {"role": "user", "content": "${isRu ? "Объясни рекурсию простыми словами" : "Explain recursion in simple terms"}"}
    ],
    "max_tokens": 1024,
    "temperature": 0.7
  }'`}
      />

      <H3>Python</H3>
      <CodeBlock
        title="Python"
        code={`import os
import requests

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {os.environ['MIRA_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "model": "mira",
        "messages": [
            {"role": "system", "content": "${isRu ? "Ты полезный ассистент." : "You are a helpful assistant."}"},
            {"role": "user", "content": "${isRu ? "Объясни рекурсию простыми словами" : "Explain recursion in simple terms"}"},
        ],
        "max_tokens": 1024,
        "temperature": 0.7,
    },
)

data = response.json()
print(data["choices"][0]["message"]["content"])`}
      />

      <H3>JavaScript</H3>
      <CodeBlock
        title="JavaScript (Node.js)"
        code={`const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.MIRA_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    messages: [
      { role: "system", content: "${isRu ? "Ты полезный ассистент." : "You are a helpful assistant."}" },
      { role: "user", content: "${isRu ? "Объясни рекурсию простыми словами" : "Explain recursion in simple terms"}" },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`}
      />

      <H2>{isRu ? "Формат ответа" : "Response format"}</H2>
      <CodeBlock
        title="JSON"
        code={`{
  "id": "chatcmpl-abc123def456",
  "object": "chat.completion",
  "created": 1711000000,
  "model": "mira",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "${isRu ? "Рекурсия — это когда функция вызывает саму себя..." : "Recursion is when a function calls itself..."}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 150,
    "total_tokens": 175
  }
}`}
      />

      <H3>{isRu ? "Поля ответа" : "Response fields"}</H3>
      <ParamTable params={[
        { name: "id", type: "string", required: true, desc: isRu ? "Уникальный идентификатор завершения" : "Unique completion identifier" },
        { name: "object", type: "string", required: true, desc: isRu ? "Тип объекта, всегда \"chat.completion\"" : "Object type, always \"chat.completion\"" },
        { name: "created", type: "integer", required: true, desc: isRu ? "Unix-временная метка создания" : "Unix timestamp of creation" },
        { name: "model", type: "string", required: true, desc: isRu ? "Идентификатор использованной модели" : "The model used for the completion" },
        { name: "choices", type: "array", required: true, desc: isRu ? "Массив вариантов ответа (обычно 1, если n не указан)" : "Array of response choices (usually 1 unless n is specified)" },
        { name: "usage", type: "object", required: true, desc: isRu ? "Информация об использовании токенов (prompt_tokens, completion_tokens, total_tokens)" : "Token usage info (prompt_tokens, completion_tokens, total_tokens)" },
      ]} />

      <H2>{isRu ? "Потоковая передача (Streaming)" : "Streaming"}</H2>
      <P>
        {isRu
          ? "При stream: true ответ приходит по частям через Server-Sent Events (SSE). Каждый фрагмент содержит дельту (delta) с новым контентом. Поток завершается сообщением [DONE]."
          : "When stream: true, the response arrives in chunks via Server-Sent Events (SSE). Each chunk contains a delta with new content. The stream ends with a [DONE] message."}
      </P>
      <CodeBlock
        title={isRu ? "Формат потокового ответа" : "Streaming response format"}
        code={`data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]`}
      />

      <H3>{isRu ? "Потоковая передача в Python" : "Streaming in Python"}</H3>
      <CodeBlock
        title="Python"
        code={`import os
import requests

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {os.environ['MIRA_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "model": "mira",
        "messages": [{"role": "user", "content": "Hello"}],
        "stream": True,
    },
    stream=True,
)

for line in response.iter_lines():
    if line:
        text = line.decode("utf-8")
        if text.startswith("data: ") and text != "data: [DONE]":
            import json
            chunk = json.loads(text[6:])
            delta = chunk["choices"][0]["delta"]
            if "content" in delta:
                print(delta["content"], end="", flush=True)`}
      />

      <H3>{isRu ? "Потоковая передача в JavaScript" : "Streaming in JavaScript"}</H3>
      <CodeBlock
        title="JavaScript (Node.js)"
        code={`const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.MIRA_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    messages: [{ role: "user", content: "Hello" }],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  for (const line of text.split("\\n")) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      const chunk = JSON.parse(line.slice(6));
      const content = chunk.choices[0]?.delta?.content;
      if (content) process.stdout.write(content);
    }
  }
}`}
      />

      <Note type="info">
        {isRu
          ? "Дополнительные параметры (tools, tool_choice, response_format) планируются в будущих обновлениях API. Для получения JSON-ответов используйте инструкцию в системном промпте."
          : "Additional parameters (tools, tool_choice, response_format) are planned for future API updates. To get JSON responses, include instructions in the system prompt."}
      </Note>

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/api/models-list",
          title: isRu ? "Список моделей" : "Models list",
          desc: isRu ? "Получите список доступных моделей программно" : "Fetch available models programmatically",
        },
        {
          href: "/docs/api/errors",
          title: isRu ? "Обработка ошибок" : "Error handling",
          desc: isRu ? "Узнайте о кодах ошибок и повторных попытках" : "Learn about error codes and retries",
        },
      ]} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// 3. ModelsListPage
// ────────────────────────────────────────────────────────────────

function ModelsListPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <>
      <H1>{isRu ? "Список моделей" : "Models list"}</H1>
      <P>
        {isRu
          ? "Эндпоинт списка моделей возвращает все доступные модели Mira с их характеристиками. Этот эндпоинт не требует аутентификации и может использоваться для динамического получения списка моделей."
          : "The models list endpoint returns all available Mira models with their specifications. This endpoint does not require authentication and can be used to dynamically fetch the model catalog."}
      </P>

      <H2>{isRu ? "Эндпоинт" : "Endpoint"}</H2>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        <EndpointRow method="GET" path="/api/v1/models" desc={isRu ? "Список доступных моделей" : "List available models"} />
      </div>

      <Note type="info">
        {isRu
          ? "Этот эндпоинт не требует аутентификации. Вы можете вызывать его без API-ключа."
          : "This endpoint does not require authentication. You can call it without an API key."}
      </Note>

      <H2>{isRu ? "Параметры запроса" : "Request parameters"}</H2>
      <P>
        {isRu
          ? "Этот эндпоинт не принимает параметров. Просто отправьте GET-запрос."
          : "This endpoint accepts no parameters. Simply send a GET request."}
      </P>

      <H2>{isRu ? "Примеры запросов" : "Request examples"}</H2>

      <H3>cURL</H3>
      <CodeBlock
        title="cURL"
        code="curl https://api.vmira.ai/api/v1/models"
      />

      <H3>Python</H3>
      <CodeBlock
        title="Python"
        code={`import requests

response = requests.get("https://api.vmira.ai/api/v1/models")
models = response.json()

for model in models["models"]:
    print(f"{model['id']:20} context={model['context_window']:>7}  max_output={model['max_output_tokens']}")`}
      />

      <H3>JavaScript</H3>
      <CodeBlock
        title="JavaScript"
        code={`const response = await fetch("https://api.vmira.ai/api/v1/models");
const models = await response.json();

for (const model of models.models) {
  console.log(\`\${model.id} — context: \${model.context_window}, max output: \${model.max_output_tokens}\`);
}
console.log("Default model:", models.default);`}
      />

      <H2>{isRu ? "Формат ответа" : "Response format"}</H2>
      <CodeBlock
        title="JSON"
        code={`{
  "default": "mira",
  "models": [
    {
      "id": "mira",
      "name": "Mira",
      "description": "General-purpose assistant",
      "context_window": 32768,
      "max_output_tokens": 4096
    },
    {
      "id": "mira-thinking",
      "name": "Mira Thinking",
      "description": "Extended reasoning for complex tasks",
      "context_window": 32768,
      "max_output_tokens": 8192,
      "requires_plan": "pro"
    },
    {
      "id": "mira-pro",
      "name": "Mira Pro",
      "description": "Advanced model for professional use",
      "context_window": 65536,
      "max_output_tokens": 8192,
      "requires_plan": "pro"
    },
    {
      "id": "mira-max",
      "name": "Mira Max",
      "description": "Most capable model with maximum context",
      "context_window": 131072,
      "max_output_tokens": 16384,
      "requires_plan": "max"
    }
  ]
}`}
      />

      <H2>{isRu ? "Поля объекта модели" : "Model object fields"}</H2>
      <ParamTable params={[
        { name: "id", type: "string", required: true, desc: isRu ? "Уникальный идентификатор модели, используемый в запросах к API" : "Unique model identifier used in API requests" },
        { name: "name", type: "string", required: true, desc: isRu ? "Отображаемое имя модели" : "Display name of the model" },
        { name: "description", type: "string", required: true, desc: isRu ? "Краткое описание модели и её возможностей" : "Brief description of the model and its capabilities" },
        { name: "context_window", type: "integer", required: true, desc: isRu ? "Максимальное количество токенов в контекстном окне" : "Maximum number of tokens in the context window" },
        { name: "max_output_tokens", type: "integer", required: true, desc: isRu ? "Максимальное количество токенов в ответе модели" : "Maximum number of tokens in the model's response" },
        { name: "requires_plan", type: "string", required: false, desc: isRu ? "Минимальный тарифный план для доступа к модели (\"pro\" или \"max\")" : "Minimum plan required to access the model (\"pro\" or \"max\")" },
      ]} />

      <H2>{isRu ? "Сравнение моделей" : "Model comparison"}</H2>
      <Table
        headers={[
          isRu ? "Модель" : "Model",
          isRu ? "Контекст" : "Context",
          isRu ? "Макс. вывод" : "Max output",
          isRu ? "Лучше всего для" : "Best for",
        ]}
        rows={[
          ["mira", "32K", "4K", isRu ? "Общие задачи, чат, суммаризация" : "General tasks, chat, summarization"],
          ["mira-thinking", "32K", "8K", isRu ? "Сложные рассуждения, математика, логика" : "Complex reasoning, math, logic"],
          ["mira-pro", "64K", "8K", isRu ? "Профессиональные задачи, длинные документы" : "Professional tasks, long documents"],
          ["mira-max", "128K", "16K", isRu ? "Максимальный контекст, анализ кодовых баз" : "Maximum context, codebase analysis"],
        ]}
      />

      <Note type="tip">
        {isRu
          ? "Используйте этот эндпоинт для динамического получения списка моделей в вашем приложении вместо хардкодинга идентификаторов. Так вы автоматически получите доступ к новым моделям при их появлении."
          : "Use this endpoint to dynamically fetch the model list in your application instead of hardcoding model IDs. This way you'll automatically get access to new models as they become available."}
      </Note>

      <H2>{isRu ? "Совместимость с OpenAI" : "OpenAI compatibility"}</H2>
      <P>
        {isRu
          ? "Ответ эндпоинта совместим с форматом OpenAI /v1/models. Если вы используете библиотеку OpenAI SDK, просто замените базовый URL:"
          : "The endpoint response is compatible with the OpenAI /v1/models format. If you use the OpenAI SDK library, simply replace the base URL:"}
      </P>
      <CodeBlock
        title="Python (OpenAI SDK)"
        code={`from openai import OpenAI

client = OpenAI(
    base_url="https://api.vmira.ai/v1",
    api_key="sk-mira-your-key-here",
)

models = client.models.list()
for model in models.models:
    print(model.id)`}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// 4. ErrorsPage
// ────────────────────────────────────────────────────────────────

function ErrorsPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <>
      <H1>{isRu ? "Обработка ошибок" : "Error handling"}</H1>
      <P>
        {isRu
          ? "API Mira использует стандартные HTTP-коды состояния для обозначения успеха или неудачи запросов. Все ошибки возвращаются в едином JSON-формате с подробной информацией о проблеме."
          : "The Mira API uses standard HTTP status codes to indicate request success or failure. All errors are returned in a consistent JSON format with detailed information about the issue."}
      </P>

      <H2>{isRu ? "Формат ответа об ошибке" : "Error response format"}</H2>
      <P>
        {isRu
          ? "Все ошибки API возвращаются в следующем формате:"
          : "All API errors are returned in the following format:"}
      </P>
      <CodeBlock
        title="JSON"
        code={`{
  "detail": "The 'model' field is required."
}`}
      />
      <P>
        {isRu
          ? "Поле detail содержит человекочитаемое описание ошибки. HTTP-код состояния указывает на категорию ошибки."
          : "The detail field contains a human-readable error description. The HTTP status code indicates the error category."}
      </P>

      <H2>{isRu ? "Коды состояния HTTP" : "HTTP status codes"}</H2>

      <H3>400 Bad Request</H3>
      <P>
        {isRu
          ? "Запрос содержит недопустимые параметры или отсутствуют обязательные поля. Проверьте тело запроса и формат параметров."
          : "The request contains invalid parameters or is missing required fields. Check the request body and parameter format."}
      </P>
      <CodeBlock
        title={isRu ? "Пример ошибки 400" : "400 error example"}
        code={`{
  "detail": "${isRu ? "Параметр 'temperature' должен быть между 0 и 2." : "The 'temperature' parameter must be between 0 and 2."}"
}`}
      />
      <UL items={[
        {
          bold: isRu ? "Отсутствует обязательное поле" : "Missing required field",
          text: isRu
            ? "Не указаны model или messages в теле запроса."
            : "The model or messages field is not provided in the request body.",
        },
        {
          bold: isRu ? "Недопустимое значение параметра" : "Invalid parameter value",
          text: isRu
            ? "Например, temperature вне диапазона 0-2 или несуществующая модель."
            : "For example, temperature outside the 0-2 range or a non-existent model.",
        },
        {
          bold: isRu ? "Некорректный JSON" : "Malformed JSON",
          text: isRu
            ? "Тело запроса не является валидным JSON."
            : "The request body is not valid JSON.",
        },
      ]} />

      <H3>401 Unauthorized</H3>
      <P>
        {isRu
          ? "API-ключ недействителен, истёк или отсутствует. Убедитесь, что заголовок Authorization содержит правильный ключ."
          : "The API key is invalid, expired, or missing. Make sure the Authorization header contains a valid key."}
      </P>
      <CodeBlock
        title={isRu ? "Пример ошибки 401" : "401 error example"}
        code={`{
  "detail": "${isRu ? "Недействительный API-ключ." : "Invalid API key."}"
}`}
      />

      <H3>403 Forbidden</H3>
      <P>
        {isRu
          ? "API-ключ действителен, но не имеет разрешения для данного действия. Это может означать, что ваш тарифный план не включает доступ к запрашиваемой модели."
          : "The API key is valid but does not have permission for the requested action. This may mean your plan does not include access to the requested model."}
      </P>
      <CodeBlock
        title={isRu ? "Пример ошибки 403" : "403 error example"}
        code={`{
  "detail": "${isRu ? "Ваш тарифный план не включает доступ к модели mira-max." : "Your plan does not include access to the mira-max model."}"
}`}
      />

      <H3>404 Not Found</H3>
      <P>
        {isRu
          ? "Запрашиваемый эндпоинт не существует. Проверьте URL и метод HTTP."
          : "The requested endpoint does not exist. Check the URL and HTTP method."}
      </P>
      <CodeBlock
        title={isRu ? "Пример ошибки 404" : "404 error example"}
        code={`{
  "detail": "${isRu ? "Эндпоинт не найден." : "Endpoint not found."}"
}`}
      />

      <H3>429 Too Many Requests</H3>
      <P>
        {isRu
          ? "Превышен лимит запросов. Ответ включает заголовок Retry-After, указывающий количество секунд до следующего разрешённого запроса."
          : "Rate limit exceeded. The response includes a Retry-After header indicating the number of seconds until the next allowed request."}
      </P>
      <CodeBlock
        title={isRu ? "Пример ошибки 429" : "429 error example"}
        code={`HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "detail": "${isRu ? "Превышен лимит запросов. Попробуйте через 60 секунд." : "Rate limit exceeded. Please retry after 60 seconds."}"
}`}
      />
      <Note type="warning">
        {isRu
          ? "Всегда проверяйте заголовок Retry-After при получении ошибки 429. Не делайте повторных запросов без ожидания указанного интервала."
          : "Always check the Retry-After header when receiving a 429 error. Do not retry without waiting the specified interval."}
      </Note>

      <H3>500 Internal Server Error</H3>
      <P>
        {isRu
          ? "Произошла внутренняя ошибка сервера. Это не связано с вашим запросом. Повторите запрос через несколько секунд."
          : "An internal server error occurred. This is not related to your request. Retry after a few seconds."}
      </P>
      <CodeBlock
        title={isRu ? "Пример ошибки 500" : "500 error example"}
        code={`{
  "detail": "${isRu ? "Внутренняя ошибка сервера." : "Internal server error."}"
}`}
      />

      <H2>{isRu ? "Сводная таблица ошибок" : "Error summary table"}</H2>
      <Table
        headers={[
          isRu ? "Код" : "Code",
          isRu ? "Описание" : "Description",
          isRu ? "Действие" : "Action",
        ]}
        rows={[
          ["400", isRu ? "Неверный запрос (некорректные параметры)" : "Bad request (invalid parameters)", isRu ? "Исправьте параметры" : "Fix your parameters"],
          ["401", isRu ? "Неавторизован (недействительный ключ)" : "Unauthorized (invalid API key)", isRu ? "Проверьте API-ключ" : "Check your API key"],
          ["402", isRu ? "Недостаточно средств" : "Payment required (insufficient balance)", isRu ? "Пополните баланс" : "Top up your balance"],
          ["403", isRu ? "Доступ запрещён (тарифный план)" : "Forbidden (plan restriction)", isRu ? "Обновите тариф" : "Upgrade your plan"],
          ["404", isRu ? "Не найдено" : "Not found", isRu ? "Проверьте URL" : "Check the URL"],
          ["429", isRu ? "Лимит превышен" : "Rate limited", isRu ? "Подождите Retry-After" : "Wait for Retry-After"],
          ["500", isRu ? "Ошибка сервера" : "Server error", isRu ? "Повторите запрос" : "Retry the request"],
        ]}
      />

      <H2>{isRu ? "Логика повторных попыток" : "Retry logic"}</H2>
      <P>
        {isRu
          ? "Для ошибок 429, 500 и 503 рекомендуется реализовать экспоненциальную задержку (exponential backoff). Начните с короткой задержки и увеличивайте её с каждой попыткой."
          : "For 429, 500, and 503 errors, implement exponential backoff. Start with a short delay and increase it with each attempt."}
      </P>

      <H3>{isRu ? "Повторные попытки в Python" : "Retry logic in Python"}</H3>
      <CodeBlock
        title="Python"
        code={`import os
import time
import requests

def call_mira_api(messages, max_retries=5):
    url = "https://api.vmira.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.environ['MIRA_API_KEY']}",
        "Content-Type": "application/json",
    }
    payload = {"model": "mira", "messages": messages}

    for attempt in range(max_retries):
        response = requests.post(url, headers=headers, json=payload)

        if response.status_code == 200:
            return response.json()

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            print(f"Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue

        if response.status_code in (500, 503):
            delay = min(2 ** attempt, 60)  # 1, 2, 4, 8, 16, max 60s
            print(f"Server error {response.status_code}. Retrying in {delay}s...")
            time.sleep(delay)
            continue

        # Non-retryable error
        response.raise_for_status()

    raise Exception("Max retries exceeded")

# Usage
result = call_mira_api([{"role": "user", "content": "Hello"}])
print(result["choices"][0]["message"]["content"])`}
      />

      <H3>{isRu ? "Повторные попытки в JavaScript" : "Retry logic in JavaScript"}</H3>
      <CodeBlock
        title="JavaScript (Node.js)"
        code={`async function callMiraAPI(messages, maxRetries = 5) {
  const url = "https://api.vmira.ai/v1/chat/completions";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${process.env.MIRA_API_KEY}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "mira", messages }),
    });

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
      console.log(\`Rate limited. Waiting \${retryAfter}s...\`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (response.status === 500 || response.status === 503) {
      const delay = Math.min(2 ** attempt, 60) * 1000;
      console.log(\`Server error \${response.status}. Retrying in \${delay / 1000}s...\`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    // Non-retryable error
    const error = await response.json();
    throw new Error(\`API error \${response.status}: \${error.error.message}\`);
  }

  throw new Error("Max retries exceeded");
}

// Usage
const result = await callMiraAPI([{ role: "user", content: "Hello" }]);
console.log(result.choices[0].message.content);`}
      />

      <Note type="tip">
        {isRu
          ? "Добавьте случайный джиттер к задержке, чтобы избежать «громового стада» (thundering herd) — когда множество клиентов повторяют запросы одновременно."
          : "Add random jitter to the delay to avoid the \"thundering herd\" problem — when many clients retry simultaneously."}
      </Note>

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/api/rate-limits",
          title: isRu ? "Лимиты запросов" : "Rate limits",
          desc: isRu ? "Подробнее о лимитах по тарифным планам" : "Learn about plan-based rate limits",
        },
        {
          href: "/docs/api/authentication",
          title: isRu ? "Аутентификация" : "Authentication",
          desc: isRu ? "Настройка API-ключей" : "Set up API keys",
        },
      ]} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// 5. RateLimitsPage
// ────────────────────────────────────────────────────────────────

function RateLimitsPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <>
      <H1>{isRu ? "Лимиты запросов" : "Rate limits"}</H1>
      <P>
        {isRu
          ? "API Mira применяет лимиты запросов для обеспечения справедливого доступа и стабильной работы сервиса. Лимиты зависят от вашего тарифного плана и применяются на уровне API-ключа."
          : "The Mira API enforces rate limits to ensure fair access and service stability. Limits depend on your subscription plan and are applied per API key."}
      </P>

      <H2>{isRu ? "Лимиты по тарифным планам" : "Per-tier limits"}</H2>
      <P>
        {isRu
          ? "Лимиты запросов применяются на уровне пользователя (не по модели). Все модели разделяют один дневной лимит:"
          : "Rate limits are applied per-user (not per-model). All models share a single daily limit:"}
      </P>
      <Table
        headers={[
          isRu ? "Тариф" : "Tier",
          isRu ? "Запросов в день" : "Requests per day",
          isRu ? "Цена" : "Price",
        ]}
        rows={[
          [isRu ? "Бесплатный (Free)" : "Free", "20", isRu ? "Бесплатно" : "Free"],
          ["Pro", "500", "199 ₽ / " + (isRu ? "мес" : "mo")],
          ["Max", isRu ? "Без лимита" : "Unlimited", "990 ₽ / " + (isRu ? "мес" : "mo")],
        ]}
      />
      <Note type="info">
        {isRu
          ? "Модели mira-thinking и mira-pro требуют тариф Pro или выше. Модель mira-max требует тариф Max."
          : "The mira-thinking and mira-pro models require the Pro plan or higher. The mira-max model requires the Max plan."}
      </Note>

      <H2>{isRu ? "Заголовок Retry-After" : "Retry-After header"}</H2>
      <P>
        {isRu
          ? "При превышении лимита ответ 429 включает заголовок Retry-After с количеством секунд до следующего разрешённого запроса:"
          : "When the limit is exceeded, the 429 response includes a Retry-After header with the number of seconds until the next allowed request:"}
      </P>
      <CodeBlock
        title={isRu ? "Пример ответа 429" : "429 response example"}
        code={`HTTP/1.1 429 Too Many Requests
Retry-After: 120
Content-Type: application/json

{
  "detail": "${isRu ? "Превышен дневной лимит запросов." : "Daily request limit exceeded."}"
}`}
      />

      <H2>{isRu ? "Обработка ошибки 429" : "Handling 429 errors"}</H2>
      <CodeBlock
        title="Python"
        code={`import time, os, requests

def call_with_retry(messages, max_retries=3):
    for attempt in range(max_retries):
        response = requests.post(
            "https://api.vmira.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.environ['MIRA_API_KEY']}"},
            json={"model": "mira", "messages": messages},
        )
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            print(f"Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue
        return response.json()
    raise Exception("Max retries exceeded")`}
      />

      <H2>{isRu ? "Лучшие практики" : "Best practices"}</H2>
      <UL items={[
        {
          bold: isRu ? "Используйте Retry-After" : "Respect Retry-After",
          text: isRu
            ? "При получении 429 всегда проверяйте заголовок Retry-After и ждите указанное количество секунд."
            : "On 429 responses, always check the Retry-After header and wait the specified number of seconds.",
        },
        {
          bold: isRu ? "Реализуйте экспоненциальную задержку" : "Implement exponential backoff",
          text: isRu
            ? "Для ошибок 500 используйте увеличивающуюся задержку: 1с, 2с, 4с, 8с..."
            : "For 500 errors, use increasing delays: 1s, 2s, 4s, 8s...",
        },
        {
          bold: isRu ? "Кешируйте ответы" : "Cache responses",
          text: isRu
            ? "Кешируйте одинаковые запросы на стороне клиента."
            : "Cache identical requests client-side.",
        },
        {
          bold: isRu ? "Обновите тарифный план" : "Upgrade your plan",
          text: isRu
            ? "Если регулярно достигаете лимитов, рассмотрите переход на более высокий тарифный план."
            : "If you regularly hit rate limits, consider upgrading to a higher tier.",
        },
      ]} />

      <Note type="tip">
        {isRu
          ? "Для приложений с высокой нагрузкой рекомендуется тариф Max с безлимитными запросами. Это исключает простои из-за лимитов."
          : "For high-traffic applications, the Max tier with unlimited requests is recommended. This eliminates downtime due to rate limits."}
      </Note>

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/api/errors",
          title: isRu ? "Обработка ошибок" : "Error handling",
          desc: isRu ? "Полный справочник кодов ошибок API" : "Complete API error code reference",
        },
        {
          href: "/docs/api/chat-completions",
          title: isRu ? "Завершения чата" : "Chat completions",
          desc: isRu ? "Справочник основного эндпоинта API" : "Main API endpoint reference",
        },
      ]} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// 6. VersioningPage
// ────────────────────────────────────────────────────────────────

function VersioningPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <>
      <H1>{isRu ? "Версионирование API" : "API versioning"}</H1>
      <P>
        {isRu
          ? "API Mira использует версионирование на основе URL для обеспечения обратной совместимости и плавной миграции между версиями. Текущая стабильная версия — v1."
          : "The Mira API uses URL-based versioning to ensure backward compatibility and smooth migration between versions. The current stable version is v1."}
      </P>

      <H2>{isRu ? "Текущая версия" : "Current version"}</H2>
      <CodeBlock
        title={isRu ? "Базовый URL (v1)" : "Base URL (v1)"}
        code="https://api.vmira.ai/v1"
      />
      <P>
        {isRu
          ? "Все эндпоинты включают версию в URL-пути. Например:"
          : "All endpoints include the version in the URL path. For example:"}
      </P>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden mb-6">
        <EndpointRow method="POST" path="/v1/chat/completions" desc={isRu ? "Завершения чата" : "Chat completions"} />
        <EndpointRow method="GET" path="/api/v1/models" desc={isRu ? "Список моделей" : "Models list"} />
      </div>

      <H2>{isRu ? "Как работает версионирование" : "How versioning works"}</H2>
      <P>
        {isRu
          ? "Версия API указывается непосредственно в URL-пути (например, /v1/). Это означает, что разные версии API могут сосуществовать одновременно, позволяя постепенную миграцию."
          : "The API version is specified directly in the URL path (e.g., /v1/). This means different API versions can coexist simultaneously, allowing gradual migration."}
      </P>
      <UL items={[
        {
          bold: isRu ? "Версия в URL" : "URL-based",
          text: isRu
            ? "Версия является частью URL: /v1/chat/completions. При выпуске v2 URL станет /v2/chat/completions."
            : "The version is part of the URL: /v1/chat/completions. When v2 is released, the URL will be /v2/chat/completions.",
        },
        {
          bold: isRu ? "Нет неявных версий" : "No implicit versions",
          text: isRu
            ? "Запросы без версии в URL не поддерживаются. Всегда указывайте версию явно."
            : "Requests without a version in the URL are not supported. Always specify the version explicitly.",
        },
        {
          bold: isRu ? "Версия по умолчанию" : "Default version",
          text: isRu
            ? "В данный момент единственная доступная версия — v1. При выпуске новых версий v1 продолжит работать."
            : "Currently the only available version is v1. When new versions are released, v1 will continue to work.",
        },
      ]} />

      <H2>{isRu ? "Политика обратной совместимости" : "Backward compatibility policy"}</H2>
      <P>
        {isRu
          ? "Mira придерживается строгой политики обратной совместимости в рамках одной мажорной версии:"
          : "Mira follows a strict backward compatibility policy within a major version:"}
      </P>
      <UL items={[
        {
          bold: isRu ? "Не ломающие изменения" : "Non-breaking changes",
          text: isRu
            ? "Добавление новых полей в ответ, новых необязательных параметров запроса и новых эндпоинтов — эти изменения не требуют обновления клиентского кода."
            : "Adding new fields to responses, new optional request parameters, and new endpoints — these changes do not require client code updates.",
        },
        {
          bold: isRu ? "Ломающие изменения" : "Breaking changes",
          text: isRu
            ? "Удаление полей, изменение типов, переименование параметров и изменение поведения — эти изменения возможны только при выпуске новой мажорной версии (v2)."
            : "Removing fields, changing types, renaming parameters, and behavior changes — these are only possible in a new major version (v2).",
        },
      ]} />
      <Note type="info">
        {isRu
          ? "Ваш код, работающий с v1, продолжит работать без изменений, даже если мы добавим новые поля в ответы или новые необязательные параметры."
          : "Your code that works with v1 will continue to work without changes, even if we add new fields to responses or new optional parameters."}
      </Note>

      <H2>{isRu ? "Уведомления об устаревании" : "Deprecation notices"}</H2>
      <P>
        {isRu
          ? "Если какая-либо версия API планируется к удалению, Mira предоставляет минимум 12 месяцев для миграции:"
          : "If an API version is scheduled for removal, Mira provides at least 12 months for migration:"}
      </P>
      <UL items={[
        {
          bold: isRu ? "Объявление" : "Announcement",
          text: isRu
            ? "Уведомление об устаревании публикуется в документации, блоге и отправляется по email всем пользователям с активными ключами."
            : "A deprecation notice is published in the documentation, blog, and sent via email to all users with active keys.",
        },
        {
          bold: isRu ? "Период миграции" : "Migration period",
          text: isRu
            ? "Старая версия продолжает работать минимум 12 месяцев после объявления. За этот период вы можете обновить свой код."
            : "The old version continues to work for at least 12 months after the announcement. During this period you can update your code.",
        },
        {
          bold: isRu ? "Заголовки предупреждения" : "Warning headers",
          text: isRu
            ? "Ответы устаревшей версии будут содержать заголовок Deprecation с датой удаления."
            : "Responses from a deprecated version will include a Deprecation header with the removal date.",
        },
        {
          bold: isRu ? "Удаление" : "Removal",
          text: isRu
            ? "После окончания периода миграции старая версия возвращает ошибку 410 Gone."
            : "After the migration period ends, the old version returns a 410 Gone error.",
        },
      ]} />
      <CodeBlock
        title={isRu ? "Заголовок устаревания" : "Deprecation header"}
        code={`HTTP/1.1 200 OK
Deprecation: Sun, 01 Jan 2028 00:00:00 GMT
Sunset: Sun, 01 Jan 2028 00:00:00 GMT
Link: <https://docs.vmira.ai/migration/v1-to-v2>; rel="deprecation"`}
      />

      <H2>{isRu ? "Миграция с OpenAI" : "Migration from OpenAI"}</H2>
      <P>
        {isRu
          ? "API Mira полностью совместим с форматом OpenAI. Если вы уже используете OpenAI API или SDK, миграция занимает минимум усилий — достаточно изменить базовый URL и API-ключ."
          : "The Mira API is fully compatible with the OpenAI format. If you already use the OpenAI API or SDK, migration requires minimal effort — just change the base URL and API key."}
      </P>

      <H3>{isRu ? "Использование OpenAI SDK" : "Using the OpenAI SDK"}</H3>
      <CodeBlock
        title="Python (OpenAI SDK)"
        code={`from openai import OpenAI

# Before (OpenAI)
# client = OpenAI(api_key="sk-...")

# After (Mira) — just change base_url and api_key
client = OpenAI(
    base_url="https://api.vmira.ai/v1",
    api_key="sk-mira-your-key-here",
)

response = client.chat.completions.create(
    model="mira",  # Use a Mira model name
    messages=[{"role": "user", "content": "Hello, Mira!"}],
)

print(response.choices[0].message.content)`}
      />

      <CodeBlock
        title="JavaScript (OpenAI SDK)"
        code={`import OpenAI from "openai";

// Before (OpenAI)
// const client = new OpenAI({ apiKey: "sk-..." });

// After (Mira) — just change baseURL and apiKey
const client = new OpenAI({
  baseURL: "https://api.vmira.ai/v1",
  apiKey: "sk-mira-your-key-here",
});

const response = await client.chat.completions.create({
  model: "mira",  // Use a Mira model name
  messages: [{ role: "user", content: "Hello, Mira!" }],
});

console.log(response.choices[0].message.content);`}
      />

      <H3>{isRu ? "Изменения при миграции" : "Migration changes"}</H3>
      <Table
        headers={[
          isRu ? "Что" : "What",
          "OpenAI",
          "Mira",
        ]}
        rows={[
          [isRu ? "Базовый URL" : "Base URL", "https://api.openai.com/v1", "https://api.vmira.ai/v1"],
          [isRu ? "Формат ключа" : "Key format", "sk-...", "sk-mira-..."],
          [isRu ? "Модели" : "Models", "gpt-4o, gpt-4o-mini", "mira, mira-thinking, mira-pro, mira-max"],
          [isRu ? "Формат запросов" : "Request format", isRu ? "Идентичный" : "Identical", isRu ? "Идентичный" : "Identical"],
          [isRu ? "Формат ответов" : "Response format", isRu ? "Идентичный" : "Identical", isRu ? "Идентичный" : "Identical"],
        ]}
      />

      <H3>{isRu ? "Миграция с использованием переменных окружения" : "Migration via environment variables"}</H3>
      <P>
        {isRu
          ? "Для быстрой миграции можно использовать переменные окружения, не изменяя код приложения:"
          : "For quick migration, you can use environment variables without changing application code:"}
      </P>
      <CodeBlock
        title={isRu ? "Переменные окружения" : "Environment variables"}
        code={`# Replace in your .env file
OPENAI_API_KEY=sk-mira-your-key-here
OPENAI_BASE_URL=https://api.vmira.ai/v1`}
      />
      <Note type="tip">
        {isRu
          ? "OpenAI SDK автоматически читает OPENAI_API_KEY и OPENAI_BASE_URL из окружения. Установив эти переменные, вы можете переключиться на Mira без изменения кода."
          : "The OpenAI SDK automatically reads OPENAI_API_KEY and OPENAI_BASE_URL from the environment. By setting these variables, you can switch to Mira without changing code."}
      </Note>

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/api/authentication",
          title: isRu ? "Аутентификация" : "Authentication",
          desc: isRu ? "Настройте API-ключ для начала работы" : "Set up your API key to get started",
        },
        {
          href: "/docs/api/chat-completions",
          title: isRu ? "Завершения чата" : "Chat completions",
          desc: isRu ? "Полный справочник основного эндпоинта" : "Full reference for the main endpoint",
        },
      ]} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// Export map
// ────────────────────────────────────────────────────────────────

export const apiReferenceContent: Record<string, React.FC<{ locale: Locale }>> = {
  "api/authentication": AuthenticationPage,
  "api/chat-completions": ChatCompletionsPage,
  "api/models-list": ModelsListPage,
  "api/errors": ErrorsPage,
  "api/rate-limits": RateLimitsPage,
  "api/versioning": VersioningPage,
};
