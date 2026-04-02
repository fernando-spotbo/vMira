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
          ? "Ваш API-ключ сохраняется локально в ~/.mira.json. Повторная аутентификация не потребуется до истечения срока действия ключа."
          : "Your API key is stored locally in ~/.mira.json. You will not need to re-authenticate until the key expires."}
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
          ["--version, -v", isRu ? "Показать текущую версию" : "Display current version", "mira --version"],
          ["--help, -h", isRu ? "Показать справку" : "Show help information", "mira --help"],
          ["--model", isRu ? "Выбрать модель AI" : "Select AI model", "mira --model mira-pro"],
          ["--print, -p", isRu ? "Неинтерактивный вывод (для скриптов)" : "Non-interactive output (for scripting)", "mira -p \"explain this\""],
          ["--continue, -c", isRu ? "Продолжить последний диалог" : "Continue most recent conversation", "mira --continue"],
          ["--resume, -r", isRu ? "Возобновить сессию по ID" : "Resume a session by ID", "mira -r SESSION_ID"],
          ["--yolo", isRu ? "Пропустить все подтверждения" : "Skip all permission checks", "mira --yolo"],
          ["--effort", isRu ? "Уровень усилий (low, medium, high, max)" : "Effort level (low, medium, high, max)", "mira --effort high"],
          ["--system-prompt", isRu ? "Системный промпт" : "System prompt override", "mira --system-prompt \"Be terse\""],
          ["--verbose", isRu ? "Подробный вывод" : "Verbose output", "mira --verbose"],
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
          ["MIRA_BASE_URL", isRu ? "Базовый URL API" : "Base API URL", "https://api.vmira.ai"],
          ["MIRA_MODEL", isRu ? "Модель по умолчанию" : "Default model", "mira"],
          ["MIRA_AUTH_URL", isRu ? "URL для аутентификации" : "Authentication endpoint URL", "https://api.vmira.ai"],
          ["MIRA_CONFIG_DIR", isRu ? "Директория конфигурации" : "Configuration directory", "~/.mira"],
        ]}
      />
      <CodeBlock
        title={isRu ? "Настройка переменных окружения (bash)" : "Setting environment variables (bash)"}
        code={`# Add to your ~/.bashrc or ~/.zshrc
export MIRA_API_KEY="sk-mira-your-key-here"
export MIRA_MODEL="mira-pro"
export MIRA_BASE_URL="https://api.vmira.ai"`}
        language="bash"
      />

      <H2>{isRu ? "Файлы конфигурации" : "Configuration Files"}</H2>
      <H3>{isRu ? "Глобальная конфигурация" : "Global Configuration"}</H3>
      <P>
        {isRu
          ? "Глобальная конфигурация хранится в ~/.mira.json и применяется ко всем проектам:"
          : "Global configuration is stored at ~/.mira.json and applies to all projects:"}
      </P>
      <CodeBlock
        title="~/.mira.json"
        code={`{
  "apiKey": "sk-mira-your-key-here",
  "theme": "dark",
  "autoUpdates": true,
  "verbose": false
}`}
        language="json"
      />
      <Note type="info">
        {isRu
          ? "Файл ~/.mira.json создаётся автоматически при первой аутентификации. API-ключ сохраняется в поле apiKey."
          : "The ~/.mira.json file is created automatically on first authentication. Your API key is stored in the apiKey field."}
      </Note>

      <H3>{isRu ? "Конфигурация проекта" : "Project Configuration"}</H3>
      <P>
        {isRu
          ? "Настройки проекта хранятся в .mira/settings.json в корне проекта и переопределяют глобальные настройки:"
          : "Project settings are stored at .mira/settings.json in the project root and override global settings:"}
      </P>
      <CodeBlock
        title=".mira/settings.json"
        code={`{
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash(npm test:*)"],
    "deny": ["Bash(rm *)"]
  },
  "env": {
    "MIRA_MODEL": "mira-pro"
  }
}`}
        language="json"
      />

      <H2>{isRu ? "Ключевые опции" : "Key Options"}</H2>
      <H3>{isRu ? "Глобальная конфигурация (~/.mira.json)" : "Global config (~/.mira.json)"}</H3>
      <Table
        headers={[isRu ? "Поле" : "Field", isRu ? "Тип" : "Type", isRu ? "Описание" : "Description"]}
        rows={[
          ["apiKey", "string", isRu ? "API-ключ Mira (sk-mira-...)" : "Mira API key (sk-mira-...)"],
          ["theme", "string", isRu ? "Цветовая тема: \"dark\" или \"light\"" : "Color theme: \"dark\" or \"light\""],
          ["autoUpdates", "boolean", isRu ? "Автоматическое обновление CLI" : "Auto-update the CLI"],
          ["verbose", "boolean", isRu ? "Подробный вывод логов" : "Verbose logging output"],
        ]}
      />
      <H3>{isRu ? "Настройки проекта (.mira/settings.json)" : "Project settings (.mira/settings.json)"}</H3>
      <Table
        headers={[isRu ? "Поле" : "Field", isRu ? "Тип" : "Type", isRu ? "Описание" : "Description"]}
        rows={[
          ["permissions.allow", "string[]", isRu ? "Разрешённые инструменты (Read, Edit, Write, Bash(...))" : "Allowed tools (Read, Edit, Write, Bash(...))"],
          ["permissions.deny", "string[]", isRu ? "Запрещённые инструменты" : "Denied tools"],
          ["env", "object", isRu ? "Переменные окружения для сессии (MIRA_MODEL и др.)" : "Environment variables for the session (MIRA_MODEL, etc.)"],
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
    /help        - Show this help message
    /clear       - Clear conversation history
    /compact     - Compact conversation context
    /model       - Change AI model
    /init        - Initialize project (create MIRA.md)
    /review      - Review code changes
    /login       - Authenticate with Mira
    /logout      - Remove stored credentials
    /cost        - Show session token usage and cost
    /doctor      - Run diagnostics
    /status      - Show session status
    /memory      - Manage persistent memory
    /theme       - Switch color theme
    /config      - Open configuration
    /permissions - Manage tool permissions
    /diff        - Show pending changes`} language="text" />

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
  1. mira     - Fast, general purpose
  2. mira-pro - Advanced capabilities + thinking mode
  3. mira-max - Maximum performance + thinking mode

  Select model (1-3): 2
  ✓ Switched to mira-pro`} language="text" />

      <H3>/review</H3>
      <P>{isRu ? "Выполняет ревью текущих изменений кода, находит потенциальные проблемы и предлагает улучшения." : "Performs a code review of current changes, finding potential issues and suggesting improvements."}</P>
      <CodeBlock title="/review" code={`> /review

  Reviewing changes since last commit...

  src/utils/api.ts:
  ⚠ Line 23: Missing error handling for network failure
  ⚠ Line 45: Hardcoded timeout value — consider using config

  src/components/UserList.tsx:
  ✓ Clean implementation
  * Consider memoizing the filter callback (line 18)

  Summary: 2 warnings, 1 suggestion, no critical issues.`} language="text" />

      <H3>/cost</H3>
      <P>{isRu ? "Показывает количество использованных токенов и стоимость текущей сессии." : "Shows the number of tokens used and cost of the current session."}</P>

      <H3>/doctor</H3>
      <P>{isRu ? "Запускает диагностику окружения — проверяет Node.js, аутентификацию, подключение к API и конфигурацию проекта." : "Runs environment diagnostics — checks Node.js, authentication, API connectivity, and project configuration."}</P>

      <H3>/login, /logout</H3>
      <P>{isRu ? "Аутентификация через device code flow (/login) или удаление сохранённых учётных данных (/logout)." : "Authenticate via device code flow (/login) or remove stored credentials (/logout)."}</P>

      <H3>/memory</H3>
      <P>{isRu ? "Управляет постоянной памятью Mira Code — сохраняет заметки, предпочтения и контекст между сессиями." : "Manages Mira Code's persistent memory — saves notes, preferences, and context across sessions."}</P>

      <H3>/init</H3>
      <P>{isRu ? "Анализирует ваш проект и создаёт MIRA.md с инструкциями для Mira Code, а также .mira/settings.json по необходимости." : "Analyzes your project and creates a MIRA.md with instructions for Mira Code, plus .mira/settings.json as needed."}</P>
      <CodeBlock title="/init" code={`> /init

  Creating project configuration...

  Detected:
  - Framework: Next.js 14
  - Language: TypeScript
  - Package manager: pnpm

  Created: MIRA.md
  ✓ Project initialized.`} language="text" />

      <H2>{isRu ? "Горячие клавиши" : "Keyboard Shortcuts"}</H2>
      <P>
        {isRu
          ? "В интерактивном режиме доступны следующие горячие клавиши:"
          : "The following keyboard shortcuts are available in interactive mode:"}
      </P>
      <Table
        headers={[isRu ? "Сочетание" : "Shortcut", isRu ? "Действие" : "Action"]}
        rows={[
          ["Ctrl+C", isRu ? "Прервать текущую генерацию" : "Interrupt current generation"],
          ["Ctrl+D", isRu ? "Выйти из Mira Code" : "Exit Mira Code"],
          ["Escape", isRu ? "Отменить текущую генерацию" : "Cancel current generation"],
          ["↑ / ↓", isRu ? "Навигация по истории ввода" : "Navigate input history"],
          ["Ctrl+R", isRu ? "Поиск по истории" : "Search input history"],
          ["Ctrl+L", isRu ? "Перерисовать экран" : "Redraw screen"],
          ["Ctrl+O", isRu ? "Показать/скрыть транскрипт" : "Toggle transcript view"],
        ]}
      />
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
        code={`1. CLI flags              (--model mira-pro)
2. Environment vars       (MIRA_MODEL=mira-pro)
3. Project local settings (.mira/settings.local.json)
4. Project settings       (.mira/settings.json)
5. Global config          (~/.mira.json)
6. Default values`}
        language="text"
      />
      <Note type="info">
        {isRu
          ? "Это означает, что флаг --model всегда переопределит значение из settings.json или переменной окружения MIRA_MODEL."
          : "This means a --model flag will always override a value from settings.json or the MIRA_MODEL environment variable."}
      </Note>

      <H2>{isRu ? "Глобальная конфигурация" : "Global Configuration"}</H2>
      <P>
        {isRu
          ? "Глобальная конфигурация применяется ко всем проектам и хранится в домашней директории пользователя:"
          : "Global configuration applies to all projects and is stored in the user's home directory:"}
      </P>
      <CodeBlock
        title="~/.mira.json"
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
          ? "Этот файл создаётся автоматически при первом запуске Mira Code. Вы можете отредактировать его в любом текстовом редакторе."
          : "This file is created automatically on first launch. You can edit it with any text editor."}
      </P>

      <H2>{isRu ? "Настройки проекта" : "Project Settings"}</H2>
      <P>
        {isRu
          ? "Настройки проекта хранятся в .mira/settings.json в корне проекта. Они переопределяют глобальные настройки:"
          : "Project settings are stored in .mira/settings.json in the project root. They override global settings:"}
      </P>
      <CodeBlock
        title=".mira/settings.json"
        code={`{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Bash(npm test:*)",
      "Bash(npm run build)"
    ],
    "deny": [
      "Bash(rm -rf *)"
    ]
  },
  "env": {
    "MIRA_MODEL": "mira-pro"
  }
}`}
        language="json"
      />
      <P>
        {isRu
          ? "Для приватных настроек используйте .mira/settings.local.json (добавьте в .gitignore):"
          : "For private settings, use .mira/settings.local.json (add to .gitignore):"}
      </P>
      <CodeBlock
        title=".mira/settings.local.json"
        code={`{
  "env": {
    "MIRA_API_KEY": "sk-mira-your-personal-key"
  }
}`}
        language="json"
      />
      <Note type="tip">
        {isRu
          ? "Добавьте .mira/settings.json в систему контроля версий (git), чтобы все участники команды использовали одинаковые настройки. Файл settings.local.json должен быть в .gitignore."
          : "Commit .mira/settings.json to version control so all team members share the same settings. Keep settings.local.json in .gitignore."}
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
        code={`// In ~/.mira.json
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
          ["mira-pro", isRu ? "Продвинутые возможности + режим мышления" : "Advanced capabilities + thinking mode", isRu ? "Архитектурные решения, сложная логика, отладка" : "Architecture decisions, complex logic, debugging"],
          ["mira-max", isRu ? "Максимальная производительность + режим мышления" : "Maximum performance + thinking mode", isRu ? "Крупные рефакторинги, анализ кодовых баз" : "Large-scale refactoring, codebase analysis"],
        ]}
      />
      <CodeBlock
        title={isRu ? "Способы выбора модели" : "Ways to select a model"}
        code={`# CLI flag (highest priority)
mira --model mira-pro

# Environment variable
export MIRA_MODEL="mira-pro"

# In .mira/settings.json
{ "env": { "MIRA_MODEL": "mira-pro" } }

# Interactive: use /model command
> /model`}
        language="bash"
      />

      <H2>{isRu ? "Система разрешений" : "Permission System"}</H2>
      <P>
        {isRu
          ? "Mira Code использует систему разрешений на основе инструментов. Каждый инструмент (Read, Edit, Write, Bash и т.д.) может быть разрешён или запрещён в настройках проекта:"
          : "Mira Code uses a tool-based permission system. Each tool (Read, Edit, Write, Bash, etc.) can be allowed or denied in project settings:"}
      </P>
      <CodeBlock
        title=".mira/settings.json"
        code={`{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Bash(npm test:*)",
      "Bash(npm run build)"
    ],
    "deny": [
      "Bash(rm -rf *)"
    ]
  }
}`}
        language="json"
      />
      <P>
        {isRu
          ? "По умолчанию Mira Code спрашивает подтверждение перед записью файлов и выполнением команд. Чтение файлов разрешено автоматически."
          : "By default, Mira Code asks for confirmation before writing files and running commands. File reads are allowed automatically."}
      </P>
      <Note type="warning">
        {isRu
          ? "Флаг --yolo отключает все подтверждения. Mira Code будет автоматически редактировать файлы и выполнять команды без вашего одобрения. Используйте только в изолированных средах разработки."
          : "The --yolo flag disables all confirmations. Mira Code will automatically edit files and run commands without your approval. Use only in isolated development environments."}
      </Note>
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
              ? "Поддержка моделей mira, mira-pro и mira-max. Модели загружаются динамически с платформы vmira.ai."
              : "Support for mira, mira-pro, and mira-max models. Models are fetched dynamically from the vmira.ai platform.",
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
              ? "Глобальная (~/.mira.json) и проектная (.mira/settings.json) конфигурация с поддержкой файлов инструкций MIRA.md."
              : "Global (~/.mira.json) and project-level (.mira/settings.json) configuration with MIRA.md instruction file support.",
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

// ── Mira Code Pricing Page ─────────────────────────────────────

function MiraCodePricingPage({ locale }: { locale: Locale }) {
  const isRu = locale === "ru";
  return (
    <>
      <H1>{isRu ? "Тарифы Mira Code" : "Mira Code Pricing"}</H1>
      <P>
        {isRu
          ? "Mira Code тарифицируется отдельно от подписки Мира. Выберите план, который подходит вашему рабочему процессу."
          : "Mira Code is billed separately from the Mira chat subscription. Choose the plan that fits your workflow."}
      </P>

      <Table
        headers={[
          "", "Free",  "Pro — 499 ₽/" + (isRu ? "мес" : "mo"), "Max — 990 ₽/" + (isRu ? "мес" : "mo"),
        ]}
        rows={[
          [isRu ? "Запросов в день" : "Requests/day", "30", "500", "2 000"],
          [isRu ? "Модели" : "Models", "Mira Fast", isRu ? "Все (Fast, Pro, Max)" : "All (Fast, Pro, Max)", isRu ? "Все + приоритет" : "All + priority"],
          [isRu ? "Режим мышления" : "Thinking mode", "—", "✓", "✓"],
          [isRu ? "Контекст" : "Context", "32K", "64K", "128K"],
          [isRu ? "Генерация тестов" : "Test generation", "—", "✓", "✓"],
          [isRu ? "Анализ кодовой базы" : "Codebase analysis", "—", "—", "✓"],
          [isRu ? "Приоритетная очередь" : "Priority queue", "—", "—", "✓"],
        ]}
      />

      <H2>{isRu ? "Как это работает" : "How it works"}</H2>
      <UL items={[
        { bold: isRu ? "Авторизация" : "Authorization", text: isRu ? "выполните mira auth login — откроется браузер для подтверждения" : "run mira auth login — a browser window opens for confirmation" },
        { bold: isRu ? "Выбор плана" : "Choosing a plan", text: isRu ? "бесплатный план активируется автоматически. Для Pro или Max — обновите на platform.vmira.ai" : "free plan activates automatically. For Pro or Max — upgrade on platform.vmira.ai" },
        { bold: isRu ? "Раздельная оплата" : "Separate billing", text: isRu ? "подписка Mira Code не влияет на подписку чата Мира и наоборот" : "Mira Code subscription does not affect your Mira chat subscription and vice versa" },
      ]} />

      <H2>{isRu ? "Часто задаваемые вопросы" : "FAQ"}</H2>
      <H3>{isRu ? "Могу ли я использовать Mira Code бесплатно?" : "Can I use Mira Code for free?"}</H3>
      <P>
        {isRu
          ? "Да. Бесплатный план включает 30 запросов в день с моделью Mira Fast. Этого достаточно для знакомства с продуктом."
          : "Yes. The free plan includes 30 requests per day with the Mira Fast model. Enough to get familiar with the product."}
      </P>
      <H3>{isRu ? "Связана ли подписка с чатом Мира?" : "Is the subscription linked to Mira chat?"}</H3>
      <P>
        {isRu
          ? "Нет. Mira Code и чат Мира тарифицируются отдельно. Вы можете иметь разные планы для каждого продукта."
          : "No. Mira Code and Mira chat are billed separately. You can have different plans for each product."}
      </P>
      <H3>{isRu ? "Что произойдёт, если я превышу лимит?" : "What happens if I exceed the limit?"}</H3>
      <P>
        {isRu
          ? "На платных планах запросы сверх лимита оплачиваются из вашего баланса по тарифу за токен. На бесплатном плане — ожидание до следующего дня."
          : "On paid plans, requests beyond the limit are charged from your balance at per-token rates. On the free plan, you wait until the next day."}
      </P>
    </>
  );
}

// ── Export map ───────────────────────────────────────────────────

export const miraCodeContent: Record<string, React.FC<{ locale: Locale }>> = {
  "mira-code/getting-started": MiraCodeGettingStartedPage,
  "mira-code/reference": MiraCodeReferencePage,
  "mira-code/commands": MiraCodeCommandsPage,
  "mira-code/configuration": MiraCodeConfigPage,
  "mira-code/changelog": MiraCodeChangelogPage,
  "mira-code/pricing": MiraCodePricingPage,
};
