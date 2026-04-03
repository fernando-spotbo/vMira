//! Authentication extractors for Axum.
//!
//! - `AuthUser` — extracts a `User` from a JWT Bearer token or `access_token`
//!   cookie.
//! - `ApiKeyUser` — extracts a `User` from an `sk-mira-*` API key in the
//!   Authorization header.

use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts},
};
use chrono::Utc;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::models::User;
use crate::services::audit::log_security_event;
use crate::services::rate_limit;
use crate::services::token::{decode_access_token, hash_token};
use crate::services::token_revocation;

// ═══════════════════════════════════════════════════════════════════════════
//  AuthUser — JWT-based extractor
// ═══════════════════════════════════════════════════════════════════════════

/// Extractor that resolves the currently authenticated user from either:
///   1. `Authorization: Bearer <jwt>` header, or
///   2. `access_token` cookie.
pub struct AuthUser(pub User);

impl std::ops::Deref for AuthUser {
    type Target = User;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    AppState: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        // 1. Try Authorization: Bearer <token>
        let token = extract_bearer_token(parts)
            .or_else(|| extract_cookie_token(parts, "access_token"));

        let token = token.ok_or_else(|| {
            AppError::Unauthorized("Not authenticated".to_string())
        })?;

        // 2. Decode JWT — or fall back to API key auth for sk-mira-* tokens
        let claims = match decode_access_token(&token, &app_state.config) {
            Some(c) => c,
            None => {
                if token.starts_with("sk-mira-") {
                    let key_hash = hash_token(&token, &app_state.config.secret_key);
                    let api_key_row = sqlx::query_as::<_, crate::models::ApiKey>(
                        "SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true"
                    )
                    .bind(&key_hash)
                    .fetch_optional(&app_state.db)
                    .await
                    .map_err(|_| AppError::Internal("Database error".to_string()))?
                    .ok_or_else(|| AppError::Unauthorized("Invalid API key".to_string()))?;

                    let _ = sqlx::query(
                        "UPDATE api_keys SET total_requests = total_requests + 1, last_used_at = now() WHERE id = $1"
                    )
                    .bind(api_key_row.id)
                    .execute(&app_state.db)
                    .await;

                    let user = sqlx::query_as::<_, User>(
                        "SELECT * FROM users WHERE id = $1"
                    )
                    .bind(api_key_row.user_id)
                    .fetch_optional(&app_state.db)
                    .await
                    .map_err(|_| AppError::Internal("Database error".to_string()))?
                    .ok_or_else(|| AppError::Unauthorized("User not found".to_string()))?;

                    if !user.is_active {
                        return Err(AppError::Unauthorized("Account disabled".to_string()));
                    }
                    return Ok(AuthUser(user));
                }
                return Err(AppError::Unauthorized("Invalid token".to_string()));
            }
        };

        // 3. Parse user ID from subject claim
        let user_id: Uuid = claims
            .sub
            .parse()
            .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

        // 4. Check token revocation (fail CLOSED — if Redis is down, reject)
        let revoked = token_revocation::is_user_revoked(&app_state.redis, &user_id.to_string())
            .await
            .unwrap_or(true);
        if revoked {
            return Err(AppError::Unauthorized("Session expired".to_string()));
        }

        // 5. Load user from database
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(&app_state.db)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to query user");
            AppError::Internal("Database error".to_string())
        })?;

        let user = user.ok_or_else(|| {
            AppError::Unauthorized("Not authenticated".to_string())
        })?;

        if !user.is_active {
            return Err(AppError::Unauthorized("Not authenticated".to_string()));
        }

        Ok(AuthUser(user))
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ApiKeyUser — API key extractor
// ═══════════════════════════════════════════════════════════════════════════

/// Extractor that resolves a user from an `sk-mira-*` API key.
pub struct ApiKeyUser(pub User);

impl std::ops::Deref for ApiKeyUser {
    type Target = User;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<S> FromRequestParts<S> for ApiKeyUser
where
    S: Send + Sync,
    AppState: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        // Extract client IP for rate limiting
        let client_ip = extract_client_ip(parts);

        // 1. Extract Bearer token
        let key = extract_bearer_token(parts).ok_or_else(|| {
            AppError::Unauthorized("API key required".to_string())
        })?;

        // 2. Validate prefix
        if !key.starts_with("sk-mira-") {
            // Rate limit invalid key attempts
            if let Err(e) = rate_limit::rate_limit_api_key_auth(&app_state.redis, &client_ip).await {
                tracing::warn!(error = %e, "rate limit on invalid api key format");
            }
            log_security_event("invalid_api_key_format", Some(&client_ip), None);
            return Err(AppError::Unauthorized("Invalid API key".to_string()));
        }

        // 3. Hash the key and look up in DB
        let key_hash = hash_token(&key, &app_state.config.secret_key);

        let api_key_row = sqlx::query_as::<_, crate::models::ApiKey>(
            "SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true"
        )
        .bind(&key_hash)
        .fetch_optional(&app_state.db)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to query api_keys");
            AppError::Internal("Database error".to_string())
        })?;

        let api_key_row = match api_key_row {
            Some(k) => k,
            None => {
                // Rate limit on failure
                if let Err(e) = rate_limit::rate_limit_api_key_auth(&app_state.redis, &client_ip).await {
                    tracing::warn!(error = %e, "rate limit on invalid api key");
                }
                log_security_event("invalid_api_key", Some(&client_ip), None);
                return Err(AppError::Unauthorized("Invalid API key".to_string()));
            }
        };

        // 4. Atomically increment counters
        sqlx::query(
            "UPDATE api_keys
             SET total_requests = total_requests + 1,
                 requests_today = requests_today + 1,
                 last_used_at = $1
             WHERE id = $2"
        )
        .bind(Utc::now())
        .bind(api_key_row.id)
        .execute(&app_state.db)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to update api_key counters");
            AppError::Internal("Database error".to_string())
        })?;

        // 5. Load the user
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = $1"
        )
        .bind(api_key_row.user_id)
        .fetch_optional(&app_state.db)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to query user for api key");
            AppError::Internal("Database error".to_string())
        })?;

        let user = user.ok_or_else(|| {
            AppError::Unauthorized("User not found or inactive".to_string())
        })?;

        if !user.is_active {
            return Err(AppError::Unauthorized("User not found or inactive".to_string()));
        }

        Ok(ApiKeyUser(user))
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

/// Needed so that we can use `AppState::from_ref` in extractors.
pub trait FromRef<T> {
    fn from_ref(input: &T) -> Self;
}

impl FromRef<AppState> for AppState {
    fn from_ref(input: &AppState) -> Self {
        input.clone()
    }
}

/// Extract a Bearer token from the Authorization header.
fn extract_bearer_token(parts: &Parts) -> Option<String> {
    let auth_header = parts.headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let token = auth_header.strip_prefix("Bearer ")?;
    if token.is_empty() {
        return None;
    }
    Some(token.to_string())
}

/// Extract a named cookie value from the Cookie header.
fn extract_cookie_token(parts: &Parts, name: &str) -> Option<String> {
    let cookie_header = parts.headers.get(header::COOKIE)?.to_str().ok()?;
    for pair in cookie_header.split(';') {
        let pair = pair.trim();
        if let Some(value) = pair.strip_prefix(&format!("{name}=")) {
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Extract the client IP address from ConnectInfo (primary) or headers (fallback).
pub fn extract_client_ip(parts: &Parts) -> String {
    // Primary: actual TCP peer address (unforgeable when using into_make_service_with_connect_info)
    if let Some(ci) = parts.extensions.get::<axum::extract::ConnectInfo<std::net::SocketAddr>>() {
        return ci.0.ip().to_string();
    }
    // Fallback: rightmost X-Forwarded-For entry (set by trusted reverse proxy)
    if let Some(forwarded) = parts.headers.get("x-forwarded-for") {
        if let Ok(val) = forwarded.to_str() {
            if let Some(last_ip) = val.rsplit(',').next() {
                let ip = last_ip.trim();
                if !ip.is_empty() {
                    return ip.to_string();
                }
            }
        }
    }
    if let Some(real_ip) = parts.headers.get("x-real-ip") {
        if let Ok(ip) = real_ip.to_str() {
            return ip.trim().to_string();
        }
    }
    "unknown".to_string()
}
