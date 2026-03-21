/**
 * API client for billing & payments.
 *
 * All calls go through the Next.js proxy (see api-client.ts).
 * During development mock data is used on the frontend;
 * swap to real calls once the backend billing service is live.
 */

import { apiCall } from "./api-client";

// ---- Types ----

export interface Balance {
  balance_kopecks: number;
  balance_rubles: string;
}

export interface Transaction {
  id: string;
  type: "topup" | "charge" | "refund";
  amount_kopecks: number;
  amount_rubles: string;
  description: string;
  payment_method?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;
}

export interface ModelPricing {
  model: string;
  label: string;
  speed: string;
  input_per_1k: number;
  output_per_1k: number;
  best_for: string;
}

export interface PricingInfo {
  models: ModelPricing[];
}

export interface TopupResponse {
  payment_id: string;
  redirect_url: string;
}

export interface SpendingDay {
  date: string;
  amount_kopecks: number;
}

export interface ModelSpending {
  model: string;
  label: string;
  amount_kopecks: number;
  amount_rubles: string;
  input_tokens: number;
  output_tokens: number;
}

export interface UsageStats {
  today_kopecks: number;
  today_rubles: string;
  week_kopecks: number;
  week_rubles: string;
  month_kopecks: number;
  month_rubles: string;
}

// ---- API calls ----

export async function getBalance() {
  return apiCall<Balance>("/billing/balance");
}

export async function getTransactions(limit = 20, offset = 0) {
  return apiCall<{ transactions: Transaction[]; total: number }>(
    `/billing/transactions?limit=${limit}&offset=${offset}`,
  );
}

export async function getPricing() {
  return apiCall<PricingInfo>("/billing/pricing");
}

export async function getSpending(days = 7) {
  return apiCall<{ days: SpendingDay[] }>(`/billing/spending?days=${days}`);
}

export async function getModelSpending() {
  return apiCall<{ models: ModelSpending[] }>("/billing/spending/models");
}

export async function getUsageStats() {
  return apiCall<UsageStats>("/billing/usage-stats");
}

export async function createTopup(amountRubles: number, returnUrl: string) {
  return apiCall<TopupResponse>("/billing/topup", {
    method: "POST",
    body: JSON.stringify({ amount_rubles: amountRubles, return_url: returnUrl }),
  });
}
