"use client";
import Link from "next/link";
import { CodeBlock, Note, H1, H2, H3, P, DocLink, NavCards, UL, Table, ParamTable, InlineCode } from "../shared";
import type { Locale } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════
   1. FeaturesOverviewPage
   ═══════════════════════════════════════════════════════════════ */

function FeaturesOverviewPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Обзор возможностей" : "Features overview"}</H1>
      <P>
        {isRu
          ? "Мира предоставляет полный набор возможностей для работы с искусственным интеллектом через единый API, совместимый с форматом OpenAI. Ниже представлен обзор всех ключевых функций платформы."
          : "Mira provides a comprehensive set of AI capabilities through a single API compatible with the OpenAI format. Below is an overview of all the key platform features."}
      </P>

      <H2>{isRu ? "Генерация текста" : "Text generation"}</H2>
      <P>
        {isRu
          ? "Основная возможность Мира — генерация текста на основе промптов. Модели Мира способны писать статьи, код, переводы, аналитику и многое другое. Используйте эндпоинт /v1/chat/completions для отправки сообщений и получения ответов."
          : "The core capability of Mira is prompt-based text generation. Mira models can write articles, code, translations, analytics, and much more. Use the /v1/chat/completions endpoint to send messages and receive responses."}
      </P>

      <H2>{isRu ? "Понимание изображений (Vision)" : "Vision (image understanding)"}</H2>
      <P>
        {isRu
          ? "Модели Мира могут анализировать изображения, переданные в сообщениях. Передайте изображение как base64 или URL в массиве content, и модель опишет, проанализирует или ответит на вопросы о нём. Поддерживаются форматы PNG, JPEG, WebP и GIF."
          : "Mira models can analyze images passed in messages. Send an image as base64 or a URL in the content array, and the model will describe, analyze, or answer questions about it. Supported formats include PNG, JPEG, WebP, and GIF."}
      </P>

      <H2>{isRu ? "Вызов инструментов (Tool Use)" : "Tool use (function calling)"}</H2>
      <P>
        {isRu
          ? "Мира поддерживает вызов инструментов — модель может запрашивать выполнение функций, которые вы определяете. Это позволяет интегрировать модель с внешними API, базами данных и сервисами. Определите набор инструментов в запросе, и модель вернёт структурированный вызов, когда это необходимо."
          : "Mira supports tool use \u2014 the model can request execution of functions you define. This lets you integrate the model with external APIs, databases, and services. Define a set of tools in your request, and the model will return a structured call when needed."}
      </P>

      <H2>{isRu ? "Расширенное мышление" : "Extended thinking"}</H2>
      <P>
        {isRu
          ? "Модель mira-thinking использует цепочку рассуждений для решения сложных задач. Она «думает вслух», разбивая проблему на шаги, прежде чем дать финальный ответ. Это значительно повышает точность на задачах с математикой, логикой и программированием."
          : "The mira-thinking model uses chain-of-thought reasoning to solve complex problems. It \"thinks out loud,\" breaking the problem into steps before giving a final answer. This significantly improves accuracy on math, logic, and programming tasks."}
      </P>

      <H2>{isRu ? "Потоковая передача (Streaming)" : "Streaming"}</H2>
      <P>
        {isRu
          ? "Включите stream: true в запросе, чтобы получать ответ по мере генерации, токен за токеном. Это позволяет отображать текст пользователю в реальном времени, значительно улучшая ощущение отзывчивости."
          : "Set stream: true in your request to receive the response as it is generated, token by token. This lets you display text to the user in real time, dramatically improving perceived responsiveness."}
      </P>

      <H2>{isRu ? "Режим JSON" : "JSON mode"}</H2>
      <P>
        {isRu
          ? "Для получения структурированных данных используйте параметр response_format: { type: \"json_object\" }. Модель гарантированно вернёт валидный JSON, что упрощает парсинг и интеграцию с системами обработки данных."
          : "To get structured data, use the response_format: { type: \"json_object\" } parameter. The model is guaranteed to return valid JSON, simplifying parsing and integration with data processing systems."}
      </P>

      <H2>{isRu ? "Эмбеддинги" : "Embeddings"}</H2>
      <P>
        {isRu
          ? "Мира предоставляет эндпоинт для создания векторных представлений текста (эмбеддингов). Используйте их для семантического поиска, кластеризации, рекомендательных систем и RAG (Retrieval-Augmented Generation)."
          : "Mira provides an endpoint for creating vector representations of text (embeddings). Use them for semantic search, clustering, recommendation systems, and RAG (Retrieval-Augmented Generation)."}
      </P>

      <H2>{isRu ? "Пакетная обработка" : "Batch processing"}</H2>
      <P>
        {isRu
          ? "Для обработки больших объёмов запросов используйте пакетный API. Отправьте массив запросов в одном вызове и получите все ответы, когда обработка завершена. Это эффективнее и дешевле для массовых операций."
          : "For processing large volumes of requests, use the batch API. Send an array of requests in a single call and receive all responses when processing is complete. This is more efficient and cost-effective for bulk operations."}
      </P>

      <H2>{isRu ? "Мультиязычная поддержка" : "Multilingual support"}</H2>
      <P>
        {isRu
          ? "Все модели Мира обучены на данных на множестве языков и свободно работают с русским, английским, китайским, испанским, французским и многими другими языками. Модели автоматически определяют язык ввода и отвечают на том же языке."
          : "All Mira models are trained on multilingual data and work fluently with Russian, English, Chinese, Spanish, French, and many other languages. Models automatically detect the input language and respond in the same language."}
      </P>

      <Note type="tip">
        {isRu
          ? "Мира оптимизирована для русского и английского языков — вы получите наилучшее качество именно на этих двух языках."
          : "Mira is optimized for Russian and English \u2014 you will get the best quality in these two languages."}
      </Note>

      <H2>{isRu ? "Изучите каждую возможность" : "Explore each feature"}</H2>
      <P>
        {isRu
          ? "Перейдите к подробным руководствам по каждой из возможностей Мира:"
          : "Navigate to detailed guides for each Mira capability:"}
      </P>

      <NavCards cards={[
        {
          href: "/docs/messages-api",
          title: isRu ? "Messages API" : "Messages API",
          desc: isRu ? "Структура запросов и ответов Chat Completions" : "Request and response structure for Chat Completions",
        },
        {
          href: "/docs/streaming",
          title: isRu ? "Потоковая передача" : "Streaming",
          desc: isRu ? "Получение ответов в реальном времени" : "Receive responses in real time",
        },
        {
          href: "/docs/stop-reasons",
          title: isRu ? "Причины остановки" : "Stop reasons",
          desc: isRu ? "Обработка различных finish_reason" : "Handling different finish_reason values",
        },
        {
          href: "/docs/prompt-engineering",
          title: isRu ? "Промпт-инженерия" : "Prompt engineering",
          desc: isRu ? "Лучшие практики составления промптов" : "Best practices for crafting prompts",
        },
        {
          href: "/docs/system-prompts",
          title: isRu ? "Системные промпты" : "System prompts",
          desc: isRu ? "Управление поведением модели" : "Control model behavior",
        },
        {
          href: "/docs/models",
          title: isRu ? "Обзор моделей" : "Models overview",
          desc: isRu ? "Сравнение моделей Мира" : "Compare Mira models",
        },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. MessagesApiPage
   ═══════════════════════════════════════════════════════════════ */

function MessagesApiPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Messages API (Chat Completions)" : "Messages API (Chat Completions)"}</H1>
      <P>
        {isRu
          ? "Эндпоинт /v1/chat/completions — основной способ взаимодействия с моделями Мира. Он полностью совместим с форматом OpenAI Chat Completions API, что позволяет легко мигрировать существующие приложения."
          : "The /v1/chat/completions endpoint is the primary way to interact with Mira models. It is fully compatible with the OpenAI Chat Completions API format, making it easy to migrate existing applications."}
      </P>

      <H2>{isRu ? "Базовый URL и аутентификация" : "Base URL and authentication"}</H2>
      <CodeBlock
        title={isRu ? "Эндпоинт" : "Endpoint"}
        code="POST https://api.vmira.ai/v1/chat/completions"
      />
      <P>
        {isRu
          ? "Все запросы требуют API-ключ в заголовке Authorization:"
          : "All requests require an API key in the Authorization header:"}
      </P>
      <CodeBlock title="Header" code="Authorization: Bearer sk-mira-YOUR_API_KEY" />

      <H2>{isRu ? "Структура запроса" : "Request structure"}</H2>
      <P>
        {isRu
          ? "Тело запроса представляет собой JSON-объект со следующими параметрами:"
          : "The request body is a JSON object with the following parameters:"}
      </P>

      <ParamTable params={[
        { name: "model", type: "string", required: true, desc: isRu ? "ID модели: mira, mira-thinking, mira-pro, mira-max" : "Model ID: mira, mira-thinking, mira-pro, mira-max" },
        { name: "messages", type: "array", required: true, desc: isRu ? "Массив сообщений с полями role и content" : "Array of messages with role and content fields" },
        { name: "max_tokens", type: "integer", required: false, desc: isRu ? "Максимальное количество токенов в ответе" : "Maximum number of tokens in the response" },
        { name: "temperature", type: "number", required: false, desc: isRu ? "Температура семплирования (0–2, по умолчанию 1)" : "Sampling temperature (0\u20132, default 1)" },
        { name: "top_p", type: "number", required: false, desc: isRu ? "Nucleus sampling (0\u20131, по умолчанию 1)" : "Nucleus sampling (0\u20131, default 1)" },
        { name: "stream", type: "boolean", required: false, desc: isRu ? "Включить потоковую передачу (по умолчанию false)" : "Enable streaming (default false)" },
        { name: "stop", type: "string|array", required: false, desc: isRu ? "Последовательности для остановки генерации" : "Sequences where the model will stop generating" },
        { name: "response_format", type: "object", required: false, desc: isRu ? "Формат ответа, например { type: \"json_object\" }" : "Response format, e.g. { type: \"json_object\" }" },
      ]} />

      <H2>{isRu ? "Формат сообщений" : "Message format"}</H2>
      <P>
        {isRu
          ? "Каждое сообщение в массиве messages содержит роль (role) и содержание (content). Поддерживаемые роли:"
          : "Each message in the messages array contains a role and content. Supported roles:"}
      </P>
      <UL items={[
        { bold: "system", text: isRu ? "Системный промпт, задающий поведение модели. Обычно первое сообщение." : "System prompt that sets model behavior. Usually the first message." },
        { bold: "user", text: isRu ? "Сообщение от пользователя — вопрос, задача, запрос." : "Message from the user \u2014 a question, task, or request." },
        { bold: "assistant", text: isRu ? "Ответ модели. Используется для контекста в многоходовых диалогах." : "Model response. Used for context in multi-turn conversations." },
      ]} />

      <H2>{isRu ? "Пример: базовый запрос" : "Example: basic request"}</H2>

      <H3>cURL</H3>
      <CodeBlock
        title="cURL"
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer sk-mira-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "system",
        "content": "${isRu ? "Ты полезный ассистент." : "You are a helpful assistant."}"
      },
      {
        "role": "user",
        "content": "${isRu ? "Что такое машинное обучение?" : "What is machine learning?"}"
      }
    ]
  }'`}
      />

      <H3>Python</H3>
      <CodeBlock
        title="Python"
        code={`import requests

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={
        "Authorization": "Bearer sk-mira-YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "model": "mira",
        "max_tokens": 1024,
        "temperature": 0.7,
        "messages": [
            {"role": "system", "content": "${isRu ? "Ты полезный ассистент." : "You are a helpful assistant."}"},
            {"role": "user", "content": "${isRu ? "Объясни рекурсию простыми словами." : "Explain recursion in simple terms."}"},
        ],
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
    "Authorization": "Bearer sk-mira-YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    max_tokens: 1024,
    temperature: 0.7,
    messages: [
      { role: "system", content: "${isRu ? "Ты полезный ассистент." : "You are a helpful assistant."}" },
      { role: "user", content: "${isRu ? "Что такое API?" : "What is an API?"}" },
    ],
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`}
      />

      <H2>{isRu ? "Структура ответа" : "Response structure"}</H2>
      <P>
        {isRu
          ? "API возвращает JSON-объект со следующей структурой:"
          : "The API returns a JSON object with the following structure:"}
      </P>
      <CodeBlock
        title="JSON Response"
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
        "content": "${isRu ? "Машинное обучение — это..." : "Machine learning is..."}"
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

      <H2>{isRu ? "Многоходовые диалоги" : "Multi-turn conversations"}</H2>
      <P>
        {isRu
          ? "Для поддержания контекста диалога передавайте всю историю сообщений в массиве messages. Модель использует предыдущие сообщения для понимания контекста."
          : "To maintain conversation context, pass the full message history in the messages array. The model uses previous messages to understand context."}
      </P>
      <CodeBlock
        title={isRu ? "Многоходовой диалог" : "Multi-turn conversation"}
        code={`{
  "model": "mira",
  "messages": [
    { "role": "system", "content": "${isRu ? "Ты помощник по программированию." : "You are a programming assistant."}" },
    { "role": "user", "content": "${isRu ? "Напиши функцию сортировки пузырьком на Python." : "Write a bubble sort function in Python."}" },
    { "role": "assistant", "content": "def bubble_sort(arr):\\n    n = len(arr)\\n    for i in range(n):\\n        for j in range(0, n-i-1):\\n            if arr[j] > arr[j+1]:\\n                arr[j], arr[j+1] = arr[j+1], arr[j]\\n    return arr" },
    { "role": "user", "content": "${isRu ? "Теперь оптимизируй её, чтобы она останавливалась, если массив уже отсортирован." : "Now optimize it to stop early if the array is already sorted."}" }
  ]
}`}
      />

      <Note type="tip">
        {isRu
          ? "Чем больше сообщений в истории, тем больше токенов используется. Обрезайте старые сообщения, если приближаетесь к лимиту контекста модели."
          : "The more messages in the history, the more tokens are used. Trim older messages if you are approaching the model's context limit."}
      </Note>

      <H2>{isRu ? "Совместимость с OpenAI SDK" : "OpenAI SDK compatibility"}</H2>
      <P>
        {isRu
          ? "Поскольку API Мира совместим с форматом OpenAI, вы можете использовать официальный OpenAI SDK, просто указав наш базовый URL:"
          : "Since the Mira API is compatible with the OpenAI format, you can use the official OpenAI SDK by simply pointing to our base URL:"}
      </P>
      <CodeBlock
        title="Python (OpenAI SDK)"
        code={`from openai import OpenAI

client = OpenAI(
    api_key="sk-mira-YOUR_API_KEY",
    base_url="https://api.vmira.ai/v1",
)

response = client.chat.completions.create(
    model="mira",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "${isRu ? "Привет, Мира!" : "Hello, Mira!"}"},
    ],
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
  max_tokens: 1024,
  messages: [
    { role: "user", content: "${isRu ? "Привет, Мира!" : "Hello, Mira!"}" },
  ],
});

console.log(response.choices[0].message.content);`}
      />

      <Note type="info">
        {isRu
          ? "Все API-ключи Мира начинаются с sk-mira-. Получите ключ на platform.vmira.ai."
          : "All Mira API keys start with sk-mira-. Get your key at platform.vmira.ai."}
      </Note>

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/streaming",
          title: isRu ? "Потоковая передача" : "Streaming",
          desc: isRu ? "Получайте ответы в реальном времени" : "Receive responses in real time",
        },
        {
          href: "/docs/stop-reasons",
          title: isRu ? "Причины остановки" : "Stop reasons",
          desc: isRu ? "Обработка finish_reason в ответах" : "Handle finish_reason in responses",
        },
        {
          href: "/docs/system-prompts",
          title: isRu ? "Системные промпты" : "System prompts",
          desc: isRu ? "Настройка поведения модели" : "Configure model behavior",
        },
        {
          href: "/docs/prompt-engineering",
          title: isRu ? "Промпт-инженерия" : "Prompt engineering",
          desc: isRu ? "Лучшие практики составления промптов" : "Best practices for crafting prompts",
        },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. StreamingPage
   ═══════════════════════════════════════════════════════════════ */

function StreamingPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Потоковая передача (Streaming)" : "Streaming"}</H1>
      <P>
        {isRu
          ? "Потоковая передача позволяет получать ответ модели по мере его генерации, а не дожидаться полного завершения. Это значительно улучшает пользовательский опыт, особенно для длинных ответов, поскольку текст начинает появляться практически мгновенно."
          : "Streaming lets you receive the model's response as it is generated, rather than waiting for the full completion. This dramatically improves the user experience, especially for long responses, since text starts appearing almost instantly."}
      </P>

      <H2>{isRu ? "Как включить потоковую передачу" : "How to enable streaming"}</H2>
      <P>
        {isRu
          ? "Добавьте параметр stream: true в тело вашего запроса к /v1/chat/completions. Вместо единого JSON-ответа сервер отправит серию событий в формате Server-Sent Events (SSE)."
          : "Add the stream: true parameter to your request body for /v1/chat/completions. Instead of a single JSON response, the server will send a series of events in Server-Sent Events (SSE) format."}
      </P>
      <CodeBlock
        title={isRu ? "Включение потоковой передачи" : "Enable streaming"}
        code={`{
  "model": "mira",
  "stream": true,
  "messages": [
    { "role": "user", "content": "${isRu ? "Расскажи историю о космосе" : "Tell me a story about space"}" }
  ]
}`}
      />

      <H2>{isRu ? "Формат Server-Sent Events" : "Server-Sent Events format"}</H2>
      <P>
        {isRu
          ? "При потоковой передаче сервер отправляет ответ в виде последовательности строк, каждая из которых начинается с data: и содержит JSON-объект. Последнее событие — data: [DONE], означающее конец потока."
          : "When streaming, the server sends the response as a sequence of lines, each prefixed with data: and containing a JSON object. The final event is data: [DONE], indicating the end of the stream."}
      </P>
      <CodeBlock
        title={isRu ? "Формат SSE-потока" : "SSE stream format"}
        code={`data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1711000000,"model":"mira","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]`}
      />

      <H2>{isRu ? "Типы событий в потоке" : "Stream event types"}</H2>
      <P>
        {isRu
          ? "Каждый чанк (chunk) в потоке содержит объект delta внутри choices[0]. Вот что может быть в delta:"
          : "Each chunk in the stream contains a delta object inside choices[0]. Here is what delta can contain:"}
      </P>
      <UL items={[
        { bold: "delta.role", text: isRu ? "Появляется в первом чанке, указывает роль (\"assistant\")." : "Appears in the first chunk, indicates the role (\"assistant\")." },
        { bold: "delta.content", text: isRu ? "Фрагмент текста ответа. Конкатенируйте все фрагменты для получения полного ответа." : "A fragment of the response text. Concatenate all fragments to get the full response." },
        { bold: "finish_reason", text: isRu ? "null во время генерации, \"stop\" при естественном завершении, \"length\" при достижении лимита токенов." : "null during generation, \"stop\" on natural completion, \"length\" when token limit is reached." },
      ]} />

      <Note type="info">
        {isRu
          ? "Объект usage (количество токенов) не включается в потоковые ответы по умолчанию. Добавьте stream_options: { include_usage: true } для его получения в последнем чанке."
          : "The usage object (token counts) is not included in streaming responses by default. Add stream_options: { include_usage: true } to receive it in the final chunk."}
      </Note>

      <H2>{isRu ? "Примеры реализации" : "Implementation examples"}</H2>

      <H3>cURL</H3>
      <CodeBlock
        title="cURL (streaming)"
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer sk-mira-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -N \\
  -d '{
    "model": "mira",
    "stream": true,
    "messages": [
      { "role": "user", "content": "${isRu ? "Напиши стихотворение о программировании" : "Write a poem about programming"}" }
    ]
  }'`}
      />
      <P>
        {isRu
          ? "Флаг -N отключает буферизацию вывода в cURL, позволяя видеть чанки по мере поступления."
          : "The -N flag disables output buffering in cURL, letting you see chunks as they arrive."}
      </P>

      <H3>Python</H3>
      <CodeBlock
        title="Python (streaming)"
        code={`import requests

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={
        "Authorization": "Bearer sk-mira-YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "model": "mira",
        "stream": True,
        "messages": [
            {"role": "user", "content": "${isRu ? "Объясни теорию относительности" : "Explain the theory of relativity"}"}
        ],
    },
    stream=True,  # Enable response streaming in requests
)

for line in response.iter_lines():
    if line:
        decoded = line.decode("utf-8")
        if decoded.startswith("data: ") and decoded != "data: [DONE]":
            import json
            chunk = json.loads(decoded[6:])
            content = chunk["choices"][0]["delta"].get("content", "")
            if content:
                print(content, end="", flush=True)

print()  # Final newline`}
      />

      <H3>Python (OpenAI SDK)</H3>
      <CodeBlock
        title="Python (OpenAI SDK streaming)"
        code={`from openai import OpenAI

client = OpenAI(
    api_key="sk-mira-YOUR_API_KEY",
    base_url="https://api.vmira.ai/v1",
)

stream = client.chat.completions.create(
    model="mira",
    messages=[
        {"role": "user", "content": "${isRu ? "Расскажи о квантовых компьютерах" : "Tell me about quantum computers"}"}
    ],
    stream=True,
)

for chunk in stream:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)

print()`}
      />

      <H3>JavaScript (fetch)</H3>
      <CodeBlock
        title="JavaScript (streaming with fetch)"
        code={`const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-mira-YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    stream: true,
    messages: [
      { role: "user", content: "${isRu ? "Привет! Расскажи о себе." : "Hello! Tell me about yourself."}" },
    ],
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      const chunk = JSON.parse(line.slice(6));
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content); // Node.js
        // Or append to a DOM element in the browser
      }
    }
  }
}

console.log(); // Final newline`}
      />

      <H3>JavaScript (OpenAI SDK)</H3>
      <CodeBlock
        title="JavaScript (OpenAI SDK streaming)"
        code={`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-mira-YOUR_API_KEY",
  baseURL: "https://api.vmira.ai/v1",
});

const stream = await client.chat.completions.create({
  model: "mira",
  messages: [
    { role: "user", content: "${isRu ? "Объясни рекурсию" : "Explain recursion"}" },
  ],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}

console.log();`}
      />

      <H2>{isRu ? "Обработка ошибок в потоке" : "Error handling in streams"}</H2>
      <P>
        {isRu
          ? "Если ошибка возникает во время потоковой передачи (например, превышен лимит запросов), сервер отправит событие с полем error вместо обычного чанка. Всегда оборачивайте обработку потока в try/catch."
          : "If an error occurs during streaming (e.g., rate limit exceeded), the server will send an event with an error field instead of a normal chunk. Always wrap stream processing in try/catch."}
      </P>

      <Note type="warning">
        {isRu
          ? "При потоковой передаче HTTP-статус 200 возвращается сразу, ещё до начала генерации. Ошибки, возникающие во время генерации, передаются через поток."
          : "With streaming, HTTP status 200 is returned immediately, before generation starts. Errors that occur during generation are delivered through the stream."}
      </Note>

      <H2>{isRu ? "Когда использовать потоковую передачу" : "When to use streaming"}</H2>
      <UL items={[
        { bold: isRu ? "Чат-интерфейсы" : "Chat interfaces", text: isRu ? "Отображение текста по мере генерации создаёт естественное ощущение диалога." : "Displaying text as it generates creates a natural conversational feel." },
        { bold: isRu ? "Длинные ответы" : "Long responses", text: isRu ? "Пользователь видит начало ответа, не дожидаясь конца." : "The user sees the start of the response without waiting for the end." },
        { bold: isRu ? "Индикатор прогресса" : "Progress indicator", text: isRu ? "Потоковая передача служит естественным индикатором того, что модель работает." : "Streaming serves as a natural indicator that the model is working." },
      ]} />

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/messages-api",
          title: isRu ? "Messages API" : "Messages API",
          desc: isRu ? "Полная документация по Chat Completions" : "Full Chat Completions documentation",
        },
        {
          href: "/docs/stop-reasons",
          title: isRu ? "Причины остановки" : "Stop reasons",
          desc: isRu ? "Разбираем finish_reason" : "Understanding finish_reason",
        },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. StopReasonsPage
   ═══════════════════════════════════════════════════════════════ */

function StopReasonsPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Причины остановки (Stop Reasons)" : "Stop reasons"}</H1>
      <P>
        {isRu
          ? "Каждый ответ от API Мира включает поле finish_reason, которое указывает, почему модель прекратила генерацию. Правильная обработка этого поля критически важна для надёжных приложений."
          : "Every response from the Mira API includes a finish_reason field that indicates why the model stopped generating. Properly handling this field is critical for robust applications."}
      </P>

      <H2>{isRu ? "Значения finish_reason" : "finish_reason values"}</H2>

      <Table
        headers={[
          isRu ? "Значение" : "Value",
          isRu ? "Описание" : "Description",
          isRu ? "Действие" : "Action",
        ]}
        rows={[
          [
            "stop",
            isRu ? "Модель естественно завершила ответ" : "Model naturally completed its response",
            isRu ? "Ответ полный, отобразите его" : "Response is complete, display it",
          ],
          [
            "length",
            isRu ? "Достигнут лимит max_tokens" : "Reached max_tokens limit",
            isRu ? "Ответ обрезан — увеличьте max_tokens или продолжите" : "Response truncated \u2014 increase max_tokens or continue",
          ],
          [
            "tool_calls",
            isRu ? "Модель хочет вызвать инструмент" : "Model wants to call a tool",
            isRu ? "Выполните вызов и передайте результат обратно" : "Execute the call and pass the result back",
          ],
          [
            "content_filter",
            isRu ? "Контент заблокирован фильтром безопасности" : "Content blocked by safety filter",
            isRu ? "Сообщите пользователю, измените запрос" : "Inform the user, modify the request",
          ],
        ]}
      />

      <H2>{isRu ? "stop — естественное завершение" : "stop \u2014 natural completion"}</H2>
      <P>
        {isRu
          ? "Это наиболее частый и желаемый результат. Модель завершила свой ответ полностью. Также возвращается, если модель встретила одну из последовательностей, указанных в параметре stop."
          : "This is the most common and desired result. The model completed its response in full. It is also returned when the model encounters one of the sequences specified in the stop parameter."}
      </P>
      <CodeBlock
        title={isRu ? "Пример ответа с stop" : "Example response with stop"}
        code={`{
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "${isRu ? "Париж — столица Франции." : "Paris is the capital of France."}"
      },
      "finish_reason": "stop"
    }
  ]
}`}
      />

      <H2>{isRu ? "length — обрезано по лимиту токенов" : "length \u2014 truncated by token limit"}</H2>
      <P>
        {isRu
          ? "Возвращается, когда ответ модели достиг значения max_tokens. Ответ обрезан и может быть неполным. Для решения этой проблемы вы можете:"
          : "Returned when the model's response reached the max_tokens value. The response is truncated and may be incomplete. To address this, you can:"}
      </P>
      <UL items={[
        { bold: isRu ? "Увеличить max_tokens" : "Increase max_tokens", text: isRu ? "Установите большее значение max_tokens в следующем запросе." : "Set a higher max_tokens value in the next request." },
        { bold: isRu ? "Продолжить генерацию" : "Continue generation", text: isRu ? "Отправьте новый запрос, добавив обрезанный ответ как сообщение assistant, и попросите продолжить." : "Send a new request, adding the truncated response as an assistant message, and ask to continue." },
        { bold: isRu ? "Разбить задачу" : "Break down the task", text: isRu ? "Запросите ответ по частям вместо одного длинного." : "Request the response in parts instead of one long output." },
      ]} />

      <H2>{isRu ? "tool_calls — вызов инструмента" : "tool_calls \u2014 function call requested"}</H2>
      <P>
        {isRu
          ? "Когда модель решает, что ей нужно вызвать один из предоставленных инструментов, она останавливает генерацию текста и возвращает структурированный вызов функции. Вы должны выполнить вызов и передать результат обратно модели."
          : "When the model decides it needs to call one of the provided tools, it stops text generation and returns a structured function call. You must execute the call and pass the result back to the model."}
      </P>
      <CodeBlock
        title={isRu ? "Ответ с tool_calls" : "Response with tool_calls"}
        code={`{
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\\"city\\": \\"${isRu ? "Москва" : "Moscow"}\\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}`}
      />

      <H2>{isRu ? "content_filter — контент заблокирован" : "content_filter \u2014 content blocked"}</H2>
      <P>
        {isRu
          ? "Возвращается, когда фильтр безопасности заблокировал часть или весь ответ модели. Поле content может быть пустым или содержать частичный ответ."
          : "Returned when the safety filter blocked part or all of the model's response. The content field may be empty or contain a partial response."}
      </P>

      <Note type="warning">
        {isRu
          ? "Не пытайтесь обойти фильтр контента перефразированием. Если ваш сценарий использования требует работы с чувствительным контентом, обратитесь в поддержку."
          : "Do not attempt to bypass the content filter by rephrasing. If your use case requires working with sensitive content, contact support."}
      </Note>

      <H2>{isRu ? "Обработка finish_reason в коде" : "Handling finish_reason in code"}</H2>

      <H3>Python</H3>
      <CodeBlock
        title="Python"
        code={`import requests

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={"Authorization": "Bearer sk-mira-YOUR_API_KEY"},
    json={
        "model": "mira",
        "max_tokens": 512,
        "messages": [{"role": "user", "content": "${isRu ? "Напиши длинную статью" : "Write a long article"}"}],
    },
)

data = response.json()
choice = data["choices"][0]
finish_reason = choice["finish_reason"]

if finish_reason == "stop":
    # ${isRu ? "Ответ полный" : "Response is complete"}
    print(choice["message"]["content"])

elif finish_reason == "length":
    # ${isRu ? "Ответ обрезан — нужно продолжить или увеличить max_tokens" : "Response truncated \u2014 continue or increase max_tokens"}
    print("${isRu ? "Внимание: ответ обрезан!" : "Warning: response truncated!"}")
    print(choice["message"]["content"])

elif finish_reason == "tool_calls":
    # ${isRu ? "Модель хочет вызвать инструмент" : "Model wants to call a tool"}
    tool_calls = choice["message"]["tool_calls"]
    for tool_call in tool_calls:
        fn_name = tool_call["function"]["name"]
        fn_args = tool_call["function"]["arguments"]
        print(f"${isRu ? "Вызов инструмента" : "Tool call"}: {fn_name}({fn_args})")

elif finish_reason == "content_filter":
    # ${isRu ? "Контент заблокирован" : "Content blocked"}
    print("${isRu ? "Ответ заблокирован фильтром безопасности." : "Response blocked by safety filter."}")`}
      />

      <H3>JavaScript</H3>
      <CodeBlock
        title="JavaScript"
        code={`const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-mira-YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    max_tokens: 512,
    messages: [{ role: "user", content: "${isRu ? "Напиши длинную статью" : "Write a long article"}" }],
  }),
});

const data = await response.json();
const choice = data.choices[0];

switch (choice.finish_reason) {
  case "stop":
    console.log(choice.message.content);
    break;

  case "length":
    console.warn("${isRu ? "Ответ обрезан! Увеличьте max_tokens." : "Response truncated! Increase max_tokens."}");
    console.log(choice.message.content);
    break;

  case "tool_calls":
    for (const call of choice.message.tool_calls) {
      console.log(\`${isRu ? "Инструмент" : "Tool"}: \${call.function.name}(\${call.function.arguments})\`);
    }
    break;

  case "content_filter":
    console.error("${isRu ? "Контент заблокирован фильтром." : "Content blocked by filter."}");
    break;
}`}
      />

      <Note type="tip">
        {isRu
          ? "Всегда проверяйте finish_reason перед обработкой ответа. Предполагать, что ответ полный, без проверки — частая причина багов."
          : "Always check finish_reason before processing the response. Assuming the response is complete without checking is a common source of bugs."}
      </Note>

      <H2>{isRu ? "Потоковая передача и finish_reason" : "Streaming and finish_reason"}</H2>
      <P>
        {isRu
          ? "При потоковой передаче finish_reason приходит в последнем чанке. Во всех предыдущих чанках он равен null. Обрабатывайте финальный чанк для определения причины остановки."
          : "During streaming, finish_reason arrives in the last chunk. In all previous chunks it is null. Process the final chunk to determine the stop reason."}
      </P>

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/messages-api",
          title: isRu ? "Messages API" : "Messages API",
          desc: isRu ? "Структура запросов и ответов" : "Request and response structure",
        },
        {
          href: "/docs/streaming",
          title: isRu ? "Потоковая передача" : "Streaming",
          desc: isRu ? "Потоковое получение ответов" : "Receive streaming responses",
        },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. PromptEngineeringPage
   ═══════════════════════════════════════════════════════════════ */

function PromptEngineeringPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Промпт-инженерия" : "Prompt engineering"}</H1>
      <P>
        {isRu
          ? "Промпт-инженерия — это искусство и наука составления промптов (инструкций), которые помогают модели давать наилучшие результаты. Качество промпта напрямую влияет на качество ответа. В этом руководстве собраны проверенные техники, адаптированные для моделей Мира."
          : "Prompt engineering is the art and science of crafting prompts (instructions) that help the model produce the best results. Prompt quality directly impacts response quality. This guide covers proven techniques adapted for Mira models."}
      </P>

      <Note type="tip">
        {isRu
          ? "Для задач, требующих глубокого анализа, используйте модель mira-thinking — она автоматически применяет цепочку рассуждений."
          : "For tasks requiring deep analysis, use the mira-thinking model \u2014 it automatically applies chain-of-thought reasoning."}
      </Note>

      {/* ── Technique 1: Be specific ── */}
      <H2>{isRu ? "1. Будьте конкретны" : "1. Be specific"}</H2>
      <P>
        {isRu
          ? "Чем точнее вы описываете задачу, тем лучше результат. Избегайте расплывчатых формулировок. Указывайте формат, объём, стиль и контекст."
          : "The more precisely you describe the task, the better the result. Avoid vague wording. Specify format, length, style, and context."}
      </P>
      <CodeBlock
        title={isRu ? "Плохо \u2014 расплывчато" : "Bad \u2014 vague"}
        code={isRu ? "Расскажи о Python." : "Tell me about Python."}
      />
      <CodeBlock
        title={isRu ? "Хорошо \u2014 конкретно" : "Good \u2014 specific"}
        code={isRu
          ? "Напиши краткое руководство (500 слов) по основным структурам данных в Python (списки, словари, множества, кортежи) для начинающих разработчиков. Для каждой структуры приведи один пример кода."
          : "Write a concise guide (500 words) on core Python data structures (lists, dicts, sets, tuples) for beginner developers. Include one code example for each structure."}
      />

      {/* ── Technique 2: Few-shot examples ── */}
      <H2>{isRu ? "2. Используйте примеры (few-shot)" : "2. Use examples (few-shot)"}</H2>
      <P>
        {isRu
          ? "Покажите модели несколько примеров желаемого ввода и вывода. Это один из самых эффективных способов направить модель, особенно для задач классификации, форматирования и преобразования данных."
          : "Show the model a few examples of desired input and output. This is one of the most effective ways to guide the model, especially for classification, formatting, and data transformation tasks."}
      </P>
      <CodeBlock
        title={isRu ? "Few-shot: классификация тональности" : "Few-shot: sentiment classification"}
        code={isRu
          ? `Классифицируй тональность отзыва как "позитивный", "негативный" или "нейтральный".

Отзыв: "Отличный продукт, очень доволен покупкой!"
Тональность: позитивный

Отзыв: "Доставка задержалась на неделю, товар пришёл повреждённым."
Тональность: негативный

Отзыв: "Товар соответствует описанию, работает нормально."
Тональность: нейтральный

Отзыв: "Лучшая покупка за последний год! Рекомендую всем!"
Тональность:`
          : `Classify the review sentiment as "positive", "negative", or "neutral".

Review: "Great product, very happy with my purchase!"
Sentiment: positive

Review: "Delivery was a week late and the item arrived damaged."
Sentiment: negative

Review: "Product matches the description, works fine."
Sentiment: neutral

Review: "Best purchase I've made all year! Highly recommend!"
Sentiment:`}
      />

      {/* ── Technique 3: XML tags ── */}
      <H2>{isRu ? "3. Структурируйте с помощью XML-тегов" : "3. Structure with XML tags"}</H2>
      <P>
        {isRu
          ? "XML-теги помогают чётко разграничить различные части промпта: инструкции, данные, примеры и ожидаемый вывод. Модели Мира отлично понимают эту структуру."
          : "XML tags help clearly delineate different parts of the prompt: instructions, data, examples, and expected output. Mira models understand this structure well."}
      </P>
      <CodeBlock
        title={isRu ? "Структурирование XML-тегами" : "Structuring with XML tags"}
        code={isRu
          ? `<instructions>
Ты — эксперт по ревью кода. Проанализируй предоставленный код и дай рекомендации по улучшению.
Формат вывода: список пунктов с приоритетом (высокий/средний/низкий).
</instructions>

<code>
def calc(x,y):
    r=x+y
    return r
</code>

<output_format>
- [приоритет] описание проблемы и рекомендация
</output_format>`
          : `<instructions>
You are a code review expert. Analyze the provided code and give improvement recommendations.
Output format: bulleted list with priority (high/medium/low).
</instructions>

<code>
def calc(x,y):
    r=x+y
    return r
</code>

<output_format>
- [priority] problem description and recommendation
</output_format>`}
      />

      {/* ── Technique 4: Chain of thought ── */}
      <H2>{isRu ? "4. Цепочка рассуждений (Chain of Thought)" : "4. Chain of thought"}</H2>
      <P>
        {isRu
          ? "Попросите модель «думать пошагово». Это заставляет модель разбить сложную задачу на промежуточные шаги, значительно повышая точность, особенно для математических, логических и аналитических задач."
          : "Ask the model to \"think step by step.\" This forces the model to break a complex task into intermediate steps, significantly improving accuracy, especially for mathematical, logical, and analytical tasks."}
      </P>
      <CodeBlock
        title={isRu ? "Цепочка рассуждений" : "Chain of thought"}
        code={isRu
          ? `В магазине было 85 яблок. Утром продали 23 яблока, днём привезли ещё 40, а вечером продали 31.
Сколько яблок осталось?

Пожалуйста, реши эту задачу пошагово, объясняя каждый шаг рассуждения, прежде чем дать финальный ответ.`
          : `A store had 85 apples. In the morning they sold 23 apples, at noon 40 more were delivered, and in the evening they sold 31.
How many apples are left?

Please solve this step by step, explaining each reasoning step before giving the final answer.`}
      />

      <Note type="tip">
        {isRu
          ? "Модель mira-thinking делает это автоматически — она всегда рассуждает пошагово. Для остальных моделей нужно явно попросить."
          : "The mira-thinking model does this automatically \u2014 it always reasons step by step. For other models, you need to ask explicitly."}
      </Note>

      {/* ── Technique 5: Role prompting ── */}
      <H2>{isRu ? "5. Ролевое промптирование" : "5. Role prompting"}</H2>
      <P>
        {isRu
          ? "Назначьте модели конкретную роль или персону. Это задаёт контекст и стиль ответов. Используйте системный промпт для определения роли."
          : "Assign the model a specific role or persona. This sets the context and style of responses. Use the system prompt to define the role."}
      </P>
      <CodeBlock
        title={isRu ? "Ролевое промптирование" : "Role prompting"}
        code={`{
  "model": "mira",
  "messages": [
    {
      "role": "system",
      "content": "${isRu
          ? "Ты — опытный senior backend-разработчик с 15-летним стажем. Ты специализируешься на проектировании REST API и микросервисной архитектуре. Отвечай технически точно, кратко и с примерами кода на Python. Если видишь антипаттерн, сразу указывай на него."
          : "You are an experienced senior backend developer with 15 years of experience. You specialize in REST API design and microservice architecture. Answer technically accurately, concisely, and with Python code examples. If you see an anti-pattern, point it out immediately."}"
    },
    {
      "role": "user",
      "content": "${isRu ? "Как правильно обрабатывать ошибки в REST API?" : "How should I handle errors in a REST API?"}"
    }
  ]
}`}
      />

      {/* ── Technique 6: Break into steps ── */}
      <H2>{isRu ? "6. Разбивайте сложные задачи на шаги" : "6. Break complex tasks into steps"}</H2>
      <P>
        {isRu
          ? "Вместо одного огромного промпта разбейте сложную задачу на последовательность простых. Результат каждого шага подаётся на вход следующему. Это повышает качество и даёт вам контроль на каждом этапе."
          : "Instead of one massive prompt, break a complex task into a sequence of simple ones. The result of each step feeds into the next. This improves quality and gives you control at every stage."}
      </P>
      <CodeBlock
        title={isRu ? "Пошаговая обработка" : "Step-by-step processing"}
        code={isRu
          ? `# Шаг 1: Извлечь ключевые факты из текста
prompt_1 = """
Из следующего текста извлеки все ключевые факты в виде списка:
<text>
{длинный текст статьи}
</text>
"""

# Шаг 2: Сгруппировать факты по категориям
prompt_2 = """
Сгруппируй следующие факты по тематическим категориям:
<facts>
{результат шага 1}
</facts>
"""

# Шаг 3: Написать краткое резюме на основе группировки
prompt_3 = """
На основе следующей группировки фактов напиши резюме
в 3 абзаца (введение, основная часть, заключение):
<grouped_facts>
{результат шага 2}
</grouped_facts>
"""`
          : `# Step 1: Extract key facts from text
prompt_1 = """
Extract all key facts from the following text as a list:
<text>
{long article text}
</text>
"""

# Step 2: Group facts by category
prompt_2 = """
Group the following facts by thematic categories:
<facts>
{result from step 1}
</facts>
"""

# Step 3: Write a summary based on the grouping
prompt_3 = """
Based on the following grouped facts, write a summary
in 3 paragraphs (introduction, body, conclusion):
<grouped_facts>
{result from step 2}
</grouped_facts>
"""`}
      />

      {/* ── Technique 7: System prompts ── */}
      <H2>{isRu ? "7. Используйте системные промпты" : "7. Use system prompts"}</H2>
      <P>
        {isRu
          ? "Системный промпт — это мощный инструмент для задания глобального контекста. Используйте его для определения роли, ограничений, формата вывода и стиля общения. Подробнее в разделе «Системные промпты»."
          : "The system prompt is a powerful tool for setting global context. Use it to define the role, constraints, output format, and communication style. See the \"System prompts\" section for details."}
      </P>

      {/* ── Technique 8: Output format ── */}
      <H2>{isRu ? "8. Указывайте формат вывода" : "8. Specify the output format"}</H2>
      <P>
        {isRu
          ? "Явно укажите, в каком формате вы хотите получить ответ. Модели Мира отлично следуют инструкциям о формате: JSON, Markdown, список, таблица, код."
          : "Explicitly state the format you want the response in. Mira models excel at following format instructions: JSON, Markdown, list, table, code."}
      </P>
      <CodeBlock
        title={isRu ? "Запрос JSON-формата" : "Requesting JSON format"}
        code={`{
  "model": "mira",
  "response_format": { "type": "json_object" },
  "messages": [
    {
      "role": "system",
      "content": "${isRu
          ? "Ты — API для извлечения данных. Всегда отвечай валидным JSON с полями: name (string), age (number), skills (string[])."
          : "You are a data extraction API. Always respond with valid JSON containing fields: name (string), age (number), skills (string[])."}"
    },
    {
      "role": "user",
      "content": "${isRu
          ? "Извлеки данные: Алексей, 28 лет, знает Python, Go и Kubernetes."
          : "Extract data: Alex, 28 years old, knows Python, Go, and Kubernetes."}"
    }
  ]
}`}
      />

      {/* ── Technique 9: Constraints ── */}
      <H2>{isRu ? "9. Задавайте ограничения" : "9. Set constraints"}</H2>
      <P>
        {isRu
          ? "Ограничения помогают модели оставаться в рамках задачи. Укажите, чего не нужно делать, какие темы обходить, и какой длины должен быть ответ."
          : "Constraints help the model stay on task. Specify what not to do, which topics to avoid, and how long the response should be."}
      </P>
      <CodeBlock
        title={isRu ? "Использование ограничений" : "Using constraints"}
        code={isRu
          ? `Объясни концепцию REST API.

Ограничения:
- Максимум 200 слов
- Не используй технический жаргон — объясняй для нетехнического человека
- Приведи одну аналогию из повседневной жизни
- Не упоминай конкретные фреймворки или языки программирования`
          : `Explain the concept of REST API.

Constraints:
- Maximum 200 words
- Do not use technical jargon — explain for a non-technical person
- Include one analogy from everyday life
- Do not mention specific frameworks or programming languages`}
      />

      {/* ── Technique 10: Iteration ── */}
      <H2>{isRu ? "10. Итерируйте и экспериментируйте" : "10. Iterate and experiment"}</H2>
      <P>
        {isRu
          ? "Промпт-инженерия — итеративный процесс. Редко первый промпт даёт идеальный результат. Экспериментируйте с формулировками, температурой, количеством примеров и структурой."
          : "Prompt engineering is an iterative process. The first prompt rarely gives perfect results. Experiment with wording, temperature, number of examples, and structure."}
      </P>
      <UL items={[
        { bold: isRu ? "Температура 0\u20130.3" : "Temperature 0\u20130.3", text: isRu ? "Для задач с единственным правильным ответом (код, факты, классификация)." : "For tasks with a single correct answer (code, facts, classification)." },
        { bold: isRu ? "Температура 0.5\u20130.8" : "Temperature 0.5\u20130.8", text: isRu ? "Для творческих задач с балансом точности и разнообразия." : "For creative tasks balancing accuracy and variety." },
        { bold: isRu ? "Температура 0.9\u20131.5" : "Temperature 0.9\u20131.5", text: isRu ? "Для максимально творческих задач (стихи, брейнсторм, художественный текст)." : "For maximum creativity (poetry, brainstorming, fiction)." },
      ]} />

      <H2>{isRu ? "Сводка лучших практик" : "Best practices summary"}</H2>
      <Table
        headers={[
          isRu ? "Техника" : "Technique",
          isRu ? "Когда использовать" : "When to use",
        ]}
        rows={[
          [isRu ? "Конкретность" : "Specificity", isRu ? "Всегда" : "Always"],
          [isRu ? "Few-shot примеры" : "Few-shot examples", isRu ? "Классификация, форматирование, преобразование" : "Classification, formatting, transformation"],
          [isRu ? "XML-теги" : "XML tags", isRu ? "Сложные промпты с несколькими частями" : "Complex prompts with multiple parts"],
          [isRu ? "Цепочка рассуждений" : "Chain of thought", isRu ? "Математика, логика, аналитика" : "Math, logic, analytics"],
          [isRu ? "Ролевое промптирование" : "Role prompting", isRu ? "Экспертные ответы, специализация" : "Expert answers, specialization"],
          [isRu ? "Разбиение на шаги" : "Task decomposition", isRu ? "Сложные, многоэтапные задачи" : "Complex, multi-step tasks"],
          [isRu ? "Формат вывода" : "Output format", isRu ? "Структурированные данные, интеграции" : "Structured data, integrations"],
          [isRu ? "Ограничения" : "Constraints", isRu ? "Контроль объёма и содержания" : "Controlling scope and content"],
        ]}
      />

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/system-prompts",
          title: isRu ? "Системные промпты" : "System prompts",
          desc: isRu ? "Подробное руководство по системным промптам" : "Detailed guide to system prompts",
        },
        {
          href: "/docs/messages-api",
          title: isRu ? "Messages API" : "Messages API",
          desc: isRu ? "Применяйте техники через API" : "Apply techniques via the API",
        },
        {
          href: "/docs/models",
          title: isRu ? "Обзор моделей" : "Models overview",
          desc: isRu ? "Выберите модель для вашей задачи" : "Choose the right model for your task",
        },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. SystemPromptsPage
   ═══════════════════════════════════════════════════════════════ */

function SystemPromptsPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Системные промпты" : "System prompts"}</H1>
      <P>
        {isRu
          ? "Системный промпт — это специальное сообщение, задающее поведение, роль и ограничения модели для всего диалога. Это самый мощный инструмент для настройки модели под вашу задачу."
          : "A system prompt is a special message that sets the model's behavior, role, and constraints for the entire conversation. It is the most powerful tool for customizing the model for your task."}
      </P>

      <H2>{isRu ? "Что такое системный промпт" : "What is a system prompt"}</H2>
      <P>
        {isRu
          ? "Системный промпт — это первое сообщение в массиве messages с ролью \"system\". Он не виден конечному пользователю, но определяет, как модель будет отвечать на все последующие сообщения. Думайте о нём как о «должностной инструкции» для модели."
          : "A system prompt is the first message in the messages array with the role \"system\". It is not visible to the end user but defines how the model will respond to all subsequent messages. Think of it as a \"job description\" for the model."}
      </P>

      <H2>{isRu ? "Как использовать системный промпт" : "How to use a system prompt"}</H2>
      <P>
        {isRu
          ? "Добавьте сообщение с role: \"system\" первым в массиве messages:"
          : "Add a message with role: \"system\" as the first item in the messages array:"}
      </P>
      <CodeBlock
        title={isRu ? "Базовый системный промпт" : "Basic system prompt"}
        code={`{
  "model": "mira",
  "messages": [
    {
      "role": "system",
      "content": "${isRu
          ? "Ты — дружелюбный ассистент-переводчик. Переводи всё, что пишет пользователь, с русского на английский и наоборот. Не давай никаких объяснений, только перевод."
          : "You are a friendly translation assistant. Translate everything the user writes from English to Spanish and vice versa. Do not provide any explanations, only the translation."}"
    },
    {
      "role": "user",
      "content": "${isRu ? "Привет, как дела?" : "Hello, how are you?"}"
    }
  ]
}`}
      />

      <Note type="info">
        {isRu
          ? "Системный промпт должен быть первым сообщением. Некоторые SDK также поддерживают отдельный параметр system, но в API Мира используется стандартный формат OpenAI с role: \"system\"."
          : "The system prompt should be the first message. Some SDKs also support a separate system parameter, but the Mira API uses the standard OpenAI format with role: \"system\"."}
      </Note>

      <H2>{isRu ? "Лучшие практики" : "Best practices"}</H2>

      <H3>{isRu ? "Определите персону" : "Define a persona"}</H3>
      <P>
        {isRu
          ? "Дайте модели чёткую роль. Это определит тон, стиль и глубину ответов."
          : "Give the model a clear role. This determines the tone, style, and depth of responses."}
      </P>
      <CodeBlock
        title={isRu ? "Персона" : "Persona"}
        code={isRu
          ? `Ты — Алиса, опытный DevOps-инженер в крупной технологической компании. Ты помогаешь джуниор-разработчикам настраивать CI/CD пайплайны, контейнеризацию и мониторинг. Отвечай дружелюбно, но технически точно. Если чего-то не знаешь, честно скажи об этом.`
          : `You are Alice, an experienced DevOps engineer at a large tech company. You help junior developers set up CI/CD pipelines, containerization, and monitoring. Answer in a friendly but technically accurate manner. If you don't know something, say so honestly.`}
      />

      <H3>{isRu ? "Установите ограничения" : "Set constraints"}</H3>
      <P>
        {isRu
          ? "Явно укажите, что модель должна и не должна делать. Ограничения помогают модели оставаться в рамках задачи."
          : "Explicitly state what the model should and should not do. Constraints help the model stay on task."}
      </P>
      <CodeBlock
        title={isRu ? "Ограничения" : "Constraints"}
        code={isRu
          ? `Ты — ассистент службы поддержки компании "ТехноМаг".

Правила:
- Отвечай только на вопросы о продуктах и услугах "ТехноМаг"
- Если вопрос не касается компании, вежливо перенаправь к теме
- Не давай советов по конкурентным продуктам
- Не обсуждай цены конкурентов
- Если не можешь помочь, предложи связаться с живым оператором
- Отвечай на языке, на котором задан вопрос`
          : `You are a support assistant for the company "TechMag".

Rules:
- Only answer questions about TechMag products and services
- If a question is off-topic, politely redirect to the subject
- Do not give advice about competing products
- Do not discuss competitor pricing
- If you cannot help, suggest contacting a live operator
- Respond in the language the question was asked in`}
      />

      <H3>{isRu ? "Задайте формат вывода" : "Define output format"}</H3>
      <P>
        {isRu
          ? "Если вам нужен определённый формат ответа, опишите его в системном промпте."
          : "If you need a specific response format, describe it in the system prompt."}
      </P>
      <CodeBlock
        title={isRu ? "Формат вывода" : "Output format"}
        code={isRu
          ? `Ты — ассистент для анализа текста. Для каждого текста пользователя верни JSON-объект с полями:
{
  "summary": "краткое содержание в одном предложении",
  "sentiment": "positive" | "negative" | "neutral",
  "key_topics": ["тема1", "тема2", ...],
  "word_count": число,
  "language": "ru" | "en" | "other"
}
Не добавляй никакого текста вне JSON.`
          : `You are a text analysis assistant. For each user text, return a JSON object with the fields:
{
  "summary": "one-sentence summary",
  "sentiment": "positive" | "negative" | "neutral",
  "key_topics": ["topic1", "topic2", ...],
  "word_count": number,
  "language": "ru" | "en" | "other"
}
Do not add any text outside the JSON.`}
      />

      <H2>{isRu ? "Примеры для различных сценариев" : "Examples for different use cases"}</H2>

      <H3>{isRu ? "Ассистент по программированию" : "Coding assistant"}</H3>
      <CodeBlock
        title={isRu ? "Системный промпт: кодинг-ассистент" : "System prompt: coding assistant"}
        code={`{
  "role": "system",
  "content": "${isRu
          ? "Ты — эксперт-программист. Следуй этим правилам:\\n1. Пиши чистый, читаемый код с комментариями\\n2. Следуй лучшим практикам и паттернам проектирования\\n3. Обрабатывай граничные случаи и ошибки\\n4. Предлагай тесты для критичного кода\\n5. Если есть несколько подходов, объясни плюсы и минусы каждого\\n6. Используй современный синтаксис языка\\n7. Указывай на потенциальные проблемы с производительностью"
          : "You are an expert programmer. Follow these rules:\\n1. Write clean, readable code with comments\\n2. Follow best practices and design patterns\\n3. Handle edge cases and errors\\n4. Suggest tests for critical code\\n5. If there are multiple approaches, explain the pros and cons of each\\n6. Use modern language syntax\\n7. Point out potential performance issues"}"
}`}
      />

      <H3>{isRu ? "Переводчик" : "Translator"}</H3>
      <CodeBlock
        title={isRu ? "Системный промпт: переводчик" : "System prompt: translator"}
        code={`{
  "role": "system",
  "content": "${isRu
          ? "Ты — профессиональный переводчик. Правила:\\n- Переводи текст с русского на английский и наоборот\\n- Сохраняй стиль, тон и форматирование оригинала\\n- Технические термины переводи с пояснением в скобках при первом упоминании\\n- Не добавляй своих комментариев\\n- Если текст содержит идиомы, подбирай эквивалентные выражения в целевом языке\\n- Сохраняй структуру абзацев"
          : "You are a professional translator. Rules:\\n- Translate text between English and Russian\\n- Preserve the style, tone, and formatting of the original\\n- Translate technical terms with an explanation in parentheses on first mention\\n- Do not add your own commentary\\n- If the text contains idioms, find equivalent expressions in the target language\\n- Preserve paragraph structure"}"
}`}
      />

      <H3>{isRu ? "Аналитик данных" : "Data analyst"}</H3>
      <CodeBlock
        title={isRu ? "Системный промпт: аналитик данных" : "System prompt: data analyst"}
        code={`{
  "role": "system",
  "content": "${isRu
          ? "Ты — аналитик данных. При анализе данных:\\n1. Начни с общего обзора: объём, типы данных, пропуски\\n2. Выяви ключевые паттерны и тренды\\n3. Рассчитай базовую статистику (среднее, медиана, стд. отклонение)\\n4. Укажи на аномалии и выбросы\\n5. Предложи визуализации (укажи тип графика и оси)\\n6. Сделай выводы и рекомендации\\n7. Приведи код на Python (pandas/matplotlib) для воспроизведения\\nФормат: Markdown с заголовками для каждого раздела."
          : "You are a data analyst. When analyzing data:\\n1. Start with a general overview: volume, data types, missing values\\n2. Identify key patterns and trends\\n3. Calculate basic statistics (mean, median, std deviation)\\n4. Point out anomalies and outliers\\n5. Suggest visualizations (specify chart type and axes)\\n6. Draw conclusions and recommendations\\n7. Provide Python code (pandas/matplotlib) for reproduction\\nFormat: Markdown with headings for each section."}"
}`}
      />

      <H3>{isRu ? "Генератор контента" : "Content generator"}</H3>
      <CodeBlock
        title={isRu ? "Системный промпт: контент-генератор" : "System prompt: content generator"}
        code={`{
  "role": "system",
  "content": "${isRu
          ? "Ты — копирайтер для технологического блога. Стиль:\\n- Профессиональный, но доступный\\n- Используй короткие абзацы (3-4 предложения)\\n- Добавляй подзаголовки каждые 2-3 абзаца\\n- Включай практические примеры и кейсы\\n- Завершай статью кратким резюме и призывом к действию\\n- Целевая аудитория: разработчики среднего уровня\\n- Объём: 800-1200 слов, если не указано иное"
          : "You are a copywriter for a technology blog. Style:\\n- Professional but accessible\\n- Use short paragraphs (3-4 sentences)\\n- Add subheadings every 2-3 paragraphs\\n- Include practical examples and case studies\\n- End articles with a brief summary and call to action\\n- Target audience: mid-level developers\\n- Length: 800-1200 words unless specified otherwise"}"
}`}
      />

      <H2>{isRu ? "Составной системный промпт" : "Composite system prompt"}</H2>
      <P>
        {isRu
          ? "Для сложных приложений комбинируйте несколько аспектов в одном системном промпте. Используйте XML-теги или разделители для структурирования:"
          : "For complex applications, combine multiple aspects in a single system prompt. Use XML tags or separators for structuring:"}
      </P>
      <CodeBlock
        title={isRu ? "Составной системный промпт" : "Composite system prompt"}
        code={isRu
          ? `<role>
Ты — ассистент интернет-магазина электроники "Мегабайт".
</role>

<knowledge>
- Каталог: ноутбуки, смартфоны, планшеты, аксессуары
- Доставка: 1-3 дня по Москве, 3-7 дней по России
- Возврат: 14 дней без объяснения причин
- Гарантия: 1 год на все товары
</knowledge>

<style>
- Отвечай вежливо и лаконично
- Используй эмодзи умеренно
- Предлагай альтернативы, если товар недоступен
</style>

<restrictions>
- Не обсуждай конкурентов
- Не давай финансовых советов
- Не делись внутренней информацией о компании
- При запросе контактов давай: support@megabyte.ru, 8-800-123-4567
</restrictions>`
          : `<role>
You are a customer support assistant for the electronics store "MegaByte".
</role>

<knowledge>
- Catalog: laptops, smartphones, tablets, accessories
- Delivery: 1-3 days in Moscow, 3-7 days across Russia
- Returns: 14 days no questions asked
- Warranty: 1 year on all products
</knowledge>

<style>
- Answer politely and concisely
- Use emojis sparingly
- Suggest alternatives if a product is unavailable
</style>

<restrictions>
- Do not discuss competitors
- Do not give financial advice
- Do not share internal company information
- When asked for contacts, provide: support@megabyte.com, 1-800-123-4567
</restrictions>`}
      />

      <H2>{isRu ? "Советы по эффективности" : "Effectiveness tips"}</H2>
      <UL items={[
        { bold: isRu ? "Тестируйте промпт" : "Test your prompt", text: isRu ? "Отправьте несколько разных запросов, чтобы убедиться, что модель следует инструкциям во всех случаях." : "Send several different requests to ensure the model follows instructions in all cases." },
        { bold: isRu ? "Не перегружайте" : "Don't overload", text: isRu ? "Слишком длинный системный промпт может запутать модель. Оставьте только необходимое." : "An overly long system prompt can confuse the model. Keep only what's necessary." },
        { bold: isRu ? "Будьте конкретны" : "Be specific", text: isRu ? "\"Отвечай кратко\" хуже, чем \"Отвечай в 2-3 предложениях\"." : "\"Answer briefly\" is worse than \"Answer in 2-3 sentences.\"" },
        { bold: isRu ? "Приоритезируйте" : "Prioritize", text: isRu ? "Самые важные инструкции ставьте в начало промпта." : "Put the most important instructions at the beginning of the prompt." },
        { bold: isRu ? "Используйте примеры" : "Use examples", text: isRu ? "Включите 1-2 примера желаемого поведения прямо в системный промпт." : "Include 1-2 examples of desired behavior directly in the system prompt." },
      ]} />

      <Note type="tip">
        {isRu
          ? "Системный промпт расходует токены из контекстного окна. Для модели mira (32K контекст) старайтесь не превышать 500-1000 токенов на системный промпт."
          : "The system prompt consumes tokens from the context window. For the mira model (32K context), try to keep the system prompt under 500-1000 tokens."}
      </Note>

      <H2>{isRu ? "Системный промпт через OpenAI SDK" : "System prompt via OpenAI SDK"}</H2>
      <CodeBlock
        title="Python (OpenAI SDK)"
        code={`from openai import OpenAI

client = OpenAI(
    api_key="sk-mira-YOUR_API_KEY",
    base_url="https://api.vmira.ai/v1",
)

response = client.chat.completions.create(
    model="mira-pro",
    messages=[
        {
            "role": "system",
            "content": "${isRu
              ? "Ты — эксперт по кибербезопасности. Анализируй код на наличие уязвимостей и предлагай исправления."
              : "You are a cybersecurity expert. Analyze code for vulnerabilities and suggest fixes."}"
        },
        {
            "role": "user",
            "content": "${isRu ? "Проверь этот SQL-запрос: query = f'SELECT * FROM users WHERE id = {user_id}'" : "Check this SQL query: query = f'SELECT * FROM users WHERE id = {user_id}'"}"
        },
    ],
)

print(response.choices[0].message.content)`}
      />

      <H2>{isRu ? "Следующие шаги" : "Next steps"}</H2>
      <NavCards cards={[
        {
          href: "/docs/prompt-engineering",
          title: isRu ? "Промпт-инженерия" : "Prompt engineering",
          desc: isRu ? "Больше техник для улучшения промптов" : "More techniques for better prompts",
        },
        {
          href: "/docs/messages-api",
          title: isRu ? "Messages API" : "Messages API",
          desc: isRu ? "Используйте системные промпты через API" : "Use system prompts via the API",
        },
        {
          href: "/docs/models",
          title: isRu ? "Обзор моделей" : "Models overview",
          desc: isRu ? "Выберите модель для вашей задачи" : "Choose the right model for your task",
        },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Content map export
   ═══════════════════════════════════════════════════════════════ */

export const buildFeaturesContent: Record<string, React.FC<{ locale: Locale }>> = {
  "features-overview": FeaturesOverviewPage,
  "messages-api": MessagesApiPage,
  "streaming": StreamingPage,
  "stop-reasons": StopReasonsPage,
  "prompt-engineering": PromptEngineeringPage,
  "system-prompts": SystemPromptsPage,
};
