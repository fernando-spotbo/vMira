//! Usage metering service — records and aggregates AI generation usage.

use chrono::{Datelike, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::usage::UsageRecord;

// ── DTOs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DailyUsage {
    pub total_requests: i64,
    pub total_tokens: i64,
    pub total_cost_microcents: i64,
    pub completed: i64,
    pub cancelled: i64,
    pub errors: i64,
}

#[derive(Debug, Serialize)]
pub struct MonthlyUsage {
    pub total_requests: i64,
    pub total_tokens: i64,
    pub total_cost_microcents: i64,
    pub daily_breakdown: Vec<DailyBreakdown>,
}

#[derive(Debug, Serialize)]
pub struct DailyBreakdown {
    pub date: String,
    pub requests: i64,
    pub tokens: i64,
    pub cost_microcents: i64,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyUsage {
    pub api_key_id: String,
    pub total_requests: i64,
    pub total_tokens: i64,
    pub total_cost_microcents: i64,
}

// ── Cost estimation ───────────────────────────────────────────────────────

/// Calculate cost in microcents (1 cent = 10000 microcents).
///
/// Pricing per 1K tokens in microcents:
/// - mira:     $0.001/1K in, $0.003/1K out
/// - mira-pro: $0.003/1K in, $0.006/1K out
/// - mira-max: $0.015/1K in, $0.060/1K out
pub fn estimate_cost(model: &str, input_tokens: i32, output_tokens: i32) -> i64 {
    let (input_rate, output_rate) = match model {
        "mira" => (10i64, 30i64),
        "mira-pro" => (30, 60),
        "mira-max" => (150, 600),
        _ => (10, 30),
    };
    let input_cost = (input_tokens as i64 * input_rate) / 1000;
    let output_cost = (output_tokens as i64 * output_rate) / 1000;
    input_cost + output_cost
}

// ── Recording ─────────────────────────────────────────────────────────────

/// Insert a usage record into the database.
pub async fn record_usage(pool: &PgPool, record: &UsageRecord) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO usage_records
            (id, user_id, api_key_id, conversation_id, request_id, model,
             input_tokens, output_tokens, total_tokens,
             queue_duration_ms, processing_duration_ms, total_duration_ms,
             status, cancelled_at, error_message, cost_microcents, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)",
    )
    .bind(record.id)
    .bind(record.user_id)
    .bind(record.api_key_id)
    .bind(record.conversation_id)
    .bind(&record.request_id)
    .bind(&record.model)
    .bind(record.input_tokens)
    .bind(record.output_tokens)
    .bind(record.total_tokens)
    .bind(record.queue_duration_ms)
    .bind(record.processing_duration_ms)
    .bind(record.total_duration_ms)
    .bind(&record.status)
    .bind(record.cancelled_at)
    .bind(record.error_message.as_deref())
    .bind(record.cost_microcents)
    .bind(record.created_at)
    .execute(pool)
    .await?;

    Ok(())
}

// ── Aggregation queries ───────────────────────────────────────────────────

/// Get aggregated usage for a user for today.
pub async fn get_user_usage_today(pool: &PgPool, user_id: Uuid) -> Result<DailyUsage, AppError> {
    let today = Utc::now().date_naive();
    let tomorrow = today + chrono::Duration::days(1);

    let row = sqlx::query_as::<_, (i64, i64, i64, i64, i64)>(
        "SELECT
            COUNT(*) as total_requests,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(cost_microcents), 0) as total_cost_microcents,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
         FROM usage_records
         WHERE user_id = $1 AND created_at >= $2::date AND created_at < $3::date",
    )
    .bind(user_id)
    .bind(today)
    .bind(tomorrow)
    .fetch_one(pool)
    .await?;

    let errors = row.0 - row.3 - row.4; // total - completed - cancelled = errors

    Ok(DailyUsage {
        total_requests: row.0,
        total_tokens: row.1,
        total_cost_microcents: row.2,
        completed: row.3,
        cancelled: row.4,
        errors,
    })
}

/// Get aggregated usage for a user for the current month.
pub async fn get_user_usage_month(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<MonthlyUsage, AppError> {
    let now = Utc::now();
    let first_of_month = now
        .date_naive()
        .with_day(1)
        .unwrap_or(now.date_naive());

    // Totals
    let totals = sqlx::query_as::<_, (i64, i64, i64)>(
        "SELECT
            COUNT(*) as total_requests,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(cost_microcents), 0) as total_cost_microcents
         FROM usage_records
         WHERE user_id = $1 AND created_at >= $2::date",
    )
    .bind(user_id)
    .bind(first_of_month)
    .fetch_one(pool)
    .await?;

    // Daily breakdown
    let daily_rows = sqlx::query_as::<_, (chrono::NaiveDate, i64, i64, i64)>(
        "SELECT
            created_at::date as day,
            COUNT(*) as requests,
            COALESCE(SUM(total_tokens), 0) as tokens,
            COALESCE(SUM(cost_microcents), 0) as cost_microcents
         FROM usage_records
         WHERE user_id = $1 AND created_at >= $2::date
         GROUP BY created_at::date
         ORDER BY day ASC",
    )
    .bind(user_id)
    .bind(first_of_month)
    .fetch_all(pool)
    .await?;

    let daily_breakdown = daily_rows
        .into_iter()
        .map(|(date, requests, tokens, cost)| DailyBreakdown {
            date: date.to_string(),
            requests,
            tokens,
            cost_microcents: cost,
        })
        .collect();

    Ok(MonthlyUsage {
        total_requests: totals.0,
        total_tokens: totals.1,
        total_cost_microcents: totals.2,
        daily_breakdown,
    })
}

/// Get aggregated usage for a specific API key.
pub async fn get_api_key_usage(pool: &PgPool, api_key_id: Uuid) -> Result<ApiKeyUsage, AppError> {
    let row = sqlx::query_as::<_, (i64, i64, i64)>(
        "SELECT
            COUNT(*) as total_requests,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(cost_microcents), 0) as total_cost_microcents
         FROM usage_records
         WHERE api_key_id = $1",
    )
    .bind(api_key_id)
    .fetch_one(pool)
    .await?;

    Ok(ApiKeyUsage {
        api_key_id: api_key_id.to_string(),
        total_requests: row.0,
        total_tokens: row.1,
        total_cost_microcents: row.2,
    })
}

// ── Admin aggregation queries ─────────────────────────────────────────────

/// Global usage stats for admin dashboard.
#[derive(Debug, Serialize)]
pub struct GlobalUsageStats {
    pub today_requests: i64,
    pub today_tokens: i64,
    pub today_cost_microcents: i64,
    pub month_requests: i64,
    pub month_tokens: i64,
    pub month_cost_microcents: i64,
}

/// Get global usage stats (today + this month).
pub async fn get_global_usage_stats(pool: &PgPool) -> Result<GlobalUsageStats, AppError> {
    let today = Utc::now().date_naive();
    let tomorrow = today + chrono::Duration::days(1);
    let first_of_month = today.with_day(1).unwrap_or(today);

    let today_stats = sqlx::query_as::<_, (i64, i64, i64)>(
        "SELECT
            COUNT(*),
            COALESCE(SUM(total_tokens), 0),
            COALESCE(SUM(cost_microcents), 0)
         FROM usage_records WHERE created_at >= $1::date AND created_at < $2::date",
    )
    .bind(today)
    .bind(tomorrow)
    .fetch_one(pool)
    .await?;

    let month_stats = sqlx::query_as::<_, (i64, i64, i64)>(
        "SELECT
            COUNT(*),
            COALESCE(SUM(total_tokens), 0),
            COALESCE(SUM(cost_microcents), 0)
         FROM usage_records WHERE created_at >= $1::date",
    )
    .bind(first_of_month)
    .fetch_one(pool)
    .await?;

    Ok(GlobalUsageStats {
        today_requests: today_stats.0,
        today_tokens: today_stats.1,
        today_cost_microcents: today_stats.2,
        month_requests: month_stats.0,
        month_tokens: month_stats.1,
        month_cost_microcents: month_stats.2,
    })
}

/// Per-user usage breakdown for admin.
#[derive(Debug, Serialize)]
pub struct UserUsageRow {
    pub user_id: Uuid,
    pub total_requests: i64,
    pub total_tokens: i64,
    pub total_cost_microcents: i64,
}

/// Get per-user usage breakdown (top users by cost, this month).
pub async fn get_per_user_usage(
    pool: &PgPool,
    limit: i64,
    offset: i64,
) -> Result<Vec<UserUsageRow>, AppError> {
    let first_of_month = Utc::now()
        .date_naive()
        .with_day(1)
        .unwrap_or(Utc::now().date_naive());

    let rows = sqlx::query_as::<_, (Uuid, i64, i64, i64)>(
        "SELECT
            user_id,
            COUNT(*) as total_requests,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(cost_microcents), 0) as total_cost_microcents
         FROM usage_records
         WHERE created_at >= $1::date
         GROUP BY user_id
         ORDER BY total_cost_microcents DESC
         LIMIT $2 OFFSET $3",
    )
    .bind(first_of_month)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(user_id, requests, tokens, cost)| UserUsageRow {
            user_id,
            total_requests: requests,
            total_tokens: tokens,
            total_cost_microcents: cost,
        })
        .collect())
}
