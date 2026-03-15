# ChatGPT Frontend Clone — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pixel-perfect, frontend-only, fully responsive ChatGPT UI clone.

**Architecture:** Next.js 15 App Router with TypeScript and Tailwind CSS. Component-per-section approach mirroring ChatGPT's layout. React Context for state (active conversation, sidebar toggle). Mock data in static JSON. Color tokens reverse-engineered from ChatGPT via LibreChat (MIT).

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, react-markdown, rehype-highlight, highlight.js, lucide-react

---

### Task 1: Scaffold Next.js project and configure Tailwind with ChatGPT color tokens

**Files:**
- Create: project root via `npx create-next-app`
- Modify: `tailwind.config.ts` (add custom colors)
- Modify: `src/app/globals.css` (add CSS variables + base styles)
- Modify: `src/app/layout.tsx` (dark theme, font)
- Modify: `src/app/page.tsx` (clear boilerplate)

**Step 1: Scaffold project**

Run:
```bash
cd "C:/Users/ferna/OneDrive/Escritorio/mira"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Install dependencies**

Run:
```bash
npm install react-markdown rehype-highlight highlight.js lucide-react
```

**Step 3: Configure Tailwind with ChatGPT color tokens**

Replace `tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "gpt-gray": {
          50: "#f7f7f8",
          100: "#ececec",
          200: "#e3e3e3",
          300: "#cdcdcd",
          400: "#999696",
          500: "#595959",
          600: "#424242",
          700: "#2f2f2f",
          800: "#212121",
          850: "#171717",
          900: "#0d0d0d",
        },
        "gpt-green": "#10a37f",
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 4: Set up global CSS with dark theme**

Replace `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import "highlight.js/styles/github-dark.css";

:root {
  --sidebar-width: 260px;
}

* {
  box-sizing: border-box;
}

body {
  background-color: #212121;
  color: #ececec;
  overflow: hidden;
}

/* Hide scrollbar but keep functionality */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Markdown code block styling */
.markdown-body pre {
  background-color: #0d0d0d;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.markdown-body pre code {
  display: block;
  padding: 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
}

.markdown-body code:not(pre code) {
  background-color: #0d0d0d;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.markdown-body p {
  margin-bottom: 0.75rem;
  line-height: 1.75;
}

.markdown-body p:last-child {
  margin-bottom: 0;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.markdown-body li {
  margin-bottom: 0.25rem;
  line-height: 1.75;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 1rem;
}

/* Textarea auto-resize */
textarea {
  field-sizing: content;
}
```

**Step 5: Set up root layout**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChatGPT",
  description: "ChatGPT UI Clone",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
```

**Step 6: Clear page boilerplate**

Replace `src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <div className="flex h-screen w-screen bg-gpt-gray-800 text-gpt-gray-100">
      <p className="m-auto text-gpt-gray-400">ChatGPT Clone — scaffold working</p>
    </div>
  );
}
```

**Step 7: Verify**

Run: `npm run dev`
Expected: Dark page with centered gray text, no errors.

**Step 8: Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold Next.js project with ChatGPT color tokens"
```

---

### Task 2: Create mock data and ChatContext provider

**Files:**
- Create: `src/lib/mock-data.ts`
- Create: `src/lib/types.ts`
- Create: `src/context/ChatContext.tsx`

**Step 1: Define types**

Create `src/lib/types.ts`:
```ts
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}
```

**Step 2: Create mock data**

Create `src/lib/mock-data.ts`:
```ts
import { Conversation } from "./types";

export const mockConversations: Conversation[] = [
  {
    id: "1",
    title: "Python quicksort implementation",
    createdAt: "2026-03-15",
    messages: [
      {
        id: "1a",
        role: "user",
        content: "Write a quicksort function in Python",
      },
      {
        id: "1b",
        role: "assistant",
        content: `Here's a clean implementation of quicksort in Python:

\`\`\`python
def quicksort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr

    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]

    return quicksort(left) + middle + quicksort(right)

# Example usage
numbers = [3, 6, 8, 10, 1, 2, 1]
print(quicksort(numbers))  # [1, 1, 2, 3, 6, 8, 10]
\`\`\`

This implementation uses the **Lomuto partition scheme** variant with list comprehensions. Here's how it works:

1. **Base case**: Arrays of length 0 or 1 are already sorted
2. **Pivot selection**: We pick the middle element as the pivot
3. **Partition**: Split into elements less than, equal to, and greater than the pivot
4. **Recurse**: Sort left and right partitions, concatenate with middle

**Time complexity**: O(n log n) average, O(n²) worst case
**Space complexity**: O(n) due to list comprehensions`,
      },
      {
        id: "1c",
        role: "user",
        content: "Can you make it sort in-place?",
      },
      {
        id: "1d",
        role: "assistant",
        content: `Sure! Here's an in-place version that doesn't create new lists:

\`\`\`python
def quicksort_inplace(arr: list[int], low: int = 0, high: int | None = None) -> None:
    if high is None:
        high = len(arr) - 1

    if low < high:
        pivot_idx = partition(arr, low, high)
        quicksort_inplace(arr, low, pivot_idx - 1)
        quicksort_inplace(arr, pivot_idx + 1, high)

def partition(arr: list[int], low: int, high: int) -> int:
    pivot = arr[high]
    i = low - 1

    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]

    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1
\`\`\`

This version sorts the array **in-place** with O(log n) space complexity (for the recursion stack only).`,
      },
    ],
  },
  {
    id: "2",
    title: "React useEffect explained",
    createdAt: "2026-03-14",
    messages: [
      {
        id: "2a",
        role: "user",
        content: "Explain React useEffect to me like I'm a beginner",
      },
      {
        id: "2b",
        role: "assistant",
        content: `Great question! Let me break down \`useEffect\` in simple terms.

## What is useEffect?

\`useEffect\` is a React Hook that lets you **synchronize your component with something outside of React** — like fetching data, setting up timers, or updating the page title.

Think of it as telling React: *"Hey, after you render this component, also do this thing."*

## Basic syntax

\`\`\`jsx
useEffect(() => {
  // This code runs after the component renders
  document.title = "New title";
}, [dependency]);
\`\`\`

## The dependency array

The second argument controls **when** the effect runs:

- **No array**: Runs after every render
- **Empty array \`[]\`**: Runs only once (on mount)
- **With values \`[count]\`**: Runs when \`count\` changes

## Common use cases

1. **Fetching data** when the component loads
2. **Setting up subscriptions** (WebSocket, event listeners)
3. **Updating the document title**
4. **Running timers** with setInterval/setTimeout

## Cleanup

Return a function to clean up side effects:

\`\`\`jsx
useEffect(() => {
  const timer = setInterval(() => console.log("tick"), 1000);

  return () => clearInterval(timer); // cleanup!
}, []);
\`\`\`

This prevents memory leaks when the component unmounts.`,
      },
    ],
  },
  {
    id: "3",
    title: "Travel tips for Tokyo",
    createdAt: "2026-03-13",
    messages: [
      {
        id: "3a",
        role: "user",
        content:
          "I'm planning a trip to Tokyo next month. What are your top recommendations?",
      },
      {
        id: "3b",
        role: "assistant",
        content: `Tokyo is incredible! Here are my top recommendations:

## Must-Visit Areas

- **Shibuya** — The famous crossing, Shibuya Sky observation deck, great shopping
- **Shinjuku** — Bustling nightlife, Golden Gai bar district, Shinjuku Gyoen garden
- **Asakusa** — Sensō-ji temple, traditional Nakamise shopping street
- **Akihabara** — Electronics, anime, manga culture
- **Harajuku** — Takeshita Street for quirky fashion, Meiji Shrine nearby

## Food You Can't Miss

1. **Ramen** — Try Ichiran (customizable solo booths) or Fuunji near Shinjuku
2. **Sushi** — Visit Tsukiji Outer Market for fresh sushi at 7am
3. **Conveyor belt sushi** — Genki Sushi for a fun, affordable experience
4. **Yakitori** — Grilled chicken skewers under the Yurakucho train tracks
5. **Convenience store food** — 7-Eleven onigiri and egg sandwiches are genuinely amazing

## Practical Tips

- Get a **Suica/Pasmo card** for seamless train travel
- Download **Google Maps offline** — it has excellent transit directions
- **Cash is still king** in many small restaurants and shops
- Learn basic phrases: すみません (sumimasen = excuse me), ありがとう (arigatou = thank you)
- The **JR Pass** is worth it if you're doing day trips to Kyoto/Osaka

## Day Trips

- **Kamakura** (1hr) — Great Buddha statue, hiking trails
- **Nikko** (2hr) — Ornate shrines in a mountain forest
- **Hakone** (1.5hr) — Hot springs with Mt. Fuji views`,
      },
    ],
  },
  {
    id: "4",
    title: "CSS Grid vs Flexbox",
    createdAt: "2026-03-12",
    messages: [
      {
        id: "4a",
        role: "user",
        content: "When should I use CSS Grid vs Flexbox?",
      },
      {
        id: "4b",
        role: "assistant",
        content: `Here's a simple rule of thumb:

> **Flexbox** = one direction (row OR column)
> **Grid** = two directions (rows AND columns)

## Use Flexbox for:

- Navigation bars
- Centering content
- Card rows that wrap
- Aligning items in a single line
- The \`gap\` property works great with both!

\`\`\`css
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
\`\`\`

## Use Grid for:

- Full page layouts
- Image galleries
- Dashboard layouts
- Anything with rows AND columns simultaneously

\`\`\`css
.dashboard {
  display: grid;
  grid-template-columns: 250px 1fr 300px;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
  height: 100vh;
}
\`\`\`

## They work great together!

Use Grid for the overall page layout, then Flexbox for individual components within each grid area. That's the most common pattern in modern CSS.`,
      },
    ],
  },
];
```

**Step 3: Create ChatContext**

Create `src/context/ChatContext.tsx`:
```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Conversation, Message } from "@/lib/types";
import { mockConversations } from "@/lib/mock-data";

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  sidebarOpen: boolean;
  selectedModel: string;
  setActiveConversationId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSelectedModel: (model: string) => void;
  createNewChat: () => void;
  addMessage: (conversationId: string, message: Message) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] =
    useState<Conversation[]>(mockConversations);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >("1");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("GPT-4o");

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const createNewChat = useCallback(() => {
    const newId = String(Date.now());
    const newConversation: Conversation = {
      id: newId,
      title: "New chat",
      messages: [],
      createdAt: new Date().toISOString().split("T")[0],
    };
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newId);
  }, []);

  const addMessage = useCallback(
    (conversationId: string, message: Message) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, message] }
            : c
        )
      );
    },
    []
  );

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        sidebarOpen,
        selectedModel,
        setActiveConversationId,
        setSidebarOpen,
        toggleSidebar,
        setSelectedModel,
        createNewChat,
        addMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
}
```

**Step 4: Verify** — run `npm run dev`, ensure no errors.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add types, mock data, and ChatContext provider"
```

---

### Task 3: Build the Sidebar component

**Files:**
- Create: `src/components/Sidebar.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create Sidebar**

Create `src/components/Sidebar.tsx`:
```tsx
"use client";

import { useChat } from "@/context/ChatContext";
import { Plus, MessageSquare, Ellipsis, X } from "lucide-react";

export default function Sidebar() {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    sidebarOpen,
    setSidebarOpen,
    createNewChat,
  } = useChat();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-full w-[260px] flex-col bg-gpt-gray-850
          transition-transform duration-300 ease-in-out
          md:relative md:z-auto md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:hidden"}
        `}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-3">
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gpt-gray-400 hover:bg-gpt-gray-700"
            title="Close sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <button
            onClick={() => {
              createNewChat();
              setSidebarOpen(false);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gpt-gray-400 hover:bg-gpt-gray-700"
            title="New chat"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-2 pb-2">
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConversationId(conv.id);
                  setSidebarOpen(false);
                }}
                className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
                  ${
                    activeConversationId === conv.id
                      ? "bg-gpt-gray-700 text-gpt-gray-100"
                      : "text-gpt-gray-300 hover:bg-gpt-gray-700/50"
                  }
                `}
              >
                <span className="flex-1 truncate">{conv.title}</span>
                {activeConversationId === conv.id && (
                  <Ellipsis
                    size={16}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gpt-gray-400"
                  />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* User menu */}
        <div className="border-t border-gpt-gray-700 p-2">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-gpt-gray-300 hover:bg-gpt-gray-700/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gpt-green text-white text-xs font-semibold">
              U
            </div>
            <span>User</span>
          </button>
        </div>
      </aside>
    </>
  );
}
```

**Step 2: Wire into page.tsx**

Replace `src/app/page.tsx`:
```tsx
import { ChatProvider } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";

export default function Home() {
  return (
    <ChatProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gpt-gray-800">
        <Sidebar />
        <main className="flex flex-1 flex-col items-center justify-center">
          <p className="text-gpt-gray-400">Chat area coming next</p>
        </main>
      </div>
    </ChatProvider>
  );
}
```

**Step 3: Verify** — sidebar renders with conversation list, mobile overlay works.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Sidebar with conversation list and mobile overlay"
```

---

### Task 4: Build the TopBar with ModelSelector

**Files:**
- Create: `src/components/TopBar.tsx`
- Create: `src/components/ModelSelector.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create ModelSelector**

Create `src/components/ModelSelector.tsx`:
```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Sparkles, Zap } from "lucide-react";
import { useChat } from "@/context/ChatContext";

const models = [
  { id: "GPT-4o", label: "GPT-4o", description: "Great for most tasks", icon: Sparkles },
  { id: "GPT-4o mini", label: "GPT-4o mini", description: "Fastest model", icon: Zap },
];

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useChat();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-lg font-semibold text-gpt-gray-100 hover:bg-gpt-gray-700/50 transition-colors"
      >
        {selectedModel}
        <ChevronDown size={16} className={`text-gpt-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-gpt-gray-600 bg-gpt-gray-850 py-1 shadow-xl">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                setSelectedModel(model.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gpt-gray-700/50 transition-colors"
            >
              <model.icon size={18} className="shrink-0 text-gpt-gray-300" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gpt-gray-100">{model.label}</div>
                <div className="text-xs text-gpt-gray-400">{model.description}</div>
              </div>
              {selectedModel === model.id && (
                <Check size={16} className="shrink-0 text-gpt-gray-300" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create TopBar**

Create `src/components/TopBar.tsx`:
```tsx
"use client";

import { useChat } from "@/context/ChatContext";
import ModelSelector from "./ModelSelector";
import { Plus } from "lucide-react";

export default function TopBar() {
  const { sidebarOpen, toggleSidebar, createNewChat } = useChat();

  return (
    <header className="flex h-14 items-center justify-between px-3 md:px-4">
      <div className="flex items-center gap-1">
        {!sidebarOpen && (
          <>
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gpt-gray-400 hover:bg-gpt-gray-700 transition-colors"
              title="Open sidebar"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            <button
              onClick={createNewChat}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gpt-gray-400 hover:bg-gpt-gray-700 transition-colors"
              title="New chat"
            >
              <Plus size={20} />
            </button>
          </>
        )}
        <ModelSelector />
      </div>

      {/* Placeholder for share/profile on right */}
      <div />
    </header>
  );
}
```

**Step 3: Update page.tsx**

Replace `src/app/page.tsx`:
```tsx
import { ChatProvider } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default function Home() {
  return (
    <ChatProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gpt-gray-800">
        <Sidebar />
        <main className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="text-gpt-gray-400">Chat area coming next</p>
          </div>
        </main>
      </div>
    </ChatProvider>
  );
}
```

**Step 4: Verify** — model selector dropdown works, sidebar toggle buttons appear/hide.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add TopBar with ModelSelector dropdown"
```

---

### Task 5: Build MessageBubble with markdown and code blocks

**Files:**
- Create: `src/components/MessageBubble.tsx`
- Create: `src/components/CodeBlock.tsx`

**Step 1: Create CodeBlock**

Create `src/components/CodeBlock.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-gpt-gray-600">
      {/* Header */}
      <div className="flex items-center justify-between bg-gpt-gray-700 px-4 py-2 text-xs text-gpt-gray-300">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-gpt-gray-300 hover:text-gpt-gray-100 transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy code
            </>
          )}
        </button>
      </div>
      {/* Code (rendered by rehype-highlight via the parent pre>code) */}
      <div className="overflow-x-auto bg-gpt-gray-900 p-4 text-sm leading-relaxed">
        <pre>
          <code className={language ? `hljs language-${language}` : ""}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}
```

**Step 2: Create MessageBubble**

Create `src/components/MessageBubble.tsx`:
```tsx
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { Message } from "@/lib/types";
import CodeBlock from "./CodeBlock";

export default function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group py-4 ${isUser ? "flex justify-end" : ""}`}>
      <div className={`max-w-3xl ${isUser ? "max-w-[70%]" : "w-full"}`}>
        {/* Message content */}
        <div
          className={`
            ${isUser ? "rounded-3xl bg-gpt-gray-700 px-5 py-3" : ""}
          `}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</p>
          ) : (
            <div className="markdown-body text-[15px] leading-7">
              <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
                components={{
                  pre({ children, ...props }) {
                    return <>{children}</>;
                  },
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const code = String(children).replace(/\n$/, "");

                    if (match) {
                      return <CodeBlock language={match[1]} code={code} />;
                    }

                    return (
                      <code className="rounded bg-gpt-gray-900 px-1.5 py-0.5 text-sm" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              />
            </div>
          )}
        </div>

        {/* Action buttons (assistant only) */}
        {!isUser && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gpt-gray-400 hover:bg-gpt-gray-700 hover:text-gpt-gray-200 transition-colors"
              title="Copy"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-gpt-gray-400 hover:bg-gpt-gray-700 hover:text-gpt-gray-200 transition-colors"
              title="Good response"
            >
              <ThumbsUp size={16} />
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-gpt-gray-400 hover:bg-gpt-gray-700 hover:text-gpt-gray-200 transition-colors"
              title="Bad response"
            >
              <ThumbsDown size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Verify** — no build errors.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add MessageBubble with markdown rendering and CodeBlock"
```

---

### Task 6: Build ChatArea and InputBar

**Files:**
- Create: `src/components/ChatArea.tsx`
- Create: `src/components/InputBar.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create ChatArea**

Create `src/components/ChatArea.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/context/ChatContext";
import MessageBubble from "./MessageBubble";

export default function ChatArea() {
  const { activeConversation } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  if (!activeConversation || activeConversation.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gpt-gray-100">
            What can I help with?
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto hide-scrollbar">
      <div className="mx-auto max-w-3xl px-4 py-4">
        {activeConversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

**Step 2: Create InputBar**

Create `src/components/InputBar.tsx`:
```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { useChat } from "@/context/ChatContext";

export default function InputBar() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { activeConversationId, addMessage, createNewChat, activeConversation } =
    useChat();

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    let convId = activeConversationId;
    if (!convId) {
      createNewChat();
      // Note: in a real app we'd await state update. For the mock this is fine.
      return;
    }

    addMessage(convId, {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    });

    // Simulate assistant response after short delay
    setTimeout(() => {
      addMessage(convId!, {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content:
          "This is a mock response. In a real implementation, this would be connected to an AI API.",
      });
    }, 500);

    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, activeConversationId, addMessage, createNewChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.45) + "px";
  };

  return (
    <div className="w-full px-2 pb-4 pt-2 md:px-4">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end rounded-3xl border border-gpt-gray-600 bg-gpt-gray-700 px-3 py-2 shadow-lg focus-within:border-gpt-gray-500 transition-colors">
          {/* Attachment button */}
          <button
            className="mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gpt-gray-400 hover:bg-gpt-gray-600 transition-colors"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message ChatGPT"
            rows={1}
            className="max-h-[45vh] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-gpt-gray-100 placeholder-gpt-gray-400 focus:outline-none"
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className={`mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors
              ${
                input.trim()
                  ? "bg-white text-gpt-gray-900 hover:bg-gpt-gray-200"
                  : "bg-gpt-gray-500 text-gpt-gray-700 cursor-not-allowed"
              }
            `}
            title="Send message"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Footer text */}
        <p className="mt-2 text-center text-xs text-gpt-gray-500">
          ChatGPT can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
```

**Step 3: Wire everything into page.tsx**

Replace `src/app/page.tsx`:
```tsx
import { ChatProvider } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ChatArea from "@/components/ChatArea";
import InputBar from "@/components/InputBar";

export default function Home() {
  return (
    <ChatProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gpt-gray-800">
        <Sidebar />
        <main className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <ChatArea />
          <InputBar />
        </main>
      </div>
    </ChatProvider>
  );
}
```

**Step 4: Verify** — full app works: sidebar, chat messages with markdown/code, input sends messages.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add ChatArea and InputBar, complete main UI"
```

---

### Task 7: Polish and final responsive tweaks

**Files:**
- Modify: `src/components/Sidebar.tsx` (ensure mobile hamburger works perfectly)
- Modify: `src/components/ChatArea.tsx` (empty state styling)
- Modify: `src/app/globals.css` (any final fixes)

**Step 1: Test responsive behavior**

Verify in browser:
- Desktop: sidebar visible, all features work
- Mobile (<768px): sidebar hidden, hamburger shows, sidebar slides in as overlay
- Tablet: similar to mobile behavior
- Messages display markdown, code blocks, copy buttons

**Step 2: Fix any visual issues**

Tweak spacing, colors, font sizes as needed to match ChatGPT pixel-perfect.

**Step 3: Final commit**

```bash
git add -A && git commit -m "feat: polish responsive layout and visual tweaks"
```
