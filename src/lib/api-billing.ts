/**
 * API client for billing & payments (CryptoCloud).
 *
 * All calls go through the Next.js proxy → HMAC-signed → backend.
 */

import { apiCall } from "./api-client";

// ---- Types matching backend schema ----

export interface SpendingSummary {
  today_kopecks: number;
  week_kopecks: number;
  month_kopecks: number;
  by_model: { model: string; total_kopecks: number; total_requests: number; total_input_tokens: number; total_output_tokens: number }[];
}

export interface Balance {
  balance_kopecks: number;
  balance_rubles: string;
  spending: SpendingSummary;
}

export interface Transaction {
  id: string;
  type: "topup" | "charge" | "refund" | "bonus" | "adjustment";
  amount_kopecks: number;
  amount_rubles: string;
  balance_after_kopecks: number;
  description: string | null;
  payment_method: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface TopupResponse {
  payment_url: string;
  payment_id: string;
  amount_kopecks: number;
  provider: string;
}

// ---- API calls ----

export async function getBalance() {
  return apiCall<Balance>("/billing/balance");
}

export async function getTransactions(limit = 50, offset = 0) {
  return apiCall<Transaction[]>(
    `/billing/transactions?limit=${limit}&offset=${offset}`,
  );
}

export async function createTopup(amountRubles: number, returnUrl: string) {
  return apiCall<TopupResponse>("/billing/topup", {
    method: "POST",
    body: JSON.stringify({ amount_rubles: amountRubles, return_url: returnUrl }),
  });
}
