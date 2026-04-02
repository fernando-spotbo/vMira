"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Buffer-based streaming text hook.
 *
 * Tokens arrive from SSE potentially in bursts. Instead of showing them
 * instantly, this hook queues them and drains at a controlled "fast typist"
 * pace — fast enough to feel real-time, slow enough to be readable and
 * feel like someone is writing.
 *
 * Key behaviours:
 *   - Diffs fullText against what's already queued (no reset on each update)
 *   - Drains 1–2 word-tokens per tick at ~25ms base interval
 *   - Brief pause after sentence-ending punctuation (. ! ?)
 *   - Slightly longer pause after paragraph breaks
 *   - Random jitter for organic feel
 */

// ── Tuning ──────────────────────────────────────────────────────────

/** Base interval between drain ticks (ms). */
const BASE_MS = 25;
/** Extra pause after sentence-ending punctuation. */
const PUNCT_PAUSE = 50;
/** Extra pause after a newline / paragraph break. */
const NEWLINE_PAUSE = 80;
/** Random jitter range (±ms). */
const JITTER = 8;
/** Tokens revealed per tick. */
const MIN_BATCH = 1;
const MAX_BATCH = 2;

// ── Hook ────────────────────────────────────────────────────────────

export function useStreamingText(
  fullText: string,
  isStreaming: boolean,
) {
  const [displayedText, setDisplayedText] = useState(isStreaming ? "" : fullText);
  const [isComplete, setIsComplete] = useState(!isStreaming);

  const bufferRef = useRef<string[]>([]);
  const queuedLenRef = useRef(0);
  const displayedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamEndedRef = useRef(false);
  const activeRef = useRef(false); // whether streaming session is active

  // ── Tokenise into words (preserving whitespace) ───────────────────
  const tokenize = useCallback(
    (text: string): string[] => text.match(/\S+\s*/g) || [],
    [],
  );

  // ── Delay for the last token in a batch ───────────────────────────
  const delayFor = useCallback((token: string): number => {
    let d = BASE_MS + (Math.random() * JITTER * 2 - JITTER);
    const t = token.trimEnd();
    if (/[.!?]$/.test(t)) d += PUNCT_PAUSE;
    else if (/[:;]$/.test(t)) d += PUNCT_PAUSE * 0.4;
    if (token.includes("\n")) d += NEWLINE_PAUSE;
    return d;
  }, []);

  // ── Drain one tick ────────────────────────────────────────────────
  const drain = useCallback(() => {
    const buf = bufferRef.current;

    if (buf.length === 0) {
      timerRef.current = null;
      if (streamEndedRef.current) setIsComplete(true);
      return;
    }

    const count = MIN_BATCH + Math.floor(Math.random() * (MAX_BATCH - MIN_BATCH + 1));
    const batch = buf.splice(0, count);
    displayedRef.current += batch.join("");
    setDisplayedText(displayedRef.current);

    timerRef.current = setTimeout(drain, delayFor(batch[batch.length - 1]));
  }, [delayFor]);

  // ── Start a new streaming session ─────────────────────────────────
  useEffect(() => {
    if (!isStreaming) return;
    // Reset everything for the new stream
    bufferRef.current = [];
    queuedLenRef.current = 0;
    displayedRef.current = "";
    streamEndedRef.current = false;
    activeRef.current = true;
    setDisplayedText("");
    setIsComplete(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  // Only on streaming start
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // ── Feed new content into the buffer ──────────────────────────────
  useEffect(() => {
    if (!activeRef.current) return;
    if (!isStreaming && !streamEndedRef.current) return;

    const prev = queuedLenRef.current;
    if (fullText.length <= prev) return;

    const newTokens = tokenize(fullText.slice(prev));
    queuedLenRef.current = fullText.length;
    bufferRef.current.push(...newTokens);

    // Kick drain if idle
    if (!timerRef.current) drain();
  }, [fullText, isStreaming, tokenize, drain]);

  // ── Streaming stopped externally ──────────────────────────────────
  useEffect(() => {
    if (isStreaming) return;
    streamEndedRef.current = true;
    // If buffer still has content, drain will set isComplete when done.
    // If buffer is already empty, mark complete now.
    if (bufferRef.current.length === 0 && activeRef.current) {
      // Show any remaining text that arrived in the last tick
      if (displayedRef.current !== fullText) {
        displayedRef.current = fullText;
        setDisplayedText(fullText);
      }
      setIsComplete(true);
      activeRef.current = false;
    }
    if (!timerRef.current && bufferRef.current.length > 0) drain();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // ── Non-streaming: show full text immediately ─────────────────────
  useEffect(() => {
    if (!isStreaming && !activeRef.current) {
      displayedRef.current = fullText;
      setDisplayedText(fullText);
      setIsComplete(true);
    }
  }, [fullText, isStreaming]);

  // ── Cleanup ───────────────────────────────────────────────────────
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { displayedText, isComplete };
}
