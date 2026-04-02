import type { MessageStep } from "./types";

const mockResponses = [
  `That's a great question! Let me break it down for you.

The key thing to understand is that this concept builds on several fundamental principles. Here's a quick overview:

1. **Start with the basics** — make sure you have a solid foundation
2. **Practice regularly** — consistency beats intensity
3. **Ask questions** — there's no such thing as a dumb question

Would you like me to go deeper into any of these points?`,

  `Here's a simple example to illustrate:

\`\`\`python
def greet(name: str) -> str:
    return f"Hello, {name}! Welcome aboard."

# Usage
message = greet("World")
print(message)  # Hello, World! Welcome aboard.
\`\`\`

This pattern is commonly used when you need to create reusable, composable functions. Let me know if you'd like to see more advanced examples!`,

  `Good thinking! Here are a few approaches you could consider:

- **Option A**: The straightforward approach — simple to implement, easy to maintain
- **Option B**: More scalable — better for long-term projects with growing complexity
- **Option C**: The hybrid — combines the best of both worlds

I'd personally recommend **Option B** for most use cases, but it really depends on your specific requirements. What are you optimizing for?`,

  `Absolutely! Here's what you need to know:

## Quick Summary

The main takeaway is that **simplicity wins**. Don't over-engineer your solution when a straightforward approach will do.

## Key Points

- Keep your code readable and well-organized
- Write tests for critical paths
- Document your decisions, not just your code
- Refactor when patterns emerge, not before

> "Premature optimization is the root of all evil." — Donald Knuth

Is there a specific aspect you'd like me to elaborate on?`,

  `Here's a comparison that might help:

| Feature | Approach A | Approach B |
|---------|-----------|-----------|
| Speed | Fast | Moderate |
| Complexity | Low | Medium |
| Scalability | Limited | High |
| Maintenance | Easy | Moderate |

\`\`\`javascript
// Approach A - Simple and direct
const result = data.filter(item => item.active).map(item => item.name);

// Approach B - More flexible
const pipeline = compose(
  filter(isActive),
  map(getName),
  sort(byDate)
);
const result = pipeline(data);
\`\`\`

Both are valid — choose based on your project's needs!`,
];

// Responses that follow the ChatGPT pattern:
// text → reasoning block → text → search block → text
const steppedResponses: { steps: MessageStep[]; content: string }[] = [
  {
    // Pattern: thinking → text → search → text → search → final text
    steps: [
      {
        type: "text",
        content: "Good question — let me look into what's currently available and give you an accurate picture.",
      },
      {
        type: "reasoning",
        summary: "Considered existing options and recognized need for current data",
        thinking: "The user is asking about AI coding tools. This space evolves rapidly — Copilot, Cursor, and several new players have launched or updated recently. I should search for the latest comparisons rather than rely on potentially outdated knowledge.",
        searches: [
          {
            query: "best AI coding assistants comparison 2026",
            resultCount: 6,
            results: [
              { title: "Top AI Coding Tools Ranked for 2026", domain: "techreview.com" },
              { title: "The Best AI Pair Programmers", domain: "stackoverflow.blog" },
              { title: "AI Code Assistants: Complete Guide", domain: "dev.to" },
            ],
          },
        ],
      },
      {
        type: "text",
        content: "The landscape has shifted quite a bit. Let me verify the latest pricing to make sure I'm accurate.",
      },
      {
        type: "reasoning",
        summary: "Searched the web",
        searches: [
          {
            query: "AI coding assistant pricing tiers 2026",
            resultCount: 4,
            results: [
              { title: "AI Tool Pricing Comparison", domain: "cloudcompare.io" },
              { title: "Developer Tool Costs: What to Expect", domain: "infoworld.com" },
            ],
          },
        ],
      },
      {
        type: "text",
        content: "Here's what the latest data shows:\n\n| Tool | Free Tier | Pro Price | Key Strength |\n|------|-----------|-----------|---------------|\n| Copilot | Limited | $19/mo | Deep IDE integration |\n| Cursor | 50 requests | $20/mo | Full-file edits |\n| Mira Code | 30 requests | $5/mo | Reasoning + search |\n\n**My recommendation**: For most developers, the sweet spot is a tool that integrates reasoning with code context. The trend is moving away from simple autocomplete toward **agentic coding** — where the AI can plan, search, and execute multi-step changes.\n\nWant me to dive deeper into any specific tool?",
      },
    ],
    content: "Here's what the latest data shows:\n\n| Tool | Free Tier | Pro Price | Key Strength |\n|------|-----------|-----------|---------------|\n| Copilot | Limited | $19/mo | Deep IDE integration |\n| Cursor | 50 requests | $20/mo | Full-file edits |\n| Mira Code | 30 requests | $5/mo | Reasoning + search |\n\n**My recommendation**: For most developers, the sweet spot is a tool that integrates reasoning with code context.",
  },
  {
    // Pattern: text → thinking → text
    steps: [
      {
        type: "reasoning",
        summary: "Analyzed the problem and evaluated multiple approaches",
        thinking: "This is a setup/configuration question. I should provide a concrete, copy-pasteable example rather than abstract guidance. TypeScript is likely what they're using given the context. I'll show the client pattern with proper types and error handling considerations.",
      },
      {
        type: "text",
        content: "Great question. Let me walk you through the recommended approach.\n\n## Getting Started\n\nThe simplest way to begin is with this pattern:\n\n```typescript\ninterface Config {\n  apiKey: string;\n  baseUrl?: string;\n  timeout?: number;\n}\n\nconst client = createClient({\n  apiKey: process.env.API_KEY,\n  baseUrl: \"https://api.example.com/v1\",\n  timeout: 30000,\n});\n\nconst response = await client.chat({\n  messages: [{ role: \"user\", content: \"Hello!\" }],\n});\n```\n\n## Key Considerations\n\n- **Error handling** — Always wrap API calls in try/catch blocks\n- **Rate limiting** — Implement exponential backoff for retries\n- **Streaming** — Use streaming responses for better UX on longer outputs\n\nThis should get you up and running quickly. Need help with any specific part?",
      },
    ],
    content: "Great question. Let me walk you through the recommended approach.\n\n## Getting Started\n\nThe simplest way to begin is with this pattern...",
  },
  {
    // Pattern: text → thinking+search → text → search → text (multiple rounds)
    steps: [
      {
        type: "text",
        content: "Let me research this to give you the most accurate and up-to-date answer.",
      },
      {
        type: "reasoning",
        summary: "Explored current market landscape and verified availability",
        thinking: "Cloud pricing changes frequently — AWS, Azure, and GCP all had pricing adjustments in Q1 2026. I need to search for the latest numbers rather than guessing. I should also check the serverless vs containers angle since that's where the real cost savings are happening.",
        searches: [
          {
            query: "cloud computing pricing comparison 2026",
            resultCount: 5,
            results: [
              { title: "Cloud Pricing Guide 2026", domain: "cloudcompare.io" },
              { title: "AWS vs Azure vs GCP: 2026 Edition", domain: "techcrunch.com" },
              { title: "Best Cloud for Startups", domain: "hackernoon.com" },
            ],
          },
        ],
      },
      {
        type: "text",
        content: "Interesting — pricing has changed since last quarter. Let me check the serverless angle too.",
      },
      {
        type: "reasoning",
        summary: "Searched the web",
        searches: [
          {
            query: "serverless vs containers cost analysis 2026",
            resultCount: 4,
            results: [
              { title: "Serverless vs Containers: The Real Cost", domain: "martinfowler.com" },
              { title: "When to Go Serverless", domain: "aws.amazon.com" },
            ],
          },
        ],
      },
      {
        type: "text",
        content: "Here's the full picture:\n\n| Provider | Compute (vCPU/hr) | Storage (GB/mo) | Free Tier |\n|----------|-------------------|------------------|-----------|\n| AWS | $0.042 | $0.023 | 12 months |\n| Azure | $0.040 | $0.021 | 12 months |\n| GCP | $0.038 | $0.020 | Always free |\n\n**My recommendation**: For startups, GCP has the best value with sustained-use discounts. For enterprise, AWS has the broadest ecosystem.\n\nThe big trend is **serverless-first** — most teams see 30-50% cost savings after migration since you eliminate idle compute costs entirely.\n\nWant me to help estimate costs for your specific workload?",
      },
    ],
    content: "Here's the full picture with pricing comparisons and recommendations...",
  },
];

export function getRandomMockResponse(): string {
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

export function getRandomSteppedResponse(): { steps: MessageStep[]; content: string } | null {
  // 50% chance of a stepped response
  if (Math.random() > 0.5) return null;
  return steppedResponses[Math.floor(Math.random() * steppedResponses.length)];
}
