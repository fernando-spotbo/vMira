//! Admin routes — protected by `is_admin = true` check.
//!
//! Provides user management, usage analytics, and plan management.

use std::collections::HashMap;

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    routing::{get, patch},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::User;
use crate::schema::{AdminUserResponse, UsageStats};
use crate::services::audit::log_api_event;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn admin_routes() -> Router<AppState> {
    Router::new()
        .route("/stats", get(get_stats))
        .route("/users", get(list_users))
        .route("/users/{user_id}/plan", patch(update_user_plan))
        .route("/users/{user_id}/deactivate", patch(deactivate_user))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Admin guard
// ═══════════════════════════════════════════════════════════════════════════

fn require_admin(user: &User) -> Result<(), AppError> {
    if !user.is_admin {
        return Err(AppError::Forbidden("Forbidden".to_string()));
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /stats
// ═══════════════════════════════════════════════════════════════════════════

async fn get_stats(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<UsageStats>, AppError> {
    require_admin(&user)?;

    let today = Utc::now().date_naive();

    let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await?;

    let active_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users
         WHERE daily_messages_used > 0 AND DATE(daily_reset_at) = $1"
    )
    .bind(today)
    .fetch_one(&state.db)
    .await?;

    let total_conversations: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM conversations")
            .fetch_one(&state.db)
            .await?;

    let total_messages: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages")
        .fetch_one(&state.db)
        .await?;

    let messages_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM messages WHERE DATE(created_at) = $1"
    )
    .bind(today)
    .fetch_one(&state.db)
    .await?;

    // Users by plan
    let plan_rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT plan, COUNT(*) as cnt FROM users GROUP BY plan"
    )
    .fetch_all(&state.db)
    .await?;

    let users_by_plan: HashMap<String, i64> =
        plan_rows.into_iter().collect();

    Ok(Json(UsageStats {
        total_users,
        active_users_today: active_today,
        total_conversations,
        total_messages,
        messages_today,
        users_by_plan,
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /users
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct UserListParams {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
    plan: Option<String>,
}

fn default_limit() -> i64 {
    50
}

async fn list_users(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<UserListParams>,
) -> Result<Json<Vec<AdminUserResponse>>, AppError> {
    require_admin(&user)?;

    let limit = params.limit.min(200);
    let offset = params.offset.max(0);

    let users: Vec<User> = if let Some(ref plan) = params.plan {
        sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE plan = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3"
        )
        .bind(plan)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, User>(
            "SELECT * FROM users
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?
    };

    let response: Vec<AdminUserResponse> = users
        .iter()
        .map(|u| AdminUserResponse {
            id: u.id,
            name: u.name.clone(),
            email: u.email.clone(),
            phone: u.phone.clone(),
            plan: u.plan.clone(),
            language: u.language.clone(),
            is_active: u.is_active,
            daily_messages_used: u.daily_messages_used,
            created_at: u.created_at,
        })
        .collect();

    Ok(Json(response))
}

// ═══════════════════════════════════════════════════════════════════════════
//  PATCH /users/:id/plan
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct PlanUpdateParams {
    plan: String,
}

async fn update_user_plan(
    State(state): State<AppState>,
    AuthUser(admin): AuthUser,
    Path(user_id): Path<Uuid>,
    Query(params): Query<PlanUpdateParams>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&admin)?;

    // Validate plan value
    match params.plan.as_str() {
        "free" | "pro" | "max" | "enterprise" => {}
        _ => {
            return Err(AppError::BadRequest(
                "Plan must be one of: free, pro, max, enterprise".to_string(),
            ));
        }
    }

    let target = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let old_plan = target.plan.clone();

    sqlx::query("UPDATE users SET plan = $1, updated_at = $2 WHERE id = $3")
        .bind(&params.plan)
        .bind(Utc::now())
        .bind(user_id)
        .execute(&state.db)
        .await?;

    log_api_event(
        "admin_plan_change",
        &admin.id,
        Some("user"),
        Some(&user_id.to_string()),
        None,
        Some(&format!("{old_plan}->{}", params.plan)),
    );

    Ok(Json(serde_json::json!({
        "detail": format!("Plan updated to {}", params.plan)
    })))
}

// ═══════════════════════════════════════════════════════════════════════════
//  PATCH /users/:id/deactivate
// ═══════════════════════════════════════════════════════════════════════════

async fn deactivate_user(
    State(state): State<AppState>,
    AuthUser(admin): AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&admin)?;

    sqlx::query("UPDATE users SET is_active = false, updated_at = $1 WHERE id = $2")
        .bind(Utc::now())
        .bind(user_id)
        .execute(&state.db)
        .await?;

    log_api_event(
        "admin_deactivate",
        &admin.id,
        Some("user"),
        Some(&user_id.to_string()),
        None,
        None,
    );

    Ok(Json(serde_json::json!({ "detail": "User deactivated" })))
}
