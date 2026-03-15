"use client";

import { useState, useEffect, useRef } from "react";

export function useStreamingText(
  fullText: string,
  isStreaming: boolean,
  speed: number = 20 // ms per token
) {
  const [displayedText, setDisplayedText] = useState(isStreaming ? "" : fullText);
  const [isComplete, setIsComplete] = useState(!isStreaming);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(fullText);
      setIsComplete(true);
      return;
    }

    indexRef.current = 0;
    setDisplayedText("");
    setIsComplete(false);

    // Split into tokens (words + punctuation + whitespace)
    const tokens = fullText.match(/\S+\s*/g) || [];

    const interval = setInterval(() => {
      if (indexRef.current < tokens.length) {
        // Add 1-3 tokens per tick for natural feel
        const batch = Math.floor(Math.random() * 3) + 1;
        const end = Math.min(indexRef.current + batch, tokens.length);
        const newText = tokens.slice(0, end).join("");
        setDisplayedText(newText);
        indexRef.current = end;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed + Math.random() * 15);

    return () => clearInterval(interval);
  }, [fullText, isStreaming, speed]);

  return { displayedText, isComplete };
}
