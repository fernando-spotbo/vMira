//! Bridge environment routes — CLI registration, work polling, heartbeat.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{BridgeEnvironment, BridgeWorkItem};
use crate::schema::{
    HeartbeatResponse, RegisterEnvironmentRequest, RegisterEnvironmentResponse, WorkResponse,
};

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn bridge_routes() -> Router<AppState> {
    Router::new()
        .route("/bridge", post(register_environment))
        .route("/bridge/{id}", delete(deregister_environment))
        .route("/{id}/work/poll", get(poll_for_work))
        .route("/{id}/work/{work_id}/ack", post(acknowledge_work))
        .route("/{id}/work/{work_id}/heartbeat", post(heartbeat))
        .route("/{id}/work/{work_id}/stop", post(stop_work))
}

/// Separate router for /v1/sessions (session creation for bridge environments)
pub fn bridge_session_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_session))
        .route("/{id}/archive", post(archive_session))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

/// Verify that the bridge environment belongs to the authenticated user.
async fn ensure_env_owner(
    state: &AppState,
    env_id: Uuid,
    user_id: Uuid,
) -> Result<BridgeEnvironment, AppError> {
    let env = sqlx::query_as::<_, BridgeEnvironment>(
        "SELECT * FROM bridge_environments WHERE id = $1",
    )
    .bind(env_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Environment not found".to_string()))?;

    if env.user_id != user_id {
        return Err(AppError::Forbidden(
            "You do not own this environment".to_string(),
        ));
    }

    Ok(env)
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /bridge — register a new environment
// ═══════════════════════════════════════════════════════════════════════════

async fn register_environment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<RegisterEnvironmentRequest>,
) -> Result<(StatusCode, Json<RegisterEnvironmentResponse>), AppError> {
    let org_id = user.active_organization_id.ok_or_else(|| {
        AppError::BadRequest("No active organization — set one before registering".to_string())
    })?;

    let secret = format!("env-secret-{}", Uuid::new_v4());
    let now = Utc::now();

    // Idempotent re-registration: if caller supplies an existing env id, reuse it.
    if let Some(existing_id) = body.environment_id {
        let existing = sqlx::query_as::<_, BridgeEnvironment>(
            "SELECT * FROM bridge_environments WHERE id = $1 AND user_id = $2",
        )
        .bind(existing_id)
        .bind(user.id)
        .fetch_optional(&state.db)
        .await?;

        if let Some(env) = existing {
            // Re-activate with a fresh secret and updated metadata.
            sqlx::query(
                "UPDATE bridge_environments
                 SET secret = $1, status = 'connected', machine_name = $2,
                     directory = $3, branch = $4, git_repo_url = $5,
                     max_sessions = $6, metadata = $7,
                     last_heartbeat_at = $8, updated_at = $8
                 WHERE id = $9",
            )
            .bind(&secret)
            .bind(&body.machine_name)
            .bind(&body.directory)
            .bind(&body.branch)
            .bind(&body.git_repo_url)
            .bind(body.max_sessions)
            .bind(&body.metadata)
            .bind(now)
            .bind(env.id)
            .execute(&state.db)
            .await?;

            return Ok((
                StatusCode::OK,
                Json(RegisterEnvironmentResponse {
                    environment_id: env.id,
                    environment_secret: secret,
                }),
            ));
        }
        // If the id was given but not found / not owned, fall through to create.
    }

    let env_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO bridge_environments
            (id, user_id, organization_id, machine_name, directory, branch,
             git_repo_url, max_sessions, metadata, secret, status,
             last_heartbeat_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'connected',$11,$11,$11)",
    )
    .bind(env_id)
    .bind(user.id)
    .bind(org_id)
    .bind(&body.machine_name)
    .bind(&body.directory)
    .bind(&body.branch)
    .bind(&body.git_repo_url)
    .bind(body.max_sessions)
    .bind(&body.metadata)
    .bind(&secret)
    .bind(now)
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(RegisterEnvironmentResponse {
            environment_id: env_id,
            environment_secret: secret,
        }),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /{id}/work/poll — CLI polls for pending work
// ═══════════════════════════════════════════════════════════════════════════

async fn poll_for_work(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(env_id): Path<Uuid>,
) -> Result<Json<Option<WorkResponse>>, AppError> {
    let env = ensure_env_owner(&state, env_id, user.id).await?;

    let item = sqlx::query_as::<_, BridgeWorkItem>(
        "SELECT * FROM bridge_work_queue
         WHERE environment_id = $1 AND state = 'pending'
         ORDER BY created_at ASC
         LIMIT 1",
    )
    .bind(env.id)
    .fetch_optional(&state.db)
    .await?;

    let response = match item {
        Some(w) => {
            sqlx::query(
                "UPDATE bridge_work_queue SET state = 'claimed' WHERE id = $1",
            )
            .bind(w.id)
            .execute(&state.db)
            .await?;

            Some(WorkResponse {
                id: w.id,
                type_: w.work_type,
                environment_id: w.environment_id,
                state: "claimed".to_string(),
                data: w.data,
                secret: env.secret.clone(),
                created_at: w.created_at,
            })
        }
        None => None,
    };

    Ok(Json(response))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /{id}/work/{work_id}/ack — acknowledge claimed work
// ═══════════════════════════════════════════════════════════════════════════

async fn acknowledge_work(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((env_id, work_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    ensure_env_owner(&state, env_id, user.id).await?;

    let rows = sqlx::query(
        "UPDATE bridge_work_queue
         SET state = 'acknowledged', acknowledged_at = $1
         WHERE id = $2 AND environment_id = $3 AND state = 'claimed'",
    )
    .bind(Utc::now())
    .bind(work_id)
    .bind(env_id)
    .execute(&state.db)
    .await?;

    if rows.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Work item not found or not in 'claimed' state".to_string(),
        ));
    }

    Ok(StatusCode::OK)
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /{id}/work/{work_id}/heartbeat — extend lease
// ═══════════════════════════════════════════════════════════════════════════

async fn heartbeat(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((env_id, _work_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<HeartbeatResponse>, AppError> {
    ensure_env_owner(&state, env_id, user.id).await?;

    let now = Utc::now();

    sqlx::query(
        "UPDATE bridge_environments
         SET last_heartbeat_at = $1, status = 'connected', updated_at = $1
         WHERE id = $2",
    )
    .bind(now)
    .bind(env_id)
    .execute(&state.db)
    .await?;

    Ok(Json(HeartbeatResponse {
        lease_extended: true,
        state: "active".to_string(),
        last_heartbeat: now,
        ttl_seconds: 60,
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /{id}/work/{work_id}/stop — complete work item
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct StopWorkBody {
    result: Option<serde_json::Value>,
    #[serde(default)]
    force: bool,
}

async fn stop_work(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((env_id, work_id)): Path<(Uuid, Uuid)>,
    body: Option<Json<StopWorkBody>>,
) -> Result<StatusCode, AppError> {
    ensure_env_owner(&state, env_id, user.id).await?;

    let body = body.map(|b| b.0);
    let result = body.as_ref().and_then(|b| b.result.clone());
    let now = Utc::now();

    let rows = sqlx::query(
        "UPDATE bridge_work_queue
         SET state = 'completed', completed_at = $1, result = $2
         WHERE id = $3 AND environment_id = $4",
    )
    .bind(now)
    .bind(&result)
    .bind(work_id)
    .bind(env_id)
    .execute(&state.db)
    .await?;

    if rows.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Work item not found".to_string(),
        ));
    }

    // If the result contains assistant message content, persist it.
    if let Some(ref res) = result {
        let content = res.get("content").and_then(|c| c.as_str());
        let thinking = res.get("thinking").and_then(|t| t.as_str());
        let steps = res.get("steps");

        if let Some(content) = content {
            sqlx::query(
                "INSERT INTO bridge_messages
                    (id, environment_id, role, content, thinking, steps, created_at)
                 VALUES ($1, $2, 'assistant', $3, $4, $5, $6)",
            )
            .bind(Uuid::new_v4())
            .bind(env_id)
            .bind(content)
            .bind(thinking)
            .bind(steps)
            .bind(now)
            .execute(&state.db)
            .await?;
        }
    }

    Ok(StatusCode::OK)
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /bridge/{id} — deregister (mark offline)
// ═══════════════════════════════════════════════════════════════════════════

async fn deregister_environment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    ensure_env_owner(&state, id, user.id).await?;

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

// ═══════════════════════════════════════════════════════════════════════════
//  POST /v1/sessions — create a session on a bridge environment
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct CreateSessionRequest {
    environment_id: Uuid,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    events: serde_json::Value,
    #[serde(default)]
    session_context: serde_json::Value,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    permission_mode: Option<String>,
}

async fn create_session(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    // Verify the environment belongs to this user
    ensure_env_owner(&state, body.environment_id, user.id).await?;

    // Create a session record (stored as a work item with type 'session_created')
    let session_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO bridge_work_queue (id, environment_id, work_type, data, state, created_at)
         VALUES ($1, $2, 'session_created', $3, 'completed', $4)"
    )
    .bind(session_id)
    .bind(body.environment_id)
    .bind(serde_json::json!({
        "title": body.title,
        "source": body.source,
        "session_context": body.session_context,
    }))
    .bind(Utc::now())
    .execute(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({
        "id": session_id,
        "environment_id": body.environment_id,
        "status": "active",
    }))))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /v1/sessions/{id}/archive — archive a session
// ═══════════════════════════════════════════════════════════════════════════

async fn archive_session(
    State(state): State<AppState>,
    AuthUser(_user): AuthUser,
    Path(session_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Mark session as archived (idempotent)
    let rows = sqlx::query(
        "UPDATE bridge_work_queue SET state = 'archived'
         WHERE id = $1 AND work_type = 'session_created'"
    )
    .bind(session_id)
    .execute(&state.db)
    .await?;

    if rows.rows_affected() == 0 {
        // Already archived or doesn't exist — 409 Conflict (idempotent)
        return Ok(StatusCode::CONFLICT);
    }

    Ok(StatusCode::OK)
}
