//! Code session routes — web app interface for bridge environments.

use std::convert::Infallible;
use std::time::Duration;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{BridgeEnvironment, BridgeMessage, BridgeWorkItem};
use crate::schema::{
    BridgeMessageRequest, BridgeMessageResponse, BridgeSessionResponse,
    BridgeSessionWithMessages,
};

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn code_routes() -> Router<AppState> {
    Router::new()
        .route("/sessions", get(list_sessions))
        .route("/sessions/{id}", get(get_session).delete(disconnect_session))
        .route("/sessions/{id}/messages", post(send_message))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct PaginationParams {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_limit() -> i64 {
    50
}

/// Verify that the environment belongs to the user's active organization.
async fn ensure_org_env(
    state: &AppState,
    env_id: Uuid,
    org_id: Uuid,
) -> Result<BridgeEnvironment, AppError> {
    let env = sqlx::query_as::<_, BridgeEnvironment>(
        "SELECT * FROM bridge_environments WHERE id = $1 AND organization_id = $2",
    )
    .bind(env_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

    Ok(env)
}

fn session_response(env: &BridgeEnvironment) -> BridgeSessionResponse {
    BridgeSessionResponse {
        id: env.id,
        environment_id: env.id,
        machine_name: env.machine_name.clone(),
        directory: env.directory.clone(),
        branch: env.branch.clone(),
        git_repo_url: env.git_repo_url.clone(),
        status: env.status.clone(),
        created_at: env.created_at,
        updated_at: env.updated_at,
    }
}

fn message_response(m: &BridgeMessage) -> BridgeMessageResponse {
    BridgeMessageResponse {
        id: m.id,
        role: m.role.clone(),
        content: m.content.clone(),
        thinking: m.thinking.clone(),
        steps: m.steps.clone(),
        created_at: m.created_at,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /sessions — list bridge sessions for the user's org
// ═══════════════════════════════════════════════════════════════════════════

async fn list_sessions(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<BridgeSessionResponse>>, AppError> {
    let org_id = match user.active_organization_id {
        Some(id) => id,
        None => return Ok(Json(vec![])),
    };

    // Mark stale environments as offline (heartbeat missed > 60s).
    sqlx::query(
        "UPDATE bridge_environments
         SET status = 'offline', updated_at = now()
         WHERE organization_id = $1
           AND status = 'connected'
           AND last_heartbeat_at < now() - interval '60 seconds'",
    )
    .bind(org_id)
    .execute(&state.db)
    .await?;

    // Clean up old offline sessions (>5 min since last heartbeat)
    sqlx::query(
        "DELETE FROM bridge_environments
         WHERE organization_id = $1
           AND status = 'offline'
           AND last_heartbeat_at < now() - interval '5 minutes'",
    )
    .bind(org_id)
    .execute(&state.db)
    .await?;

    // Only return active sessions (connected or recently disconnected)
    let envs = sqlx::query_as::<_, BridgeEnvironment>(
        "SELECT * FROM bridge_environments
         WHERE organization_id = $1
           AND (status = 'connected' OR last_heartbeat_at > now() - interval '5 minutes')
         ORDER BY created_at DESC",
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await?;

    let response: Vec<BridgeSessionResponse> = envs.iter().map(session_response).collect();

    Ok(Json(response))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /sessions/{id} — get session with paginated messages
// ═══════════════════════════════════════════════════════════════════════════

async fn get_session(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<BridgeSessionWithMessages>, AppError> {
    let org_id = user.active_organization_id.ok_or_else(|| {
        AppError::BadRequest("No active organization".to_string())
    })?;

    let env = ensure_org_env(&state, id, org_id).await?;

    // Clamp limit to [1, 200].
    let limit = params.limit.clamp(1, 200);
    let offset = params.offset.max(0);

    let messages = sqlx::query_as::<_, BridgeMessage>(
        "SELECT * FROM bridge_messages
         WHERE environment_id = $1
         ORDER BY created_at ASC
         LIMIT $2 OFFSET $3",
    )
    .bind(env.id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM bridge_messages WHERE environment_id = $1",
    )
    .bind(env.id)
    .fetch_one(&state.db)
    .await?;

    let msg_responses: Vec<BridgeMessageResponse> = messages.iter().map(message_response).collect();
    let has_more = (offset + limit) < total;

    Ok(Json(BridgeSessionWithMessages {
        id: env.id,
        environment_id: env.id,
        machine_name: env.machine_name.clone(),
        directory: env.directory.clone(),
        branch: env.branch.clone(),
        git_repo_url: env.git_repo_url.clone(),
        status: env.status.clone(),
        created_at: env.created_at,
        updated_at: env.updated_at,
        messages: msg_responses,
        total_messages: total,
        has_more,
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /sessions/{id}/messages — send a message and stream the response
// ═══════════════════════════════════════════════════════════════════════════

async fn send_message(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<BridgeMessageRequest>,
) -> Result<Sse<impl futures_util::Stream<Item = Result<Event, Infallible>>>, AppError> {
    body.validate()
        .map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let org_id = user.active_organization_id.ok_or_else(|| {
        AppError::BadRequest("No active organization".to_string())
    })?;

    let env = ensure_org_env(&state, id, org_id).await?;

    if env.status != "connected" {
        return Err(AppError::BadRequest(
            "Environment is not connected".to_string(),
        ));
    }

    let now = Utc::now();

    // 1. Persist the user's message.
    sqlx::query(
        "INSERT INTO bridge_messages (id, environment_id, role, content, created_at)
         VALUES ($1, $2, 'user', $3, $4)",
    )
    .bind(Uuid::new_v4())
    .bind(env.id)
    .bind(&body.content)
    .bind(now)
    .execute(&state.db)
    .await?;

    // 2. Enqueue a work item for the CLI to pick up.
    let work_item_id = Uuid::new_v4();
    let work_data = serde_json::json!({
        "type": "session",
        "content": body.content,
    });

    sqlx::query(
        "INSERT INTO bridge_work_queue
            (id, environment_id, work_type, data, state, created_at)
         VALUES ($1, $2, 'session', $3, 'pending', $4)",
    )
    .bind(work_item_id)
    .bind(env.id)
    .bind(&work_data)
    .bind(now)
    .execute(&state.db)
    .await?;

    // 3. Return an SSE stream that polls until the CLI completes the work.
    let db = state.db.clone();

    let stream = async_stream::stream! {
        // Emit initial processing event.
        yield Ok::<_, Infallible>(Event::default().data(
            serde_json::json!({"type": "processing"}).to_string()
        ));

        let timeout = tokio::time::Instant::now() + Duration::from_secs(120);

        loop {
            if tokio::time::Instant::now() > timeout {
                yield Ok(Event::default().data(
                    serde_json::json!({"type": "error", "message": "Timeout waiting for response"}).to_string()
                ));
                break;
            }

            // Check if work is completed.
            let work = sqlx::query_as::<_, BridgeWorkItem>(
                "SELECT * FROM bridge_work_queue WHERE id = $1"
            )
            .bind(work_item_id)
            .fetch_optional(&db)
            .await;

            if let Ok(Some(w)) = work {
                if w.state == "completed" {
                    if let Some(result) = w.result {
                        if let Some(content) = result.get("content").and_then(|c| c.as_str()) {
                            yield Ok(Event::default().data(
                                serde_json::json!({"type": "token", "content": content}).to_string()
                            ));
                        }
                        if let Some(thinking) = result.get("thinking").and_then(|c| c.as_str()) {
                            yield Ok(Event::default().data(
                                serde_json::json!({"type": "thinking", "content": thinking}).to_string()
                            ));
                        }
                    }
                    yield Ok(Event::default().data(
                        serde_json::json!({"type": "done"}).to_string()
                    ));
                    break;
                }
            }

            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /sessions/{id} — disconnect session (mark offline)
// ═══════════════════════════════════════════════════════════════════════════

async fn disconnect_session(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let org_id = user.active_organization_id.ok_or_else(|| {
        AppError::BadRequest("No active organization".to_string())
    })?;

    ensure_org_env(&state, id, org_id).await?;

    sqlx::query(
        "UPDATE bridge_environments
         SET status = 'offline', updated_at = $1
         WHERE id = $2",
    )
    .bind(Utc::now())
    .bind(id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
