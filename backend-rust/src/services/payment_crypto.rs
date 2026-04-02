//! CryptoCloud payment integration for cryptocurrency top-ups.
//!
//! API docs: <https://docs.cryptocloud.plus/en>
//!
//! This module implements the `PaymentProvider` trait, making it swappable
//! with any other provider (e.g., NOWPayments, CoinGate, Plisio).

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;
use crate::services::billing;
use crate::services::payment_provider::{PaymentProvider, PaymentResult, WebhookResult};

// ── CryptoCloud provider ────────────────────────────────────────

pub struct CryptoCloudProvider;

impl PaymentProvider for CryptoCloudProvider {
    fn name(&self) -> &'static str {
        "cryptocloud"
    }

    fn is_configured(&self, config: &Config) -> bool {
        !config.cryptocloud_api_key.is_empty()
            && !config.cryptocloud_shop_id.is_empty()
            && !config.cryptocloud_secret_key.is_empty()
    }
}

// ── CryptoCloud API types ───────────────────────────────────────

#[derive(Debug, Serialize)]
struct CreateInvoiceRequest {
    shop_id: String,
    amount: f64,
    currency: String,
    order_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CryptoCloudResponse {
    status: String,
    result: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct InvoiceResult {
    uuid: String,
    link: String,
}

// ── CryptoCloud webhook types ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CryptoCloudPostback {
    pub status: String,
    pub invoice_id: String,
    pub amount_crypto: f64,
    pub currency: String,
    pub order_id: Option<String>,
    pub token: Option<String>,
    pub invoice_info: Option<CryptoCloudInvoiceInfo>,
}

#[derive(Debug, Deserialize)]
pub struct CryptoCloudInvoiceInfo {
    pub uuid: Option<String>,
    pub status: Option<String>,
    pub invoice_status: Option<String>,
    pub amount_in_fiat: Option<f64>,
    pub amount_usd: Option<f64>,
}

// ── Invoice creation ────────────────────────────────────────────

/// Create a CryptoCloud invoice and return the payment page URL.
pub async fn create_payment(
    config: &Config,
    user_id: Uuid,
    amount_kopecks: i64,
    user_email: Option<&str>,
) -> Result<PaymentResult, AppError> {
    let provider = CryptoCloudProvider;
    if !provider.is_configured(config) {
        return Err(AppError::Internal(
            "Crypto payment system not configured".to_string(),
        ));
    }

    if amount_kopecks < 100 {
        return Err(AppError::BadRequest(
            "Minimum top-up amount is 1.00 RUB".to_string(),
        ));
    }

    let amount_rubles = amount_kopecks as f64 / 100.0;
    // Encode user_id in order_id for webhook extraction
    let order_id = format!("mira-{}-{}", user_id, Uuid::new_v4());

    let body = CreateInvoiceRequest {
        shop_id: config.cryptocloud_shop_id.clone(),
        amount: amount_rubles,
        currency: "RUB".to_string(),
        order_id: order_id.clone(),
        email: user_email.map(|e| e.to_string()),
    };

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.cryptocloud.plus/v2/invoice/create")
        .header("Authorization", format!("Token {}", config.cryptocloud_api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "CryptoCloud API request failed");
            AppError::Internal("Crypto payment service unavailable".to_string())
        })?;

    let status = response.status();
    if !status.is_success() {
        let error_body = response.text().await.unwrap_or_default();
        tracing::error!(status = %status, body = %error_body, "CryptoCloud API error");
        return Err(AppError::Internal(
            "Crypto payment creation failed".to_string(),
        ));
    }

    let cc_response: CryptoCloudResponse = response.json().await.map_err(|e| {
        tracing::error!(error = %e, "Failed to parse CryptoCloud response");
        AppError::Internal("Crypto payment service error".to_string())
    })?;

    if cc_response.status != "success" {
        tracing::error!(status = %cc_response.status, "CryptoCloud returned non-success");
        return Err(AppError::Internal(
            "Crypto payment creation failed".to_string(),
        ));
    }

    let invoice: InvoiceResult = serde_json::from_value(cc_response.result).map_err(|e| {
        tracing::error!(error = %e, "Failed to parse CryptoCloud invoice result");
        AppError::Internal("Crypto payment service error".to_string())
    })?;

    tracing::info!(
        invoice_uuid = %invoice.uuid,
        user_id = %user_id,
        amount_kopecks = %amount_kopecks,
        order_id = %order_id,
        "CryptoCloud invoice created"
    );

    Ok(PaymentResult {
        payment_url: invoice.link,
        payment_id: invoice.uuid,
        provider: "cryptocloud".to_string(),
    })
}

// ── Webhook handling ────────────────────────────────────────────

/// Verify a CryptoCloud postback JWT token using the project's secret key.
///
/// Enforces HS256 only — rejects algorithm confusion attacks (none, RS256, etc.).
fn verify_postback_token(token: &str, secret_key: &str) -> bool {
    if token.is_empty() || secret_key.is_empty() {
        return false;
    }

    let key = jsonwebtoken::DecodingKey::from_secret(secret_key.as_bytes());
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
    // Strictly enforce HS256 — reject all other algorithms
    validation.algorithms = vec![jsonwebtoken::Algorithm::HS256];
    // CryptoCloud tokens may not have standard exp/nbf claims
    validation.validate_exp = false;
    validation.required_spec_claims = std::collections::HashSet::new();

    jsonwebtoken::decode::<serde_json::Value>(token, &key, &validation).is_ok()
}

/// Extract user_id from the order_id format: "mira-{uuid}-{random}"
fn extract_user_id(order_id: &str) -> Result<Uuid, AppError> {
    if !order_id.starts_with("mira-") || order_id.len() < 41 {
        return Err(AppError::BadRequest("Invalid order_id format".to_string()));
    }
    order_id[5..41].parse().map_err(|_| {
        tracing::error!(order_id = %order_id, "Invalid user_id in CryptoCloud order_id");
        AppError::BadRequest("Invalid order_id".to_string())
    })
}

/// Process a CryptoCloud postback notification.
///
/// Uses a two-layer deduplication strategy:
/// 1. Redis SET NX (fast, distributed) — rejects replays within 24 hours
/// 2. PostgreSQL transactions table (durable) — rejects replays forever
pub async fn handle_postback(
    pool: &PgPool,
    config: &Config,
    redis: &redis::Client,
    postback: &CryptoCloudPostback,
) -> Result<WebhookResult, AppError> {
    // Verify JWT token
    match &postback.token {
        Some(token) if !verify_postback_token(token, &config.cryptocloud_secret_key) => {
            tracing::warn!("CryptoCloud postback JWT verification failed");
            return Err(AppError::Forbidden("Invalid postback token".to_string()));
        }
        None => {
            tracing::warn!("CryptoCloud postback missing token");
            return Err(AppError::Forbidden("Missing postback token".to_string()));
        }
        _ => {}
    }

    if postback.status != "success" {
        tracing::info!(
            invoice_id = %postback.invoice_id,
            status = %postback.status,
            "CryptoCloud non-success postback, ignoring"
        );
        return Ok(WebhookResult::Ignored);
    }

    // Postback invoice_id does NOT include "INV-" prefix
    let invoice_uuid = format!("INV-{}", postback.invoice_id);

    // Layer 1: Redis-backed replay protection (fast, 24-hour window)
    let redis_key = format!("webhook:crypto:{}", invoice_uuid);
    if let Ok(mut conn) = redis.get_multiplexed_async_connection().await {
        let already_processed: Result<Option<String>, _> = redis::cmd("SET")
            .arg(&redis_key)
            .arg("1")
            .arg("NX")
            .arg("EX")
            .arg(86400) // 24 hours
            .query_async(&mut conn)
            .await;
        match already_processed {
            Ok(Some(_)) => {} // New key — proceed
            Ok(None) => {
                tracing::info!(invoice_id = %invoice_uuid, "Replay blocked by Redis");
                return Ok(WebhookResult::Duplicate);
            }
            Err(e) => {
                // Redis down — fall through to SQL dedup (fail open for availability)
                tracing::warn!(error = %e, "Redis unavailable for replay check, falling through to SQL");
            }
        }
    }

    // Advisory lock to prevent duplicate processing
    let lock_key = {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        invoice_uuid.hash(&mut h);
        h.finish() as i64
    };

    sqlx::query("SELECT pg_advisory_lock($1)")
        .bind(lock_key)
        .execute(pool)
        .await?;

    let result = async {
        // Deduplicate
        let existing: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM transactions WHERE payment_id = $1 AND type = 'topup' LIMIT 1",
        )
        .bind(&invoice_uuid)
        .fetch_optional(pool)
        .await?;

        if existing.is_some() {
            tracing::info!(invoice_id = %invoice_uuid, "Duplicate CryptoCloud postback");
            return Ok(WebhookResult::Duplicate);
        }

        let order_id = postback.order_id.as_deref().unwrap_or("");
        let payment_method = format!("crypto:{}", postback.currency);

        // Get fiat amount from invoice_info
        let raw_amount = postback
            .invoice_info
            .as_ref()
            .and_then(|info| info.amount_in_fiat.or(info.amount_usd));

        let amount_kopecks = match raw_amount {
            Some(fiat) if fiat.is_finite() && fiat > 0.0 => {
                let kopecks = (fiat * 100.0).round() as i64;
                if kopecks <= 0 || kopecks > 10_000_000_00 {
                    tracing::error!(invoice_id = %invoice_uuid, fiat = %fiat, "Amount out of range");
                    return Err(AppError::BadRequest("Payment amount out of range".to_string()));
                }
                kopecks
            }
            _ => {
                tracing::error!(invoice_id = %invoice_uuid, "Missing or invalid fiat amount in postback");
                return Err(AppError::BadRequest("Invalid payment amount".to_string()));
            }
        };

        // Route by order_id prefix: "sub-" = subscription, "mira-" = balance top-up
        if order_id.starts_with("sub-") {
            // Subscription payment: sub-{product}-{plan}-{user_id}-{uuid}
            let parts: Vec<&str> = order_id.splitn(5, '-').collect();
            if parts.len() < 4 {
                return Err(AppError::BadRequest("Invalid subscription order_id".to_string()));
            }
            let product = parts[1];
            let plan = parts[2];
            // user_id is parts[3] which is a UUID (36 chars)
            let user_id_str = if parts.len() >= 5 && parts[3].len() == 36 {
                parts[3]
            } else if order_id.len() >= 4 + product.len() + plan.len() + 3 + 36 {
                // sub-chat-pro-{uuid starts here}
                let offset = 4 + product.len() + 1 + plan.len() + 1;
                &order_id[offset..offset + 36]
            } else {
                return Err(AppError::BadRequest("Cannot extract user_id from subscription order".to_string()));
            };

            let user_id: Uuid = user_id_str.parse().map_err(|_| {
                tracing::error!(order_id = %order_id, "Invalid user_id in subscription order");
                AppError::BadRequest("Invalid order_id".to_string())
            })?;

            crate::services::subscription::activate_subscription(
                pool, user_id, product, plan, &invoice_uuid, &payment_method, amount_kopecks,
            ).await?;

            tracing::info!(
                invoice_id = %invoice_uuid,
                user_id = %user_id,
                product = %product,
                plan = %plan,
                "Subscription activated via crypto payment"
            );
        } else {
            // Balance top-up: mira-{user_id}-{uuid}
            let user_id = extract_user_id(order_id)?;

            billing::topup_user(pool, user_id, amount_kopecks, &invoice_uuid, &payment_method).await?;

            tracing::info!(
                invoice_id = %invoice_uuid,
                user_id = %user_id,
                amount_kopecks = %amount_kopecks,
                crypto = %postback.currency,
                "Crypto balance topped up"
            );
        }

        Ok(WebhookResult::Processed)
    }
    .await;

    let _ = sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(lock_key)
        .execute(pool)
        .await;

    result
}
