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
