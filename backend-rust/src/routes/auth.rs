//! Authentication routes — registration, login, token refresh, logout,
//! password reset, user profile, and 152-FZ data subject rights.

use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::User;
use crate::schema::{
    ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest,
    TokenResponse, UpdateUserRequest, UserResponse,
};
use crate::services::audit::{log_auth_event, log_security_event};
use crate::services::rate_limit;
use crate::services::token::{
    create_access_token, create_refresh_token, generate_token, hash_password, hash_token,
    verify_password,
};
use crate::services::token_revocation;
use crate::services::usage;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/phone/send-code", post(phone_send_code))
        .route("/phone/verify", post(phone_verify))
        .route("/vk", post(vk_auth))
        .route("/yandex", post(yandex_auth))
        .route("/google", post(google_auth))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout))
        .route("/forgot-password", post(forgot_password))
        .route("/reset-password", post(reset_password))
        .route("/me", get(me).patch(update_me))
        .route("/me/usage", get(me_usage))
        .route("/me/data-export", get(data_export))
        .route("/me/data", delete(delete_account))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

fn user_response(user: &User) -> UserResponse {
    UserResponse {
        id: user.id,
        name: user.name.clone(),
        email: user.email.clone(),
        phone: mask_phone(user.phone.as_deref()),
        avatar_url: user.avatar_url.clone(),
        plan: user.plan.clone(),
        language: user.language.clone(),
        created_at: user.created_at,
    }
}

/// Mask a phone number for API responses: "+7***4567"
fn mask_phone(phone: Option<&str>) -> Option<String> {
    let phone = phone?;
    if phone.len() < 8 {
        return Some(phone.to_string());
    }
    let prefix = &phone[..2];
    let suffix = &phone[phone.len() - 4..];
    Some(format!("{prefix}***{suffix}"))
}

/// Issue access + refresh tokens, store the refresh token in DB, and return
/// a `TokenResponse`.  The caller is responsible for setting the cookie.
async fn issue_tokens(
    user: &User,
    ip: &str,
    user_agent: Option<&str>,
    state: &AppState,
) -> Result<(TokenResponse, String), AppError> {
    let access_token = create_access_token(&user.id, &state.config)
        .map_err(|e| AppError::Internal(format!("JWT creation failed: {e}")))?;

    let (raw_refresh, refresh_hash, expires_at) = create_refresh_token(&user.id, &state.config);

    // Cap the number of active sessions per user. If the user has too many,
    // evict the oldest non-password-reset sessions to prevent session flooding.
    const MAX_SESSIONS_PER_USER: i64 = 20;
    let session_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND (user_agent IS NULL OR user_agent != 'password-reset')"
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    if session_count >= MAX_SESSIONS_PER_USER {
        // Delete the oldest sessions to make room
        sqlx::query(
            "DELETE FROM refresh_tokens WHERE id IN (
                SELECT id FROM refresh_tokens
                WHERE user_id = $1 AND (user_agent IS NULL OR user_agent != 'password-reset')
                ORDER BY created_at ASC
                LIMIT $2
            )"
        )
        .bind(user.id)
        .bind(session_count - MAX_SESSIONS_PER_USER + 1)
        .execute(&state.db)
        .await?;
    }

    sqlx::query(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)"
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind(&refresh_hash)
    .bind(user_agent)
    .bind(ip)
    .bind(expires_at)
    .bind(Utc::now())
    .execute(&state.db)
    .await?;

    let token_response = TokenResponse::new(
        access_token,
        state.config.access_token_expire_minutes * 60,
    );

    Ok((token_response, raw_refresh))
}

/// Build a Set-Cookie header for the refresh token.
/// Path=/ so the cookie is sent on all requests (the proxy rewrites paths).
/// When `secure` is false (debug mode), omits `Secure` flag for HTTP localhost.
fn refresh_cookie_header(raw_token: &str, max_age_days: i64, _api_prefix: &str, secure: bool) -> String {
    let max_age = max_age_days * 86400;
    let sec = if secure { "; Secure" } else { "" };
    format!("refresh_token={raw_token}; HttpOnly; SameSite=Lax; Max-Age={max_age}; Path=/{sec}")
}

/// Build a delete-cookie header for the refresh token.
fn delete_refresh_cookie_header(_api_prefix: &str, secure: bool) -> String {
    let sec = if secure { "; Secure" } else { "" };
    format!("refresh_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/{sec}")
}

/// Extract useful headers from the request parts via the axum extension.
fn extract_request_headers(
    headers: &axum::http::HeaderMap,
) -> (String, Option<String>) {
    // Rightmost X-Forwarded-For entry (set by trusted reverse proxy)
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.rsplit(',').next())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "unknown".to_string());

    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    (client_ip, user_agent)
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /register
// ═══════════════════════════════════════════════════════════════════════════

async fn register(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Validate
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let (client_ip, _user_agent) = extract_request_headers(&headers);

    // Rate limit by IP
    rate_limit::rate_limit_login(&state.redis, &client_ip)
        .await
        .map_err(|e| match e {
            rate_limit::RateLimitError::Exceeded { retry_after_seconds } => {
                AppError::RateLimited { retry_after: retry_after_seconds as u32 }
            }
            rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
        })?;

    // 152-FZ: Consent must be explicit
    if !body.consent_personal_data {
        return Err(AppError::Unprocessable(
            "Consent for personal data processing is required".to_string(),
        ));
    }

    // Need at least email or phone
    if body.email.is_none() && body.phone.is_none() {
        return Err(AppError::Unprocessable(
            "Email or phone number required".to_string(),
        ));
    }

    // Check uniqueness
    let existing = if body.email.is_some() && body.phone.is_some() {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE email = $1 OR phone = $2"
        )
        .bind(body.email.as_deref())
        .bind(body.phone.as_deref())
        .fetch_one(&state.db)
        .await?
    } else if let Some(ref email) = body.email {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE email = $1"
        )
        .bind(email)
        .fetch_one(&state.db)
        .await?
    } else {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE phone = $1"
        )
        .bind(body.phone.as_deref())
        .fetch_one(&state.db)
        .await?
    };

    if existing > 0 {
        // Timing oracle prevention: always hash password on duplicates
        let _ = hash_password(&body.password);
        log_security_event("register_duplicate", Some(&client_ip), None);
        return Err(AppError::Conflict(
            "Registration failed. If this account exists, try logging in.".to_string(),
        ));
    }

    let password_hash = hash_password(&body.password)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {e}")))?;

    let now = Utc::now();
    let user_id = Uuid::new_v4();

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, name, email, phone, password_hash, consent_personal_data,
                           consent_personal_data_at, created_at, updated_at,
                           daily_reset_at, language, plan, is_active, is_verified, is_admin,
                           daily_messages_used, failed_login_attempts, consent_marketing)
         VALUES ($1, $2, $3, $4, $5, true, $6, $6, $6, $6, 'ru', 'free', true, false, false, 0, 0, false)
         RETURNING *"
    )
    .bind(user_id)
    .bind(&body.name)
    .bind(body.email.as_deref())
    .bind(body.phone.as_deref())
    .bind(&password_hash)
    .bind(now)
    .fetch_one(&state.db)
    .await?;

    log_auth_event(
        "register",
        Some(&user.id),
        body.email.as_deref(),
        Some(&client_ip),
        None,
        true,
        None,
    );

    Ok((StatusCode::CREATED, Json(user_response(&user))))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /login
// ═══════════════════════════════════════════════════════════════════════════

async fn login(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let (client_ip, user_agent) = extract_request_headers(&headers);
    let identifier = body.email.as_deref().or(body.phone.as_deref());

    let identifier = identifier.ok_or_else(|| {
        AppError::Unprocessable("Email or phone required".to_string())
    })?;

    // Rate limit by IP and by identifier
    for key in [&client_ip, &format!("id:{identifier}")] {
        rate_limit::rate_limit_login(&state.redis, key)
            .await
            .map_err(|e| match e {
                rate_limit::RateLimitError::Exceeded { retry_after_seconds } => {
                    AppError::RateLimited { retry_after: retry_after_seconds as u32 }
                }
                rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
            })?;
    }

    // Find user by email or phone
    let user: Option<User> = if body.email.is_some() {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(body.email.as_deref())
            .fetch_optional(&state.db)
            .await?
    } else {
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE phone = $1")
            .bind(body.phone.as_deref())
            .fetch_optional(&state.db)
            .await?
    };

    // Timing oracle prevention: always verify password even for unknown users
    let user = match user {
        Some(u) if u.password_hash.is_some() => u,
        _ => {
            let _ = hash_password("dummy-password-timing-burn");
            log_auth_event(
                "login_failed",
                None,
                body.email.as_deref(),
                Some(&client_ip),
                None,
                false,
                Some("unknown"),
            );
            return Err(AppError::Unauthorized("Invalid credentials".to_string()));
        }
    };

    // ALWAYS verify password first (constant time), then check lock status
    let password_valid = verify_password(&body.password, user.password_hash.as_deref().unwrap_or(""))
        .unwrap_or(false);

    // Check lockout
    if let Some(locked_until) = user.locked_until {
        if locked_until > Utc::now() {
            log_auth_event(
                "login_locked",
                Some(&user.id),
                None,
                Some(&client_ip),
                None,
                false,
                None,
            );
            return Err(AppError::Unauthorized("Invalid credentials".to_string()));
        }
    }

    if !password_valid {
        let new_attempts = user.failed_login_attempts + 1;

        if new_attempts >= 5 {
            let lock_until = Utc::now() + Duration::minutes(15);
            sqlx::query(
                "UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3"
            )
            .bind(new_attempts)
            .bind(lock_until)
            .bind(user.id)
            .execute(&state.db)
            .await?;

            log_auth_event(
                "account_locked",
                Some(&user.id),
                None,
                Some(&client_ip),
                None,
                false,
                None,
            );
        } else {
            sqlx::query("UPDATE users SET failed_login_attempts = $1 WHERE id = $2")
                .bind(new_attempts)
                .bind(user.id)
                .execute(&state.db)
                .await?;
        }

        log_auth_event(
            "login_failed",
            Some(&user.id),
            None,
            Some(&client_ip),
            None,
            false,
            Some(&format!("attempt={new_attempts}")),
        );

        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    // Success: reset lockout counters
    sqlx::query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    // Check if the account is active
    if !user.is_active {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    log_auth_event(
        "login",
        Some(&user.id),
        None,
        Some(&client_ip),
        user_agent.as_deref(),
        true,
        None,
    );

    let (token_response, raw_refresh) =
        issue_tokens(&user, &client_ip, user_agent.as_deref(), &state).await?;

    let cookie = refresh_cookie_header(
        &raw_refresh,
        state.config.refresh_token_expire_days,
        &state.config.api_prefix,
        !state.config.debug,
    );

    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(token_response),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Phone SMS stubs
// ═══════════════════════════════════════════════════════════════════════════

async fn phone_send_code() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({ "detail": "Phone SMS authentication not yet implemented" })),
    )
}

async fn phone_verify() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({ "detail": "Phone verification not yet implemented" })),
    )
}

// ═══════════════════════════════════════════════════════════════════════════
//  OAuth stubs
// ═══════════════════════════════════════════════════════════════════════════

async fn vk_auth(State(state): State<AppState>) -> impl IntoResponse {
    if state.config.vk_client_id.is_empty() {
        return (
            StatusCode::NOT_IMPLEMENTED,
            Json(serde_json::json!({ "detail": "VK OAuth not configured" })),
        );
    }
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({ "detail": "VK OAuth not yet implemented in Rust backend" })),
    )
}

async fn yandex_auth(State(state): State<AppState>) -> impl IntoResponse {
    if state.config.yandex_client_id.is_empty() {
        return (
            StatusCode::NOT_IMPLEMENTED,
            Json(serde_json::json!({ "detail": "Yandex OAuth not configured" })),
        );
    }
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({ "detail": "Yandex OAuth not yet implemented in Rust backend" })),
    )
}

async fn google_auth(State(state): State<AppState>) -> impl IntoResponse {
    if state.config.google_client_id.is_empty() {
        return (
            StatusCode::NOT_IMPLEMENTED,
            Json(serde_json::json!({ "detail": "Google OAuth not configured" })),
        );
    }
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(serde_json::json!({ "detail": "Google OAuth not yet implemented in Rust backend" })),
    )
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /refresh
// ═══════════════════════════════════════════════════════════════════════════

async fn refresh(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    let (client_ip, user_agent) = extract_request_headers(&headers);

    // Read refresh_token cookie
    let raw_token = headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|cookies| {
            cookies.split(';').find_map(|pair| {
                let pair = pair.trim();
                pair.strip_prefix("refresh_token=")
                    .map(|v| v.to_string())
            })
        });

    let raw_token = raw_token.ok_or_else(|| {
        AppError::Unauthorized("Not authenticated".to_string())
    })?;

    let token_hash = hash_token(&raw_token, &state.config.secret_key);

    // Atomic lookup + delete in a single statement using DELETE ... RETURNING
    // This prevents race conditions where two concurrent refresh requests
    // both read the same token before either deletes it.
    let rt = sqlx::query_as::<_, crate::models::RefreshToken>(
        "DELETE FROM refresh_tokens WHERE token_hash = $1 RETURNING *"
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;

    match rt {
        None => {
            // Token not found — either already consumed (race) or never existed.
            // Treat as potential token theft: if someone replayed a rotated token,
            // the legitimate holder already consumed it.
            return Err(AppError::Unauthorized("Not authenticated".to_string()));
        }
        Some(ref rt) if rt.expires_at < Utc::now() => {
            // Expired token reuse: potential theft
            // Revoke all sessions AND invalidate access tokens
            log_security_event(
                "expired_refresh_reuse",
                Some(&client_ip),
                Some(&format!("user={}", rt.user_id)),
            );

            let ttl = (state.config.access_token_expire_minutes * 60) as u64;
            let _ = token_revocation::revoke_user_tokens(
                &state.redis,
                &rt.user_id.to_string(),
                ttl,
            )
            .await;

            sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
                .bind(rt.user_id)
                .execute(&state.db)
                .await?;

            return Err(AppError::Unauthorized("Not authenticated".to_string()));
        }
        _ => {}
    }

    let rt = rt.unwrap();

    // Reject password-reset tokens used as refresh tokens
    if rt.user_agent.as_deref() == Some("password-reset") {
        return Err(AppError::Unauthorized("Not authenticated".to_string()));
    }

    let user_id = rt.user_id;

    // Load user to create new tokens
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Not authenticated".to_string()))?;

    // Check that the user account is still active.
    // Without this, deactivated users can continue refreshing tokens indefinitely.
    if !user.is_active {
        // Revoke all remaining tokens for the deactivated user
        sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
            .bind(user.id)
            .execute(&state.db)
            .await?;
        return Err(AppError::Unauthorized("Not authenticated".to_string()));
    }

    let (token_response, raw_refresh) =
        issue_tokens(&user, &client_ip, user_agent.as_deref(), &state).await?;

    let cookie = refresh_cookie_header(
        &raw_refresh,
        state.config.refresh_token_expire_days,
        &state.config.api_prefix,
        !state.config.debug,
    );

    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(token_response),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /logout
// ═══════════════════════════════════════════════════════════════════════════

async fn logout(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    // Read refresh_token cookie
    let raw_token = headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|cookies| {
            cookies.split(';').find_map(|pair| {
                let pair = pair.trim();
                pair.strip_prefix("refresh_token=")
                    .map(|v| v.to_string())
            })
        });

    if let Some(raw_token) = raw_token {
        let token_hash = hash_token(&raw_token, &state.config.secret_key);
        sqlx::query("DELETE FROM refresh_tokens WHERE token_hash = $1")
            .bind(&token_hash)
            .execute(&state.db)
            .await?;
    }

    let cookie = delete_refresh_cookie_header(&state.config.api_prefix, !state.config.debug);

    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(serde_json::json!({ "detail": "ok" })),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /forgot-password
// ═══════════════════════════════════════════════════════════════════════════

async fn forgot_password(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<ForgotPasswordRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let (client_ip, _) = extract_request_headers(&headers);

    rate_limit::rate_limit_login(&state.redis, &client_ip)
        .await
        .map_err(|e| match e {
            rate_limit::RateLimitError::Exceeded { retry_after_seconds } => {
                AppError::RateLimited { retry_after: retry_after_seconds as u32 }
            }
            rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
        })?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&body.email)
        .fetch_optional(&state.db)
        .await?;

    if let Some(ref user) = user {
        if user.password_hash.is_some() {
            // Delete any existing password-reset tokens for this user to prevent
            // token flooding attacks and ensure only one reset is active at a time.
            sqlx::query(
                "DELETE FROM refresh_tokens WHERE user_id = $1 AND user_agent = 'password-reset'"
            )
            .bind(user.id)
            .execute(&state.db)
            .await?;

            let raw_token = generate_token();
            let token_hash = hash_token(&raw_token, &state.config.secret_key);
            let expires_at = Utc::now() + Duration::hours(1);

            sqlx::query(
                "INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at, created_at)
                 VALUES ($1, $2, $3, 'password-reset', $4, $5, $6)"
            )
            .bind(Uuid::new_v4())
            .bind(user.id)
            .bind(&token_hash)
            .bind(&client_ip)
            .bind(expires_at)
            .bind(Utc::now())
            .execute(&state.db)
            .await?;

            log_auth_event(
                "forgot_password",
                None,
                Some(&body.email),
                Some(&client_ip),
                None,
                true,
                None,
            );
        }
    } else {
        // Timing oracle prevention
        let _ = hash_password("timing-burn");
    }

    Ok(Json(serde_json::json!({
        "detail": "If an account exists, a reset link has been sent."
    })))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /reset-password
// ═══════════════════════════════════════════════════════════════════════════

async fn reset_password(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<ResetPasswordRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let (client_ip, _) = extract_request_headers(&headers);

    rate_limit::rate_limit_login(&state.redis, &client_ip)
        .await
        .map_err(|e| match e {
            rate_limit::RateLimitError::Exceeded { retry_after_seconds } => {
                AppError::RateLimited { retry_after: retry_after_seconds as u32 }
            }
            rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
        })?;

    let token_hash = hash_token(&body.token, &state.config.secret_key);

    let rt = sqlx::query_as::<_, crate::models::RefreshToken>(
        "SELECT * FROM refresh_tokens WHERE token_hash = $1"
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;

    let rt = rt.ok_or_else(|| {
        AppError::BadRequest("Invalid or expired reset token".to_string())
    })?;

    if rt.expires_at < Utc::now() || rt.user_agent.as_deref() != Some("password-reset") {
        return Err(AppError::BadRequest(
            "Invalid or expired reset token".to_string(),
        ));
    }

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(rt.user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::BadRequest("Invalid reset token".to_string()))?;

    let new_hash = hash_password(&body.password)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {e}")))?;

    // Update password, clear lockout, delete all refresh tokens
    sqlx::query(
        "UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = $2
         WHERE id = $3"
    )
    .bind(&new_hash)
    .bind(Utc::now())
    .bind(user.id)
    .execute(&state.db)
    .await?;

    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    // Revoke all access tokens — fail if Redis is down to prevent stale tokens
    let ttl = (state.config.access_token_expire_minutes * 60) as u64;
    if let Err(e) = token_revocation::revoke_user_tokens(&state.redis, &user.id.to_string(), ttl).await {
        tracing::error!(error = %e, user_id = %user.id, "Failed to revoke tokens after password reset");
        return Err(AppError::Internal("Password updated but session revocation failed — please log out manually".to_string()));
    }

    log_auth_event(
        "password_reset",
        Some(&user.id),
        None,
        Some(&client_ip),
        None,
        true,
        None,
    );

    Ok(Json(serde_json::json!({
        "detail": "Password reset successfully."
    })))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /me
// ═══════════════════════════════════════════════════════════════════════════

async fn me(AuthUser(user): AuthUser) -> Json<UserResponse> {
    Json(user_response(&user))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /me/usage
// ═══════════════════════════════════════════════════════════════════════════

async fn me_usage(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let daily = usage::get_user_usage_today(&state.db, user.id).await?;
    let monthly = usage::get_user_usage_month(&state.db, user.id).await?;

    // Plan-based quota info
    let daily_limit: i64 = match user.plan.as_str() {
        "free" => 20,
        "pro" => 500,
        "max" | "enterprise" => -1,
        _ => 20,
    };

    let remaining = if daily_limit == -1 {
        -1 // unlimited
    } else {
        (daily_limit - daily.total_requests).max(0)
    };

    Ok(Json(serde_json::json!({
        "today": daily,
        "month": monthly,
        "quota": {
            "daily_limit": daily_limit,
            "remaining_today": remaining,
            "plan": user.plan,
        }
    })))
}

// ═══════════════════════════════════════════════════════════════════════════
//  PATCH /me
// ═══════════════════════════════════════════════════════════════════════════

async fn update_me(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<UpdateUserRequest>,
) -> Result<Json<UserResponse>, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let name = body.name.as_deref().unwrap_or(&user.name);
    let language = body.language.as_deref().unwrap_or(&user.language);

    let updated = sqlx::query_as::<_, User>(
        "UPDATE users SET name = $1, language = $2, updated_at = $3 WHERE id = $4 RETURNING *"
    )
    .bind(name)
    .bind(language)
    .bind(Utc::now())
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(user_response(&updated)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /me/data-export  (152-FZ: Right of access)
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct PaginationParams {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_limit() -> i64 {
    100
}

async fn data_export(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<PaginationParams>,
) -> Result<impl IntoResponse, AppError> {
    let limit = params.limit.min(500);
    let offset = params.offset.max(0);

    // Load conversations
    let conversations = sqlx::query_as::<_, crate::models::Conversation>(
        "SELECT * FROM conversations WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3"
    )
    .bind(user.id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    // Load messages for each conversation
    let conv_ids: Vec<Uuid> = conversations.iter().map(|c| c.id).collect();

    let messages = if !conv_ids.is_empty() {
        sqlx::query_as::<_, crate::models::Message>(
            "SELECT * FROM messages WHERE conversation_id = ANY($1)
             ORDER BY created_at ASC"
        )
        .bind(&conv_ids)
        .fetch_all(&state.db)
        .await?
    } else {
        vec![]
    };

    // Build response
    let mut conv_data = Vec::new();
    for c in &conversations {
        let conv_messages: Vec<serde_json::Value> = messages
            .iter()
            .filter(|m| m.conversation_id == c.id)
            .map(|m| {
                serde_json::json!({
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at.to_rfc3339(),
                })
            })
            .collect();

        conv_data.push(serde_json::json!({
            "id": c.id.to_string(),
            "title": c.title,
            "created_at": c.created_at.to_rfc3339(),
            "messages": conv_messages,
        }));
    }

    let data = serde_json::json!({
        "user": {
            "id": user.id.to_string(),
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "plan": user.plan,
            "created_at": user.created_at.to_rfc3339(),
        },
        "conversations": conv_data,
        "pagination": {
            "limit": limit,
            "offset": offset,
        },
    });

    Ok((
        StatusCode::OK,
        [
            (header::CACHE_CONTROL, "no-store"),
            (header::PRAGMA, "no-cache"),
        ],
        Json(data),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /me/data  (152-FZ: Right of deletion)
// ═══════════════════════════════════════════════════════════════════════════

async fn delete_account(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<impl IntoResponse, AppError> {
    // Collect attachment file paths BEFORE deleting from DB (for disk cleanup)
    let attachment_paths: Vec<String> = sqlx::query_scalar(
        "SELECT storage_path FROM attachments WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Delete all user data in a transaction
    let mut tx = state.db.begin().await?;

    sqlx::query("DELETE FROM message_feedback WHERE user_id = $1")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM attachments WHERE user_id = $1")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = $1)")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM conversations WHERE user_id = $1")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM api_keys WHERE user_id = $1")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    // Delete attachment files from disk (best-effort, after DB commit)
    for path in &attachment_paths {
        let _ = tokio::fs::remove_file(path).await;
    }

    log_auth_event(
        "account_deleted",
        Some(&user.id),
        None,
        None,
        None,
        true,
        None,
    );

    Ok(StatusCode::NO_CONTENT)
}
