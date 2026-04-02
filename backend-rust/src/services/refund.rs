//! Refund service — sends crypto back to user's wallet via CryptoCloud withdrawal API.
//!
//! Refund policy:
//! - Within 3 days of subscription: full refund
//! - Days 4-20: prorated (unused days / 30 × amount)
//! - After day 20: no refund
//!
//! Anti-abuse:
//! - Max 2 refunds per user per 90 days (prevents refund farming)
//! - Advisory lock on subscription ID (prevents double-refund race condition)
//! - Subscription marked 'refunded' atomically (no replay)
//! - Cooldown: 30 days after refund before user can re-subscribe to same product

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;

const FULL_REFUND_DAYS: i64 = 3;
const MAX_REFUND_DAYS: i64 = 20;
const SUBSCRIPTION_DAYS: i64 = 30;
const REFUND_CURRENCY: &str = "USDT_TRC20";
const MAX_REFUNDS_PER_90_DAYS: i64 = 2;
const REFUND_COOLDOWN_DAYS: i64 = 30;

/// Calculate refund amount in kopecks based on subscription age.
pub fn calculate_refund(amount_kopecks: i64, started_at: chrono::DateTime<Utc>) -> Result<i64, AppError> {
    let now = Utc::now();
    let days_used = (now - started_at).num_days();

    if days_used < 0 {
        return Err(AppError::Internal("Subscription start date is in the future".to_string()));
    }

    if days_used <= FULL_REFUND_DAYS {
        Ok(amount_kopecks)
    } else if days_used <= MAX_REFUND_DAYS {
        let unused_days = SUBSCRIPTION_DAYS - days_used;
        let refund = (amount_kopecks * unused_days) / SUBSCRIPTION_DAYS;
        Ok(refund.max(0))
    } else {
        Err(AppError::BadRequest(
            "Refund period has expired. Refunds are available within 20 days of subscription.".to_string()
        ))
    }
}

/// Process a refund with full anti-abuse protection.
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

    if wallet_address.len() < 20 || wallet_address.len() > 128 {
        return Err(AppError::BadRequest("Invalid wallet address".to_string()));
    }

    // Validate currency if provided
    let refund_currency = currency.unwrap_or(REFUND_CURRENCY);
    let valid_currencies = [
        "USDT_TRC20", "USDT_TON", "USDT_BSC", "USDT_SOL", "USDT_ARB",
        "USDC_BSC", "USDC_SOL", "USDC_BASE", "USDC_ARB",
    ];
    if !valid_currencies.contains(&refund_currency) {
        return Err(AppError::BadRequest(format!(
            "Refund currency must be a stablecoin: {}",
            valid_currencies.join(", ")
        )));
    }

    // ── Anti-abuse check: max refunds per 90 days ──────────
    let recent_refunds: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM subscriptions
         WHERE user_id = $1 AND status = 'refunded'
         AND created_at >= NOW() - INTERVAL '90 days'"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if recent_refunds.0 >= MAX_REFUNDS_PER_90_DAYS {
        return Err(AppError::BadRequest(format!(
            "Maximum {} refunds per 90 days reached. Contact support for assistance.",
            MAX_REFUNDS_PER_90_DAYS
        )));
    }

    // ── Advisory lock on subscription ID (prevent double-refund race) ──
    let lock_key = {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        subscription_id.hash(&mut h);
        h.finish() as i64
    };

    sqlx::query("SELECT pg_advisory_lock($1)")
        .bind(lock_key)
        .execute(pool)
        .await?;

    let result = async {
        // Get the subscription (re-check inside lock)
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
            return Err(AppError::BadRequest(
                "Only active subscriptions can be refunded".to_string(),
            ));
        }

        // Calculate refund amount
        let refund_kopecks = calculate_refund(sub.amount_kopecks, sub.started_at)?;
        let refund_rubles = refund_kopecks as f64 / 100.0;

        // Convert RUB to USDT (approximate rate)
        // TODO: fetch live rate from exchange API for production
        let usdt_amount = refund_rubles / 95.0;

        if usdt_amount < 0.01 {
            return Err(AppError::BadRequest("Refund amount too small".to_string()));
        }

        // Round to 6 decimal places
        let usdt_amount = (usdt_amount * 1_000_000.0).round() / 1_000_000.0;

        // ── Call CryptoCloud withdrawal API ──────────────────
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
                tracing::error!(error = %e, "CryptoCloud withdrawal failed");
                AppError::Internal("Refund service unavailable".to_string())
            })?;

        let status = response.status();
        let body: serde_json::Value = response.json().await.unwrap_or_default();

        if !status.is_success() || body["status"].as_str() != Some("success") {
            tracing::error!(status = %status, body = %body, "CryptoCloud withdrawal rejected");
            return Err(AppError::Internal(
                "Refund transfer failed. Please contact support.".to_string(),
            ));
        }

        let withdrawal_id = body["result"]["uuid"].as_str().unwrap_or("unknown").to_string();

        // ── Atomic: cancel subscription + downgrade plan + record ──
        let now = Utc::now();
        let mut tx = pool.begin().await?;

        sqlx::query("UPDATE subscriptions SET status = 'refunded' WHERE id = $1")
            .bind(subscription_id)
            .execute(&mut *tx)
            .await?;

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

        sqlx::query(
            "INSERT INTO transactions (id, user_id, type, amount_kopecks, balance_after_kopecks, description, payment_id, payment_method, created_at)
             VALUES ($1, $2, 'refund', $3, (SELECT balance_kopecks FROM users WHERE id = $2), $4, $5, $6, $7)"
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(refund_kopecks)
        .bind(format!("Refund: {} {} → {} {}", sub.product, sub.plan, usdt_amount, refund_currency))
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
            usdt = %usdt_amount,
            withdrawal_id = %withdrawal_id,
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
    .await;

    // Always release lock
    let _ = sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(lock_key)
        .execute(pool)
        .await;

    result
}

/// Check if a user is in a refund cooldown period for a product.
/// Returns true if they can subscribe, false if still in cooldown.
pub async fn can_subscribe(pool: &PgPool, user_id: Uuid, product: &str) -> Result<bool, AppError> {
    let recent_refund: Option<(chrono::DateTime<Utc>,)> = sqlx::query_as(
        "SELECT created_at FROM subscriptions
         WHERE user_id = $1 AND product = $2 AND status = 'refunded'
         ORDER BY created_at DESC LIMIT 1"
    )
    .bind(user_id)
    .bind(product)
    .fetch_optional(pool)
    .await?;

    if let Some((refund_date,)) = recent_refund {
        let cooldown_ends = refund_date + chrono::Duration::days(REFUND_COOLDOWN_DAYS);
        if Utc::now() < cooldown_ends {
            return Ok(false);
        }
    }

    Ok(true)
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
