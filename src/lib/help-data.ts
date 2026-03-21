export interface HelpArticle {
  slug: string;
  title: string;
  description?: string;
  content: { heading: string; body: string }[];
  related?: string[];
  updatedAt: string;
}

export interface HelpCategory {
  slug: string;
  title: string;
  description: string;
  icon: string; // emoji or icon name
  articles: HelpArticle[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Learn the basics of using Mira",
    icon: "rocket",
    articles: [
      {
        slug: "what-is-mira",
        title: "What is Mira?",
        description: "An introduction to Mira AI assistant",
        updatedAt: "2 weeks ago",
        content: [
          { heading: "What is Mira?", body: "Mira is an AI-powered conversational assistant that can help you with a wide range of tasks, from answering questions to writing code, analyzing documents, and more." },
          { heading: "How do I get started?", body: "Simply create an account and start chatting. You can type your question or request in the input field and Mira will respond with helpful, detailed answers." },
          { heading: "What can Mira do?", body: "Mira can help with writing, coding, analysis, research, brainstorming, learning, and much more. Check our Capabilities Overview for a full list of features." },
        ],
        related: ["capabilities-overview", "thinking-mode"],
      },
      {
        slug: "capabilities-overview",
        title: "Mira Capabilities Overview",
        description: "Learn about Mira's capabilities and features",
        updatedAt: "1 week ago",
        content: [
          { heading: "Text conversations", body: "Chat naturally with Mira about any topic. Mira understands context and can maintain long, detailed conversations." },
          { heading: "Thinking mode", body: "Pro and Max users can enable thinking mode for complex reasoning tasks. Mira will show its thought process step by step before providing a final answer." },
          { heading: "File uploads", body: "Upload PDF, images, and documents for Mira to analyze. Available on Pro and Max plans." },
          { heading: "Web search", body: "Mira can search the web to find current information and include sources in its responses." },
          { heading: "Code assistance", body: "Write, debug, and explain code in any programming language. Mira can also run code snippets in supported languages." },
        ],
        related: ["what-is-mira", "file-uploads"],
      },
    ],
  },
  {
    slug: "account-and-billing",
    title: "Account, login and billing",
    description: "Refund requests, billing and login issues",
    icon: "wallet",
    articles: [
      {
        slug: "managing-subscription",
        title: "Managing your subscription",
        description: "Upgrade, downgrade, or cancel your plan",
        updatedAt: "3 days ago",
        content: [
          { heading: "How do I upgrade my plan?", body: "Go to Settings > Subscription, or click on your username and select 'View all plans'. Choose the plan you want and complete the payment." },
          { heading: "How do I cancel my subscription?", body: "You can cancel anytime from Settings > Subscription. You will retain access to paid features until the end of your current billing period." },
          { heading: "Refund policy", body: "Refunds are available on a case-by-case basis. Contact support@mira.ai within 14 days of your payment to request a refund." },
        ],
        related: ["pricing-plans"],
      },
      {
        slug: "pricing-plans",
        title: "Pricing plans explained",
        description: "Free, Pro, and Max plan details",
        updatedAt: "1 week ago",
        content: [
          { heading: "Free plan", body: "20 messages per day, standard response speed, text chat, and web access. No credit card required." },
          { heading: "Pro plan ($2/mo)", body: "Thinking mode, 500 messages per day, faster responses, file uploads, extended context, chat history, and web search." },
          { heading: "Max plan ($10/mo)", body: "Everything in Pro plus unlimited messages, fastest responses, voice I/O, image understanding, longest context, and early access to new features." },
        ],
        related: ["managing-subscription"],
      },
    ],
  },
  {
    slug: "features",
    title: "Features and tools",
    description: "Guides for thinking mode, file uploads, voice, and more",
    icon: "tools",
    articles: [
      {
        slug: "thinking-mode",
        title: "How to use thinking mode",
        description: "Deep reasoning with step-by-step thought traces",
        updatedAt: "5 days ago",
        content: [
          { heading: "What is thinking mode?", body: "Thinking mode enables Mira to reason through complex problems step by step. You can see the thought process before the final answer, helping you understand the reasoning." },
          { heading: "How to enable it", body: "Thinking mode is available on Pro and Max plans. It activates automatically for complex queries, or you can request it by saying 'think through this step by step'." },
        ],
        related: ["capabilities-overview"],
      },
      {
        slug: "file-uploads",
        title: "File uploads and supported formats",
        updatedAt: "1 week ago",
        content: [
          { heading: "Supported formats", body: "Mira supports PDF, TXT, DOC, DOCX, PNG, JPG, JPEG, and GIF files. Maximum file size is 10MB per file." },
          { heading: "How to upload", body: "Click the + button in the chat input and select 'Upload file' or 'Upload image'. You can also drag and drop files into the chat." },
        ],
        related: ["thinking-mode"],
      },
      {
        slug: "voice-input",
        title: "Voice input and output",
        updatedAt: "2 weeks ago",
        content: [
          { heading: "Using voice input", body: "Click the microphone icon in the chat input to start speaking. Mira will transcribe your speech and respond. Available on Max plan." },
          { heading: "Voice output", body: "Mira can read responses aloud. Enable voice output in Settings > Preferences." },
        ],
        related: ["file-uploads"],
      },
      {
        slug: "keyboard-shortcuts",
        title: "Keyboard shortcuts",
        updatedAt: "1 month ago",
        content: [
          { heading: "Available shortcuts", body: "Ctrl+N: New chat. Ctrl+K: Search chats. Ctrl+,: Settings. Enter: Send message. Shift+Enter: New line. Escape: Close modal." },
        ],
      },
    ],
  },
  {
    slug: "privacy-and-security",
    title: "Privacy and policies",
    description: "Details on data privacy and security",
    icon: "shield",
    articles: [
      {
        slug: "data-handling",
        title: "Privacy and data handling",
        description: "How your data is stored and protected",
        updatedAt: "1 week ago",
        content: [
          { heading: "What data does Mira collect?", body: "We collect account information (name, email), usage data, and conversation content. See our Privacy Policy for full details." },
          { heading: "Is my data used for training?", body: "By default, we do not use your conversations to train our models. You can opt in through Privacy settings if you want to help improve Mira." },
          { heading: "Data storage", body: "Your data is stored on servers in the Russian Federation in compliance with Federal Law No. 152-FZ." },
        ],
        related: ["managing-subscription"],
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Fixes for frequent problems and error messages",
    icon: "wrench",
    articles: [
      {
        slug: "common-issues",
        title: "Troubleshooting common issues",
        description: "Fixes for frequent problems and common troubleshooting suggestions",
        updatedAt: "4 days ago",
        content: [
          { heading: "Mira is not responding", body: "Try refreshing the page. If the issue persists, check our status page for any ongoing incidents. Clearing your browser cache may also help." },
          { heading: "Messages not sending", body: "Ensure you have a stable internet connection. If you are on the free plan, check that you have not exceeded your daily message limit of 20 messages." },
          { heading: "Slow responses", body: "Response speed depends on your plan and current demand. Pro and Max users receive priority processing. Try again in a few minutes if responses are slow." },
        ],
      },
    ],
  },
  {
    slug: "api",
    title: "API",
    description: "Common questions related to our API",
    icon: "code",
    articles: [
      {
        slug: "api-access",
        title: "API access and documentation",
        description: "Integrate Mira into your applications",
        updatedAt: "1 week ago",
        content: [
          { heading: "Getting API access", body: "API access is billed separately from subscriptions. Create an API key from your account settings to get started. New accounts receive 100K free tokens." },
          { heading: "Pricing", body: "Mira API is priced at 300 RUB per 1M tokens (~$3.15). Batch processing is available at 150 RUB per 1M tokens." },
          { heading: "Documentation", body: "Full API documentation is available at docs.mira.ai. The API is compatible with the OpenAI format for easy migration." },
        ],
      },
    ],
  },
];

export function findCategory(slug: string) {
  return HELP_CATEGORIES.find((c) => c.slug === slug);
}

export function findArticle(categorySlug: string, articleSlug: string) {
  const cat = findCategory(categorySlug);
  if (!cat) return null;
  return cat.articles.find((a) => a.slug === articleSlug) ?? null;
}

export function findArticleBySlug(slug: string) {
  for (const cat of HELP_CATEGORIES) {
    const article = cat.articles.find((a) => a.slug === slug);
    if (article) return { category: cat, article };
  }
  return null;
}
