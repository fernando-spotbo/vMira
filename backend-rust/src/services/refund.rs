//! Refund service — sends crypto back to user's wallet via CryptoCloud withdrawal API.
//!
//! Refund policy:
//! - Within 3 days of subscription: full refund
//! - Days 4-20: prorated (unused days / 30 × amount)
//! - After day 20: no refund
//!
//! Refunds are sent in USDT on the cheapest available network (TRC20 default).
//! The CryptoCloud withdrawal API is rate-limited to 1 request per 12 seconds.

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;

/// Refund policy constants
const FULL_REFUND_DAYS: i64 = 3;
const MAX_REFUND_DAYS: i64 = 20;
const SUBSCRIPTION_DAYS: i64 = 30;

/// Default refund currency (cheapest network)
const REFUND_CURRENCY: &str = "USDT_TRC20";

/// Calculate refund amount in kopecks based on subscription age.
pub fn calculate_refund(amount_kopecks: i64, started_at: chrono::DateTime<Utc>) -> Result<i64, AppError> {
    let now = Utc::now();
    let days_used = (now - started_at).num_days();

    if days_used < 0 {
        return Err(AppError::Internal("Subscription start date is in the future".to_string()));
    }

    if days_used <= FULL_REFUND_DAYS {
        // Full refund within grace period
        Ok(amount_kopecks)
    } else if days_used <= MAX_REFUND_DAYS {
        // Prorated refund
        let unused_days = SUBSCRIPTION_DAYS - days_used;
        let refund = (amount_kopecks * unused_days) / SUBSCRIPTION_DAYS;
        Ok(refund.max(0))
    } else {
        // Too late for refund
        Err(AppError::BadRequest(
            "Refund period has expired. Refunds are available within 20 days of subscription.".to_string()
        ))
    }
}

/// Process a refund: cancel subscription, send crypto to user's wallet.
pub async fn process_refund(
    pool: &PgPool,
    config: &Config,
    user_id: Uuid,
    subscription_id: Uuid,
    wallet_address: &str,
    currency: Option<&str>,
) -> Result<RefundResult, AppError> {
    if config.cryptocloud_withdrawal_api_key.is_empty() {
        return Err(AppError::Internal("Withdrawal API not configured".to_string()));
    }

    // Validate wallet address (basic check)
    if wallet_address.len() < 20 || wallet_address.len() > 128 {
        return Err(AppError::BadRequest("Invalid wallet address".to_string()));
    }

    let refund_currency = currency.unwrap_or(REFUND_CURRENCY);

    // Get the subscription
    let sub: Option<SubscriptionRow> = sqlx::query_as(
        "SELECT id, user_id, product, plan, started_at, expires_at, amount_kopecks, status, payment_id
         FROM subscriptions WHERE id = $1 AND user_id = $2"
    )
    .bind(subscription_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let sub = sub.ok_or_else(|| AppError::NotFound("Subscription not found".to_string()))?;

    if sub.status != "active" {
        return Err(AppError::BadRequest("Only active subscriptions can be refunded".to_string()));
    }

    // Calculate refund amount
    let refund_kopecks = calculate_refund(sub.amount_kopecks, sub.started_at)?;
    let refund_rubles = refund_kopecks as f64 / 100.0;

    // Convert RUB to USDT (approximate: 1 USDT ≈ 95 RUB as of 2026)
    // In production: fetch live rate from CryptoCloud or exchange API
    let usdt_amount = refund_rubles / 95.0;

    if usdt_amount < 0.01 {
        return Err(AppError::BadRequest("Refund amount too small to process".to_string()));
    }

    // Call CryptoCloud withdrawal API
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.cryptocloud.plus/v2/invoice/api/out/create")
        .header("Authorization", format!("Token {}", config.cryptocloud_withdrawal_api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "currency_code": refund_currency,
            "to_address": wallet_address,
            "amount": usdt_amount,
        }))
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "CryptoCloud withdrawal API failed");
            AppError::Internal("Refund service unavailable".to_string())
        })?;

    let status = response.status();
    let body: serde_json::Value = response.json().await.unwrap_or_default();

    if !status.is_success() || body["status"].as_str() != Some("success") {
        tracing::error!(status = %status, body = %body, "CryptoCloud withdrawal failed");
        return Err(AppError::Internal("Refund transfer failed. Please contact support.".to_string()));
    }

    let withdrawal_id = body["result"]["uuid"].as_str().unwrap_or("unknown").to_string();

    // Cancel subscription
    let now = Utc::now();
    let mut tx = pool.begin().await?;

    sqlx::query("UPDATE subscriptions SET status = 'refunded' WHERE id = $1")
        .bind(subscription_id)
        .execute(&mut *tx)
        .await?;

    // Downgrade user plan
    let (plan_col, expires_col) = match sub.product.as_str() {
        "chat" => ("chat_plan", "chat_plan_expires_at"),
        "code" => ("code_plan", "code_plan_expires_at"),
        _ => return Err(AppError::Internal("Invalid product".to_string())),
    };

    let query = format!(
        "UPDATE users SET {plan_col} = 'free', {expires_col} = NULL, updated_at = $1 WHERE id = $2"
    );
    sqlx::query(&query)
        .bind(now)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    // Record refund transaction
    sqlx::query(
        "INSERT INTO transactions (id, user_id, type, amount_kopecks, balance_after_kopecks, description, payment_id, payment_method, created_at)
         VALUES ($1, $2, 'refund', $3, (SELECT balance_kopecks FROM users WHERE id = $2), $4, $5, $6, $7)"
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(refund_kopecks)
    .bind(format!("Refund: {} {} subscription", sub.product, sub.plan))
    .bind(&withdrawal_id)
    .bind(format!("crypto_out:{}", refund_currency))
    .bind(now)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        user_id = %user_id,
        subscription_id = %subscription_id,
        refund_kopecks = %refund_kopecks,
        usdt_amount = %usdt_amount,
        withdrawal_id = %withdrawal_id,
        wallet = %wallet_address,
        "Refund processed"
    );

    Ok(RefundResult {
        refund_kopecks,
        usdt_amount,
        currency: refund_currency.to_string(),
        wallet_address: wallet_address.to_string(),
        withdrawal_id,
        days_used: (now - sub.started_at).num_days(),
    })
}

#[derive(Debug, serde::Serialize)]
pub struct RefundResult {
    pub refund_kopecks: i64,
    pub usdt_amount: f64,
    pub currency: String,
    pub wallet_address: String,
    pub withdrawal_id: String,
    pub days_used: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct SubscriptionRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub product: String,
    pub plan: String,
    pub started_at: chrono::DateTime<Utc>,
    pub expires_at: chrono::DateTime<Utc>,
    pub amount_kopecks: i64,
    pub status: String,
    pub payment_id: Option<String>,
}
