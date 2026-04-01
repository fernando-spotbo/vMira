"use client";
import Link from "next/link";
import { CodeBlock, Note, H1, H2, H3, P, DocLink, NavCards, UL, Table, InlineCode } from "../shared";
import type { Locale } from "@/lib/i18n";

// ── 1. Getting Started ─────────────────────────────────────────

function MiraCodeGettingStartedPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <div>
      <H1>{isRu ? "Начало работы с Mira Code" : "Getting Started with Mira Code"}</H1>
      <P>
        {isRu
          ? "Mira Code — это AI-ассистент для программирования, работающий прямо в вашем терминале. Он понимает структуру вашего проекта, может редактировать файлы, выполнять команды, искать код и помогать с git — всё через естественный язык."
          : "Mira Code is an AI-powered coding assistant that lives in your terminal. It understands your entire codebase, can edit files, run commands, search code, and help with git — all through natural language."}
      </P>

      <H2>{isRu ? "Что такое Mira Code?" : "What is Mira Code?"}</H2>
      <P>
        {isRu
          ? "Mira Code — это CLI-инструмент, который приносит возможности AI прямо в ваш рабочий процесс разработки. В отличие от веб-чатботов, Mira Code работает локально в вашем проекте и имеет полный контекст вашей кодовой базы."
          : "Mira Code is a CLI tool that brings AI capabilities directly into your development workflow. Unlike web-based chatbots, Mira Code runs locally in your project and has full context of your codebase."}
      </P>
      <UL
        items={[
          {
            bold: isRu ? "Понимание кодовой базы" : "Codebase understanding",
            text: isRu
              ? "Автоматически анализирует структуру проекта, зависимости и паттерны кода"
              : "Automatically analyzes project structure, dependencies, and code patterns",
          },
          {
            bold: isRu ? "Редактирование файлов" : "Multi-file editing",
            text: isRu
              ? "Создаёт, изменяет и удаляет файлы в нескольких местах одновременно"
              : "Creates, modifies, and deletes files across multiple locations simultaneously",
          },
          {
            bold: isRu ? "Команды терминала" : "Terminal commands",
            text: isRu
              ? "Выполняет команды сборки, тестирования, линтинга и любые другие команды"
              : "Runs build, test, lint, and any other shell commands on your behalf",
          },
          {
            bold: isRu ? "Git-интеграция" : "Git integration",
            text: isRu
              ? "Создаёт коммиты, ревью изменений, управляет ветками"
              : "Creates commits, reviews changes, manages branches",
          },
        ]}
      />

      <H2>{isRu ? "Системные требования" : "System Requirements"}</H2>
      <UL
        items={[
          { bold: "Node.js", text: isRu ? "Версия 18.0 или выше" : "Version 18.0 or higher" },
          { bold: "npm", text: isRu ? "Поставляется вместе с Node.js" : "Comes bundled with Node.js" },
          {
            bold: isRu ? "Терминал" : "Terminal",
            text: isRu
              ? "Любой современный терминал (iTerm2, Windows Terminal, Hyper, встроенный терминал VS Code)"
              : "Any modern terminal emulator (iTerm2, Windows Terminal, Hyper, VS Code integrated terminal)",
          },
          {
            bold: isRu ? "Аккаунт Mira" : "Mira account",
            text: isRu
              ? "Бесплатный аккаунт на platform.vmira.ai"
              : "A free account on platform.vmira.ai",
          },
        ]}
      />

      <H2>{isRu ? "Установка" : "Installation"}</H2>
      <P>
        {isRu
          ? "Установите Mira Code глобально через npm:"
          : "Install Mira Code globally via npm:"}
      </P>
      <CodeBlock title={isRu ? "Установка" : "Install"} code="npm install -g mira-code" language="bash" />
      <P>
        {isRu
          ? "Убедитесь, что установка прошла успешно:"
          : "Verify the installation was successful:"}
      </P>
      <CodeBlock title={isRu ? "Проверка версии" : "Check version"} code="mira --version" language="bash" />

      <H2>{isRu ? "Первый запуск" : "First Run"}</H2>
      <P>
        {isRu
          ? "Перейдите в папку вашего проекта и запустите команду mira:"
          : "Navigate to your project directory and run the mira command:"}
      </P>
      <CodeBlock
        title={isRu ? "Запуск Mira Code" : "Launch Mira Code"}
        code={`cd your-project
mira`}
        language="bash"
      />
      <P>
        {isRu
          ? "При первом запуске вам будет показано уведомление о безопасности и условия использования. После принятия условий начнётся процесс аутентификации через device code flow:"
          : "On the first launch, you will see a security notice and terms of service. After accepting, the device code authentication flow begins:"}
      </P>
      <CodeBlock
        title={isRu ? "Процесс аутентификации" : "Authentication flow"}
        code={`$ mira

  Mira Code v0.1.0

  Security Notice:
  Mira Code can read and modify files in this directory.
  It can also execute terminal commands on your behalf.
  Always review suggested changes before approving.

  Do you accept the Terms of Service? (y/n): y

  To authenticate, open this URL in your browser:
  https://platform.vmira.ai/authorize

  Enter the code: ABCD-1234

  Waiting for approval...
  ✓ Authenticated successfully!

  Welcome to Mira Code. How can I help?
  >`}
        language="text"
      />
      <Note type="info">
        {isRu
          ? "Ваш токен аутентификации сохраняется локально в ~/.mira/auth.json. Повторная аутентификация не потребуется до истечения срока действия токена."
          : "Your authentication token is stored locally in ~/.mira/auth.json. You will not need to re-authenticate until the token expires."}
      </Note>

      <H2>{isRu ? "Базовое использование" : "Basic Usage"}</H2>
      <P>
        {isRu
          ? "После запуска просто опишите, что вам нужно, на естественном языке:"
          : "Once running, simply describe what you need in natural language:"}
      </P>
      <CodeBlock
        title={isRu ? "Пример: создание компонента" : "Example: creating a component"}
        code={`> Create a React button component with primary, secondary, and ghost variants using Tailwind CSS

  I'll create a new Button component for you.

  Created: src/components/ui/Button.tsx
  ✓ Button component with 3 variants (primary, secondary, ghost)
  ✓ TypeScript props interface
  ✓ Tailwind CSS styling
  ✓ Forwarded ref support`}
        language="text"
      />
      <CodeBlock
        title={isRu ? "Пример: исправление бага" : "Example: fixing a bug"}
        code={`> The login form is not validating email addresses properly

  Let me search for the login form implementation...

  Found: src/components/LoginForm.tsx
  The issue is on line 42 — the regex pattern is missing
  the TLD validation.

  Modified: src/components/LoginForm.tsx
  ✓ Updated email regex to properly validate TLDs
  ✓ Added test case for edge cases`}
        language="text"
      />
      <P>
        {isRu
          ? "Вы также можете запускать Mira Code в однокомандном режиме для быстрых задач:"
          : "You can also run Mira Code in one-shot mode for quick tasks:"}
      </P>
      <CodeBlock
        title={isRu ? "Однокомандный режим" : "One-shot mode"}
        code={`mira "add a loading spinner to the Dashboard component"`}
        language="bash"
      />

      <H2>{isRu ? "Следующие шаги" : "Next Steps"}</H2>
      <NavCards
        cards={[
          {
            href: `/docs/mira-code/commands`,
            title: isRu ? "Команды" : "Commands",
            desc: isRu ? "Все доступные команды и горячие клавиши" : "All available commands and keyboard shortcuts",
          },
          {
            href: `/docs/mira-code/configuration`,
            title: isRu ? "Конфигурация" : "Configuration",
            desc: isRu ? "Настройка Mira Code под ваши нужды" : "Customize Mira Code to your needs",
          },
          {
            href: `/docs/mira-code/reference`,
            title: isRu ? "Справочник" : "Reference",
            desc: isRu ? "Полная документация CLI-флагов и параметров" : "Full documentation of CLI flags and options",
          },
        ]}
      />
    </div>
  );
}

// ── 2. Reference ────────────────────────────────────────────────

function MiraCodeReferencePage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <div>
      <H1>{isRu ? "Справочник Mira Code" : "Mira Code Reference"}</H1>
      <P>
        {isRu
          ? "Полная справочная документация по всем флагам CLI, переменным окружения, файлам конфигурации и системе разрешений Mira Code."
          : "Complete reference documentation for all Mira Code CLI flags, environment variables, configuration files, and the permission system."}
      </P>

      <H2>{isRu ? "Флаги CLI" : "CLI Flags"}</H2>
      <P>
        {isRu
          ? "Mira Code поддерживает следующие флаги командной строки:"
          : "Mira Code supports the following command-line flags:"}
      </P>
      <Table
        headers={[isRu ? "Флаг" : "Flag", isRu ? "Описание" : "Description", isRu ? "Пример" : "Example"]}
        rows={[
          ["--version", isRu ? "Показать текущую версию" : "Display current version", "mira --version"],
          ["--help", isRu ? "Показать справку" : "Show help information", "mira --help"],
          ["--model", isRu ? "Выбрать модель AI" : "Select AI model", "mira --model mira-pro"],
          ["--api-key", isRu ? "Указать API-ключ" : "Provide API key", "mira --api-key sk-..."],
          ["--max-tokens", isRu ? "Максимум токенов ответа" : "Maximum response tokens", "mira --max-tokens 4096"],
        ]}
      />
      <Note type="tip">
        {isRu
          ? "Флаги CLI имеют наивысший приоритет и переопределяют все другие источники конфигурации."
          : "CLI flags have the highest priority and override all other configuration sources."}
      </Note>

      <H2>{isRu ? "Переменные окружения" : "Environment Variables"}</H2>
      <P>
        {isRu
          ? "Вы можете настроить поведение Mira Code с помощью переменных окружения:"
          : "You can configure Mira Code behavior using environment variables:"}
      </P>
      <Table
        headers={[isRu ? "Переменная" : "Variable", isRu ? "Описание" : "Description", isRu ? "По умолчанию" : "Default"]}
        rows={[
          ["MIRA_API_KEY", isRu ? "API-ключ для аутентификации" : "API key for authentication", isRu ? "нет" : "none"],
          ["MIRA_API_URL", isRu ? "Базовый URL API" : "Base API URL", "https://api.vmira.ai"],
          ["MIRA_MODEL", isRu ? "Модель по умолчанию" : "Default model", "mira"],
        ]}
      />
      <CodeBlock
        title={isRu ? "Настройка переменных окружения (bash)" : "Setting environment variables (bash)"}
        code={`# Add to your ~/.bashrc or ~/.zshrc
export MIRA_API_KEY="your-api-key-here"
export MIRA_MODEL="mira-pro"
export MIRA_API_URL="https://api.vmira.ai"`}
        language="bash"
      />

      <H2>{isRu ? "Файлы конфигурации" : "Configuration Files"}</H2>
      <H3>{isRu ? "Глобальная конфигурация" : "Global Configuration"}</H3>
      <P>
        {isRu
          ? "Глобальная конфигурация хранится в ~/.mira/config.json и применяется ко всем проектам:"
          : "Global configuration is stored at ~/.mira/config.json and applies to all projects:"}
      </P>
      <CodeBlock
        title="~/.mira/config.json"
        code={`{
  "model": "mira",
  "apiKey": "your-api-key",
  "maxTokens": 4096,
  "theme": "dark",
  "permissions": {
    "fileRead": "auto",
    "fileWrite": "ask",
    "commandExecution": "ask"
  }
}`}
        language="json"
      />

      <H3>{isRu ? "Конфигурация проекта" : "Project Configuration"}</H3>
      <P>
        {isRu
          ? "Конфигурация проекта хранится в .mira.json в корне проекта и переопределяет глобальные настройки:"
          : "Project configuration is stored at .mira.json in the project root and overrides global settings:"}
      </P>
      <CodeBlock
        title=".mira.json"
        code={`{
  "model": "mira-pro",
  "maxTokens": 8192,
  "permissions": {
    "fileRead": "auto",
    "fileWrite": "auto",
    "commandExecution": "ask"
  },
  "ignore": [
    "node_modules",
    ".env",
    "dist"
  ]
}`}
        language="json"
      />

      <H2>{isRu ? "Опции конфигурации" : "Configuration Options"}</H2>
      <Table
        headers={[isRu ? "Опция" : "Option", isRu ? "Тип" : "Type", isRu ? "Описание" : "Description"]}
        rows={[
          ["model", "string", isRu ? "Идентификатор модели AI (mira, mira-thinking, mira-pro, mira-max)" : "AI model identifier (mira, mira-thinking, mira-pro, mira-max)"],
          ["apiKey", "string", isRu ? "API-ключ для аутентификации" : "API key for authentication"],
          ["maxTokens", "number", isRu ? "Максимальное количество токенов ответа (по умолчанию: 4096)" : "Maximum response tokens (default: 4096)"],
          ["theme", "string", isRu ? "Цветовая тема: \"dark\" или \"light\"" : "Color theme: \"dark\" or \"light\""],
          ["permissions", "object", isRu ? "Настройки системы разрешений" : "Permission system settings"],
          ["ignore", "string[]", isRu ? "Файлы и директории для игнорирования" : "Files and directories to ignore"],
        ]}
      />

      <H2>{isRu ? "Система разрешений" : "Permission System"}</H2>
      <P>
        {isRu
          ? "Mira Code использует систему разрешений для управления доступом к файлам и командам. Каждое действие может быть в одном из трёх режимов:"
          : "Mira Code uses a permission system to control access to files and commands. Each action can be in one of three modes:"}
      </P>
      <UL
        items={[
          {
            bold: isRu ? "ask (спрашивать)" : "ask",
            text: isRu
              ? "Запрашивать подтверждение перед каждым действием (по умолчанию для записи и выполнения команд)"
              : "Ask for confirmation before each action (default for write and command execution)",
          },
          {
            bold: isRu ? "auto (автоматически)" : "auto",
            text: isRu
              ? "Выполнять действие без подтверждения (по умолчанию для чтения файлов)"
              : "Perform action without confirmation (default for file reads)",
          },
          {
            bold: isRu ? "deny (запретить)" : "deny",
            text: isRu
              ? "Полностью запретить данное действие"
              : "Completely block the action",
          },
        ]}
      />
      <Note type="warning">
        {isRu
          ? "Будьте осторожны с режимом auto для fileWrite и commandExecution. Рекомендуется использовать ask для этих действий, особенно в production-окружениях."
          : "Be careful with auto mode for fileWrite and commandExecution. It is recommended to use ask for these actions, especially in production environments."}
      </Note>

      <H2>{isRu ? "Поддерживаемые типы файлов" : "Supported File Types"}</H2>
      <P>
        {isRu
          ? "Mira Code работает со всеми текстовыми файлами и обеспечивает подсветку синтаксиса для более чем 50 языков программирования, включая:"
          : "Mira Code works with all text files and provides syntax highlighting for 50+ programming languages, including:"}
      </P>
      <P>
        TypeScript, JavaScript, Python, Rust, Go, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin,
        Dart, Lua, Scala, Haskell, Elixir, Clojure, HTML, CSS, SCSS, SQL, GraphQL, YAML, JSON,
        TOML, Markdown, Dockerfile, Terraform, {isRu ? "и многие другие." : "and many more."}
      </P>
    </div>
  );
}

// ── 3. Commands ─────────────────────────────────────────────────

function MiraCodeCommandsPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <div>
      <H1>{isRu ? "Команды Mira Code" : "Mira Code Commands"}</H1>
      <P>
        {isRu
          ? "Mira Code предоставляет набор основных команд для запуска и набор slash-команд для использования в интерактивном режиме."
          : "Mira Code provides a set of main commands for launching and a set of slash commands for use within the interactive session."}
      </P>

      <H2>{isRu ? "Основные команды" : "Main Commands"}</H2>

      <H3>{isRu ? "Интерактивный режим" : "Interactive Mode"}</H3>
      <P>
        {isRu
          ? "Запустите Mira Code без аргументов, чтобы войти в интерактивный режим. Вы сможете вести диалог, задавать вопросы и давать инструкции:"
          : "Run Mira Code without arguments to enter interactive mode. You can have a conversation, ask questions, and give instructions:"}
      </P>
      <CodeBlock
        title={isRu ? "Интерактивный режим" : "Interactive mode"}
        code={`$ mira

  Mira Code v0.1.0
  Welcome to Mira Code. How can I help?

  > Explain the authentication flow in this project

  Looking at the codebase...
  Found auth-related files:
  - src/lib/auth.ts
  - src/middleware.ts
  - src/app/api/auth/[...nextauth]/route.ts
  ...`}
        language="text"
      />

      <H3>{isRu ? "Однокомандный режим" : "One-shot Mode"}</H3>
      <P>
        {isRu
          ? "Передайте промпт в кавычках для выполнения одной задачи. Mira Code выполнит запрос и завершит работу:"
          : "Pass a prompt in quotes to execute a single task. Mira Code will complete the request and exit:"}
      </P>
      <CodeBlock
        title={isRu ? "Однокомандный режим" : "One-shot mode"}
        code={`$ mira "add input validation to the signup form"

  Reading src/components/SignupForm.tsx...
  Modified: src/components/SignupForm.tsx
  ✓ Added email format validation
  ✓ Added password strength check (min 8 chars, mixed case, number)
  ✓ Added real-time validation feedback

  Done.`}
        language="text"
      />

      <H2>{isRu ? "Slash-команды" : "Slash Commands"}</H2>
      <P>
        {isRu
          ? "В интерактивном режиме доступны следующие slash-команды. Введите команду и нажмите Enter:"
          : "The following slash commands are available in interactive mode. Type the command and press Enter:"}
      </P>

      <H3>/help</H3>
      <P>{isRu ? "Показывает справку по всем доступным командам и горячим клавишам." : "Displays help for all available commands and keyboard shortcuts."}</P>
      <CodeBlock title="/help" code={`> /help

  Available commands:
    /help     - Show this help message
    /clear    - Clear conversation history
    /compact  - Compact conversation context
    /model    - Change AI model
    /commit   - Create a git commit
    /review   - Review code changes
    /bug      - Find and fix bugs
    /init     - Initialize project config`} language="text" />

      <H3>/clear</H3>
      <P>{isRu ? "Очищает текущую историю диалога. Полезно, когда контекст разговора стал слишком большим или вы хотите начать новую тему." : "Clears the current conversation history. Useful when context becomes too large or you want to start a new topic."}</P>
      <CodeBlock title="/clear" code={`> /clear
  ✓ Conversation cleared. Starting fresh.`} language="text" />

      <H3>/compact</H3>
      <P>{isRu ? "Сжимает контекст разговора, сохраняя ключевую информацию. Используйте, когда приближаетесь к лимиту контекста, но хотите сохранить важные решения." : "Compresses conversation context while preserving key information. Use when approaching context limits but wanting to preserve important decisions."}</P>
      <CodeBlock title="/compact" code={`> /compact
  ✓ Conversation compacted.
  Reduced from 12,847 to 3,215 tokens.
  Key context preserved.`} language="text" />

      <H3>/model</H3>
      <P>{isRu ? "Переключает модель AI без перезапуска сессии. Доступные модели загружаются динамически с платформы." : "Switches the AI model without restarting the session. Available models are fetched dynamically from the platform."}</P>
      <CodeBlock title="/model" code={`> /model

  Available models:
  1. mira          - Fast, general purpose
  2. mira-thinking - Extended reasoning
  3. mira-pro      - Advanced capabilities
  4. mira-max      - Maximum performance

  Select model (1-4): 3
  ✓ Switched to mira-pro`} language="text" />

      <H3>/commit</H3>
      <P>{isRu ? "Анализирует текущие изменения в git и создаёт коммит с автоматически сгенерированным сообщением." : "Analyzes current git changes and creates a commit with an automatically generated message."}</P>
      <CodeBlock title="/commit" code={`> /commit

  Analyzing staged changes...
  - Modified: src/components/Button.tsx
  - Added: src/components/Button.test.tsx

  Suggested commit message:
  "feat: add Button component with variants and tests"

  Proceed? (y/n): y
  ✓ Committed: feat: add Button component with variants and tests`} language="text" />

      <H3>/review</H3>
      <P>{isRu ? "Выполняет ревью текущих изменений кода, находит потенциальные проблемы и предлагает улучшения." : "Performs a code review of current changes, finding potential issues and suggesting improvements."}</P>
      <CodeBlock title="/review" code={`> /review

  Reviewing changes since last commit...

  src/utils/api.ts:
  ⚠ Line 23: Missing error handling for network failure
  ⚠ Line 45: Hardcoded timeout value — consider using config

  src/components/UserList.tsx:
  ✓ Clean implementation
  💡 Consider memoizing the filter callback (line 18)

  Summary: 2 warnings, 1 suggestion, no critical issues.`} language="text" />

      <H3>/bug</H3>
      <P>{isRu ? "Помогает найти и исправить баги в проекте. Можно описать симптомы, и Mira Code проанализирует код для поиска причины." : "Helps find and fix bugs in the project. Describe the symptoms, and Mira Code will analyze the code to find the root cause."}</P>
      <CodeBlock title="/bug" code={`> /bug Users report that the search results page shows a blank screen on mobile

  Investigating...
  Searching for responsive breakpoints in search components...

  Found the issue in src/components/SearchResults.tsx:
  Line 67: The grid layout uses "grid-cols-3" without a mobile breakpoint.
  On screens < 768px, items overflow and become invisible.

  Fix applied:
  - Changed "grid-cols-3" to "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
  ✓ Bug fixed.`} language="text" />

      <H3>/init</H3>
      <P>{isRu ? "Создаёт файл конфигурации .mira.json в корне текущего проекта с оптимальными настройками." : "Creates a .mira.json configuration file in the current project root with optimal settings."}</P>
      <CodeBlock title="/init" code={`> /init

  Creating project configuration...

  Detected:
  - Framework: Next.js 14
  - Language: TypeScript
  - Package manager: pnpm

  Created: .mira.json
  ✓ Project configuration initialized.`} language="text" />

      <H2>{isRu ? "Горячие клавиши" : "Keyboard Shortcuts"}</H2>
      <P>
        {isRu
          ? "В интерактивном режиме доступны следующие горячие клавиши:"
          : "The following keyboard shortcuts are available in interactive mode:"}
      </P>
      <Table
        headers={[isRu ? "Сочетание" : "Shortcut", isRu ? "Действие" : "Action"]}
        rows={[
          ["Ctrl+C", isRu ? "Отменить текущую генерацию или ввод" : "Cancel current generation or input"],
          ["Ctrl+D", isRu ? "Выйти из Mira Code" : "Exit Mira Code"],
          ["Tab", isRu ? "Автодополнение команд и путей файлов" : "Autocomplete commands and file paths"],
          ["↑ / ↓", isRu ? "Навигация по истории ввода" : "Navigate input history"],
          ["Escape", isRu ? "Очистить текущую строку ввода" : "Clear current input line"],
        ]}
      />
      <Note type="tip">
        {isRu
          ? "Нажмите Tab дважды, чтобы увидеть все доступные варианты автодополнения для текущего ввода."
          : "Press Tab twice to see all available autocomplete suggestions for your current input."}
      </Note>
    </div>
  );
}

// ── 4. Configuration ────────────────────────────────────────────

function MiraCodeConfigPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <div>
      <H1>{isRu ? "Конфигурация Mira Code" : "Mira Code Configuration"}</H1>
      <P>
        {isRu
          ? "Mira Code можно настроить на нескольких уровнях: глобально, на уровне проекта и через файлы инструкций. Эта страница описывает все варианты конфигурации и их приоритет."
          : "Mira Code can be configured at multiple levels: globally, per-project, and through instruction files. This page covers all configuration options and their precedence."}
      </P>

      <H2>{isRu ? "Приоритет конфигурации" : "Configuration Precedence"}</H2>
      <P>
        {isRu
          ? "Когда одна и та же опция указана в нескольких местах, Mira Code использует следующий порядок приоритета (от высшего к низшему):"
          : "When the same option is specified in multiple places, Mira Code uses the following precedence order (highest to lowest):"}
      </P>
      <CodeBlock
        title={isRu ? "Порядок приоритета" : "Precedence order"}
        code={`1. CLI flags          (--model mira-pro)
2. Environment vars   (MIRA_MODEL=mira-pro)
3. Project config     (.mira.json)
4. Global config      (~/.mira/config.json)
5. Default values`}
        language="text"
      />
      <Note type="info">
        {isRu
          ? "Это означает, что флаг --model всегда переопределит значение из .mira.json или переменной окружения MIRA_MODEL."
          : "This means a --model flag will always override a value from .mira.json or the MIRA_MODEL environment variable."}
      </Note>

      <H2>{isRu ? "Глобальная конфигурация" : "Global Configuration"}</H2>
      <P>
        {isRu
          ? "Глобальная конфигурация применяется ко всем проектам и хранится в домашней директории пользователя:"
          : "Global configuration applies to all projects and is stored in the user's home directory:"}
      </P>
      <CodeBlock
        title="~/.mira/config.json"
        code={`{
  "model": "mira",
  "maxTokens": 4096,
  "theme": "dark",
  "permissions": {
    "fileRead": "auto",
    "fileWrite": "ask",
    "commandExecution": "ask"
  },
  "telemetry": false,
  "editor": "code",
  "shell": "/bin/zsh"
}`}
        language="json"
      />
      <P>
        {isRu
          ? "Вы можете создать этот файл вручную или использовать команду инициализации:"
          : "You can create this file manually or use the init command:"}
      </P>
      <CodeBlock title={isRu ? "Создание глобальной конфигурации" : "Create global config"} code="mira --init-global" language="bash" />

      <H2>{isRu ? "Конфигурация проекта" : "Project Configuration"}</H2>
      <P>
        {isRu
          ? "Конфигурация проекта хранится в файле .mira.json в корне проекта. Она переопределяет глобальные настройки для данного проекта:"
          : "Project configuration is stored in a .mira.json file at the project root. It overrides global settings for that project:"}
      </P>
      <CodeBlock
        title=".mira.json"
        code={`{
  "model": "mira-pro",
  "maxTokens": 8192,
  "permissions": {
    "fileRead": "auto",
    "fileWrite": "auto",
    "commandExecution": "ask"
  },
  "ignore": [
    "node_modules",
    "dist",
    ".env",
    ".env.local",
    "*.log",
    "coverage"
  ],
  "context": {
    "include": [
      "src/**/*.ts",
      "src/**/*.tsx"
    ],
    "exclude": [
      "**/*.test.ts",
      "**/__mocks__/**"
    ]
  }
}`}
        language="json"
      />
      <Note type="tip">
        {isRu
          ? "Добавьте .mira.json в систему контроля версий (git), чтобы все участники команды использовали одинаковые настройки."
          : "Commit .mira.json to version control (git) so all team members share the same settings."}
      </Note>

      <H2>{isRu ? "Файлы инструкций (MIRA.md)" : "Instruction Files (MIRA.md)"}</H2>
      <P>
        {isRu
          ? "Mira Code поддерживает файлы MIRA.md для хранения инструкций, специфичных для проекта. Эти файлы написаны на Markdown и загружаются автоматически при запуске:"
          : "Mira Code supports MIRA.md files for storing project-specific instructions. These files are written in Markdown and loaded automatically at startup:"}
      </P>
      <CodeBlock
        title="MIRA.md"
        code={`# Project Instructions

## Code Style
- Use functional components with TypeScript
- Prefer named exports over default exports
- Use Tailwind CSS for styling — no CSS modules
- All components must have proper TypeScript interfaces

## Architecture
- Follow the App Router pattern (Next.js 14+)
- Server components by default, "use client" only when needed
- Data fetching in server components, not in client components

## Testing
- Write tests for all utility functions
- Use Vitest + React Testing Library
- Minimum 80% coverage for new code

## Git
- Use conventional commits (feat:, fix:, chore:, etc.)
- Keep commits atomic — one logical change per commit`}
        language="markdown"
      />
      <P>
        {isRu
          ? "Mira Code ищет файлы инструкций в следующем порядке:"
          : "Mira Code looks for instruction files in the following order:"}
      </P>
      <UL
        items={[
          { bold: "MIRA.md", text: isRu ? "В корне проекта (рекомендуется)" : "In project root (recommended)" },
          { bold: ".mira/MIRA.md", text: isRu ? "В директории .mira проекта" : "In the project .mira directory" },
          { bold: ".mira/rules/*.md", text: isRu ? "Правила в директории .mira/rules" : "Rules in the .mira/rules directory" },
          { bold: "MIRA.local.md", text: isRu ? "Приватные инструкции (добавьте в .gitignore)" : "Private instructions (add to .gitignore)" },
        ]}
      />

      <H2>{isRu ? "Темы и внешний вид" : "Themes and Appearance"}</H2>
      <P>
        {isRu
          ? "Mira Code поддерживает две темы оформления:"
          : "Mira Code supports two display themes:"}
      </P>
      <Table
        headers={[isRu ? "Тема" : "Theme", isRu ? "Описание" : "Description"]}
        rows={[
          ["dark", isRu ? "Тёмная тема (по умолчанию). Оптимизирована для тёмных терминалов." : "Dark theme (default). Optimized for dark terminal backgrounds."],
          ["light", isRu ? "Светлая тема. Оптимизирована для светлых терминалов." : "Light theme. Optimized for light terminal backgrounds."],
        ]}
      />
      <CodeBlock
        title={isRu ? "Установка темы" : "Setting the theme"}
        code={`// In ~/.mira/config.json
{
  "theme": "light"
}

// Or via environment variable
export MIRA_THEME="light"`}
        language="json"
      />

      <H2>{isRu ? "Выбор модели" : "Model Selection"}</H2>
      <P>
        {isRu
          ? "Mira Code поддерживает несколько моделей AI. Доступные модели загружаются динамически с платформы vmira.ai:"
          : "Mira Code supports multiple AI models. Available models are fetched dynamically from the vmira.ai platform:"}
      </P>
      <Table
        headers={[isRu ? "Модель" : "Model", isRu ? "Описание" : "Description", isRu ? "Лучше всего для" : "Best for"]}
        rows={[
          ["mira", isRu ? "Быстрая, общего назначения" : "Fast, general purpose", isRu ? "Повседневные задачи" : "Everyday tasks"],
          ["mira-thinking", isRu ? "С расширенным рассуждением" : "Extended reasoning", isRu ? "Сложная логика, отладка" : "Complex logic, debugging"],
          ["mira-pro", isRu ? "Продвинутые возможности" : "Advanced capabilities", isRu ? "Архитектурные решения" : "Architecture decisions"],
          ["mira-max", isRu ? "Максимальная производительность" : "Maximum performance", isRu ? "Крупные рефакторинги" : "Large-scale refactoring"],
        ]}
      />
      <CodeBlock
        title={isRu ? "Способы выбора модели" : "Ways to select a model"}
        code={`# CLI flag (highest priority)
mira --model mira-pro

# Environment variable
export MIRA_MODEL="mira-pro"

# In .mira.json
{ "model": "mira-pro" }

# Interactive: use /model command
> /model`}
        language="bash"
      />

      <H2>{isRu ? "Пресеты разрешений" : "Permission Presets"}</H2>
      <P>
        {isRu
          ? "Для удобства Mira Code предоставляет пресеты разрешений, которые можно использовать вместо ручной настройки каждого параметра:"
          : "For convenience, Mira Code provides permission presets that can be used instead of manually configuring each option:"}
      </P>
      <Table
        headers={[isRu ? "Пресет" : "Preset", isRu ? "Чтение" : "Read", isRu ? "Запись" : "Write", isRu ? "Команды" : "Commands", isRu ? "Описание" : "Description"]}
        rows={[
          ["safe", "auto", "ask", "ask", isRu ? "По умолчанию. Читает свободно, спрашивает перед изменениями." : "Default. Reads freely, asks before changes."],
          ["trusted", "auto", "auto", "ask", isRu ? "Автозапись файлов, спрашивает перед командами." : "Auto-writes files, asks before commands."],
          ["yolo", "auto", "auto", "auto", isRu ? "Полная автоматизация. Используйте с осторожностью!" : "Full automation. Use with caution!"],
          ["readonly", "auto", "deny", "deny", isRu ? "Только чтение. Не может изменять файлы или выполнять команды." : "Read only. Cannot modify files or run commands."],
        ]}
      />
      <Note type="warning">
        {isRu
          ? "Пресет \"yolo\" отключает все подтверждения. Mira Code будет автоматически редактировать файлы и выполнять команды без вашего одобрения. Используйте только в изолированных средах разработки."
          : "The \"yolo\" preset disables all confirmations. Mira Code will automatically edit files and run commands without your approval. Use only in isolated development environments."}
      </Note>
      <CodeBlock
        title={isRu ? "Использование пресета" : "Using a preset"}
        code={`// In .mira.json
{
  "permissionPreset": "trusted"
}`}
        language="json"
      />
    </div>
  );
}

// ── 5. Changelog ────────────────────────────────────────────────

function MiraCodeChangelogPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";

  return (
    <div>
      <H1>{isRu ? "Журнал изменений Mira Code" : "Mira Code Changelog"}</H1>
      <P>
        {isRu
          ? "Все заметные изменения в Mira Code документируются на этой странице. Формат основан на Keep a Changelog, версионирование следует Semantic Versioning."
          : "All notable changes to Mira Code are documented on this page. The format is based on Keep a Changelog, and versioning follows Semantic Versioning."}
      </P>

      <H2>v0.1.0 — {isRu ? "1 апреля 2026" : "April 1, 2026"}</H2>
      <P>
        {isRu
          ? "Первый публичный релиз Mira Code — AI-ассистента для программирования в терминале."
          : "Initial public release of Mira Code — the AI-powered coding assistant for your terminal."}
      </P>

      <H3>{isRu ? "Добавлено" : "Added"}</H3>
      <UL
        items={[
          {
            bold: isRu ? "AI-ассистент в терминале" : "AI-powered terminal assistant",
            text: isRu
              ? "Интерактивный режим работы с AI прямо в вашем терминале. Понимает естественный язык, анализирует код и предлагает решения."
              : "Interactive AI session right in your terminal. Understands natural language, analyzes code, and suggests solutions.",
          },
          {
            bold: isRu ? "Аутентификация через device code flow" : "Device code authentication",
            text: isRu
              ? "Безопасная аутентификация через platform.vmira.ai. Откройте ссылку в браузере, введите код, подтвердите — готово."
              : "Secure authentication via platform.vmira.ai. Open the link in your browser, enter the code, approve — done.",
          },
          {
            bold: isRu ? "Редактирование нескольких файлов" : "Multi-file editing",
            text: isRu
              ? "Создание, изменение и удаление файлов в нескольких местах проекта одновременно с полным пониманием контекста."
              : "Create, modify, and delete files across multiple project locations simultaneously with full context awareness.",
          },
          {
            bold: isRu ? "Понимание кодовой базы" : "Codebase understanding",
            text: isRu
              ? "Автоматический анализ структуры проекта, зависимостей, паттернов кода и архитектуры при запуске."
              : "Automatic analysis of project structure, dependencies, code patterns, and architecture on startup.",
          },
          {
            bold: isRu ? "Git-интеграция с /commit" : "Git integration with /commit",
            text: isRu
              ? "Команда /commit анализирует изменения в git и генерирует осмысленные сообщения коммитов в формате conventional commits."
              : "The /commit command analyzes git changes and generates meaningful commit messages in conventional commit format.",
          },
          {
            bold: isRu ? "Ревью кода с /review" : "Code review with /review",
            text: isRu
              ? "Команда /review выполняет автоматическое ревью изменений, находит потенциальные проблемы и предлагает улучшения."
              : "The /review command performs automatic code review, finds potential issues, and suggests improvements.",
          },
          {
            bold: isRu ? "Поиск и исправление багов с /bug" : "Bug finding with /bug",
            text: isRu
              ? "Опишите симптомы бага, и Mira Code проанализирует код для поиска и исправления корневой причины."
              : "Describe the bug symptoms and Mira Code will analyze the code to find and fix the root cause.",
          },
          {
            bold: isRu ? "Поддержка моделей" : "Model support",
            text: isRu
              ? "Поддержка моделей mira, mira-thinking, mira-pro и mira-max. Модели загружаются динамически с платформы vmira.ai."
              : "Support for mira, mira-thinking, mira-pro, and mira-max models. Models are fetched dynamically from the vmira.ai platform.",
          },
          {
            bold: isRu ? "Уведомление о безопасности" : "Security notice and consent",
            text: isRu
              ? "При первом запуске отображается уведомление о безопасности и запрашивается согласие с условиями использования."
              : "On first launch, a security notice is displayed and consent to the terms of service is requested.",
          },
          {
            bold: isRu ? "Многоязычная поддержка" : "Multilingual support",
            text: isRu
              ? "Полная поддержка английского и русского языков в интерфейсе и документации."
              : "Full English and Russian language support in the interface and documentation.",
          },
          {
            bold: isRu ? "Система конфигурации" : "Configuration system",
            text: isRu
              ? "Глобальная (~/.mira/config.json) и проектная (.mira.json) конфигурация с поддержкой файлов инструкций MIRA.md."
              : "Global (~/.mira/config.json) and project-level (.mira.json) configuration with MIRA.md instruction file support.",
          },
          {
            bold: isRu ? "Система разрешений" : "Permission system",
            text: isRu
              ? "Гибкая система разрешений с пресетами (safe, trusted, yolo, readonly) для управления доступом к файлам и командам."
              : "Flexible permission system with presets (safe, trusted, yolo, readonly) for controlling access to files and commands.",
          },
          {
            bold: isRu ? "Однокомандный режим" : "One-shot mode",
            text: isRu
              ? "Выполнение одной задачи из командной строки: mira \"ваш запрос\". Удобно для скриптов и быстрых задач."
              : "Execute a single task from the command line: mira \"your prompt\". Convenient for scripts and quick tasks.",
          },
          {
            bold: isRu ? "Slash-команды" : "Slash commands",
            text: isRu
              ? "Набор встроенных команд: /help, /clear, /compact, /model, /commit, /review, /bug, /init."
              : "Built-in command set: /help, /clear, /compact, /model, /commit, /review, /bug, /init.",
          },
        ]}
      />

      <H3>{isRu ? "Технические детали" : "Technical Details"}</H3>
      <UL
        items={[
          {
            bold: "Node.js 18+",
            text: isRu
              ? "Требуется Node.js версии 18 или выше"
              : "Requires Node.js version 18 or higher",
          },
          {
            bold: isRu ? "Установка через npm" : "npm installation",
            text: isRu
              ? "Устанавливается глобально: npm install -g mira-code"
              : "Installed globally: npm install -g mira-code",
          },
          {
            bold: isRu ? "Запуск командой mira" : "mira command",
            text: isRu
              ? "Запускается командой mira в любой директории проекта"
              : "Launched with the mira command in any project directory",
          },
          {
            bold: isRu ? "Кроссплатформенность" : "Cross-platform",
            text: isRu
              ? "Работает на macOS, Linux и Windows (через WSL или Windows Terminal)"
              : "Works on macOS, Linux, and Windows (via WSL or Windows Terminal)",
          },
        ]}
      />

      <Note type="info">
        {isRu
          ? "Это первый релиз Mira Code. Мы активно работаем над новыми функциями и улучшениями. Следите за обновлениями на platform.vmira.ai."
          : "This is the first release of Mira Code. We are actively working on new features and improvements. Follow updates on platform.vmira.ai."}
      </Note>

      <H2>{isRu ? "Обратная связь" : "Feedback"}</H2>
      <P>
        {isRu
          ? "Нашли баг или хотите предложить улучшение? Свяжитесь с нами через платформу:"
          : "Found a bug or want to suggest an improvement? Reach out through the platform:"}
      </P>
      <UL
        items={[
          {
            bold: isRu ? "Баг-репорты" : "Bug reports",
            text: isRu
              ? "Отправляйте через platform.vmira.ai/feedback с тегом \"mira-code\""
              : "Submit via platform.vmira.ai/feedback with the \"mira-code\" tag",
          },
          {
            bold: isRu ? "Запросы функций" : "Feature requests",
            text: isRu
              ? "Голосуйте за существующие запросы или создавайте новые на platform.vmira.ai/feedback"
              : "Vote on existing requests or create new ones at platform.vmira.ai/feedback",
          },
        ]}
      />
    </div>
  );
}

// ── Export map ───────────────────────────────────────────────────

export const miraCodeContent: Record<string, React.FC<{ locale: Locale }>> = {
  "mira-code/getting-started": MiraCodeGettingStartedPage,
  "mira-code/reference": MiraCodeReferencePage,
  "mira-code/commands": MiraCodeCommandsPage,
  "mira-code/configuration": MiraCodeConfigPage,
  "mira-code/changelog": MiraCodeChangelogPage,
};
