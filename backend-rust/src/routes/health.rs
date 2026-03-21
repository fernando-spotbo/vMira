//! Health-check endpoint.
//!
//! GET /health — verifies connectivity to PostgreSQL and Redis.

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use redis::AsyncCommands;

use crate::db::AppState;
use crate::schema::HealthResponse;

/// GET /health
///
/// Returns 200 with `{"status":"ok"}` when both DB and Redis are reachable, or
/// 503 with `{"status":"degraded"}` and per-service flags when either is down.
pub async fn health_check(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let mut db_status = "ok".to_string();
    let mut redis_status = "ok".to_string();

    // Check PostgreSQL
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await;
    if db_ok.is_err() {
        db_status = "error".to_string();
        tracing::warn!("Health check: PostgreSQL unreachable");
    }

    // Check Redis (SET + DEL)
    let redis_ok: bool = match state.redis.get_multiplexed_async_connection().await {
        Ok(mut conn) => {
            let set_result: Result<(), _> = conn.set("_health", "1").await;
            let del_result: Result<(), _> = conn.del("_health").await;
            set_result.is_ok() && del_result.is_ok()
        }
        Err(_) => false,
    };
    if !redis_ok {
        redis_status = "error".to_string();
        tracing::warn!("Health check: Redis unreachable");
    }

    let overall = if db_status == "ok" && redis_status == "ok" {
        "ok"
    } else {
        "degraded"
    };

    let status_code = if overall == "ok" {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let body = HealthResponse {
        status: overall.to_string(),
        service: "mira-api".to_string(),
        db: db_status,
        redis: redis_status,
    };

    (status_code, Json(body))
}
