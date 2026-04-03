"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiCall } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────

export interface LiveStockData {
  symbol: string;
  name: string;
  price: number;
  open: number;
  previous_close: number;
  change: number;
  change_percent: number;
  high: number;
  low: number;
  currency: string;
  source: string;
  updated: string;
  chart: Array<{ time: number; price: number; is_regular: boolean }>;
}

export interface LiveWeatherData {
  city: string;
  summary: string;
  temperature: number;
  feels_like: number;
  description: string;
  icon: string;
  wind: string;
  wind_gusts: string;
  humidity: string;
  uv_index: number | null;
  precip_prob: string;
  sunrise: string;
  sunset: string;
  hourly: Array<{ time: string; temp: number; icon: string; precip: number | null }>;
  forecast: Array<{ day: string; temp: string; temp_max?: number; temp_min?: number; icon: string; precip_prob?: number }>;
}

// ── Intersection Observer helper ─────────────────────────

function useIsVisible(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return visible;
}

// ── useLiveStock ─────────────────────────────────────────

/** Poll intervals per range (ms). 1D is aggressive, longer ranges less so. */
const RANGE_INTERVALS: Record<string, number> = {
  "1d": 15_000,
  "5d": 60_000,
  "1mo": 120_000,
  "1y": 300_000,
};

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1500, 3000, 6000]; // exponential-ish backoff

/** Polls stock data while the ref element is visible. Supports range param. */
export function useLiveStock(
  symbol: string,
  initialData: LiveStockData | null,
  containerRef: React.RefObject<HTMLElement | null>,
  range: string = "1d",
) {
  const [data, setData] = useState<LiveStockData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [chartError, setChartError] = useState(false);
  const visible = useIsVisible(containerRef);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRangeRef = useRef(range);
  const intervalMs = RANGE_INTERVALS[range] || 15_000;

  // Use a ref for fetchStock so polling always calls the latest version
  const fetchStockRef = useRef<(isRangeSwitch?: boolean) => Promise<void>>(undefined);

  const fetchStock = useCallback(async (isRangeSwitch = false) => {
    if (!symbol) return;
    if (isRangeSwitch) setLoading(true);
    setChartError(false);

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Bail if range changed while we were retrying
      if (currentRangeRef.current !== range) break;

      try {
        const result = await apiCall<LiveStockData>(
          `/live/stock/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}`
        );
        if (result.ok && currentRangeRef.current === range) {
          setData((prev) => {
            const incoming = result.data;
            // If the API returned quote data but no chart, keep existing chart
            if ((!incoming.chart || incoming.chart.length === 0) && prev?.chart?.length) {
              incoming.chart = prev.chart;
            }
            if (prev && prev.price !== incoming.price && !isRangeSwitch) {
              setPrevPrice(prev.price);
              setFlash(incoming.price > prev.price ? "up" : "down");
              setTimeout(() => setFlash(null), 800);
            }
            return incoming;
          });
          setLoading(false);
          return; // success
        }
        // result.ok was false — treat as failure
        lastError = new Error(`API returned status ${result.status}`);
      } catch (e) {
        lastError = e;
      }

      // Wait before retrying (skip wait on last attempt)
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] || 3000));
      }
    }

    // All retries exhausted
    console.error("Stock chart fetch failed after retries:", lastError);
    if (isRangeSwitch) setChartError(true);
    setLoading(false);
  }, [symbol, range]);

  // Keep ref in sync
  fetchStockRef.current = fetchStock;

  // On range change: clear chart, fetch fresh data.
  // Skip the initial mount (don't destroy chart data from the AI payload).
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      currentRangeRef.current = range;
      return;
    }
    currentRangeRef.current = range;
    setChartError(false);
    // Clear chart to show loading state
    setData((prev) => prev ? { ...prev, chart: [] } : prev);
    // Clear any pending retry
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
  }, [range]);

  // Fetch when visible + range changes, and set up polling
  useEffect(() => {
    if (!visible || !symbol) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    // Fetch fresh data — only show loading spinner if chart is empty
    fetchStockRef.current?.(!data?.chart?.length);

    timerRef.current = setInterval(() => {
      fetchStockRef.current?.(false);
    }, intervalMs);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [visible, symbol, range, intervalMs]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Manual retry (exposed for tap-to-retry UI)
  const retry = useCallback(() => {
    fetchStockRef.current?.(true);
  }, []);

  return { data, loading, prevPrice, flash, chartError, retry };
}

// ── useLiveWeather ───────────────────────────────────────

/** Polls weather data every `intervalMs` while the ref element is visible. */
export function useLiveWeather(
  city: string,
  initialData: LiveWeatherData | null,
  containerRef: React.RefObject<HTMLElement | null>,
  intervalMs = 300_000, // 5 minutes
) {
  const [data, setData] = useState<LiveWeatherData | null>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const visible = useIsVisible(containerRef);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWeather = useCallback(async () => {
    if (!city) return;
    try {
      const result = await apiCall<LiveWeatherData>(`/live/weather/${encodeURIComponent(city)}`);
      if (result.ok) {
        setData(result.data);
        setLastUpdated(new Date());
      }
    } catch {
      // Silent fail
    }
  }, [city]);

  useEffect(() => {
    if (!visible || !city) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    fetchWeather();
    timerRef.current = setInterval(fetchWeather, intervalMs);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [visible, city, intervalMs, fetchWeather]);

  return { data, lastUpdated };
}
