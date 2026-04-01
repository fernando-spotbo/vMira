"use client";
import Link from "next/link";
import { CodeBlock, Note, H1, H2, H3, P, DocLink, NavCards, UL, Table, ParamTable, InlineCode } from "../shared";
import type { Locale } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════
   1. VisionPage — Image input capabilities
   ═══════════════════════════════════════════════════════════════ */

function VisionPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Распознавание изображений" : "Vision (Image Input)"}</H1>
      <Note type="warning">
        {isRu
          ? "Распознавание изображений через публичный API (/v1/chat/completions) находится в разработке. Эта функция доступна через интерфейс Mira Chat на platform.vmira.ai."
          : "Vision via the public API (/v1/chat/completions) is under development. This feature is available through the Mira Chat interface at platform.vmira.ai."}
      </Note>
      <P>
        {isRu
          ? "Модели Mira могут анализировать изображения, переданные в запросе. Вы можете отправлять изображения как Base64-строку или как URL-ссылку, используя формат content blocks, совместимый с OpenAI."
          : "Mira models can analyze images included in your request. You can send images as Base64-encoded strings or as URL references, using the OpenAI-compatible content blocks format."}
      </P>

      <Note type="info">
        {isRu
          ? "Распознавание изображений доступно для моделей mira, mira-pro и mira-max. Модель mira-thinking поддерживает изображения, но может отвечать медленнее из-за этапа рассуждений."
          : "Vision is available for the mira, mira-pro, and mira-max models. The mira-thinking model supports images but may respond slower due to the reasoning step."}
      </Note>

      <H2>{isRu ? "Поддерживаемые форматы" : "Supported Formats"}</H2>
      <Table
        headers={[
          isRu ? "Формат" : "Format",
          isRu ? "MIME-тип" : "MIME Type",
          isRu ? "Макс. размер" : "Max Size",
        ]}
        rows={[
          ["JPEG", "image/jpeg", "20 MB"],
          ["PNG", "image/png", "20 MB"],
          ["GIF", "image/gif", "20 MB"],
          ["WebP", "image/webp", "20 MB"],
        ]}
      />

      <H2>{isRu ? "Отправка изображения по URL" : "Sending an Image via URL"}</H2>
      <P>
        {isRu
          ? "Самый простой способ — передать публичный URL изображения в блоке content с типом image_url."
          : "The simplest approach is to pass a publicly accessible image URL inside a content block with type image_url."}
      </P>
      <CodeBlock
        title="cURL"
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer sk-mira-YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "${isRu ? "Что изображено на этой картинке?" : "What is in this image?"}"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://example.com/photo.jpg"
            }
          }
        ]
      }
    ],
    "max_tokens": 1024
  }'`}
      />

      <H2>{isRu ? "Отправка изображения в Base64" : "Sending a Base64 Image"}</H2>
      <P>
        {isRu
          ? "Если изображение находится на диске или генерируется динамически, закодируйте его в Base64 и передайте с data URI."
          : "If the image is on disk or generated dynamically, encode it to Base64 and pass it with a data URI."}
      </P>
      <CodeBlock
        title="Python"
        code={`import base64, requests

with open("photo.png", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={"Authorization": "Bearer sk-mira-YOUR_KEY"},
    json={
        "model": "mira",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "${isRu ? "Опиши это изображение" : "Describe this image"}"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img_b64}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1024
    }
)

print(response.json()["choices"][0]["message"]["content"])`}
      />

      <CodeBlock
        title="JavaScript"
        code={`import fs from "fs";

const imgBuffer = fs.readFileSync("photo.png");
const imgB64 = imgBuffer.toString("base64");

const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-mira-YOUR_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "${isRu ? "Что на этой картинке?" : "What is in this image?"}" },
          {
            type: "image_url",
            image_url: {
              url: \`data:image/png;base64,\${imgB64}\`,
            },
          },
        ],
      },
    ],
    max_tokens: 1024,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`}
      />

      <H2>{isRu ? "Несколько изображений" : "Multiple Images"}</H2>
      <P>
        {isRu
          ? "Вы можете отправить несколько изображений в одном запросе, добавив несколько блоков image_url в массив content. Модель проанализирует все изображения вместе."
          : "You can send multiple images in a single request by adding multiple image_url blocks in the content array. The model will analyze all images together."}
      </P>
      <CodeBlock
        title="JSON body"
        code={`{
  "model": "mira-pro",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "${isRu ? "Сравни эти два изображения" : "Compare these two images"}" },
        { "type": "image_url", "image_url": { "url": "https://example.com/image1.jpg" } },
        { "type": "image_url", "image_url": { "url": "https://example.com/image2.jpg" } }
      ]
    }
  ],
  "max_tokens": 2048
}`}
      />

      <Note type="tip">
        {isRu
          ? "Отправляйте до 10 изображений в одном запросе. Учтите, что каждое изображение потребляет токены: примерно 85 токенов за тайл 512x512 пикселей."
          : "You can send up to 10 images per request. Note that each image consumes tokens: approximately 85 tokens per 512x512 pixel tile."}
      </Note>

      <H2>{isRu ? "Рекомендации по качеству" : "Image Quality Best Practices"}</H2>
      <UL
        items={[
          {
            bold: isRu ? "Разрешение" : "Resolution",
            text: isRu
              ? "Для мелких деталей используйте изображения не менее 768px по длинной стороне. Слишком маленькие изображения снижают точность."
              : "For fine details, use images at least 768px on the long edge. Very small images reduce accuracy.",
          },
          {
            bold: isRu ? "Чёткость" : "Clarity",
            text: isRu
              ? "Избегайте размытых, пережатых или сильно затемнённых фотографий."
              : "Avoid blurry, heavily compressed, or very dark photos.",
          },
          {
            bold: isRu ? "Обрезка" : "Cropping",
            text: isRu
              ? "Обрежьте изображение до нужной области, чтобы модель сосредоточилась на важном контенте."
              : "Crop the image to the region of interest so the model focuses on the relevant content.",
          },
          {
            bold: isRu ? "Текст на изображениях" : "Text in images",
            text: isRu
              ? "Модель хорошо читает печатный текст. Рукописный текст распознаётся менее надёжно."
              : "The model reads printed text well. Handwritten text is recognized less reliably.",
          },
        ]}
      />

      <H2>{isRu ? "Ограничения" : "Limitations"}</H2>
      <UL
        items={[
          {
            bold: isRu ? "Идентификация людей" : "People identification",
            text: isRu
              ? "Модель не идентифицирует конкретных людей по лицам. Она может описать внешность, но не назовёт имена."
              : "The model does not identify specific people by face. It can describe appearance but will not name individuals.",
          },
          {
            bold: isRu ? "Пространственное мышление" : "Spatial reasoning",
            text: isRu
              ? "Точные измерения, подсчёт мелких объектов и определение расположения элементов могут быть неточными."
              : "Precise measurements, counting small objects, and determining exact spatial positions may be inaccurate.",
          },
          {
            bold: isRu ? "Медицинские / специализированные изображения" : "Medical / specialized images",
            text: isRu
              ? "Модель не является диагностическим инструментом. Не используйте её для медицинской диагностики."
              : "The model is not a diagnostic tool. Do not use it for medical diagnosis.",
          },
        ]}
      />

      <Note type="warning">
        {isRu
          ? "Не отправляйте изображения, содержащие конфиденциальную информацию (документы, пароли, персональные данные), если ваше приложение не защищено соответствующим образом."
          : "Do not send images containing sensitive information (documents, passwords, personal data) unless your application is appropriately secured."}
      </Note>

      <H2>{isRu ? "Следующие шаги" : "Next Steps"}</H2>
      <NavCards
        cards={[
          {
            href: "/docs/build/tool-use",
            title: isRu ? "Использование инструментов" : "Tool Use",
            desc: isRu ? "Вызов функций и интеграция с внешними сервисами" : "Function calling and external service integration",
          },
          {
            href: "/docs/build/extended-thinking",
            title: isRu ? "Расширенное мышление" : "Extended Thinking",
            desc: isRu ? "Пошаговое рассуждение для сложных задач" : "Step-by-step reasoning for complex tasks",
          },
        ]}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. ToolUsePage — Function calling / tool use
   ═══════════════════════════════════════════════════════════════ */

function ToolUsePage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Использование инструментов (Function Calling)" : "Tool Use (Function Calling)"}</H1>
      <Note type="warning">
        {isRu
          ? "Вызов инструментов через публичный API (/v1/chat/completions) находится в разработке. Параметры tools и tool_choice будут доступны в ближайших обновлениях."
          : "Tool calling via the public API (/v1/chat/completions) is under development. The tools and tool_choice parameters will be available in upcoming releases."}
      </Note>
      <P>
        {isRu
          ? "Инструменты позволяют модели вызывать внешние функции для получения данных или выполнения действий. Вы описываете доступные функции в запросе, модель решает, когда их вызвать, и возвращает структурированный вызов, который вы исполняете на своей стороне."
          : "Tools allow the model to call external functions to retrieve data or perform actions. You describe available functions in your request, the model decides when to call them, and returns a structured call that you execute on your side."}
      </P>

      <H2>{isRu ? "Как это работает" : "How It Works"}</H2>
      <P>
        {isRu
          ? "Процесс состоит из трёх шагов:"
          : "The process consists of three steps:"}
      </P>
      <UL
        items={[
          {
            bold: isRu ? "1. Определение инструментов" : "1. Define tools",
            text: isRu
              ? "Передайте массив tools в запросе с описанием каждой функции и её параметров в формате JSON Schema."
              : "Pass a tools array in your request describing each function and its parameters using JSON Schema.",
          },
          {
            bold: isRu ? "2. Модель возвращает tool_calls" : "2. Model returns tool_calls",
            text: isRu
              ? "Если модель решает, что нужно вызвать функцию, она возвращает finish_reason: \"tool_calls\" и массив tool_calls с именем функции и аргументами."
              : "If the model decides to call a function, it returns finish_reason: \"tool_calls\" and a tool_calls array with the function name and arguments.",
          },
          {
            bold: isRu ? "3. Отправка результатов обратно" : "3. Send results back",
            text: isRu
              ? "Вы исполняете функцию, добавляете результат в messages с role: \"tool\" и отправляете повторный запрос."
              : "You execute the function, append the result to messages with role: \"tool\", and send a follow-up request.",
          },
        ]}
      />

      <H2>{isRu ? "Определение инструментов" : "Defining Tools"}</H2>
      <P>
        {isRu
          ? "Каждый инструмент описывается объектом с type: \"function\" и блоком function, содержащим имя, описание и параметры."
          : "Each tool is described by an object with type: \"function\" and a function block containing the name, description, and parameters."}
      </P>
      <CodeBlock
        title={isRu ? "Схема инструмента" : "Tool schema"}
        code={`{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "${isRu ? "Получить текущую погоду для указанного города" : "Get current weather for a given city"}",
    "parameters": {
      "type": "object",
      "properties": {
        "city": {
          "type": "string",
          "description": "${isRu ? "Название города, например: Москва" : "City name, e.g. London"}"
        },
        "units": {
          "type": "string",
          "enum": ["celsius", "fahrenheit"],
          "description": "${isRu ? "Единицы измерения температуры" : "Temperature units"}"
        }
      },
      "required": ["city"]
    }
  }
}`}
      />

      <H2>{isRu ? "Полный пример" : "Full Example"}</H2>
      <H3>{isRu ? "Шаг 1: Запрос с инструментами" : "Step 1: Request with tools"}</H3>
      <CodeBlock
        title="Python"
        code={`import requests, json

API_KEY = "sk-mira-YOUR_KEY"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"},
                    "units": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                },
                "required": ["city"]
            }
        }
    }
]

messages = [{"role": "user", "content": "${isRu ? "Какая погода в Москве?" : "What is the weather in London?"}"}]

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"model": "mira", "messages": messages, "tools": tools}
)

result = response.json()
choice = result["choices"][0]
print(choice["finish_reason"])  # "tool_calls"
print(choice["message"]["tool_calls"])`}
      />

      <H3>{isRu ? "Шаг 2: Ответ модели с tool_calls" : "Step 2: Model response with tool_calls"}</H3>
      <CodeBlock
        title="JSON"
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
              "arguments": "{\\"city\\": \\"${isRu ? "Moscow" : "London"}\\", \\"units\\": \\"celsius\\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}`}
      />

      <H3>{isRu ? "Шаг 3: Отправка результата функции" : "Step 3: Send function result"}</H3>
      <CodeBlock
        title="Python"
        code={`# Execute the function on your side
weather_result = {"temperature": 18, "condition": "cloudy", "humidity": 72}

# Append the assistant message with tool_calls
messages.append(choice["message"])

# Append the tool result
messages.append({
    "role": "tool",
    "tool_call_id": "call_abc123",
    "content": json.dumps(weather_result)
})

# Send the follow-up request
response2 = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"model": "mira", "messages": messages, "tools": tools}
)

final_answer = response2.json()["choices"][0]["message"]["content"]
print(final_answer)
# "${isRu ? "В Москве сейчас 18°C, облачно, влажность 72%." : "It's currently 18°C in London, cloudy with 72% humidity."}"`}
      />

      <H2>{isRu ? "Параллельные вызовы инструментов" : "Parallel Tool Calls"}</H2>
      <P>
        {isRu
          ? "Модель может вернуть несколько tool_calls одновременно, если ей нужны данные из нескольких источников. В этом случае массив tool_calls будет содержать несколько элементов. Вы должны исполнить все вызовы и отправить все результаты обратно."
          : "The model can return multiple tool_calls at once if it needs data from several sources. In that case, the tool_calls array will contain multiple items. You must execute all calls and send all results back."}
      </P>
      <CodeBlock
        title="JSON"
        code={`{
  "tool_calls": [
    {
      "id": "call_001",
      "type": "function",
      "function": { "name": "get_weather", "arguments": "{\\"city\\": \\"London\\"}" }
    },
    {
      "id": "call_002",
      "type": "function",
      "function": { "name": "get_weather", "arguments": "{\\"city\\": \\"Paris\\"}" }
    }
  ]
}`}
      />

      <Note type="tip">
        {isRu
          ? "Выполняйте параллельные вызовы инструментов конкурентно (Promise.all в JS, asyncio.gather в Python), чтобы уменьшить задержку."
          : "Execute parallel tool calls concurrently (Promise.all in JS, asyncio.gather in Python) to reduce latency."}
      </Note>

      <H2>{isRu ? "Параметр tool_choice" : "The tool_choice Parameter"}</H2>
      <P>
        {isRu
          ? "Управляйте тем, как модель использует инструменты, с помощью параметра tool_choice:"
          : "Control how the model uses tools with the tool_choice parameter:"}
      </P>
      <Table
        headers={[
          isRu ? "Значение" : "Value",
          isRu ? "Поведение" : "Behavior",
        ]}
        rows={[
          [
            '"auto"',
            isRu
              ? "Модель сама решает, вызывать ли инструмент (по умолчанию)"
              : "Model decides whether to call a tool (default)",
          ],
          [
            '"none"',
            isRu
              ? "Модель не будет вызывать инструменты, даже если они определены"
              : "Model will not call tools, even if they are defined",
          ],
          [
            '"required"',
            isRu
              ? "Модель обязана вызвать хотя бы один инструмент"
              : "Model must call at least one tool",
          ],
          [
            '{"type":"function","function":{"name":"get_weather"}}',
            isRu
              ? "Принудительный вызов конкретной функции"
              : "Force a specific function to be called",
          ],
        ]}
      />

      <Note type="warning">
        {isRu
          ? "Не определяйте слишком много инструментов (более 20) — это увеличивает потребление токенов и может снизить качество выбора модели."
          : "Do not define too many tools (more than 20) — this increases token consumption and can reduce the model's tool selection quality."}
      </Note>

      <H2>{isRu ? "Следующие шаги" : "Next Steps"}</H2>
      <NavCards
        cards={[
          {
            href: "/docs/build/json-mode",
            title: isRu ? "Режим JSON" : "JSON Mode",
            desc: isRu ? "Получение структурированных данных в формате JSON" : "Get structured JSON output from the model",
          },
          {
            href: "/docs/build/vision",
            title: isRu ? "Распознавание изображений" : "Vision",
            desc: isRu ? "Отправка и анализ изображений" : "Send and analyze images",
          },
        ]}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. ExtendedThinkingPage — Extended thinking / reasoning mode
   ═══════════════════════════════════════════════════════════════ */

function ExtendedThinkingPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Расширенное мышление" : "Extended Thinking"}</H1>
      <Note type="info">
        {isRu
          ? "Расширенное мышление доступно через модель mira-thinking. Внутренние рассуждения модели обрабатываются на сервере — ответ API содержит только итоговый результат."
          : "Extended thinking is available via the mira-thinking model. The model's internal reasoning is processed server-side — the API response contains only the final result."}
      </Note>
      <P>
        {isRu
          ? "Расширенное мышление позволяет модели пошагово рассуждать перед формированием окончательного ответа. Это повышает точность для сложных задач: математики, логики, анализа кода, многошаговых рассуждений."
          : "Extended thinking allows the model to reason step-by-step before producing its final answer. This improves accuracy for complex tasks: math, logic, code analysis, and multi-step reasoning."}
      </P>

      <H2>{isRu ? "Как это работает" : "How It Works"}</H2>
      <P>
        {isRu
          ? "Когда вы используете модель mira-thinking, она генерирует внутреннюю \"цепочку рассуждений\" (chain-of-thought) перед итоговым ответом. Этапы рассуждения возвращаются в поле thinking ответа, что позволяет вам видеть ход мысли модели."
          : "When you use the mira-thinking model, it generates an internal \"chain-of-thought\" before the final answer. The reasoning steps are returned in the thinking field of the response, letting you see the model's thought process."}
      </P>

      <UL
        items={[
          {
            bold: isRu ? "Модель" : "Model",
            text: isRu
              ? "Используйте mira-thinking для активации режима рассуждений."
              : "Use mira-thinking to enable reasoning mode.",
          },
          {
            bold: isRu ? "Этап рассуждения" : "Thinking phase",
            text: isRu
              ? "Модель анализирует задачу, разбивает её на шаги и проверяет свои выводы."
              : "The model analyzes the task, breaks it into steps, and verifies its conclusions.",
          },
          {
            bold: isRu ? "Итоговый ответ" : "Final answer",
            text: isRu
              ? "После рассуждения модель формирует чистый, структурированный ответ."
              : "After reasoning, the model produces a clean, structured answer.",
          },
        ]}
      />

      <H2>{isRu ? "Базовый пример" : "Basic Example"}</H2>
      <CodeBlock
        title="cURL"
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer sk-mira-YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira-thinking",
    "messages": [
      {
        "role": "user",
        "content": "${isRu ? "Решите: если у меня 3 коробки, в каждой по 5 мешков, в каждом мешке по 7 яблок, сколько всего яблок?" : "Solve: if I have 3 boxes, each with 5 bags, each bag with 7 apples, how many apples total?"}"
      }
    ],
    "max_tokens": 4096
  }'`}
      />

      <H2>{isRu ? "Формат ответа" : "Response Format"}</H2>
      <P>
        {isRu
          ? "Ответ содержит дополнительное поле thinking с промежуточными рассуждениями модели:"
          : "The response includes an additional thinking field with the model's intermediate reasoning:"}
      </P>
      <CodeBlock
        title="JSON"
        code={`{
  "id": "chatcmpl-xyz789",
  "model": "mira-thinking",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "${isRu ? "Всего 105 яблок.\\n\\n3 коробки * 5 мешков * 7 яблок = 105 яблок." : "There are 105 apples total.\\n\\n3 boxes * 5 bags * 7 apples = 105 apples."}",
        "thinking": "${isRu ? "Мне нужно найти общее количество яблок.\\nЕсть 3 коробки.\\nВ каждой коробке 5 мешков: 3 * 5 = 15 мешков.\\nВ каждом мешке 7 яблок: 15 * 7 = 105 яблок.\\nПроверка: 3 * 5 * 7 = 105. Верно." : "I need to find the total number of apples.\\nThere are 3 boxes.\\nEach box has 5 bags: 3 * 5 = 15 bags.\\nEach bag has 7 apples: 15 * 7 = 105 apples.\\nCheck: 3 * 5 * 7 = 105. Correct."}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 35,
    "completion_tokens": 120,
    "thinking_tokens": 85,
    "total_tokens": 240
  }
}`}
      />

      <Note type="info">
        {isRu
          ? "Обратите внимание на поле thinking_tokens в usage — это количество токенов, использованных на этапе рассуждения. Они тарифицируются как выходные токены."
          : "Note the thinking_tokens field in usage — this is the number of tokens used during the reasoning phase. They are billed as output tokens."}
      </Note>

      <H2>{isRu ? "Сравнение: обычный режим vs мышление" : "Comparison: Regular vs Thinking Mode"}</H2>
      <Table
        headers={[
          isRu ? "Параметр" : "Aspect",
          isRu ? "mira (обычный)" : "mira (regular)",
          "mira-thinking",
        ]}
        rows={[
          [
            isRu ? "Скорость" : "Speed",
            isRu ? "Быстрый ответ" : "Fast response",
            isRu ? "Медленнее (этап рассуждения)" : "Slower (reasoning phase)",
          ],
          [
            isRu ? "Точность (сложные задачи)" : "Accuracy (complex tasks)",
            isRu ? "Хорошая" : "Good",
            isRu ? "Значительно выше" : "Significantly higher",
          ],
          [
            isRu ? "Потребление токенов" : "Token usage",
            isRu ? "Стандартное" : "Standard",
            isRu ? "Выше (+ thinking_tokens)" : "Higher (+ thinking_tokens)",
          ],
          [
            isRu ? "Прозрачность" : "Transparency",
            isRu ? "Только итоговый ответ" : "Final answer only",
            isRu ? "Видны шаги рассуждения" : "Reasoning steps visible",
          ],
        ]}
      />

      <H2>{isRu ? "Рекомендуемые сценарии" : "Recommended Use Cases"}</H2>
      <UL
        items={[
          {
            bold: isRu ? "Математика и логика" : "Math and logic",
            text: isRu
              ? "Сложные вычисления, задачи на логику, головоломки, доказательства."
              : "Complex calculations, logic puzzles, brain teasers, proofs.",
          },
          {
            bold: isRu ? "Анализ кода" : "Code analysis",
            text: isRu
              ? "Отладка, поиск ошибок, оптимизация алгоритмов, ревью кода."
              : "Debugging, error detection, algorithm optimization, code review.",
          },
          {
            bold: isRu ? "Многошаговый анализ" : "Multi-step analysis",
            text: isRu
              ? "Анализ данных, сравнение вариантов, принятие решений на основе множества факторов."
              : "Data analysis, comparing options, decision-making based on multiple factors.",
          },
          {
            bold: isRu ? "Научные задачи" : "Scientific tasks",
            text: isRu
              ? "Химические реакции, физические задачи, биологический анализ."
              : "Chemical reactions, physics problems, biological analysis.",
          },
        ]}
      />

      <H2>{isRu ? "Лучшие практики" : "Best Practices"}</H2>
      <Note type="tip">
        {isRu
          ? "Используйте mira-thinking только для задач, где точность критична. Для простых вопросов (перевод, генерация текста, чат) обычная модель mira будет быстрее и дешевле."
          : "Use mira-thinking only for tasks where accuracy is critical. For simple questions (translation, text generation, chat), the regular mira model will be faster and cheaper."}
      </Note>
      <UL
        items={[
          {
            bold: isRu ? "Формулируйте задачу чётко" : "State the problem clearly",
            text: isRu
              ? "Чем яснее сформулирован вопрос, тем эффективнее модель выстраивает рассуждение."
              : "The clearer the question, the more effectively the model structures its reasoning.",
          },
          {
            bold: isRu ? "Увеличьте max_tokens" : "Increase max_tokens",
            text: isRu
              ? "Рассуждение потребляет дополнительные токены. Установите max_tokens не менее 4096 для сложных задач."
              : "Reasoning consumes extra tokens. Set max_tokens to at least 4096 for complex tasks.",
          },
          {
            bold: isRu ? "Используйте thinking для отладки" : "Use thinking for debugging",
            text: isRu
              ? "Если ответ неверный, изучите поле thinking, чтобы понять, где модель ошиблась в рассуждениях."
              : "If the answer is wrong, inspect the thinking field to understand where the model went wrong in its reasoning.",
          },
        ]}
      />

      <H2>{isRu ? "Следующие шаги" : "Next Steps"}</H2>
      <NavCards
        cards={[
          {
            href: "/docs/build/json-mode",
            title: isRu ? "Режим JSON" : "JSON Mode",
            desc: isRu ? "Структурированный вывод в формате JSON" : "Structured JSON output",
          },
          {
            href: "/docs/build/tool-use",
            title: isRu ? "Использование инструментов" : "Tool Use",
            desc: isRu ? "Вызов функций из моделей Mira" : "Call functions from Mira models",
          },
        ]}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. JsonModePage — Structured JSON output
   ═══════════════════════════════════════════════════════════════ */

function JsonModePage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Режим JSON" : "JSON Mode"}</H1>
      <Note type="warning">
        {isRu
          ? "Параметр response_format находится в разработке. Для получения JSON-ответов используйте инструкцию в системном промпте: \"Respond only in valid JSON format.\""
          : "The response_format parameter is under development. To get JSON responses, include instructions in the system prompt: \"Respond only in valid JSON format.\""}
      </Note>
      <P>
        {isRu
          ? "Режим JSON гарантирует, что модель вернёт ответ в виде валидного JSON-объекта. Это идеально для интеграции с приложениями, парсинга данных и автоматизации."
          : "JSON mode guarantees that the model will return a response as a valid JSON object. This is ideal for application integration, data parsing, and automation."}
      </P>

      <H2>{isRu ? "Включение режима JSON" : "Enabling JSON Mode"}</H2>
      <P>
        {isRu
          ? "Добавьте параметр response_format в запрос:"
          : "Add the response_format parameter to your request:"}
      </P>
      <CodeBlock
        title="cURL"
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer sk-mira-YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira",
    "response_format": { "type": "json_object" },
    "messages": [
      {
        "role": "system",
        "content": "${isRu ? "Ты помощник, который всегда отвечает в формате JSON." : "You are a helpful assistant that always responds in JSON format."}"
      },
      {
        "role": "user",
        "content": "${isRu ? "Назови 3 столицы европейских стран с населением" : "Name 3 European capital cities with their population"}"
      }
    ]
  }'`}
      />

      <Note type="warning">
        {isRu
          ? "При использовании JSON mode обязательно укажите в системном сообщении, что модель должна отвечать в JSON. Иначе модель может вернуть бесконечный поток токенов."
          : "When using JSON mode, you must instruct the model in the system message to respond in JSON. Otherwise, the model may produce an endless stream of tokens."}
      </Note>

      <H2>{isRu ? "Пример ответа" : "Example Response"}</H2>
      <CodeBlock
        title="JSON"
        code={`{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "{\\"capitals\\": [{\\"city\\": \\"${isRu ? "Париж" : "Paris"}\\", \\"country\\": \\"${isRu ? "Франция" : "France"}\\", \\"population\\": 2161000}, {\\"city\\": \\"${isRu ? "Берлин" : "Berlin"}\\", \\"country\\": \\"${isRu ? "Германия" : "Germany"}\\", \\"population\\": 3645000}, {\\"city\\": \\"${isRu ? "Мадрид" : "Madrid"}\\", \\"country\\": \\"${isRu ? "Испания" : "Spain"}\\", \\"population\\": 3223000}]}"
      },
      "finish_reason": "stop"
    }
  ]
}`}
      />

      <H2>{isRu ? "JSON Schema (структурированный вывод)" : "JSON Schema (Structured Output)"}</H2>
      <P>
        {isRu
          ? "Для точного контроля структуры ответа используйте JSON Schema в параметре response_format. Модель гарантированно вернёт объект, соответствующий указанной схеме."
          : "For precise control over response structure, use JSON Schema in the response_format parameter. The model is guaranteed to return an object matching the specified schema."}
      </P>
      <CodeBlock
        title="Python"
        code={`import requests

response = requests.post(
    "https://api.vmira.ai/v1/chat/completions",
    headers={"Authorization": "Bearer sk-mira-YOUR_KEY"},
    json={
        "model": "mira",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "city_info",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string"},
                        "country": {"type": "string"},
                        "population": {"type": "integer"},
                        "landmarks": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": ["city", "country", "population", "landmarks"],
                    "additionalProperties": False
                }
            }
        },
        "messages": [
            {"role": "system", "content": "${isRu ? "Верни информацию о городе в указанном формате JSON." : "Return city information in the specified JSON format."}"},
            {"role": "user", "content": "${isRu ? "Расскажи о Токио" : "Tell me about Tokyo"}"}
        ]
    }
)

import json
data = json.loads(response.json()["choices"][0]["message"]["content"])
print(data)
# {"city": "Tokyo", "country": "Japan", "population": 13960000, "landmarks": ["Tokyo Tower", "Senso-ji", "Shibuya Crossing"]}`}
      />

      <H2>{isRu ? "Распространённые паттерны" : "Common Patterns"}</H2>

      <H3>{isRu ? "Извлечение данных" : "Data Extraction"}</H3>
      <P>
        {isRu
          ? "Извлекайте структурированные данные из неструктурированного текста:"
          : "Extract structured data from unstructured text:"}
      </P>
      <CodeBlock
        title={isRu ? "Промпт" : "Prompt"}
        code={`${isRu ? "Извлеки информацию о товаре из этого текста и верни JSON с полями name, price, category:" : "Extract product info from this text and return JSON with fields name, price, category:"}

"${isRu ? "Продаётся iPhone 15 Pro, 128 ГБ, цена 89990 руб. Категория: электроника." : "For sale: iPhone 15 Pro, 128GB, price $999. Category: electronics."}"
`}
      />
      <CodeBlock
        title={isRu ? "Ответ" : "Response"}
        code={`{
  "name": "iPhone 15 Pro 128GB",
  "price": ${isRu ? "89990" : "999"},
  "category": "${isRu ? "электроника" : "electronics"}"
}`}
      />

      <H3>{isRu ? "Классификация" : "Classification"}</H3>
      <P>
        {isRu
          ? "Классифицируйте текст с уверенностью модели:"
          : "Classify text with model confidence:"}
      </P>
      <CodeBlock
        title="JSON Schema"
        code={`{
  "type": "object",
  "properties": {
    "sentiment": { "type": "string", "enum": ["positive", "negative", "neutral"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "topics": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["sentiment", "confidence", "topics"]
}`}
      />

      <H3>{isRu ? "Генерация структурированных данных" : "Structured Data Generation"}</H3>
      <P>
        {isRu
          ? "Генерируйте тестовые данные, конфигурации или API-ответы в заданном формате."
          : "Generate test data, configurations, or API responses in a given format."}
      </P>

      <H2>{isRu ? "Лучшие практики" : "Best Practices"}</H2>
      <UL
        items={[
          {
            bold: isRu ? "Системное сообщение" : "System message",
            text: isRu
              ? "Всегда указывайте в system-промпте, что ответ должен быть в JSON. Опишите ожидаемую структуру."
              : "Always state in the system prompt that the response should be JSON. Describe the expected structure.",
          },
          {
            bold: isRu ? "Используйте strict: true" : "Use strict: true",
            text: isRu
              ? "При использовании json_schema задайте strict: true, чтобы гарантировать точное соответствие схеме."
              : "When using json_schema, set strict: true to guarantee exact schema compliance.",
          },
          {
            bold: isRu ? "Обрабатывайте ошибки парсинга" : "Handle parse errors",
            text: isRu
              ? "Даже в JSON mode оборачивайте JSON.parse() в try/catch на случай неожиданных ситуаций."
              : "Even in JSON mode, wrap JSON.parse() in try/catch for unexpected situations.",
          },
          {
            bold: isRu ? "Примеры в промпте" : "Examples in prompt",
            text: isRu
              ? "Для сложных схем добавьте пример ожидаемого JSON в промпт — это повышает точность."
              : "For complex schemas, include an example of the expected JSON in the prompt to improve accuracy.",
          },
        ]}
      />

      <H2>{isRu ? "Следующие шаги" : "Next Steps"}</H2>
      <NavCards
        cards={[
          {
            href: "/docs/build/tool-use",
            title: isRu ? "Использование инструментов" : "Tool Use",
            desc: isRu ? "Вызов внешних функций из модели" : "Call external functions from the model",
          },
          {
            href: "/docs/build/embeddings",
            title: isRu ? "Эмбеддинги" : "Embeddings",
            desc: isRu ? "Векторные представления текста для поиска и кластеризации" : "Text vector representations for search and clustering",
          },
        ]}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. EmbeddingsPage — Text embeddings API
   ═══════════════════════════════════════════════════════════════ */

function EmbeddingsPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Эмбеддинги (Embeddings)" : "Embeddings"}</H1>
      <Note type="warning">
        {isRu
          ? "Эндпоинт /v1/embeddings находится в разработке и будет доступен в ближайших обновлениях платформы."
          : "The /v1/embeddings endpoint is under development and will be available in upcoming platform updates."}
      </Note>
      <P>
        {isRu
          ? "Эмбеддинги — это числовые векторные представления текста, которые отражают его семантическое значение. Тексты с похожим смыслом будут иметь близкие векторы, что позволяет реализовать семантический поиск, кластеризацию и классификацию."
          : "Embeddings are numerical vector representations of text that capture its semantic meaning. Texts with similar meaning will have close vectors, enabling semantic search, clustering, and classification."}
      </P>

      <H2>{isRu ? "Сценарии использования" : "Use Cases"}</H2>
      <UL
        items={[
          {
            bold: isRu ? "Семантический поиск" : "Semantic search",
            text: isRu
              ? "Найти документы, похожие по смыслу на запрос, даже если они не содержат тех же ключевых слов."
              : "Find documents similar in meaning to a query, even if they don't contain the same keywords.",
          },
          {
            bold: isRu ? "Кластеризация" : "Clustering",
            text: isRu
              ? "Автоматически группировать тексты по темам без ручной разметки."
              : "Automatically group texts by topic without manual labeling.",
          },
          {
            bold: isRu ? "Классификация" : "Classification",
            text: isRu
              ? "Определить категорию текста путём сравнения с эталонными эмбеддингами."
              : "Determine text category by comparing against reference embeddings.",
          },
          {
            bold: isRu ? "Обнаружение дубликатов" : "Duplicate detection",
            text: isRu
              ? "Выявить семантически схожие тексты для дедупликации."
              : "Identify semantically similar texts for deduplication.",
          },
          {
            bold: isRu ? "Рекомендации" : "Recommendations",
            text: isRu
              ? "Рекомендовать контент на основе схожести с предпочтениями пользователя."
              : "Recommend content based on similarity to user preferences.",
          },
        ]}
      />

      <H2>{isRu ? "Эндпоинт API" : "API Endpoint"}</H2>
      <P>
        {isRu
          ? "Отправьте POST-запрос на /v1/embeddings:"
          : "Send a POST request to /v1/embeddings:"}
      </P>
      <ParamTable
        params={[
          {
            name: "model",
            type: "string",
            required: true,
            desc: isRu ? "Модель эмбеддингов, например mira-embed" : "Embedding model, e.g. mira-embed",
          },
          {
            name: "input",
            type: "string | string[]",
            required: true,
            desc: isRu ? "Текст или массив текстов для эмбеддинга" : "Text or array of texts to embed",
          },
          {
            name: "dimensions",
            type: "integer",
            required: false,
            desc: isRu ? "Размерность вектора (по умолчанию 1536)" : "Vector dimensions (default 1536)",
          },
          {
            name: "encoding_format",
            type: "string",
            required: false,
            desc: isRu ? "\"float\" (по умолчанию) или \"base64\"" : "\"float\" (default) or \"base64\"",
          },
        ]}
      />

      <H2>{isRu ? "Пример на Python" : "Python Example"}</H2>
      <CodeBlock
        title="Python"
        code={`import requests

response = requests.post(
    "https://api.vmira.ai/v1/embeddings",
    headers={"Authorization": "Bearer sk-mira-YOUR_KEY"},
    json={
        "model": "mira-embed",
        "input": "${isRu ? "Искусственный интеллект меняет мир" : "Artificial intelligence is changing the world"}"
    }
)

data = response.json()
embedding = data["data"][0]["embedding"]
print(f"Dimensions: {len(embedding)}")  # 1536
print(f"First 5 values: {embedding[:5]}")`}
      />

      <H2>{isRu ? "Пример на JavaScript" : "JavaScript Example"}</H2>
      <CodeBlock
        title="JavaScript"
        code={`const response = await fetch("https://api.vmira.ai/v1/embeddings", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-mira-YOUR_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira-embed",
    input: "${isRu ? "Искусственный интеллект меняет мир" : "Artificial intelligence is changing the world"}",
  }),
});

const data = await response.json();
const embedding = data.data[0].embedding;
console.log("Dimensions:", embedding.length);  // 1536
console.log("First 5:", embedding.slice(0, 5));`}
      />

      <H2>{isRu ? "Пакетные эмбеддинги" : "Batch Embeddings"}</H2>
      <P>
        {isRu
          ? "Отправьте массив текстов для одновременного получения нескольких эмбеддингов:"
          : "Send an array of texts to get multiple embeddings at once:"}
      </P>
      <CodeBlock
        title="Python"
        code={`response = requests.post(
    "https://api.vmira.ai/v1/embeddings",
    headers={"Authorization": "Bearer sk-mira-YOUR_KEY"},
    json={
        "model": "mira-embed",
        "input": [
            "${isRu ? "Машинное обучение" : "Machine learning"}",
            "${isRu ? "Глубокие нейронные сети" : "Deep neural networks"}",
            "${isRu ? "Рецепт борща" : "Chocolate cake recipe"}"
        ]
    }
)

embeddings = [item["embedding"] for item in response.json()["data"]]
print(f"Got {len(embeddings)} embeddings")`}
      />

      <H2>{isRu ? "Формат ответа" : "Response Format"}</H2>
      <CodeBlock
        title="JSON"
        code={`{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0023, -0.0091, 0.0152, ...]
    }
  ],
  "model": "mira-embed",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}`}
      />

      <H2>{isRu ? "Метрики схожести" : "Similarity Metrics"}</H2>
      <P>
        {isRu
          ? "Для сравнения эмбеддингов используйте одну из следующих метрик:"
          : "To compare embeddings, use one of the following metrics:"}
      </P>
      <Table
        headers={[
          isRu ? "Метрика" : "Metric",
          isRu ? "Диапазон" : "Range",
          isRu ? "Описание" : "Description",
        ]}
        rows={[
          [
            isRu ? "Косинусное сходство" : "Cosine similarity",
            "-1 ... 1",
            isRu ? "Наиболее распространённая. 1 = идентичные, 0 = ортогональные" : "Most common. 1 = identical, 0 = orthogonal",
          ],
          [
            isRu ? "Скалярное произведение" : "Dot product",
            "-inf ... inf",
            isRu ? "Быстрое вычисление, учитывает длину вектора" : "Fast computation, considers vector magnitude",
          ],
          [
            isRu ? "Евклидово расстояние" : "Euclidean distance",
            "0 ... inf",
            isRu ? "Меньше = ближе. Чувствительна к масштабу" : "Lower = closer. Sensitive to scale",
          ],
        ]}
      />

      <H3>{isRu ? "Пример вычисления косинусного сходства" : "Cosine Similarity Example"}</H3>
      <CodeBlock
        title="Python"
        code={`import numpy as np

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# Compare two embeddings
similarity = cosine_similarity(embeddings[0], embeddings[1])
print(f"Similarity: {similarity:.4f}")  # ~0.89 (${isRu ? "похожие темы" : "similar topics"})

similarity2 = cosine_similarity(embeddings[0], embeddings[2])
print(f"Similarity: {similarity2:.4f}")  # ~0.31 (${isRu ? "разные темы" : "different topics"})`}
      />

      <Note type="tip">
        {isRu
          ? "Для семантического поиска используйте косинусное сходство — оно нормализует длину вектора и даёт наиболее стабильные результаты."
          : "For semantic search, use cosine similarity — it normalizes vector length and gives the most stable results."}
      </Note>

      <H2>{isRu ? "Лучшие практики" : "Best Practices"}</H2>
      <UL
        items={[
          {
            bold: isRu ? "Пакетная обработка" : "Batch processing",
            text: isRu
              ? "Отправляйте до 100 текстов в одном запросе для максимальной эффективности."
              : "Send up to 100 texts per request for maximum efficiency.",
          },
          {
            bold: isRu ? "Кэширование" : "Caching",
            text: isRu
              ? "Сохраняйте эмбеддинги в базе данных (например, pgvector, Pinecone), чтобы не пересчитывать их."
              : "Store embeddings in a database (e.g., pgvector, Pinecone) to avoid recomputing them.",
          },
          {
            bold: isRu ? "Предобработка текста" : "Text preprocessing",
            text: isRu
              ? "Удаляйте лишние пробелы, HTML-теги и шум перед вычислением эмбеддингов."
              : "Remove extra whitespace, HTML tags, and noise before computing embeddings.",
          },
          {
            bold: isRu ? "Размерность" : "Dimensions",
            text: isRu
              ? "Используйте 1536 по умолчанию. Меньшие значения (256, 512) экономят память, но снижают точность."
              : "Use the default 1536. Smaller values (256, 512) save memory but reduce accuracy.",
          },
        ]}
      />

      <H2>{isRu ? "Следующие шаги" : "Next Steps"}</H2>
      <NavCards
        cards={[
          {
            href: "/docs/build/batch-processing",
            title: isRu ? "Пакетная обработка" : "Batch Processing",
            desc: isRu ? "Массовая обработка запросов" : "Bulk request processing at scale",
          },
          {
            href: "/docs/build/json-mode",
            title: isRu ? "Режим JSON" : "JSON Mode",
            desc: isRu ? "Структурированный вывод данных" : "Structured data output",
          },
        ]}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. BatchProcessingPage — Batch / bulk request processing
   ═══════════════════════════════════════════════════════════════ */

function BatchProcessingPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Пакетная обработка (Batch API)" : "Batch Processing (Batch API)"}</H1>
      <Note type="warning">
        {isRu
          ? "Batch API находится в разработке и будет доступен в ближайших обновлениях платформы."
          : "The Batch API is under development and will be available in upcoming platform updates."}
      </Note>
      <P>
        {isRu
          ? "Batch API позволяет отправить большое количество запросов за один раз и получить результаты асинхронно. Это идеально для массовой обработки данных, когда мгновенный ответ не требуется."
          : "The Batch API lets you submit a large number of requests at once and retrieve results asynchronously. This is ideal for bulk data processing when immediate responses are not required."}
      </P>

      <H2>{isRu ? "Когда использовать Batch API" : "When to Use Batch API"}</H2>
      <UL
        items={[
          {
            bold: isRu ? "Массовая обработка" : "Bulk processing",
            text: isRu
              ? "Обработка тысяч текстов, изображений или запросов на классификацию."
              : "Processing thousands of texts, images, or classification requests.",
          },
          {
            bold: isRu ? "Экономия средств" : "Cost savings",
            text: isRu
              ? "Пакетные запросы стоят на 50% дешевле стандартных запросов API."
              : "Batch requests cost 50% less than standard API requests.",
          },
          {
            bold: isRu ? "Высокие rate-лимиты" : "Higher rate limits",
            text: isRu
              ? "Batch API имеет отдельный, значительно более высокий лимит запросов."
              : "The Batch API has a separate, significantly higher request limit.",
          },
          {
            bold: isRu ? "Асинхронные задачи" : "Async tasks",
            text: isRu
              ? "Когда результат можно подождать — генерация отчётов, ETL-пайплайны, обработка данных."
              : "When results can wait — report generation, ETL pipelines, data processing.",
          },
        ]}
      />

      <Note type="info">
        {isRu
          ? "Пакетные задачи обычно завершаются в течение 24 часов. Большинство выполняется значительно быстрее."
          : "Batch jobs typically complete within 24 hours. Most finish significantly faster."}
      </Note>

      <H2>{isRu ? "Как это работает" : "How It Works"}</H2>
      <P>
        {isRu
          ? "Процесс состоит из четырёх шагов:"
          : "The process consists of four steps:"}
      </P>
      <UL
        items={[
          {
            bold: isRu ? "1. Подготовка файла" : "1. Prepare the file",
            text: isRu
              ? "Создайте JSONL-файл, где каждая строка — отдельный запрос."
              : "Create a JSONL file where each line is a separate request.",
          },
          {
            bold: isRu ? "2. Загрузка файла" : "2. Upload the file",
            text: isRu
              ? "Загрузите файл через Files API и получите file_id."
              : "Upload the file via the Files API and get a file_id.",
          },
          {
            bold: isRu ? "3. Создание батча" : "3. Create the batch",
            text: isRu
              ? "Отправьте запрос на создание батча с указанием file_id."
              : "Submit a batch creation request with the file_id.",
          },
          {
            bold: isRu ? "4. Получение результатов" : "4. Retrieve results",
            text: isRu
              ? "Поллите статус батча и скачайте результаты по готовности."
              : "Poll the batch status and download results when ready.",
          },
        ]}
      />

      <H2>{isRu ? "Формат входного файла (JSONL)" : "Input File Format (JSONL)"}</H2>
      <P>
        {isRu
          ? "Каждая строка файла — JSON-объект с полями custom_id, method, url и body:"
          : "Each line in the file is a JSON object with custom_id, method, url, and body fields:"}
      </P>
      <CodeBlock
        title="requests.jsonl"
        code={`{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "mira", "messages": [{"role": "user", "content": "${isRu ? "Переведи на английский: Привет" : "Translate to French: Hello"}"}], "max_tokens": 100}}
{"custom_id": "req-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "mira", "messages": [{"role": "user", "content": "${isRu ? "Переведи на английский: Спасибо" : "Translate to French: Thank you"}"}], "max_tokens": 100}}
{"custom_id": "req-3", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "mira", "messages": [{"role": "user", "content": "${isRu ? "Переведи на английский: До свидания" : "Translate to French: Goodbye"}"}], "max_tokens": 100}}`}
      />

      <Note type="tip">
        {isRu
          ? "custom_id должен быть уникальным для каждого запроса. Он позволяет вам сопоставить результат с исходным запросом."
          : "custom_id must be unique for each request. It lets you match results back to the original request."}
      </Note>

      <H2>{isRu ? "Шаг 1: Загрузка файла" : "Step 1: Upload File"}</H2>
      <CodeBlock
        title="Python"
        code={`import requests

# Upload the JSONL file
with open("requests.jsonl", "rb") as f:
    upload = requests.post(
        "https://api.vmira.ai/v1/files",
        headers={"Authorization": "Bearer sk-mira-YOUR_KEY"},
        files={"file": ("requests.jsonl", f, "application/jsonl")},
        data={"purpose": "batch"}
    )

file_id = upload.json()["id"]
print(f"File uploaded: {file_id}")`}
      />

      <H2>{isRu ? "Шаг 2: Создание батча" : "Step 2: Create Batch"}</H2>
      <CodeBlock
        title="Python"
        code={`batch = requests.post(
    "https://api.vmira.ai/v1/batches",
    headers={
        "Authorization": "Bearer sk-mira-YOUR_KEY",
        "Content-Type": "application/json",
    },
    json={
        "input_file_id": file_id,
        "endpoint": "/v1/chat/completions",
        "completion_window": "24h"
    }
)

batch_id = batch.json()["id"]
print(f"Batch created: {batch_id}")
# batch_abc123`}
      />

      <H2>{isRu ? "Шаг 3: Проверка статуса" : "Step 3: Check Status"}</H2>
      <CodeBlock
        title="Python"
        code={`import time

while True:
    status = requests.get(
        f"https://api.vmira.ai/v1/batches/{batch_id}",
        headers={"Authorization": "Bearer sk-mira-YOUR_KEY"}
    ).json()

    print(f"Status: {status['status']} | "
          f"Completed: {status['request_counts']['completed']}/{status['request_counts']['total']}")

    if status["status"] in ("completed", "failed", "expired"):
        break

    time.sleep(30)  # ${isRu ? "Поллинг каждые 30 сек" : "Poll every 30 seconds"}`}
      />

      <H2>{isRu ? "Статусы батча" : "Batch Statuses"}</H2>
      <Table
        headers={[
          isRu ? "Статус" : "Status",
          isRu ? "Описание" : "Description",
        ]}
        rows={[
          ["validating", isRu ? "Файл проверяется на корректность" : "File is being validated"],
          ["in_progress", isRu ? "Запросы обрабатываются" : "Requests are being processed"],
          ["completed", isRu ? "Все запросы обработаны" : "All requests have been processed"],
          ["failed", isRu ? "Батч завершился с ошибкой" : "Batch failed with an error"],
          ["expired", isRu ? "Батч не завершился вовремя" : "Batch did not complete in time"],
          ["cancelling", isRu ? "Отмена в процессе" : "Cancellation in progress"],
          ["cancelled", isRu ? "Батч отменён" : "Batch was cancelled"],
        ]}
      />

      <H2>{isRu ? "Шаг 4: Получение результатов" : "Step 4: Retrieve Results"}</H2>
      <CodeBlock
        title="Python"
        code={`import json

# Get the output file ID from the completed batch
output_file_id = status["output_file_id"]

# Download the results
results = requests.get(
    f"https://api.vmira.ai/v1/files/{output_file_id}/content",
    headers={"Authorization": "Bearer sk-mira-YOUR_KEY"}
)

# Parse JSONL results
for line in results.text.strip().split("\\n"):
    result = json.loads(line)
    custom_id = result["custom_id"]
    content = result["response"]["body"]["choices"][0]["message"]["content"]
    print(f"{custom_id}: {content}")`}
      />

      <H2>{isRu ? "Пример на JavaScript" : "JavaScript Example"}</H2>
      <CodeBlock
        title="JavaScript"
        code={`const API_KEY = "sk-mira-YOUR_KEY";
const BASE = "https://api.vmira.ai/v1";

// Step 1: Upload
const formData = new FormData();
formData.append("file", new Blob([jsonlContent], { type: "application/jsonl" }), "requests.jsonl");
formData.append("purpose", "batch");

const upload = await fetch(\`\${BASE}/files\`, {
  method: "POST",
  headers: { "Authorization": \`Bearer \${API_KEY}\` },
  body: formData,
});
const { id: fileId } = await upload.json();

// Step 2: Create batch
const batch = await fetch(\`\${BASE}/batches\`, {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    input_file_id: fileId,
    endpoint: "/v1/chat/completions",
    completion_window: "24h",
  }),
});
const { id: batchId } = await batch.json();

// Step 3: Poll status
let status;
do {
  await new Promise(r => setTimeout(r, 30000));
  const res = await fetch(\`\${BASE}/batches/\${batchId}\`, {
    headers: { "Authorization": \`Bearer \${API_KEY}\` },
  });
  status = await res.json();
  console.log(\`Status: \${status.status}\`);
} while (!["completed", "failed", "expired"].includes(status.status));

// Step 4: Download results
const output = await fetch(\`\${BASE}/files/\${status.output_file_id}/content\`, {
  headers: { "Authorization": \`Bearer \${API_KEY}\` },
});
const text = await output.text();
const results = text.trim().split("\\n").map(line => JSON.parse(line));
console.log(results);`}
      />

      <H2>{isRu ? "Обработка ошибок" : "Error Handling"}</H2>
      <P>
        {isRu
          ? "Если некоторые запросы в батче не удались, они будут записаны в error_file_id. Скачайте этот файл для диагностики:"
          : "If some requests in the batch failed, they will be recorded in error_file_id. Download this file for diagnostics:"}
      </P>
      <CodeBlock
        title="Python"
        code={`if status.get("error_file_id"):
    errors = requests.get(
        f"https://api.vmira.ai/v1/files/{status['error_file_id']}/content",
        headers={"Authorization": "Bearer sk-mira-YOUR_KEY"}
    )
    for line in errors.text.strip().split("\\n"):
        err = json.loads(line)
        print(f"{err['custom_id']}: {err['error']['message']}")`}
      />

      <Note type="warning">
        {isRu
          ? "Максимальный размер входного файла — 100 МБ. Максимальное количество запросов в одном батче — 50 000."
          : "Maximum input file size is 100 MB. Maximum number of requests per batch is 50,000."}
      </Note>

      <H2>{isRu ? "Лучшие практики" : "Best Practices"}</H2>
      <UL
        items={[
          {
            bold: isRu ? "Малые батчи для тестирования" : "Small batches for testing",
            text: isRu
              ? "Начните с 5-10 запросов, чтобы убедиться, что формат корректен, прежде чем отправлять тысячи."
              : "Start with 5-10 requests to verify the format is correct before submitting thousands.",
          },
          {
            bold: isRu ? "Уникальные custom_id" : "Unique custom_ids",
            text: isRu
              ? "Используйте осмысленные идентификаторы (например, row-1234), чтобы легко сопоставить результаты."
              : "Use meaningful identifiers (e.g., row-1234) to easily match results.",
          },
          {
            bold: isRu ? "Разумный поллинг" : "Reasonable polling",
            text: isRu
              ? "Не опрашивайте статус чаще одного раза в 30 секунд. Для больших батчей — раз в минуту."
              : "Do not poll status more than once every 30 seconds. For large batches, poll once per minute.",
          },
          {
            bold: isRu ? "Обработка частичных ошибок" : "Handle partial failures",
            text: isRu
              ? "Всегда проверяйте error_file_id после завершения батча и обрабатывайте неудавшиеся запросы."
              : "Always check error_file_id after batch completion and handle failed requests.",
          },
        ]}
      />

      <H2>{isRu ? "Следующие шаги" : "Next Steps"}</H2>
      <NavCards
        cards={[
          {
            href: "/docs/build/embeddings",
            title: isRu ? "Эмбеддинги" : "Embeddings",
            desc: isRu ? "Векторные представления текста" : "Text vector representations",
          },
          {
            href: "/docs/api/overview",
            title: isRu ? "Обзор API" : "API Overview",
            desc: isRu ? "Полная справка по всем эндпоинтам" : "Full reference for all endpoints",
          },
        ]}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Export map
   ═══════════════════════════════════════════════════════════════ */

export const buildAdvancedContent: Record<string, React.FC<{ locale: Locale }>> = {
  "vision": VisionPage,
  "tool-use": ToolUsePage,
  "extended-thinking": ExtendedThinkingPage,
  "json-mode": JsonModePage,
  "embeddings": EmbeddingsPage,
  "batch-processing": BatchProcessingPage,
};
