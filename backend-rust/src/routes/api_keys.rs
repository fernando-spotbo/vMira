//! API key management routes.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, delete},
    Json, Router,
};
use chrono::Utc;
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::ApiKey;
use crate::models::api_key::generate_api_key;
use crate::schema::{ApiKeyCreatedResponse, ApiKeyResponse, CreateKeyRequest};
use crate::services::token::hash_token;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn api_key_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_api_keys).post(create_api_key))
        .route("/{key_id}", delete(revoke_api_key))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /
// ═══════════════════════════════════════════════════════════════════════════

async fn list_api_keys(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<ApiKeyResponse>>, AppError> {
    let keys = sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_keys
         WHERE user_id = $1 AND is_active = true
         ORDER BY created_at DESC"
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let response: Vec<ApiKeyResponse> = keys
        .iter()
        .map(|k| ApiKeyResponse {
            id: k.id,
            name: k.name.clone(),
            key_prefix: k.key_prefix.clone(),
            is_active: k.is_active,
            total_requests: k.total_requests,
            total_tokens: k.total_tokens,
            last_used_at: k.last_used_at,
            created_at: k.created_at,
        })
        .collect();

    Ok(Json(response))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /
// ═══════════════════════════════════════════════════════════════════════════

async fn create_api_key(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<CreateKeyRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    // Check max active keys
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = true"
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    if count >= 10 {
        return Err(AppError::BadRequest(
            "Maximum 10 active API keys".to_string(),
        ));
    }

    let raw_key = generate_api_key();
    let key_hash = hash_token(&raw_key, &state.config.secret_key);
    let key_prefix = &raw_key[..raw_key.len().min(16)];
    let now = Utc::now();
    let key_id = Uuid::new_v4();

    let api_key = sqlx::query_as::<_, ApiKey>(
        "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, is_active,
                              requests_today, total_requests, total_tokens, created_at)
         VALUES ($1, $2, $3, $4, $5, true, 0, 0, 0, $6)
         RETURNING *"
    )
    .bind(key_id)
    .bind(user.id)
    .bind(&body.name)
    .bind(&key_hash)
    .bind(key_prefix)
    .bind(now)
    .fetch_one(&state.db)
    .await?;

    let response = ApiKeyCreatedResponse {
        id: api_key.id,
        name: api_key.name,
        key_prefix: api_key.key_prefix,
        is_active: api_key.is_active,
        total_requests: api_key.total_requests,
        total_tokens: api_key.total_tokens,
        last_used_at: api_key.last_used_at,
        created_at: api_key.created_at,
        key: raw_key,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /:id
// ═══════════════════════════════════════════════════════════════════════════

async fn revoke_api_key(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(key_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let key = sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_keys WHERE id = $1 AND user_id = $2"
    )
    .bind(key_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("API key not found".to_string()))?;

    // Soft delete: revoke, don't destroy (keeps audit trail)
    sqlx::query("UPDATE api_keys SET is_active = false WHERE id = $1")
        .bind(key.id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
