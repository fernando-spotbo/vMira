//! Billing service — balance management, charging, top-ups, and spending analytics.
//!
//! All monetary values are stored in **kopecks** (1 ruble = 100 kopecks).
//! Balance mutations use `SELECT … FOR UPDATE` inside a transaction to prevent
//! race conditions.

use chrono::{Datelike, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::billing::{ModelPricing, Transaction};

// ── Spending summary DTOs ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct SpendingSummary {
    pub today_kopecks: i64,
    pub week_kopecks: i64,
    pub month_kopecks: i64,
    pub by_model: Vec<ModelSpending>,
}

#[derive(Debug, Serialize)]
pub struct ModelSpending {
    pub model: String,
    pub total_kopecks: i64,
    pub total_requests: i64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
}

// ── Pricing queries ──────────────────────────────────────────────────────

/// Fetch pricing for a specific model.
pub async fn get_pricing(pool: &PgPool, model: &str) -> Result<ModelPricing, AppError> {
    let pricing = sqlx::query_as::<_, ModelPricing>(
        "SELECT * FROM model_pricing WHERE model = $1 AND is_active = true",
    )
    .bind(model)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("No pricing found for model: {model}")))?;

    Ok(pricing)
}

/// List all active model pricing entries.
pub async fn get_all_pricing(pool: &PgPool) -> Result<Vec<ModelPricing>, AppError> {
    let pricing = sqlx::query_as::<_, ModelPricing>(
        "SELECT * FROM model_pricing WHERE is_active = true ORDER BY input_price_per_1k_kopecks ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(pricing)
}

// ── Cost calculation ─────────────────────────────────────────────────────

/// Calculate cost in kopecks for a given model and token counts.
///
/// The thinking surcharge is applied to output tokens for reasoning models.
pub fn calculate_charge(pricing: &ModelPricing, input_tokens: i32, output_tokens: i32) -> i64 {
    let input_cost =
        (input_tokens as i64 * pricing.input_price_per_1k_kopecks as i64) / 1000;

    let mut output_cost =
        (output_tokens as i64 * pricing.output_price_per_1k_kopecks as i64) / 1000;

    // Apply thinking surcharge if applicable
    if pricing.thinking_surcharge_percent > 0 {
        output_cost += (output_cost * pricing.thinking_surcharge_percent as i64) / 100;
    }

    input_cost + output_cost
}

// ── Balance operations ───────────────────────────────────────────────────

/// Atomically charge a user's balance, creating a transaction record.
///
/// Uses `SELECT … FOR UPDATE` to prevent race conditions.
/// Returns an error if the user has insufficient balance.
pub async fn charge_user(
    pool: &PgPool,
    user_id: Uuid,
    amount_kopecks: i64,
    description: &str,
    usage_record_id: Option<Uuid>,
    model: &str,
    input_tokens: i32,
    output_tokens: i32,
) -> Result<Transaction, AppError> {
    let mut tx = pool.begin().await?;

    // Lock the user row to prevent concurrent balance modifications
    let balance: (i64,) = sqlx::query_as(
        "SELECT balance_kopecks FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| AppError::NotFound("User not found".to_string()))?;

    let current_balance = balance.0;

    if current_balance < amount_kopecks {
        tx.rollback().await?;
        return Err(AppError::PaymentRequired(
            "Insufficient balance".to_string(),
        ));
    }

    let new_balance = current_balance - amount_kopecks;

    // Update user balance and totals
    sqlx::query(
        "UPDATE users SET balance_kopecks = $1, total_spent_kopecks = total_spent_kopecks + $2, updated_at = $3 WHERE id = $4",
    )
    .bind(new_balance)
    .bind(amount_kopecks)
    .bind(Utc::now())
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Record the transaction
    let transaction_id = Uuid::new_v4();
    let now = Utc::now();

    let transaction = sqlx::query_as::<_, Transaction>(
        "INSERT INTO transactions
            (id, user_id, type, amount_kopecks, balance_after_kopecks, description,
             usage_record_id, model, input_tokens, output_tokens, created_at)
         VALUES ($1, $2, 'charge', $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *",
    )
    .bind(transaction_id)
    .bind(user_id)
    .bind(-amount_kopecks) // Negative because it's a debit
    .bind(new_balance)
    .bind(description)
    .bind(usage_record_id)
    .bind(model)
    .bind(input_tokens)
    .bind(output_tokens)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(transaction)
}

/// Add funds to a user's balance after a successful payment.
pub async fn topup_user(
    pool: &PgPool,
    user_id: Uuid,
    amount_kopecks: i64,
    payment_id: &str,
    payment_method: &str,
) -> Result<Transaction, AppError> {
    let mut tx = pool.begin().await?;

    // Lock the user row
    let balance: (i64,) = sqlx::query_as(
        "SELECT balance_kopecks FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| AppError::NotFound("User not found".to_string()))?;

    let new_balance = balance.0 + amount_kopecks;

    // Update user balance and totals
    sqlx::query(
        "UPDATE users SET balance_kopecks = $1, total_topped_up_kopecks = total_topped_up_kopecks + $2, updated_at = $3 WHERE id = $4",
    )
    .bind(new_balance)
    .bind(amount_kopecks)
    .bind(Utc::now())
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Record the transaction
    let transaction_id = Uuid::new_v4();
    let now = Utc::now();

    let transaction = sqlx::query_as::<_, Transaction>(
        "INSERT INTO transactions
            (id, user_id, type, amount_kopecks, balance_after_kopecks, description,
             payment_id, payment_method, receipt_status, created_at)
         VALUES ($1, $2, 'topup', $3, $4, $5, $6, $7, 'pending', $8)
         RETURNING *",
    )
    .bind(transaction_id)
    .bind(user_id)
    .bind(amount_kopecks) // Positive because it's a credit
    .bind(new_balance)
    .bind(format!("Top-up via {payment_method}"))
    .bind(payment_id)
    .bind(payment_method)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(transaction)
}

/// Get the current balance in kopecks for a user.
pub async fn get_user_balance(pool: &PgPool, user_id: Uuid) -> Result<i64, AppError> {
    let balance: (i64,) = sqlx::query_as(
        "SELECT balance_kopecks FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| AppError::NotFound("User not found".to_string()))?;

    Ok(balance.0)
}

/// Get paginated transaction history for a user.
pub async fn get_user_transactions(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<Transaction>, AppError> {
    let transactions = sqlx::query_as::<_, Transaction>(
        "SELECT * FROM transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3",
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(transactions)
}

/// Get filtered transaction history for a user.
pub async fn get_user_transactions_filtered(
    pool: &PgPool,
    user_id: Uuid,
    tx_type: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<Transaction>, AppError> {
    let transactions = if let Some(tx_type) = tx_type {
        sqlx::query_as::<_, Transaction>(
            "SELECT * FROM transactions
             WHERE user_id = $1 AND type = $2
             ORDER BY created_at DESC
             LIMIT $3 OFFSET $4",
        )
        .bind(user_id)
        .bind(tx_type)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Transaction>(
            "SELECT * FROM transactions
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3",
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    };

    Ok(transactions)
}

/// Get spending summary: today, this week, this month, broken down by model.
pub async fn get_spending_summary(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<SpendingSummary, AppError> {
    let now = Utc::now();
    let today = now.date_naive();
    let week_start = today - chrono::Duration::days(today.weekday().num_days_from_monday() as i64);
    let month_start = today.with_day(1).unwrap_or(today);

    // Today's spending
    let today_row: (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(ABS(amount_kopecks)), 0)
         FROM transactions
         WHERE user_id = $1 AND type = 'charge' AND DATE(created_at) = $2",
    )
    .bind(user_id)
    .bind(today)
    .fetch_one(pool)
    .await?;

    // This week's spending
    let week_row: (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(ABS(amount_kopecks)), 0)
         FROM transactions
         WHERE user_id = $1 AND type = 'charge' AND DATE(created_at) >= $2",
    )
    .bind(user_id)
    .bind(week_start)
    .fetch_one(pool)
    .await?;

    // This month's spending
    let month_row: (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(ABS(amount_kopecks)), 0)
         FROM transactions
         WHERE user_id = $1 AND type = 'charge' AND DATE(created_at) >= $2",
    )
    .bind(user_id)
    .bind(month_start)
    .fetch_one(pool)
    .await?;

    // By model breakdown (this month)
    let model_rows = sqlx::query_as::<_, (String, i64, i64, i64, i64)>(
        "SELECT
            COALESCE(model, 'unknown'),
            COALESCE(SUM(ABS(amount_kopecks)), 0),
            COUNT(*),
            COALESCE(SUM(input_tokens), 0),
            COALESCE(SUM(output_tokens), 0)
         FROM transactions
         WHERE user_id = $1 AND type = 'charge' AND DATE(created_at) >= $2
         GROUP BY model
         ORDER BY SUM(ABS(amount_kopecks)) DESC",
    )
    .bind(user_id)
    .bind(month_start)
    .fetch_all(pool)
    .await?;

    let by_model = model_rows
        .into_iter()
        .map(|(model, total_kopecks, total_requests, total_input_tokens, total_output_tokens)| {
            ModelSpending {
                model,
                total_kopecks,
                total_requests,
                total_input_tokens,
                total_output_tokens,
            }
        })
        .collect();

    Ok(SpendingSummary {
        today_kopecks: today_row.0,
        week_kopecks: week_row.0,
        month_kopecks: month_row.0,
        by_model,
    })
}

/// Refund a specific charge transaction, restoring the user's balance.
pub async fn refund_charge(
    pool: &PgPool,
    transaction_id: Uuid,
) -> Result<Transaction, AppError> {
    let mut tx = pool.begin().await?;

    // Find the original charge
    let original = sqlx::query_as::<_, Transaction>(
        "SELECT * FROM transactions WHERE id = $1 AND type = 'charge'",
    )
    .bind(transaction_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Charge transaction not found".to_string()))?;

    let refund_amount = original.amount_kopecks.unsigned_abs() as i64;

    // Lock user row
    let balance: (i64,) = sqlx::query_as(
        "SELECT balance_kopecks FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(original.user_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| AppError::NotFound("User not found".to_string()))?;

    let new_balance = balance.0 + refund_amount;

    // Update user balance
    sqlx::query(
        "UPDATE users SET balance_kopecks = $1, total_spent_kopecks = total_spent_kopecks - $2, updated_at = $3 WHERE id = $4",
    )
    .bind(new_balance)
    .bind(refund_amount)
    .bind(Utc::now())
    .bind(original.user_id)
    .execute(&mut *tx)
    .await?;

    // Record refund transaction
    let refund_id = Uuid::new_v4();
    let now = Utc::now();

    let refund_tx = sqlx::query_as::<_, Transaction>(
        "INSERT INTO transactions
            (id, user_id, type, amount_kopecks, balance_after_kopecks, description,
             usage_record_id, model, input_tokens, output_tokens, created_at)
         VALUES ($1, $2, 'refund', $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *",
    )
    .bind(refund_id)
    .bind(original.user_id)
    .bind(refund_amount) // Positive because it's a credit (refund)
    .bind(new_balance)
    .bind(format!("Refund for transaction {transaction_id}"))
    .bind(original.usage_record_id)
    .bind(original.model.as_deref())
    .bind(original.input_tokens)
    .bind(original.output_tokens)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(refund_tx)
}

/// Get a single transaction by ID (must belong to the given user).
pub async fn get_transaction(
    pool: &PgPool,
    transaction_id: Uuid,
    user_id: Uuid,
) -> Result<Transaction, AppError> {
    let transaction = sqlx::query_as::<_, Transaction>(
        "SELECT * FROM transactions WHERE id = $1 AND user_id = $2",
    )
    .bind(transaction_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Transaction not found".to_string()))?;

    Ok(transaction)
}
