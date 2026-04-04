//! Subscription management for Chat and Mira Code products.
//!
//! Subscriptions are time-limited (30 days) and independent per product.
//! A user can have different plans for chat vs code.
//! This is separate from API balance-based billing.

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::services::plans;

/// Subscription prices in kopecks.
pub fn subscription_price(product: &str, plan: &str) -> Result<i64, AppError> {
    let cfg = plans::get_plan(plan);
    match product {
        "chat" => {
            if cfg.chat_price_kopecks > 0 {
                Ok(cfg.chat_price_kopecks)
            } else {
                Err(AppError::BadRequest(format!(
                    "Invalid subscription: product={product}, plan={plan}"
                )))
            }
        }
        "code" => {
            if cfg.code_price_kopecks > 0 {
                Ok(cfg.code_price_kopecks)
            } else {
                Err(AppError::BadRequest(format!(
                    "Invalid subscription: product={product}, plan={plan}"
                )))
            }
        }
        _ => Err(AppError::BadRequest(format!(
            "Invalid subscription: product={product}, plan={plan}"
        ))),
    }
}

/// Create or renew a subscription after successful payment.
///
/// If the user already has an active subscription for this product,
/// the new subscription extends from the current expiry date (stacking).
/// Otherwise, it starts from now.
pub async fn activate_subscription(
    pool: &PgPool,
    user_id: Uuid,
    product: &str,
    plan: &str,
    payment_id: &str,
    payment_method: &str,
    amount_kopecks: i64,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    // Determine start date: if active subscription exists, extend from its expiry
    let (plan_col, expires_col) = match product {
        "chat" => ("chat_plan", "chat_plan_expires_at"),
        "code" => ("code_plan", "code_plan_expires_at"),
        _ => return Err(AppError::BadRequest("Invalid product".to_string())),
    };

    // Get current expiry (if any active subscription)
    let current_expiry: Option<(Option<chrono::DateTime<Utc>>,)> = sqlx::query_as(
        &format!("SELECT {expires_col} FROM users WHERE id = $1")
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    let now = Utc::now();
    let start_from = current_expiry
        .and_then(|r| r.0)
        .filter(|exp| *exp > now)  // Only extend if not yet expired
        .unwrap_or(now);

    let expires_at = start_from + Duration::days(30);

    // Insert subscription record
    sqlx::query(
        "INSERT INTO subscriptions (id, user_id, product, plan, started_at, expires_at, payment_id, payment_method, amount_kopecks, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')"
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(product)
    .bind(plan)
    .bind(now)
    .bind(expires_at)
    .bind(payment_id)
    .bind(payment_method)
    .bind(amount_kopecks)
    .execute(&mut *tx)
    .await?;

    // Update user's product plan and expiry
    let query = format!(
        "UPDATE users SET {plan_col} = $1, {expires_col} = $2, updated_at = $3 WHERE id = $4"
    );
    sqlx::query(&query)
        .bind(plan)
        .bind(expires_at)
        .bind(now)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    tracing::info!(
        user_id = %user_id,
        product = %product,
        plan = %plan,
        expires_at = %expires_at,
        "Subscription activated"
    );

    Ok(())
}

/// Check if a user's subscription for a product has expired.
/// If expired, downgrade to free and mark subscription as expired.
/// Returns the effective plan after the check.
pub async fn check_and_enforce_expiry(pool: &PgPool, user_id: Uuid, product: &str) -> Result<String, AppError> {
    let (plan_col, expires_col) = match product {
        "chat" => ("chat_plan", "chat_plan_expires_at"),
        "code" => ("code_plan", "code_plan_expires_at"),
        _ => return Ok("free".to_string()),
    };

    let row: Option<(String, Option<chrono::DateTime<Utc>>)> = sqlx::query_as(
        &format!("SELECT {plan_col}, {expires_col} FROM users WHERE id = $1")
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let (current_plan, expires_at) = match row {
        Some(r) => r,
        None => return Ok("free".to_string()),
    };

    // Free plan never expires
    if current_plan == "free" {
        return Ok("free".to_string());
    }

    // Check expiry
    let now = Utc::now();
    if let Some(exp) = expires_at {
        if exp > now {
            return Ok(current_plan); // Still active
        }
    }

    // Expired — downgrade to free
    let query = format!(
        "UPDATE users SET {plan_col} = 'free', {expires_col} = NULL, updated_at = $1 WHERE id = $2"
    );
    sqlx::query(&query)
        .bind(now)
        .bind(user_id)
        .execute(pool)
        .await?;

    // Mark all active subscriptions for this product as expired
    sqlx::query(
        "UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND product = $2 AND status = 'active' AND expires_at <= $3"
    )
    .bind(user_id)
    .bind(product)
    .bind(now)
    .execute(pool)
    .await?;

    tracing::info!(user_id = %user_id, product = %product, "Subscription expired, downgraded to free");

    Ok("free".to_string())
}
