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

export function getRandomMockResponse(): string {
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}
