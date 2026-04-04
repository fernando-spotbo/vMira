//! GET /v1/quota — returns usage quota status for the CLI.
//!
//! The CLI polls this endpoint to display rate-limit bars, warnings,
//! and overage notices. Data comes from `usage_records` (real) and
//! the user's plan/subscription (real).

use axum::{extract::State, routing::get, Json, Router};
use chrono::{Duration, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::ApiKeyUser;
use crate::services::plans;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn quota_routes() -> Router<AppState> {
    Router::new().route("/quota", get(get_quota))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Response types (matches what the CLI expects)
// ═══════════════════════════════════════════════════════════════════════════

/// Per-window utilization bucket shown in the CLI's /usage bars.
#[derive(Debug, Serialize)]
pub struct UtilizationBucket {
    pub used: i64,
    pub limit: i64,
    pub utilization: f64,
    pub resets_at: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct QuotaResponse {
    /// "allowed", "allowed_warning", or "rejected"
    pub status: String,
    /// Which limit is closest to being hit
    pub rate_limit_type: Option<String>,
    /// 0.0 – 1.0 utilisation of the tightest limit
    pub utilization: Option<f64>,
    /// Unix-epoch seconds when the tightest limit resets
    pub resets_at: Option<i64>,
    /// Whether this request is being billed as overage
    pub is_using_overage: bool,
    /// Per-window breakdowns for the /usage UI
    pub buckets: QuotaBuckets,
    /// User's effective plan for code
    pub plan: String,
}

#[derive(Debug, Serialize)]
pub struct QuotaBuckets {
    /// Messages in the last 5 hours vs session cap
    pub five_hour: Option<UtilizationBucket>,
    /// All messages in the last 7 days vs weekly cap
    pub seven_day: Option<UtilizationBucket>,
    /// mira-thinking / mira-max messages in the last 7 days
    pub seven_day_thinking: Option<UtilizationBucket>,
    /// mira / mira-pro messages in the last 7 days
    pub seven_day_standard: Option<UtilizationBucket>,
}

// ═══════════════════════════════════════════════════════════════════════════
//  Plan limits
// ═══════════════════════════════════════════════════════════════════════════

/// Monthly token limits by plan. Returns -1 for unlimited.
pub fn monthly_token_limit(plan: &str) -> i64 {
    plans::get_plan(plan).monthly_token_limit
}

struct PlanLimits {
    daily: i64,
    five_hour: i64,
    seven_day: i64,
    seven_day_thinking: i64,
    seven_day_standard: i64,
}

fn plan_limits(plan: &str) -> PlanLimits {
    let cfg = plans::get_plan(plan);
    PlanLimits {
        daily: cfg.code_daily_messages,
        five_hour: cfg.five_hour_limit,
        seven_day: cfg.seven_day_limit,
        seven_day_thinking: cfg.seven_day_thinking_limit,
        seven_day_standard: cfg.seven_day_standard_limit,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Handler
// ═══════════════════════════════════════════════════════════════════════════

async fn get_quota(
    State(state): State<AppState>,
    ApiKeyUser(user): ApiKeyUser,
) -> Result<Json<QuotaResponse>, AppError> {
    let now = Utc::now();
    let five_hours_ago = now - Duration::hours(5);
    let seven_days_ago = now - Duration::days(7);

    // Determine effective plan (code_plan > general plan)
    let effective_plan = if user.code_plan != "free" {
        // Check expiry
        if user
            .code_plan_expires_at
            .map_or(false, |exp| exp > now)
        {
            user.code_plan.clone()
        } else {
            "free".to_string()
        }
    } else {
        user.plan.clone()
    };

    let limits = plan_limits(&effective_plan);

    // ── Count messages in each window ────────────────────────────────

    // 5-hour window (all models)
    let five_hour_used: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM usage_records
         WHERE user_id = $1 AND created_at >= $2 AND status = 'completed'",
    )
    .bind(user.id)
    .bind(five_hours_ago)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // 7-day window (all models)
    let seven_day_used: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM usage_records
         WHERE user_id = $1 AND created_at >= $2 AND status = 'completed'",
    )
    .bind(user.id)
    .bind(seven_days_ago)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // 7-day thinking models (mira-thinking, mira-max)
    let seven_day_thinking_used: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM usage_records
         WHERE user_id = $1 AND created_at >= $2 AND status = 'completed'
           AND model IN ('mira-thinking', 'mira-max')",
    )
    .bind(user.id)
    .bind(seven_days_ago)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // 7-day standard models (mira, mira-pro)
    let seven_day_standard_used: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM usage_records
         WHERE user_id = $1 AND created_at >= $2 AND status = 'completed'
           AND model IN ('mira', 'mira-pro')",
    )
    .bind(user.id)
    .bind(seven_days_ago)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    // ── Build utilization buckets ────────────────────────────────────

    let make_bucket =
        |used: i64, limit: i64, resets_at: Option<i64>| -> Option<UtilizationBucket> {
            if limit < 0 {
                // Unlimited — still report usage but 0% utilization
                Some(UtilizationBucket {
                    used,
                    limit: -1,
                    utilization: 0.0,
                    resets_at,
                })
            } else {
                Some(UtilizationBucket {
                    used,
                    limit,
                    utilization: if limit > 0 {
                        (used as f64 / limit as f64).min(1.0)
                    } else {
                        1.0
                    },
                    resets_at,
                })
            }
        };

    let five_hour_reset = (now + Duration::hours(5)).timestamp();
    let daily_reset = (now.date_naive().succ_opt().unwrap_or(now.date_naive()))
        .and_hms_opt(0, 0, 0)
        .map(|dt| dt.and_utc().timestamp());
    let seven_day_reset = (now + Duration::days(7)).timestamp();

    let buckets = QuotaBuckets {
        five_hour: make_bucket(five_hour_used, limits.five_hour, Some(five_hour_reset)),
        seven_day: make_bucket(seven_day_used, limits.seven_day, Some(seven_day_reset)),
        seven_day_thinking: make_bucket(
            seven_day_thinking_used,
            limits.seven_day_thinking,
            Some(seven_day_reset),
        ),
        seven_day_standard: make_bucket(
            seven_day_standard_used,
            limits.seven_day_standard,
            Some(seven_day_reset),
        ),
    };

    // ── Determine tightest limit ─────────────────────────────────────

    let mut worst_util: f64 = 0.0;
    let mut worst_type: Option<String> = None;
    let mut worst_resets: Option<i64> = None;

    for (name, bucket) in [
        ("five_hour", &buckets.five_hour),
        ("seven_day", &buckets.seven_day),
        ("seven_day_opus", &buckets.seven_day_thinking),
        ("seven_day_sonnet", &buckets.seven_day_standard),
    ] {
        if let Some(b) = bucket {
            if b.utilization > worst_util {
                worst_util = b.utilization;
                worst_type = Some(name.to_string());
                worst_resets = b.resets_at;
            }
        }
    }

    // Check overage
    let is_overage = user.allow_overage_billing
        && limits.daily >= 0
        && user.daily_messages_used as i64 >= limits.daily;

    let status = if worst_util >= 1.0 && !is_overage {
        "rejected"
    } else if worst_util >= 0.8 {
        "allowed_warning"
    } else {
        "allowed"
    };

    Ok(Json(QuotaResponse {
        status: status.to_string(),
        rate_limit_type: worst_type,
        utilization: Some(worst_util),
        resets_at: worst_resets,
        is_using_overage: is_overage,
        buckets,
        plan: effective_plan,
    }))
}
