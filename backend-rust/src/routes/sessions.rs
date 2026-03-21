//! Session management routes — users can view and revoke their active sessions.

use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{delete, get},
    Json, Router,
};
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::RefreshToken;
use crate::schema::SessionResponse;
use crate::services::audit::log_auth_event;
use crate::services::token::hash_token;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn session_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_sessions).delete(revoke_all_sessions))
        .route("/{session_id}", delete(revoke_session))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /
// ═══════════════════════════════════════════════════════════════════════════

async fn list_sessions(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    headers: axum::http::HeaderMap,
) -> Result<Json<Vec<SessionResponse>>, AppError> {
    let sessions = sqlx::query_as::<_, RefreshToken>(
        "SELECT * FROM refresh_tokens
         WHERE user_id = $1 AND (user_agent IS NULL OR user_agent != 'password-reset')
         ORDER BY created_at DESC"
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    // Identify current session by cookie hash
    let current_hash = extract_refresh_cookie(&headers)
        .map(|raw| hash_token(&raw, &state.config.secret_key));

    let response: Vec<SessionResponse> = sessions
        .iter()
        .map(|s| {
            let is_current = current_hash
                .as_ref()
                .map(|h| h == &s.token_hash)
                .unwrap_or(false);

            SessionResponse {
                id: s.id,
                user_agent: s.user_agent.clone(),
                ip_address: s.ip_address.clone(),
                created_at: s.created_at,
                expires_at: s.expires_at,
                is_current,
            }
        })
        .collect();

    Ok(Json(response))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /:session_id
// ═══════════════════════════════════════════════════════════════════════════

async fn revoke_session(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(session_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let session = sqlx::query_as::<_, RefreshToken>(
        "SELECT * FROM refresh_tokens WHERE id = $1 AND user_id = $2"
    )
    .bind(session_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Session not found".to_string()))?;

    sqlx::query("DELETE FROM refresh_tokens WHERE id = $1")
        .bind(session.id)
        .execute(&state.db)
        .await?;

    log_auth_event(
        "session_revoked",
        Some(&user.id),
        None,
        None,
        None,
        true,
        Some(&format!("session={session_id}")),
    );

    Ok(StatusCode::NO_CONTENT)
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /  (revoke all except current)
// ═══════════════════════════════════════════════════════════════════════════

async fn revoke_all_sessions(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    headers: axum::http::HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    let current_hash = extract_refresh_cookie(&headers)
        .map(|raw| hash_token(&raw, &state.config.secret_key));

    if let Some(ref current_hash) = current_hash {
        sqlx::query(
            "DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash != $2"
        )
        .bind(user.id)
        .bind(current_hash)
        .execute(&state.db)
        .await?;
    } else {
        sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
            .bind(user.id)
            .execute(&state.db)
            .await?;
    }

    log_auth_event(
        "all_sessions_revoked",
        Some(&user.id),
        None,
        None,
        None,
        true,
        None,
    );

    Ok(StatusCode::NO_CONTENT)
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helper
// ═══════════════════════════════════════════════════════════════════════════

/// Extract the raw refresh_token value from the Cookie header.
fn extract_refresh_cookie(headers: &axum::http::HeaderMap) -> Option<String> {
    let cookie_header = headers.get(header::COOKIE)?.to_str().ok()?;
    for pair in cookie_header.split(';') {
        let pair = pair.trim();
        if let Some(value) = pair.strip_prefix("refresh_token=") {
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}
