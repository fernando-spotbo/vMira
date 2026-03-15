# ChatGPT Frontend Clone — Design Document

**Date:** 2026-03-15
**Status:** Approved

## Goal

Build a pixel-perfect, frontend-only, fully responsive clone of ChatGPT's UI using Next.js 15 (App Router) + TypeScript + Tailwind CSS.

## Decisions

- **Frontend only** — no backend, no AI API calls, mock/static data
- **Next.js 15 + Tailwind CSS + TypeScript** — modern stack
- **Pixel-perfect** — match ChatGPT's current design as closely as possible
- **Full feature set** — sidebar, conversation history, model selector, user menu, code blocks, markdown, copy buttons, attachments button
- **Fully responsive** — collapsible sidebar on mobile/tablet
- **Approach A (component-per-section)** — clean separation, each UI section is its own component

## Reference Repos

- **LibreChat** (danny-avila/LibreChat, MIT) — primary visual/architectural reference for Tailwind + Radix UI components (sidebar, chat, model selector, code blocks). 34k+ stars, closest to ChatGPT's real UI.
- **IndrajeetPatil/chatgpt-clone** — reference for markdown rendering patterns (react-markdown + react-code-blocks).
- **ZiadGamalDev/chatgpt-clone-frontend** — stack reference (Next.js 15 App Router + TS + Tailwind).

## Architecture

### Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- react-markdown + rehype-highlight (markdown + syntax-highlighted code blocks)
- lucide-react (icons)

### Component Tree

```
App (layout.tsx)
├── Sidebar
│   ├── NewChatButton
│   ├── ConversationList
│   │   └── ConversationItem (per conversation)
│   └── UserMenu (avatar + dropdown)
├── Main
│   ├── TopBar
│   │   ├── ModelSelector (dropdown)
│   │   └── HamburgerToggle (mobile only)
│   ├── ChatArea (scrollable)
│   │   └── MessageBubble (per message)
│   │       ├── Markdown content
│   │       ├── CodeBlock (syntax highlighted, copy button)
│   │       └── ActionButtons (copy, thumbs up/down)
│   └── InputBar
│       ├── AutoResizeTextarea
│       ├── AttachmentButton
│       └── SendButton
```

### State Management

- React `useState` + `useContext` for:
  - Active conversation
  - Sidebar open/closed
  - Conversation list
  - Messages per conversation
- No external state library needed for a frontend-only clone

### Mock Data

- Static JSON file with 3-4 sample conversations
- Varied content: plain text, code blocks (multiple languages), lists, markdown formatting
- Simulates both user and assistant messages

### Design Tokens (ChatGPT's palette)

- Sidebar background: `#171717`
- Main background: `#212121`
- Input background: `#2f2f2f`
- Text primary: `#ececec`
- Text secondary: `#b4b4b4`
- Accent/hover: `#2f2f2f`
- User message bubble: `#2f2f2f`
- Send button active: `#ffffff`
- Dark theme by default

### Responsive Behavior

- **Desktop (>768px):** Sidebar visible, fixed width ~260px
- **Mobile (<768px):** Sidebar hidden by default, slides in as overlay with hamburger toggle
- Smooth CSS transitions for sidebar collapse/expand

### Key UI Details

- Auto-scroll to bottom on new messages
- Textarea auto-resizes with content
- Code blocks with language label + copy button
- Typing simulation with mock responses (optional enhancement)
- Conversation list shows truncated last message
