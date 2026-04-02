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
  const visible = useIsVisible(containerRef);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRangeRef = useRef(range);
  const intervalMs = RANGE_INTERVALS[range] || 15_000;

  const fetchStock = useCallback(async (isRangeSwitch = false) => {
    if (!symbol) return;
    if (isRangeSwitch) setLoading(true);
    try {
      const result = await apiCall<LiveStockData>(
        `/live/stock/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}`
      );
      if (result.ok && currentRangeRef.current === range) {
        setData((prev) => {
          if (prev && prev.price !== result.data.price && !isRangeSwitch) {
            setPrevPrice(prev.price);
            setFlash(result.data.price > prev.price ? "up" : "down");
            setTimeout(() => setFlash(null), 800);
          }
          return result.data;
        });
      }
    } catch {
      // Silent fail — keep showing last data
    } finally {
      setLoading(false);
    }
  }, [symbol, range]);

  // On range change: clear chart immediately so user sees loading, then fetch
  useEffect(() => {
    currentRangeRef.current = range;
    // Keep the price/name but clear chart to indicate loading
    setData((prev) => prev ? { ...prev, chart: [] } : prev);
    if (visible && symbol) fetchStock(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Polling loop
  useEffect(() => {
    if (!visible || !symbol) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    // Only start immediately if we have no data yet (range switch handled above)
    if (!data?.chart?.length) fetchStock(true);

    timerRef.current = setInterval(() => fetchStock(false), intervalMs);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, symbol, intervalMs]);

  return { data, loading, prevPrice, flash };
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
