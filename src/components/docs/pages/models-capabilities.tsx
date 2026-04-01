"use client";
import Link from "next/link";
import { CodeBlock, Note, H1, H2, H3, P, DocLink, NavCards, UL, Table, InlineCode, CostCard } from "../shared";
import type { Locale } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════
   1. ChoosingModelPage — "choosing-a-model"
   ═══════════════════════════════════════════════════════════════ */

function ChoosingModelPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Как выбрать модель Mira" : "Choosing the right Mira model"}</H1>
      <P>
        {isRu
          ? "Mira предлагает семейство из четырёх моделей, каждая из которых оптимизирована для определённых задач. Это руководство поможет вам выбрать подходящую модель на основе ваших требований к производительности, контексту и бюджету."
          : "Mira offers a family of four models, each optimized for specific workloads. This guide helps you pick the right model based on your performance, context, and budget requirements."}
      </P>

      <H2>{isRu ? "Сравнительная таблица моделей" : "Model comparison matrix"}</H2>
      <Table
        headers={[
          isRu ? "Модель" : "Model",
          isRu ? "Контекст" : "Context",
          isRu ? "Макс. вывод" : "Max output",
          isRu ? "Скорость" : "Speed",
          isRu ? "Стоимость" : "Cost",
        ]}
        rows={[
          ["mira", "32K", "4K", isRu ? "Быстрая" : "Fast", "$"],
          ["mira-thinking", "32K", "8K", isRu ? "Средняя" : "Medium", "$$"],
          ["mira-pro", "64K", "8K", isRu ? "Средняя" : "Medium", "$$$"],
          ["mira-max", "128K", "16K", isRu ? "Медленнее" : "Slower", "$$$$"],
        ]}
      />

      <H2>{isRu ? "Когда использовать каждую модель" : "When to use each model"}</H2>

      <H3>mira</H3>
      <P>
        {isRu
          ? "Универсальная модель для повседневных задач. Идеально подходит для чат-ботов, ответов на вопросы, обобщения текста, перевода и генерации коротких фрагментов кода. Самая быстрая и экономичная модель в семействе."
          : "The general-purpose workhorse for everyday tasks. Ideal for chatbots, question answering, text summarization, translation, and short code generation. The fastest and most cost-effective model in the family."}
      </P>
      <UL items={[
        { bold: isRu ? "Лучше всего для" : "Best for", text: isRu ? "простые вопросы, обобщение, перевод, короткий код" : "simple Q&A, summarization, translation, short code snippets" },
        { bold: isRu ? "Контекст" : "Context", text: isRu ? "32K токенов (~50 страниц текста)" : "32K tokens (~50 pages of text)" },
        { bold: isRu ? "Типичная задержка" : "Typical latency", text: isRu ? "< 1 секунды до первого токена" : "< 1 second to first token" },
      ]} />

      <H3>mira-thinking</H3>
      <P>
        {isRu
          ? "Модель с расширенным мышлением, выполняющая цепочку рассуждений перед ответом. Генерирует внутреннюю «цепочку мыслей», что значительно повышает точность при решении сложных задач."
          : "An extended reasoning model that performs chain-of-thought before responding. It generates an internal \"thinking chain\" that dramatically improves accuracy on complex problems."}
      </P>
      <UL items={[
        { bold: isRu ? "Лучше всего для" : "Best for", text: isRu ? "математика, логические задачи, отладка кода, многошаговое планирование" : "math, logic puzzles, code debugging, multi-step planning" },
        { bold: isRu ? "Контекст" : "Context", text: isRu ? "32K токенов, вывод до 8K" : "32K tokens, up to 8K output" },
        { bold: isRu ? "Компромисс" : "Trade-off", text: isRu ? "медленнее, но значительно точнее при сложных рассуждениях" : "slower, but significantly more accurate on complex reasoning" },
      ]} />

      <H3>mira-pro</H3>
      <P>
        {isRu
          ? "Профессиональная модель с расширенным контекстным окном. Предназначена для корпоративных приложений, где требуется обработка больших документов и высокая точность."
          : "A professional-grade model with an expanded context window. Built for enterprise applications that demand large document processing and high accuracy."}
      </P>
      <UL items={[
        { bold: isRu ? "Лучше всего для" : "Best for", text: isRu ? "анализ длинных документов, корпоративные приложения, детальный код-ревью" : "long document analysis, enterprise applications, detailed code review" },
        { bold: isRu ? "Контекст" : "Context", text: isRu ? "64K токенов (~100 страниц текста)" : "64K tokens (~100 pages of text)" },
        { bold: isRu ? "Преимущество" : "Advantage", text: isRu ? "баланс между возможностями и стоимостью для профессионального использования" : "balances capability and cost for professional use" },
      ]} />

      <H3>mira-max</H3>
      <P>
        {isRu
          ? "Самая мощная модель с максимальным контекстным окном 128K токенов. Предназначена для задач, требующих обработки целых кодовых баз, длинных юридических документов или сложного многостороннего анализа."
          : "The most powerful model with a maximum context window of 128K tokens. Designed for tasks requiring processing of entire codebases, lengthy legal documents, or complex multi-faceted analysis."}
      </P>
      <UL items={[
        { bold: isRu ? "Лучше всего для" : "Best for", text: isRu ? "целые кодовые базы, юридические документы, исследовательские работы, сложный анализ" : "entire codebases, legal documents, research papers, complex analysis" },
        { bold: isRu ? "Контекст" : "Context", text: isRu ? "128K токенов (~200 страниц текста)" : "128K tokens (~200 pages of text)" },
        { bold: isRu ? "Вывод" : "Output", text: isRu ? "до 16K токенов — самый длинный вывод среди всех моделей" : "up to 16K tokens — the longest output of any model" },
      ]} />

      <H2>{isRu ? "Схема принятия решения" : "Decision flowchart"}</H2>
      <P>
        {isRu
          ? "Используйте этот текстовый алгоритм, чтобы быстро определить нужную модель:"
          : "Use this text-based flowchart to quickly identify the right model:"}
      </P>
      <CodeBlock
        title={isRu ? "Алгоритм выбора модели" : "Model selection flowchart"}
        code={isRu
          ? `1. Ваш ввод > 64K токенов?
   ├─ Да  → mira-max
   └─ Нет → перейдите к шагу 2

2. Задача требует глубоких рассуждений (математика, логика, отладка)?
   ├─ Да  → mira-thinking
   └─ Нет → перейдите к шагу 3

3. Ваш ввод > 32K токенов ИЛИ нужна максимальная точность?
   ├─ Да  → mira-pro
   └─ Нет → mira (оптимальное соотношение цены и качества)`
          : `1. Is your input > 64K tokens?
   ├─ Yes → mira-max
   └─ No  → go to step 2

2. Does the task require deep reasoning (math, logic, debugging)?
   ├─ Yes → mira-thinking
   └─ No  → go to step 3

3. Is your input > 32K tokens OR do you need maximum accuracy?
   ├─ Yes → mira-pro
   └─ No  → mira (best cost-performance ratio)`}
      />

      <H2>{isRu ? "Матрица задач" : "Task-to-model matrix"}</H2>
      <Table
        headers={[
          isRu ? "Тип задачи" : "Task type",
          isRu ? "Рекомендация" : "Recommendation",
          isRu ? "Почему" : "Why",
        ]}
        rows={[
          [isRu ? "Чат-бот / FAQ" : "Chatbot / FAQ", "mira", isRu ? "Быстро, дёшево, достаточно точно" : "Fast, cheap, accurate enough"],
          [isRu ? "Решение уравнений" : "Math problems", "mira-thinking", isRu ? "Цепочка рассуждений повышает точность" : "Chain-of-thought improves accuracy"],
          [isRu ? "Код-ревью (большой PR)" : "Code review (large PR)", "mira-pro", isRu ? "64K контекст вмещает крупные диффы" : "64K context fits large diffs"],
          [isRu ? "Анализ кодовой базы" : "Codebase analysis", "mira-max", isRu ? "128K контекст для целых проектов" : "128K context for entire projects"],
          [isRu ? "Перевод" : "Translation", "mira", isRu ? "Отличное качество при низкой стоимости" : "Great quality at low cost"],
          [isRu ? "Юридический анализ" : "Legal analysis", "mira-max", isRu ? "Длинный контекст + высокая точность" : "Long context + high accuracy"],
          [isRu ? "Генерация тестов" : "Test generation", "mira-pro", isRu ? "Понимает полный контекст проекта" : "Understands full project context"],
        ]}
      />

      <H2>{isRu ? "Стоимость vs производительность" : "Cost vs performance trade-offs"}</H2>
      <P>
        {isRu
          ? "Стоимость моделей растёт пропорционально их возможностям. Для большинства приложений рекомендуется начинать с mira и переходить на более мощную модель только если качество результатов недостаточно."
          : "Model costs scale with their capabilities. For most applications, we recommend starting with mira and upgrading only when output quality is insufficient."}
      </P>
      <Note type="tip">
        {isRu
          ? "Совет: используйте маршрутизацию моделей — направляйте простые запросы на mira, а сложные на mira-thinking или mira-pro. Это снижает среднюю стоимость на 40-60%."
          : "Tip: use model routing — send simple queries to mira and complex ones to mira-thinking or mira-pro. This reduces average cost by 40-60%."}
      </Note>

      <H2>{isRu ? "Миграция между моделями" : "Migrating between models"}</H2>
      <P>
        {isRu
          ? "Все модели Mira используют одинаковый API-формат. Для перехода между моделями достаточно изменить значение параметра model в запросе. Промпты, инструменты и системные сообщения остаются совместимыми."
          : "All Mira models share the same API format. To switch between models, simply change the model parameter in your request. Prompts, tools, and system messages remain compatible."}
      </P>
      <CodeBlock
        title={isRu ? "Переключение модели" : "Switching models"}
        code={`// Simply change the model parameter
const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-mira-YOUR_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira-pro",  // was "mira" — just change this line
    messages: [{ role: "user", content: "Analyze this document..." }],
  }),
});`}
      />

      <NavCards cards={[
        { href: "/docs/models-capabilities/pricing", title: isRu ? "Цены" : "Pricing", desc: isRu ? "Подробные цены по моделям и тарифам" : "Detailed per-model and per-tier pricing" },
        { href: "/docs/models-capabilities/thinking-mode", title: isRu ? "Режим мышления" : "Thinking mode", desc: isRu ? "Глубокое погружение в mira-thinking" : "Deep dive into mira-thinking" },
        { href: "/docs/models-capabilities/long-context", title: isRu ? "Длинный контекст" : "Long context", desc: isRu ? "Работа с большими документами" : "Working with large documents" },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. WhatsNewPage — "whats-new"
   ═══════════════════════════════════════════════════════════════ */

function WhatsNewPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Что нового" : "What's new"}</H1>
      <P>
        {isRu
          ? "Последние обновления платформы Mira, новые возможности моделей и изменения в API. Следите за нашими релизами, чтобы использовать все новейшие функции."
          : "Latest Mira platform updates, new model capabilities, and API changes. Follow our releases to take advantage of all the newest features."}
      </P>

      {/* ── April 2026 ────────────────────────────────── */}
      <H2>{isRu ? "Апрель 2026" : "April 2026"}</H2>

      <H3>{isRu ? "Запуск mira-max — 1 апреля 2026" : "mira-max launch — April 1, 2026"}</H3>
      <P>
        {isRu
          ? "Мы рады представить mira-max — нашу самую мощную модель с контекстным окном 128K токенов и максимальным выводом 16K токенов. Это крупнейшее обновление в линейке моделей Mira."
          : "We're excited to introduce mira-max — our most powerful model with a 128K token context window and 16K token maximum output. This is the largest upgrade to the Mira model lineup."}
      </P>
      <UL items={[
        { bold: isRu ? "128K контекст" : "128K context", text: isRu ? "обрабатывайте целые кодовые базы, юридические договоры, научные статьи за один запрос" : "process entire codebases, legal contracts, research papers in a single request" },
        { bold: isRu ? "16K вывод" : "16K output", text: isRu ? "генерируйте длинные документы, подробные отчёты и объёмный код без обрезки" : "generate long documents, detailed reports, and substantial code without truncation" },
        { bold: isRu ? "Улучшенные бенчмарки" : "Improved benchmarks", text: isRu ? "на 15% выше по MMLU и на 20% выше по HumanEval по сравнению с mira-pro" : "15% higher on MMLU and 20% higher on HumanEval compared to mira-pro" },
      ]} />

      <H3>{isRu ? "Новый сайт документации — 1 апреля 2026" : "New documentation site — April 1, 2026"}</H3>
      <P>
        {isRu
          ? "Полностью переработанный сайт документации platform.vmira.ai/docs с двуязычной поддержкой (русский и английский), интерактивными примерами кода и улучшенной навигацией."
          : "Completely redesigned documentation site at platform.vmira.ai/docs with bilingual support (Russian and English), interactive code examples, and improved navigation."}
      </P>

      {/* ── March 2026 ────────────────────────────────── */}
      <H2>{isRu ? "Март 2026" : "March 2026"}</H2>

      <H3>{isRu ? "Улучшения mira-thinking — 15 марта 2026" : "mira-thinking improvements — March 15, 2026"}</H3>
      <P>
        {isRu
          ? "Значительные улучшения модели mira-thinking: более точная цепочка рассуждений, уменьшенное количество галлюцинаций и улучшенная производительность при математических задачах."
          : "Major improvements to mira-thinking: more accurate chain-of-thought reasoning, reduced hallucinations, and improved performance on mathematical tasks."}
      </P>
      <UL items={[
        { bold: isRu ? "Математика" : "Math", text: isRu ? "+12% точности на GSM8K и MATH бенчмарках" : "+12% accuracy on GSM8K and MATH benchmarks" },
        { bold: isRu ? "Логика" : "Logic", text: isRu ? "улучшенное многошаговое рассуждение с меньшим количеством ошибок в цепочке" : "improved multi-step reasoning with fewer chain-of-thought errors" },
        { bold: isRu ? "Скорость" : "Speed", text: isRu ? "на 20% быстрее генерация мыслительной цепочки" : "20% faster thinking chain generation" },
      ]} />

      <H3>{isRu ? "Потоковая передача — улучшения — 8 марта 2026" : "Streaming improvements — March 8, 2026"}</H3>
      <P>
        {isRu
          ? "Переработан механизм потоковой передачи (SSE) для всех моделей. Теперь поддерживается потоковая передача результатов вызова инструментов (tool calls) и улучшена задержка первого токена."
          : "Revamped the Server-Sent Events (SSE) streaming mechanism for all models. Now supports streaming tool call results and improved time-to-first-token latency."}
      </P>

      {/* ── February 2026 ────────────────────────────── */}
      <H2>{isRu ? "Февраль 2026" : "February 2026"}</H2>

      <H3>{isRu ? "Использование инструментов (Tool Use) — улучшения — 20 февраля 2026" : "Tool use enhancements — February 20, 2026"}</H3>
      <P>
        {isRu
          ? "Улучшена точность вызова функций для всех моделей. Модели теперь лучше определяют, когда необходимо вызвать инструмент, и генерируют более точные параметры."
          : "Improved function calling accuracy across all models. Models now better identify when to invoke tools and generate more accurate parameters."}
      </P>
      <UL items={[
        { bold: isRu ? "Параллельные вызовы" : "Parallel calls", text: isRu ? "mira-pro и mira-max поддерживают параллельный вызов нескольких инструментов" : "mira-pro and mira-max support parallel invocation of multiple tools" },
        { bold: isRu ? "Точность схем" : "Schema accuracy", text: isRu ? "на 30% меньше ошибок в соответствии со схемами JSON" : "30% fewer JSON schema compliance errors" },
        { bold: isRu ? "Вложенные вызовы" : "Nested calls", text: isRu ? "поддержка цепочек вызовов инструментов с передачей результатов" : "support for chained tool calls with result passing" },
      ]} />

      <H3>{isRu ? "Mira Code CLI v1.0 — 10 февраля 2026" : "Mira Code CLI v1.0 — February 10, 2026"}</H3>
      <P>
        {isRu
          ? "Выпуск первой стабильной версии Mira Code — CLI-инструмента для интерактивного кодирования с ИИ прямо в терминале. Поддерживает автодополнение, генерацию кода, отладку и рефакторинг."
          : "Released the first stable version of Mira Code — a CLI tool for interactive AI-powered coding directly in your terminal. Supports autocompletion, code generation, debugging, and refactoring."}
      </P>
      <CodeBlock
        title={isRu ? "Установка Mira Code" : "Install Mira Code"}
        code="npm install -g mira-code"
      />

      {/* ── January 2026 ─────────────────────────────── */}
      <H2>{isRu ? "Январь 2026" : "January 2026"}</H2>

      <H3>{isRu ? "mira-pro — расширение контекста — 25 января 2026" : "mira-pro context expansion — January 25, 2026"}</H3>
      <P>
        {isRu
          ? "Контекстное окно mira-pro увеличено с 32K до 64K токенов без изменения цен. Это позволяет обрабатывать вдвое больше данных в одном запросе."
          : "Expanded mira-pro's context window from 32K to 64K tokens at no price change. This allows processing twice as much data in a single request."}
      </P>

      <H3>{isRu ? "Мультиязычные улучшения — 12 января 2026" : "Multilingual improvements — January 12, 2026"}</H3>
      <P>
        {isRu
          ? "Все модели получили улучшенную поддержку русского языка, а также арабского, китайского, японского и корейского. Качество перевода улучшено на 25%."
          : "All models received improved support for Russian, as well as Arabic, Chinese, Japanese, and Korean. Translation quality improved by 25%."}
      </P>

      <Note type="info">
        {isRu
          ? "Подпишитесь на нашу рассылку на platform.vmira.ai, чтобы получать уведомления о новых релизах."
          : "Subscribe to our newsletter at platform.vmira.ai to get notified about new releases."}
      </Note>

      <NavCards cards={[
        { href: "/docs/models-capabilities/choosing-a-model", title: isRu ? "Выбор модели" : "Choosing a model", desc: isRu ? "Сравните модели и выберите подходящую" : "Compare models and pick the right one" },
        { href: "/docs/models", title: isRu ? "Обзор моделей" : "Models overview", desc: isRu ? "Технические характеристики всех моделей" : "Technical specifications of all models" },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. PricingPage — "pricing"
   ═══════════════════════════════════════════════════════════════ */

function PricingPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Цены" : "Pricing"}</H1>
      <P>
        {isRu
          ? "Прозрачная ценовая модель с оплатой за токены. Никаких скрытых комиссий — вы платите только за то, что используете. Все тарифы включают доступ ко всем моделям."
          : "Transparent token-based pricing. No hidden fees — you only pay for what you use. All tiers include access to every model."}
      </P>

      <H2>{isRu ? "Стоимость по моделям" : "Per-model pricing"}</H2>
      <P>
        {isRu
          ? "Цены указаны за 1 миллион токенов в рублях. Тарификация потокенная, не за запрос — вы платите только за фактически обработанные и сгенерированные токены."
          : "Prices are per 1 million tokens in rubles (₽). Billing is per-token, not per-request — you only pay for tokens actually processed and generated."}
      </P>
      <Table
        headers={[
          isRu ? "Модель" : "Model",
          isRu ? "Ввод (1M токенов)" : "Input (1M tokens)",
          isRu ? "Вывод (1M токенов)" : "Output (1M tokens)",
          isRu ? "Контекст" : "Context",
        ]}
        rows={[
          ["mira", "100 ₽", "300 ₽", "32K"],
          ["mira-thinking", "150 ₽", "500 ₽", "32K"],
          ["mira-pro", "300 ₽", "900 ₽", "64K"],
          ["mira-max", "1 500 ₽", "6 000 ₽", "128K"],
        ]}
      />
      <Note type="info">
        {isRu
          ? "Токены мышления (thinking tokens) в модели mira-thinking тарифицируются как выходные токены. Они включаются в usage.completion_tokens ответа API."
          : "Thinking tokens in the mira-thinking model are billed as output tokens. They are included in the usage.completion_tokens of the API response."}
      </Note>

      <H2>{isRu ? "Тарифные планы" : "Subscription tiers"}</H2>
      <Table
        headers={[
          isRu ? "Тариф" : "Tier",
          isRu ? "Цена" : "Price",
          isRu ? "Лимит запросов" : "Request limit",
          isRu ? "Включено" : "Includes",
        ]}
        rows={[
          [isRu ? "Бесплатный" : "Free", "0 ₽", isRu ? "20 сообщений/день" : "20 messages/day", isRu ? "Все модели, базовая поддержка" : "All models, basic support"],
          ["Pro", "199 ₽/" + (isRu ? "мес" : "mo"), isRu ? "500 сообщений/день" : "500 messages/day", isRu ? "Все модели, приоритетная очередь, email-поддержка" : "All models, priority queue, email support"],
          ["Max", "990 ₽/" + (isRu ? "мес" : "mo"), isRu ? "Безлимитные сообщения" : "Unlimited messages", isRu ? "Все модели, приоритет, выделенная поддержка" : "All models, priority, dedicated support"],
          ["Enterprise", isRu ? "По запросу" : "Contact sales", isRu ? "Индивидуально" : "Custom", isRu ? "SLA, выделенная инфраструктура, SSO" : "SLA, dedicated infrastructure, SSO"],
        ]}
      />

      <H2>{isRu ? "Примеры расчёта стоимости" : "Cost calculation examples"}</H2>
      <P>
        {isRu
          ? "Вот несколько типичных сценариев с расчётом стоимости:"
          : "Here are some typical scenarios with cost calculations:"}
      </P>

      <CostCard
        model="mira"
        scenario={isRu ? "Чат-бот" : "Chatbot"}
        desc={isRu
          ? "1 000 запросов/день · 500 токенов ввода · 200 токенов вывода"
          : "1,000 requests/day · 500 input tokens · 200 output tokens"}
        volume={[
          { label: isRu ? "Ввод" : "Input", calc: isRu ? "1 000 × 500 × 30" : "1,000 × 500 × 30", result: isRu ? "15M токенов/мес" : "15M tokens/mo" },
          { label: isRu ? "Вывод" : "Output", calc: isRu ? "1 000 × 200 × 30" : "1,000 × 200 × 30", result: isRu ? "6M токенов/мес" : "6M tokens/mo" },
        ]}
        costs={[
          { label: isRu ? "Ввод" : "Input", calc: "15M × 100 ₽/1M", result: "1 500 ₽" },
          { label: isRu ? "Вывод" : "Output", calc: "6M × 300 ₽/1M", result: "1 800 ₽" },
        ]}
        total={isRu ? "3 300 ₽/мес" : "3,300 ₽/mo"}
      />

      <CostCard
        model="mira-pro"
        scenario={isRu ? "Код-ревью" : "Code review"}
        desc={isRu
          ? "50 PR/день · 8 000 токенов ввода · 2 000 токенов вывода"
          : "50 PRs/day · 8,000 input tokens · 2,000 output tokens"}
        volume={[
          { label: isRu ? "Ввод" : "Input", calc: isRu ? "50 × 8 000 × 30" : "50 × 8,000 × 30", result: isRu ? "12M токенов/мес" : "12M tokens/mo" },
          { label: isRu ? "Вывод" : "Output", calc: isRu ? "50 × 2 000 × 30" : "50 × 2,000 × 30", result: isRu ? "3M токенов/мес" : "3M tokens/mo" },
        ]}
        costs={[
          { label: isRu ? "Ввод" : "Input", calc: "12M × 300 ₽/1M", result: "3 600 ₽" },
          { label: isRu ? "Вывод" : "Output", calc: "3M × 900 ₽/1M", result: "2 700 ₽" },
        ]}
        total={isRu ? "6 300 ₽/мес" : "6,300 ₽/mo"}
      />

      <H2>{isRu ? "Сравнение с другими провайдерами" : "Comparison with other providers"}</H2>
      <P>
        {isRu
          ? "Сравнение стоимости моделей аналогичного класса. Все цены указаны за 1M токенов в рублях (курс ~90 ₽/$)."
          : "Cost comparison for models of similar class. All prices per 1M tokens in rubles (~90 ₽/$)."}
      </P>
      <Table
        headers={[
          isRu ? "Провайдер" : "Provider",
          isRu ? "Модель" : "Model",
          isRu ? "Ввод / 1M" : "Input / 1M",
          isRu ? "Вывод / 1M" : "Output / 1M",
        ]}
        rows={[
          ["Mira", "mira", "100 ₽", "300 ₽"],
          ["OpenAI", "GPT-4o mini", "~14 ₽", "~54 ₽"],
          ["Mira", "mira-pro", "300 ₽", "900 ₽"],
          ["OpenAI", "GPT-4o", "~225 ₽", "~900 ₽"],
          ["Mira", "mira-max", "1 500 ₽", "6 000 ₽"],
          ["Anthropic", "Claude Opus", "~1 350 ₽", "~6 750 ₽"],
        ]}
      />
      <Note type="info">
        {isRu
          ? "Mira предлагает нативную оплату в рублях, размещение данных в России (152-ФЗ), а также API, совместимый с OpenAI — миграция в одну строку."
          : "Mira offers native ruble billing, data residency in Russia (152-FZ compliance), and an OpenAI-compatible API — migrate in one line."}
      </Note>

      <H2>{isRu ? "Управление расходами" : "Managing costs"}</H2>
      <UL items={[
        { bold: isRu ? "Мониторинг использования" : "Monitor usage", text: isRu ? "используйте GET /api/v1/auth/me/usage для отслеживания потребления токенов в реальном времени" : "use GET /api/v1/auth/me/usage to track token consumption in real time" },
        { bold: isRu ? "Установите лимиты" : "Set limits", text: isRu ? "настройте бюджетные лимиты на панели управления platform.vmira.ai" : "configure budget limits in the platform.vmira.ai dashboard" },
        { bold: isRu ? "Маршрутизация моделей" : "Model routing", text: isRu ? "направляйте простые запросы на mira, сложные — на mira-pro или mira-max" : "route simple queries to mira, complex ones to mira-pro or mira-max" },
        { bold: isRu ? "Кэширование" : "Caching", text: isRu ? "кэшируйте ответы для повторяющихся запросов, чтобы сократить расходы" : "cache responses for recurring queries to reduce costs" },
      ]} />

      <NavCards cards={[
        { href: "/docs/models-capabilities/choosing-a-model", title: isRu ? "Выбор модели" : "Choosing a model", desc: isRu ? "Руководство по выбору оптимальной модели" : "Guide to choosing the optimal model" },
        { href: "/docs/api/overview", title: isRu ? "Обзор API" : "API overview", desc: isRu ? "Начните интеграцию с API Mira" : "Start integrating with the Mira API" },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. ThinkingModePage — "thinking-mode"
   ═══════════════════════════════════════════════════════════════ */

function ThinkingModePage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Режим мышления (Thinking Mode)" : "Thinking mode"}</H1>
      <P>
        {isRu
          ? "mira-thinking — это специализированная модель, которая выполняет внутреннюю «цепочку рассуждений» перед генерацией финального ответа. Этот подход значительно повышает точность при решении задач, требующих логических рассуждений, математических вычислений и многоступенчатого анализа."
          : "mira-thinking is a specialized model that performs an internal \"chain of thought\" before generating the final response. This approach significantly improves accuracy on tasks requiring logical reasoning, mathematical computation, and multi-step analysis."}
      </P>

      <H2>{isRu ? "Как это работает" : "How it works"}</H2>
      <P>
        {isRu
          ? "Когда вы отправляете запрос к mira-thinking, модель проходит два этапа:"
          : "When you send a request to mira-thinking, the model goes through two stages:"}
      </P>
      <UL items={[
        { bold: isRu ? "Этап мышления" : "Thinking stage", text: isRu ? "модель генерирует внутренний ход рассуждений, разбивая задачу на подзадачи, проверяя промежуточные результаты и исследуя альтернативные подходы" : "the model generates an internal reasoning trace, breaking the problem into sub-tasks, verifying intermediate results, and exploring alternative approaches" },
        { bold: isRu ? "Этап ответа" : "Response stage", text: isRu ? "на основе рассуждений модель формирует финальный, отредактированный ответ с учётом всех найденных решений" : "based on the reasoning, the model produces a final, edited response incorporating all discovered solutions" },
      ]} />
      <P>
        {isRu
          ? "Токены мышления включаются в usage.completion_tokens и тарифицируются как выходные токены. Вы можете видеть ход мышления в ответе API через поле thinking_content."
          : "Thinking tokens are included in usage.completion_tokens and billed as output tokens. You can see the reasoning trace in the API response via the thinking_content field."}
      </P>

      <H2>{isRu ? "Когда использовать режим мышления" : "When to use thinking mode"}</H2>
      <Table
        headers={[
          isRu ? "Тип задачи" : "Task type",
          isRu ? "Польза от мышления" : "Thinking benefit",
          isRu ? "Пример" : "Example",
        ]}
        rows={[
          [isRu ? "Математические доказательства" : "Mathematical proofs", isRu ? "Высокая" : "High", isRu ? "Докажите, что корень из 2 иррационален" : "Prove that sqrt(2) is irrational"],
          [isRu ? "Отладка кода" : "Code debugging", isRu ? "Высокая" : "High", isRu ? "Найдите состояние гонки в многопоточном коде" : "Find the race condition in multithreaded code"],
          [isRu ? "Логические головоломки" : "Logic puzzles", isRu ? "Высокая" : "High", isRu ? "Решите задачу Эйнштейна" : "Solve Einstein's riddle"],
          [isRu ? "Многошаговое планирование" : "Multi-step planning", isRu ? "Высокая" : "High", isRu ? "Спроектируйте архитектуру микросервисов" : "Design a microservices architecture"],
          [isRu ? "Анализ данных" : "Data analysis", isRu ? "Средняя" : "Medium", isRu ? "Выявите тренды в наборе данных" : "Identify trends in a dataset"],
          [isRu ? "Простой чат" : "Simple chat", isRu ? "Низкая" : "Low", isRu ? "Используйте mira вместо этого" : "Use mira instead"],
          [isRu ? "Перевод" : "Translation", isRu ? "Низкая" : "Low", isRu ? "Используйте mira вместо этого" : "Use mira instead"],
        ]}
      />

      <H2>{isRu ? "Использование через API" : "Using via API"}</H2>
      <P>
        {isRu
          ? "Для активации режима мышления просто укажите модель mira-thinking. Никаких дополнительных параметров не требуется."
          : "To activate thinking mode, simply specify the mira-thinking model. No additional parameters are required."}
      </P>
      <CodeBlock
        title={isRu ? "Запрос с мышлением" : "Request with thinking"}
        code={`const response = await fetch("https://api.vmira.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-mira-YOUR_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "mira-thinking",
    messages: [{
      role: "user",
      content: "${isRu ? "Докажите, что сумма углов треугольника равна 180 градусов" : "Prove that the sum of angles in a triangle is 180 degrees"}"
    }],
  }),
});`}
      />

      <H2>{isRu ? "Чтение результатов мышления" : "Reading thinking output"}</H2>
      <P>
        {isRu
          ? "Ответ API содержит как финальный ответ (content), так и цепочку рассуждений (thinking_content):"
          : "The API response contains both the final answer (content) and the reasoning chain (thinking_content):"}
      </P>
      <CodeBlock
        title={isRu ? "Структура ответа" : "Response structure"}
        code={`{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "${isRu ? "Сумма углов треугольника равна 180°. Вот формальное доказательство..." : "The sum of angles in a triangle is 180°. Here is a formal proof..."}",
      "thinking_content": "${isRu ? "Мне нужно доказать это строго. Рассмотрю подход через параллельные прямые..." : "I need to prove this rigorously. Let me consider the parallel lines approach..."}"
    }
  }],
  "usage": {
    "prompt_tokens": 28,
    "completion_tokens": 1450,
    "total_tokens": 1478
  }
}`}
      />

      <H2>{isRu ? "Сравнение: с мышлением и без" : "Comparison: with and without thinking"}</H2>

      <H3>{isRu ? "Без мышления (mira)" : "Without thinking (mira)"}</H3>
      <CodeBlock
        title={isRu ? "Запрос" : "Prompt"}
        code={isRu
          ? `Пользователь: Сколько будет 17 × 23 + 156 ÷ 12 - 89?

Ответ mira: 17 × 23 = 391, 156 ÷ 12 = 13, 391 + 13 - 89 = 315`
          : `User: What is 17 × 23 + 156 ÷ 12 - 89?

mira response: 17 × 23 = 391, 156 ÷ 12 = 13, 391 + 13 - 89 = 315`}
      />

      <H3>{isRu ? "С мышлением (mira-thinking)" : "With thinking (mira-thinking)"}</H3>
      <CodeBlock
        title={isRu ? "Ход мышления + ответ" : "Thinking trace + response"}
        code={isRu
          ? `[Мышление]
Разобью выражение на части согласно порядку операций (PEMDAS):
1. Умножение: 17 × 23 = 391
2. Деление: 156 ÷ 12 = 13
3. Сложение: 391 + 13 = 404
4. Вычитание: 404 - 89 = 315
Проверю: 17×23 = 17×20 + 17×3 = 340 + 51 = 391 ✓
156÷12 = 13 ✓ (так как 12×13 = 156)
391 + 13 = 404, 404 - 89 = 315 ✓

[Финальный ответ]
17 × 23 + 156 ÷ 12 - 89 = 315

Порядок вычислений:
• 17 × 23 = 391
• 156 ÷ 12 = 13
• 391 + 13 - 89 = 315`
          : `[Thinking]
Let me break this expression into parts following order of operations (PEMDAS):
1. Multiplication: 17 × 23 = 391
2. Division: 156 ÷ 12 = 13
3. Addition: 391 + 13 = 404
4. Subtraction: 404 - 89 = 315
Let me verify: 17×23 = 17×20 + 17×3 = 340 + 51 = 391 ✓
156÷12 = 13 ✓ (since 12×13 = 156)
391 + 13 = 404, 404 - 89 = 315 ✓

[Final answer]
17 × 23 + 156 ÷ 12 - 89 = 315

Computation steps:
• 17 × 23 = 391
• 156 ÷ 12 = 13
• 391 + 13 - 89 = 315`}
      />

      <H2>{isRu ? "Стоимость токенов мышления" : "Thinking token costs"}</H2>
      <P>
        {isRu
          ? "Токены мышления тарифицируются по ставке выходных токенов (500 ₽ / 1M). Типичный запрос с мышлением использует от 200 до 2 000 дополнительных токенов для цепочки рассуждений. Для простых задач стоимость мышления может превысить стоимость самого ответа, поэтому используйте mira-thinking только когда точность критически важна."
          : "Thinking tokens are billed at the output token rate (500 ₽ / 1M). A typical thinking request uses between 200 and 2,000 additional tokens for the reasoning chain. For simple tasks, the thinking cost can exceed the response cost, so use mira-thinking only when accuracy is critical."}
      </P>
      <Note type="warning">
        {isRu
          ? "Не используйте mira-thinking для простых задач (перевод, обобщение, чат). Это увеличит стоимость и задержку без заметного улучшения качества. Используйте стандартную модель mira."
          : "Don't use mira-thinking for simple tasks (translation, summarization, chat). This will increase cost and latency without noticeable quality improvement. Use the standard mira model instead."}
      </Note>

      <H2>{isRu ? "Ограничения" : "Limitations"}</H2>
      <UL items={[
        { bold: isRu ? "Задержка" : "Latency", text: isRu ? "время ответа в 2-5 раз больше, чем у стандартной модели mira, из-за дополнительного этапа рассуждений" : "response time is 2-5x longer than the standard mira model due to the additional reasoning stage" },
        { bold: isRu ? "Контекст" : "Context", text: isRu ? "контекстное окно 32K — для больших документов используйте mira-pro или mira-max" : "32K context window — for large documents use mira-pro or mira-max" },
        { bold: isRu ? "Потоковая передача" : "Streaming", text: isRu ? "при потоковой передаче thinking_content отправляется до основного ответа" : "when streaming, thinking_content is sent before the main response" },
        { bold: isRu ? "Не для всех задач" : "Not for every task", text: isRu ? "режим мышления не улучшает задачи, основанные на воспроизведении знаний (факты, перевод)" : "thinking mode doesn't improve knowledge-recall tasks (facts, translation)" },
      ]} />

      <NavCards cards={[
        { href: "/docs/models-capabilities/choosing-a-model", title: isRu ? "Выбор модели" : "Choosing a model", desc: isRu ? "Когда использовать какую модель" : "When to use which model" },
        { href: "/docs/models-capabilities/code-generation", title: isRu ? "Генерация кода" : "Code generation", desc: isRu ? "Отладка кода с помощью мышления" : "Debugging code with thinking" },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. MultilingualPage — "multilingual"
   ═══════════════════════════════════════════════════════════════ */

function MultilingualPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Мультиязычная поддержка" : "Multilingual support"}</H1>
      <P>
        {isRu
          ? "Все модели Mira обучены на многоязычных данных и поддерживают более 50 языков. Особое внимание уделено русскому и английскому языкам, которые поддерживаются на уровне носителя."
          : "All Mira models are trained on multilingual data and support over 50 languages. Special attention is given to Russian and English, which are supported at native-speaker level."}
      </P>

      <H2>{isRu ? "Поддерживаемые языки" : "Supported languages"}</H2>

      <H3>{isRu ? "Приоритетные языки (наивысшее качество)" : "Priority languages (highest quality)"}</H3>
      <Table
        headers={[
          isRu ? "Язык" : "Language",
          isRu ? "Код" : "Code",
          isRu ? "Качество" : "Quality",
          isRu ? "Примечания" : "Notes",
        ]}
        rows={[
          [isRu ? "Русский" : "Russian", "ru", isRu ? "Отличное" : "Excellent", isRu ? "Уровень носителя, все модели" : "Native level, all models"],
          [isRu ? "Английский" : "English", "en", isRu ? "Отличное" : "Excellent", isRu ? "Уровень носителя, все модели" : "Native level, all models"],
        ]}
      />

      <H3>{isRu ? "Хорошо поддерживаемые языки" : "Well-supported languages"}</H3>
      <P>
        {isRu
          ? "Следующие языки поддерживаются на высоком уровне с минимальными потерями качества по сравнению с приоритетными:"
          : "The following languages are supported at a high level with minimal quality loss compared to priority languages:"}
      </P>
      <UL items={[
        { bold: isRu ? "Европейские" : "European", text: isRu ? "немецкий, французский, испанский, итальянский, португальский, нидерландский, польский, украинский, чешский, шведский" : "German, French, Spanish, Italian, Portuguese, Dutch, Polish, Ukrainian, Czech, Swedish" },
        { bold: isRu ? "Азиатские" : "Asian", text: isRu ? "китайский (упрощ./традиц.), японский, корейский, вьетнамский, тайский, индонезийский" : "Chinese (Simplified/Traditional), Japanese, Korean, Vietnamese, Thai, Indonesian" },
        { bold: isRu ? "Ближневосточные" : "Middle Eastern", text: isRu ? "арабский, турецкий, иврит, фарси" : "Arabic, Turkish, Hebrew, Persian" },
        { bold: isRu ? "Индийские" : "Indian", text: isRu ? "хинди, бенгальский, тамильский, телугу" : "Hindi, Bengali, Tamil, Telugu" },
      ]} />

      <H2>{isRu ? "Качество по языкам" : "Performance across languages"}</H2>
      <P>
        {isRu
          ? "Модели Mira оптимизированы для сохранения качества при работе с неанглийскими языками. Вот приблизительная производительность по языкам:"
          : "Mira models are optimized to maintain quality when working with non-English languages. Here is approximate performance by language:"}
      </P>
      <Table
        headers={[
          isRu ? "Группа языков" : "Language group",
          isRu ? "% от англ. качества" : "% of English quality",
          isRu ? "Токенизация" : "Tokenization",
        ]}
        rows={[
          [isRu ? "Русский" : "Russian", "98%", isRu ? "Оптимизированная" : "Optimized"],
          [isRu ? "Европейские (латиница)" : "European (Latin)", "95%", isRu ? "Эффективная" : "Efficient"],
          [isRu ? "Китайский / Японский / Корейский" : "Chinese / Japanese / Korean", "92%", isRu ? "Эффективная" : "Efficient"],
          [isRu ? "Арабский / Иврит" : "Arabic / Hebrew", "88%", isRu ? "Хорошая" : "Good"],
          [isRu ? "Индийские языки" : "Indian languages", "85%", isRu ? "Хорошая" : "Good"],
        ]}
      />
      <Note type="info">
        {isRu
          ? "Русский язык имеет оптимизированную токенизацию, что означает меньший расход токенов на текст одинаковой длины по сравнению с другими кириллическими языками."
          : "Russian has optimized tokenization, meaning fewer tokens are consumed for the same text length compared to other Cyrillic languages."}
      </Note>

      <H2>{isRu ? "Рекомендации для неанглийских промптов" : "Best practices for non-English prompts"}</H2>
      <UL items={[
        { bold: isRu ? "Пишите промпт на целевом языке" : "Write prompts in the target language", text: isRu ? "для лучшего качества ответа на русском задавайте вопрос на русском, а не на английском с просьбой ответить на русском" : "for best Russian output quality, ask in Russian rather than asking in English to respond in Russian" },
        { bold: isRu ? "Будьте конкретны" : "Be specific", text: isRu ? "указывайте желаемый стиль и формальность на целевом языке" : "specify desired style and formality in the target language" },
        { bold: isRu ? "Системные сообщения" : "System messages", text: isRu ? "задавайте системное сообщение на целевом языке для поддержания контекста" : "set the system message in the target language to maintain context" },
        { bold: isRu ? "Избегайте смешения" : "Avoid mixing", text: isRu ? "для максимального качества старайтесь не смешивать языки в одном промпте (кроме терминов)" : "for maximum quality, avoid mixing languages in a single prompt (except for technical terms)" },
      ]} />

      <H2>{isRu ? "Примеры на русском языке" : "Russian language examples"}</H2>
      <CodeBlock
        title={isRu ? "Промпт на русском" : "Russian prompt"}
        code={`curl https://api.vmira.ai/v1/chat/completions \\
  -H "Authorization: Bearer sk-mira-YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mira",
    "messages": [
      {
        "role": "system",
        "content": "Ты — опытный технический писатель. Отвечай на русском языке, используя профессиональный, но доступный стиль."
      },
      {
        "role": "user",
        "content": "Объясни, что такое REST API, простыми словами."
      }
    ]
  }'`}
      />

      <H2>{isRu ? "Перевод" : "Translation"}</H2>
      <P>
        {isRu
          ? "Mira отлично справляется с переводом между любыми поддерживаемыми языками. Для достижения лучших результатов предоставляйте контекст и указывайте целевую аудиторию."
          : "Mira excels at translation between any supported languages. For best results, provide context and specify the target audience."}
      </P>
      <CodeBlock
        title={isRu ? "Пример перевода" : "Translation example"}
        code={`{
  "model": "mira",
  "messages": [
    {
      "role": "system",
      "content": "${isRu
        ? "Ты — профессиональный переводчик. Переводи с русского на английский, сохраняя стиль и тон оригинала."
        : "You are a professional translator. Translate from Russian to English, preserving the style and tone of the original."}"
    },
    {
      "role": "user",
      "content": "${isRu
        ? "Переведи: «Искусственный интеллект открывает новые горизонты в науке и технологиях.»"
        : "Translate: \\\"Artificial intelligence opens new horizons in science and technology.\\\""}"
    }
  ]
}`}
      />

      <H2>{isRu ? "Определение языка" : "Language detection"}</H2>
      <P>
        {isRu
          ? "Mira автоматически определяет язык входящего текста и может переключать языки в рамках одного разговора. Это полезно для приложений, обслуживающих пользователей из разных стран."
          : "Mira automatically detects the language of input text and can switch languages within a single conversation. This is useful for applications serving users from different countries."}
      </P>

      <H2>{isRu ? "Многоязычные диалоги" : "Mixed-language conversations"}</H2>
      <P>
        {isRu
          ? "Mira может вести диалог, в котором пользователь переключается между языками. Модель отвечает на том языке, на котором был задан вопрос, если не указано иное."
          : "Mira can handle conversations where the user switches between languages. The model responds in the same language the question was asked in, unless instructed otherwise."}
      </P>
      <CodeBlock
        title={isRu ? "Переключение языков в диалоге" : "Language switching in conversation"}
        code={`{
  "model": "mira",
  "messages": [
    { "role": "user", "content": "What is machine learning?" },
    { "role": "assistant", "content": "Machine learning is a subset of AI..." },
    { "role": "user", "content": "А теперь объясни это на русском." },
    { "role": "assistant", "content": "Машинное обучение — это подраздел ИИ..." }
  ]
}`}
      />
      <Note type="tip">
        {isRu
          ? "Совет: для создания многоязычных приложений используйте системное сообщение с инструкцией «Отвечай на том языке, на котором задан вопрос». Это обеспечивает автоматическое переключение."
          : "Tip: for multilingual apps, use a system message with the instruction \"Respond in the same language as the question.\" This ensures automatic switching."}
      </Note>

      <NavCards cards={[
        { href: "/docs/models-capabilities/choosing-a-model", title: isRu ? "Выбор модели" : "Choosing a model", desc: isRu ? "Какая модель лучше для вашего языка" : "Which model is best for your language" },
        { href: "/docs/models-capabilities/long-context", title: isRu ? "Длинный контекст" : "Long context", desc: isRu ? "Обработка многоязычных документов" : "Processing multilingual documents" },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. LongContextPage — "long-context"
   ═══════════════════════════════════════════════════════════════ */

function LongContextPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Длинный контекст" : "Long context windows"}</H1>
      <P>
        {isRu
          ? "Модели Mira поддерживают контекстные окна от 32K до 128K токенов, что позволяет обрабатывать большие документы, кодовые базы и многораундовые диалоги в одном запросе."
          : "Mira models support context windows from 32K to 128K tokens, enabling you to process large documents, codebases, and multi-turn conversations in a single request."}
      </P>

      <H2>{isRu ? "Контекстные окна по моделям" : "Context windows by model"}</H2>
      <Table
        headers={[
          isRu ? "Модель" : "Model",
          isRu ? "Контекст" : "Context",
          isRu ? "Макс. вывод" : "Max output",
          isRu ? "Эффективный ввод" : "Effective input",
        ]}
        rows={[
          ["mira", "32K", "4K", "28K"],
          ["mira-thinking", "32K", "8K", "24K"],
          ["mira-pro", "64K", "8K", "56K"],
          ["mira-max", "128K", "16K", "112K"],
        ]}
      />
      <Note type="info">
        {isRu
          ? "Эффективный ввод = контекст - макс. вывод. Это максимальный объём данных, который вы можете отправить, оставив место для полного ответа."
          : "Effective input = context - max output. This is the maximum data volume you can send while leaving room for a full response."}
      </Note>

      <H2>{isRu ? "Что помещается в каждую модель" : "What fits in each model"}</H2>
      <P>
        {isRu
          ? "Примерные объёмы текста, которые вмещает каждая модель (1 токен ~ 4 символа на английском, ~2 символа на русском):"
          : "Approximate text volumes each model can hold (1 token ~ 4 characters in English, ~2 characters in Russian):"}
      </P>
      <Table
        headers={[
          isRu ? "Содержимое" : "Content",
          "mira (32K)",
          "mira-pro (64K)",
          "mira-max (128K)",
        ]}
        rows={[
          [isRu ? "Страницы текста (англ.)" : "Text pages (English)", "~50", "~100", "~200"],
          [isRu ? "Страницы текста (рус.)" : "Text pages (Russian)", "~30", "~60", "~120"],
          [isRu ? "Строки кода" : "Lines of code", "~2,000", "~4,000", "~8,000"],
          [isRu ? "Файлы кода (средн.)" : "Code files (avg)", "~15-20", "~30-40", "~60-80"],
          [isRu ? "Письма email" : "Emails", "~100", "~200", "~400"],
          [isRu ? "Книга (страницы)" : "Book (pages)", isRu ? "~80 стр." : "~80 pages", isRu ? "~160 стр." : "~160 pages", isRu ? "~320 стр." : "~320 pages"],
        ]}
      />

      <H2>{isRu ? "Лучшие практики для длинных документов" : "Best practices for long documents"}</H2>

      <H3>{isRu ? "1. Ставьте инструкции первыми" : "1. Put instructions first"}</H3>
      <P>
        {isRu
          ? "Размещайте системное сообщение и инструкции перед длинным документом. Модель лучше следует инструкциям, которые она видит до основного контента."
          : "Place the system message and instructions before the long document. The model better follows instructions it sees before the main content."}
      </P>
      <CodeBlock
        title={isRu ? "Правильный порядок" : "Correct ordering"}
        code={`{
  "model": "mira-max",
  "messages": [
    {
      "role": "system",
      "content": "${isRu ? "Проанализируй следующий контракт и выдели ключевые риски." : "Analyze the following contract and highlight key risks."}"
    },
    {
      "role": "user",
      "content": "${isRu ? "[Здесь текст контракта на 50 000 токенов...]" : "[50,000-token contract text here...]"}"
    }
  ]
}`}
      />

      <H3>{isRu ? "2. Используйте маркеры секций" : "2. Use section markers"}</H3>
      <P>
        {isRu
          ? "Для документов с несколькими частями используйте XML-теги или маркеры для разделения секций. Это помогает модели ориентироваться в длинном тексте."
          : "For multi-part documents, use XML tags or markers to separate sections. This helps the model navigate long text."}
      </P>
      <CodeBlock
        title={isRu ? "Маркеры секций" : "Section markers"}
        code={`<document>
  <section id="terms">${isRu ? "Условия предоставления услуг..." : "Terms of service..."}</section>
  <section id="privacy">${isRu ? "Политика конфиденциальности..." : "Privacy policy..."}</section>
  <section id="sla">${isRu ? "Соглашение об уровне обслуживания..." : "Service level agreement..."}</section>
</document>

${isRu ? "Вопрос: Что говорится в секции SLA о времени доступности?" : "Question: What does the SLA section say about uptime?"}`}
      />

      <H3>{isRu ? "3. Запрашивайте ссылки на источник" : "3. Ask for source references"}</H3>
      <P>
        {isRu
          ? "При анализе длинных документов просите модель указывать, из какой части документа взята информация. Это помогает верифицировать ответы."
          : "When analyzing long documents, ask the model to indicate which part of the document the information comes from. This helps verify responses."}
      </P>

      <H2>{isRu ? "RAG vs длинный контекст" : "RAG vs long context"}</H2>
      <P>
        {isRu
          ? "Два основных подхода к работе с большими объёмами данных — извлечение с дополнением (RAG) и прямая загрузка в длинный контекст. Каждый имеет свои преимущества:"
          : "Two main approaches to working with large data volumes — Retrieval-Augmented Generation (RAG) and direct loading into long context. Each has its advantages:"}
      </P>
      <Table
        headers={[
          isRu ? "Критерий" : "Criteria",
          "RAG",
          isRu ? "Длинный контекст" : "Long context",
        ]}
        rows={[
          [isRu ? "Объём данных" : "Data volume", isRu ? "Неограничен (ГБ+)" : "Unlimited (GB+)", isRu ? "До 128K токенов" : "Up to 128K tokens"],
          [isRu ? "Точность" : "Accuracy", isRu ? "Зависит от retrieval" : "Depends on retrieval", isRu ? "Видит весь контекст" : "Sees full context"],
          [isRu ? "Стоимость" : "Cost", isRu ? "Ниже за запрос" : "Lower per request", isRu ? "Выше за запрос" : "Higher per request"],
          [isRu ? "Настройка" : "Setup", isRu ? "Требует индекс, embeddings" : "Requires index, embeddings", isRu ? "Нет настройки" : "No setup needed"],
          [isRu ? "Связи между документами" : "Cross-document relations", isRu ? "Слабо" : "Weak", isRu ? "Сильно" : "Strong"],
          [isRu ? "Актуальность" : "Freshness", isRu ? "Требует переиндексации" : "Requires reindexing", isRu ? "Мгновенно" : "Instant"],
        ]}
      />
      <Note type="tip">
        {isRu
          ? "Рекомендация: используйте длинный контекст (mira-max) когда нужно видеть весь документ целиком или анализировать связи между частями. Используйте RAG когда данных больше, чем помещается в контекст, или когда нужно искать по большой базе знаний."
          : "Recommendation: use long context (mira-max) when you need to see the full document or analyze relationships between parts. Use RAG when data exceeds context limits or when searching a large knowledge base."}
      </Note>

      <H2>{isRu ? "Характеристики производительности" : "Performance characteristics"}</H2>
      <UL items={[
        { bold: isRu ? "Время ответа" : "Response time", text: isRu ? "увеличивается линейно с объёмом ввода — ожидайте ~2-5 секунд на 10K токенов ввода" : "increases linearly with input size — expect ~2-5 seconds per 10K input tokens" },
        { bold: isRu ? "Внимание к деталям" : "Attention to detail", text: isRu ? "модели Mira используют улучшенные механизмы внимания для длинного контекста, но информация в середине документа может быть менее заметна (эффект «потерянной середины»)" : "Mira models use improved attention mechanisms for long context, but information in the middle of a document can be less salient (the 'lost in the middle' effect)" },
        { bold: isRu ? "Совет" : "Tip", text: isRu ? "размещайте наиболее важную информацию в начале и конце документа для достижения лучших результатов" : "place the most important information at the beginning and end of the document for best results" },
      ]} />

      <H2>{isRu ? "Пример: анализ кодовой базы" : "Example: codebase analysis"}</H2>
      <CodeBlock
        title={isRu ? "Анализ нескольких файлов" : "Multi-file analysis"}
        code={`{
  "model": "mira-max",
  "messages": [
    {
      "role": "system",
      "content": "${isRu
        ? "Ты — опытный код-ревьюер. Проанализируй кодовую базу и найди потенциальные проблемы."
        : "You are an expert code reviewer. Analyze the codebase and find potential issues."}"
    },
    {
      "role": "user",
      "content": "<file path=\\"src/auth.ts\\">\\n// auth.ts content...\\n</file>\\n<file path=\\"src/db.ts\\">\\n// db.ts content...\\n</file>\\n<file path=\\"src/api.ts\\">\\n// api.ts content...\\n</file>\\n\\n${isRu
        ? "Проанализируй эти три файла на предмет безопасности и найди уязвимости."
        : "Analyze these three files for security and find vulnerabilities."}"
    }
  ]
}`}
      />

      <NavCards cards={[
        { href: "/docs/models-capabilities/choosing-a-model", title: isRu ? "Выбор модели" : "Choosing a model", desc: isRu ? "Какая модель подходит для ваших данных" : "Which model fits your data" },
        { href: "/docs/models-capabilities/code-generation", title: isRu ? "Генерация кода" : "Code generation", desc: isRu ? "Работа с большими кодовыми базами" : "Working with large codebases" },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7. CodeGenerationPage — "code-generation"
   ═══════════════════════════════════════════════════════════════ */

function CodeGenerationPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Генерация кода" : "Code generation"}</H1>
      <P>
        {isRu
          ? "Mira — мощный инструмент для разработчиков. Все модели семейства обучены на больших объёмах качественного кода и поддерживают генерацию, объяснение, отладку, рефакторинг и тестирование на множестве языков программирования."
          : "Mira is a powerful tool for developers. All models in the family are trained on large volumes of high-quality code and support generation, explanation, debugging, refactoring, and testing across many programming languages."}
      </P>

      <H2>{isRu ? "Поддерживаемые языки программирования" : "Supported programming languages"}</H2>
      <Table
        headers={[
          isRu ? "Язык" : "Language",
          isRu ? "Качество" : "Quality",
          isRu ? "Примечания" : "Notes",
        ]}
        rows={[
          ["Python", isRu ? "Отличное" : "Excellent", isRu ? "Наивысшее качество, включая data science и ML" : "Highest quality, including data science and ML"],
          ["JavaScript / TypeScript", isRu ? "Отличное" : "Excellent", isRu ? "React, Next.js, Node.js, Deno" : "React, Next.js, Node.js, Deno"],
          ["Rust", isRu ? "Очень хорошее" : "Very good", isRu ? "Включая async, lifetimes, макросы" : "Including async, lifetimes, macros"],
          ["Go", isRu ? "Очень хорошее" : "Very good", isRu ? "Идиоматичный код, горутины, каналы" : "Idiomatic code, goroutines, channels"],
          ["Java / Kotlin", isRu ? "Очень хорошее" : "Very good", isRu ? "Spring Boot, Android, корпоративные приложения" : "Spring Boot, Android, enterprise apps"],
          ["C / C++", isRu ? "Хорошее" : "Good", isRu ? "Системное программирование, STL" : "Systems programming, STL"],
          ["C# / .NET", isRu ? "Хорошее" : "Good", isRu ? "ASP.NET, Unity, WPF" : "ASP.NET, Unity, WPF"],
          ["PHP", isRu ? "Хорошее" : "Good", isRu ? "Laravel, WordPress" : "Laravel, WordPress"],
          ["Ruby", isRu ? "Хорошее" : "Good", isRu ? "Rails, скрипты" : "Rails, scripting"],
          ["Swift", isRu ? "Хорошее" : "Good", isRu ? "iOS/macOS разработка" : "iOS/macOS development"],
          ["SQL", isRu ? "Отличное" : "Excellent", isRu ? "PostgreSQL, MySQL, SQLite, миграции" : "PostgreSQL, MySQL, SQLite, migrations"],
          ["Shell / Bash", isRu ? "Очень хорошее" : "Very good", isRu ? "Скрипты, DevOps" : "Scripting, DevOps"],
        ]}
      />

      <H2>{isRu ? "Генерация кода" : "Code generation"}</H2>
      <P>
        {isRu
          ? "Mira может генерировать код на основе описания на естественном языке. Для лучших результатов будьте конкретны в требованиях и указывайте желаемый стиль."
          : "Mira can generate code from natural language descriptions. For best results, be specific about requirements and desired style."}
      </P>
      <CodeBlock
        title={isRu ? "Генерация функции" : "Function generation"}
        code={`{
  "model": "mira",
  "messages": [{
    "role": "user",
    "content": "${isRu
      ? "Напиши функцию на Python, которая принимает список строк и возвращает самую часто встречающуюся строку. Если несколько строк встречаются одинаково часто, верни первую по алфавиту. Добавь type hints и docstring."
      : "Write a Python function that takes a list of strings and returns the most frequently occurring string. If multiple strings have the same frequency, return the first alphabetically. Add type hints and a docstring."}"
  }]
}`}
      />
      <P>{isRu ? "Результат:" : "Result:"}</P>
      <CodeBlock
        title="Python"
        code={`from collections import Counter


def most_frequent(strings: list[str]) -> str:
    """Return the most frequently occurring string.

    If multiple strings share the highest frequency,
    return the first one alphabetically.

    Args:
        strings: A list of strings to analyze.

    Returns:
        The most frequent string.

    Raises:
        ValueError: If the input list is empty.
    """
    if not strings:
        raise ValueError("Input list cannot be empty")

    counts = Counter(strings)
    max_count = max(counts.values())
    candidates = [s for s, c in counts.items() if c == max_count]
    return sorted(candidates)[0]`}
      />

      <H2>{isRu ? "Объяснение кода" : "Code explanation"}</H2>
      <P>
        {isRu
          ? "Передайте существующий код и попросите Mira объяснить, что он делает. Особенно полезно при работе с незнакомыми кодовыми базами."
          : "Pass existing code and ask Mira to explain what it does. Especially useful when working with unfamiliar codebases."}
      </P>
      <CodeBlock
        title={isRu ? "Запрос на объяснение" : "Explanation request"}
        code={`{
  "model": "mira",
  "messages": [{
    "role": "user",
    "content": "${isRu ? "Объясни, что делает этот код и где могут быть проблемы:" : "Explain what this code does and where issues might be:"}\\n\\nconst debounce = (fn, ms) => {\\n  let id;\\n  return (...args) => {\\n    clearTimeout(id);\\n    id = setTimeout(() => fn(...args), ms);\\n  };\\n};"
  }]
}`}
      />

      <H2>{isRu ? "Отладка" : "Debugging"}</H2>
      <P>
        {isRu
          ? "Для отладки сложного кода рекомендуется использовать mira-thinking — модель с цепочкой рассуждений, которая систематически анализирует код на наличие ошибок."
          : "For debugging complex code, we recommend using mira-thinking — the chain-of-thought model that systematically analyzes code for bugs."}
      </P>
      <CodeBlock
        title={isRu ? "Отладка с мышлением" : "Debugging with thinking"}
        code={`{
  "model": "mira-thinking",
  "messages": [{
    "role": "user",
    "content": "${isRu
      ? "Этот код на Rust паникует при определённых входных данных. Найди баг:"
      : "This Rust code panics on certain inputs. Find the bug:"}\\n\\nfn binary_search(arr: &[i32], target: i32) -> Option<usize> {\\n    let mut low = 0;\\n    let mut high = arr.len();\\n    while low < high {\\n        let mid = (low + high) / 2;\\n        if arr[mid] == target { return Some(mid); }\\n        if arr[mid] < target { low = mid + 1; }\\n        else { high = mid - 1; }  // Bug: underflow when mid = 0\\n    }\\n    None\\n}"
  }]
}`}
      />
      <Note type="tip">
        {isRu
          ? "Совет: при отладке прикрепляйте сообщение об ошибке, стек-трейс и описание ожидаемого поведения. Чем больше контекста, тем точнее диагноз."
          : "Tip: when debugging, attach the error message, stack trace, and expected behavior description. The more context, the more accurate the diagnosis."}
      </Note>

      <H2>{isRu ? "Рефакторинг" : "Refactoring"}</H2>
      <P>
        {isRu
          ? "Mira может предложить улучшения для существующего кода: улучшение структуры, производительности, читаемости и следование лучшим практикам."
          : "Mira can suggest improvements for existing code: improving structure, performance, readability, and adherence to best practices."}
      </P>
      <CodeBlock
        title={isRu ? "Запрос на рефакторинг" : "Refactoring request"}
        code={`{
  "model": "mira-pro",
  "messages": [
    {
      "role": "system",
      "content": "${isRu
        ? "Ты — старший разработчик, проводящий код-ревью. Предложи рефакторинг с объяснением каждого изменения."
        : "You are a senior developer conducting a code review. Suggest refactoring with explanation for each change."}"
    },
    {
      "role": "user",
      "content": "${isRu ? "Отрефактори этот Express-маршрут:" : "Refactor this Express route:"}\\n\\napp.post('/users', (req, res) => {\\n  if (!req.body.email) return res.status(400).send('email required');\\n  if (!req.body.name) return res.status(400).send('name required');\\n  db.query('INSERT INTO users (email, name) VALUES ($1, $2)', [req.body.email, req.body.name])\\n    .then(r => res.json(r.rows[0]))\\n    .catch(e => { console.log(e); res.status(500).send('error'); });\\n});"
    }
  ]
}`}
      />

      <H2>{isRu ? "Генерация тестов" : "Test generation"}</H2>
      <P>
        {isRu
          ? "Mira генерирует комплексные тесты, покрывающие основные сценарии, граничные случаи и обработку ошибок."
          : "Mira generates comprehensive tests covering main scenarios, edge cases, and error handling."}
      </P>
      <CodeBlock
        title={isRu ? "Генерация тестов" : "Test generation"}
        code={`{
  "model": "mira-pro",
  "messages": [{
    "role": "user",
    "content": "${isRu
      ? "Напиши тесты для этой функции на TypeScript с использованием Vitest. Покрой все граничные случаи."
      : "Write tests for this TypeScript function using Vitest. Cover all edge cases."}\\n\\nexport function parseEmail(email: string): { user: string; domain: string } | null {\\n  const parts = email.split('@');\\n  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;\\n  if (!parts[1].includes('.')) return null;\\n  return { user: parts[0], domain: parts[1] };\\n}"
  }]
}`}
      />

      <H2>{isRu ? "Генерация документации" : "Documentation generation"}</H2>
      <P>
        {isRu
          ? "Mira помогает генерировать документацию к коду: JSDoc/TSDoc комментарии, README, API-документацию и руководства."
          : "Mira helps generate code documentation: JSDoc/TSDoc comments, READMEs, API documentation, and guides."}
      </P>
      <CodeBlock
        title={isRu ? "Добавление документации" : "Adding documentation"}
        code={`{
  "model": "mira",
  "messages": [{
    "role": "user",
    "content": "${isRu
      ? "Добавь подробные JSDoc комментарии к каждой функции и типу в этом файле:"
      : "Add detailed JSDoc comments to every function and type in this file:"}\\n\\ninterface Config {\\n  baseUrl: string;\\n  timeout: number;\\n  retries: number;\\n}\\n\\nfunction createClient(config: Config) {\\n  // ...\\n}\\n\\nfunction fetchWithRetry(url: string, options?: RequestInit) {\\n  // ...\\n}"
  }]
}`}
      />

      <H2>{isRu ? "Mira Code CLI" : "Mira Code CLI"}</H2>
      <P>
        {isRu
          ? "Для интерактивного кодирования с ИИ используйте Mira Code — CLI-инструмент, который интегрируется с вашим редактором и терминалом."
          : "For interactive AI-powered coding, use Mira Code — a CLI tool that integrates with your editor and terminal."}
      </P>
      <CodeBlock
        title={isRu ? "Установка и использование" : "Install and use"}
        code={`# Install
npm install -g mira-code

# Start interactive session
mira-code

# Generate code from description
mira-code generate "REST API with Express and TypeScript"

# Debug a file
mira-code debug src/server.ts

# Explain a file
mira-code explain src/algorithm.rs`}
      />
      <Note type="tip">
        {isRu
          ? "Mira Code CLI автоматически включает контекст вашего проекта (файлы, зависимости, git-историю) для более точной генерации кода."
          : "Mira Code CLI automatically includes your project context (files, dependencies, git history) for more accurate code generation."}
      </Note>

      <H2>{isRu ? "Рекомендации" : "Best practices"}</H2>
      <UL items={[
        { bold: isRu ? "Будьте конкретны" : "Be specific", text: isRu ? "указывайте язык, фреймворк, стиль кода и версию — «Python 3.12, asyncio, type hints»" : "specify language, framework, code style, and version — 'Python 3.12, asyncio, type hints'" },
        { bold: isRu ? "Предоставьте контекст" : "Provide context", text: isRu ? "включите существующие типы, интерфейсы и зависимости — модель генерирует более совместимый код" : "include existing types, interfaces, and dependencies — the model generates more compatible code" },
        { bold: isRu ? "Проверяйте код" : "Review code", text: isRu ? "всегда проверяйте сгенерированный код перед использованием в продакшене" : "always review generated code before using in production" },
        { bold: isRu ? "Итерируйте" : "Iterate", text: isRu ? "если результат не идеален, уточните требования или попросите улучшить конкретный аспект" : "if the result isn't perfect, refine requirements or ask to improve a specific aspect" },
        { bold: isRu ? "Для сложных задач" : "For complex tasks", text: isRu ? "используйте mira-thinking для отладки и mira-pro/mira-max для работы с большими кодовыми базами" : "use mira-thinking for debugging and mira-pro/mira-max for large codebase work" },
      ]} />

      <NavCards cards={[
        { href: "/docs/mira-code/getting-started", title: "Mira Code CLI", desc: isRu ? "Интерактивное кодирование в терминале" : "Interactive coding in your terminal" },
        { href: "/docs/models-capabilities/thinking-mode", title: isRu ? "Режим мышления" : "Thinking mode", desc: isRu ? "Отладка с цепочкой рассуждений" : "Debugging with chain-of-thought" },
        { href: "/docs/models-capabilities/long-context", title: isRu ? "Длинный контекст" : "Long context", desc: isRu ? "Анализ больших кодовых баз" : "Analyzing large codebases" },
      ]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Export map
   ═══════════════════════════════════════════════════════════════ */

export const modelsCapabilitiesContent: Record<string, React.FC<{ locale: Locale }>> = {
  "choosing-a-model": ChoosingModelPage,
  "whats-new": WhatsNewPage,
  "pricing": PricingPage,
  "thinking-mode": ThinkingModePage,
  "multilingual": MultilingualPage,
  "long-context": LongContextPage,
  "code-generation": CodeGenerationPage,
};
