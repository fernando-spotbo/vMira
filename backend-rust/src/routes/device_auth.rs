//! Device authorization flow for CLI authentication.
//!
//! Implements OAuth 2.0 Device Authorization Grant (RFC 8628):
//! 1. CLI requests a device code: POST /api/v1/auth/device/code
//! 2. User opens browser to /authorize and enters the code
//! 3. CLI polls for token: POST /api/v1/auth/device/token
//!
//! Device codes are stored in Redis with a 10-minute TTL.

use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use rand::Rng;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};

use crate::db::AppState;
use crate::error::AppError;
use crate::services::token::{create_access_token, create_refresh_token, hash_token};

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn device_auth_routes() -> Router<AppState> {
    Router::new()
        .route("/device/code", post(request_device_code))
        .route("/device/token", post(poll_device_token))
        .route("/device/approve", post(approve_device_code))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Serialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u32,
    interval: u32,
}

#[derive(Deserialize)]
struct DeviceTokenRequest {
    device_code: String,
}

#[derive(Serialize)]
struct DeviceTokenResponse {
    status: String, // "pending", "approved", "expired"
    #[serde(skip_serializing_if = "Option::is_none")]
    access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    token_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    expires_in: Option<i64>,
}

#[derive(Deserialize)]
struct ApproveRequest {
    user_code: String,
}

#[derive(Serialize)]
struct ApproveResponse {
    approved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

/// Generate a user-friendly 8-character code: XXXX-XXXX (letters only, no ambiguous chars)
fn generate_user_code() -> String {
    let chars: Vec<char> = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".chars().collect();
    let mut rng = OsRng;
    let code: String = (0..8).map(|_| chars[rng.gen_range(0..chars.len())]).collect();
    format!("{}-{}", &code[..4], &code[4..])
}

/// Generate a 40-character hex device code (opaque identifier)
fn generate_device_code() -> String {
    let mut bytes = [0u8; 20];
    OsRng.fill(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

// Redis keys
fn device_code_key(device_code: &str) -> String {
    format!("device_auth:{device_code}")
}
fn user_code_key(user_code: &str) -> String {
    format!("device_auth_user:{}", user_code.to_uppercase().replace('-', ""))
}

const DEVICE_CODE_TTL_SECONDS: u64 = 600; // 10 minutes

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/v1/auth/device/code
// ═══════════════════════════════════════════════════════════════════════════

async fn request_device_code(
    State(state): State<AppState>,
) -> Result<Json<DeviceCodeResponse>, AppError> {
    let device_code = generate_device_code();
    let user_code = generate_user_code();

    let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "https://vmira.ai".to_string());

    // Store in Redis: device_code → { user_code, status: "pending" }
    let mut conn = state.redis.get_multiplexed_async_connection().await
        .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

    // Store device_code → user_code mapping (CLI polls this)
    let _: () = redis::cmd("SET")
        .arg(device_code_key(&device_code))
        .arg(format!("pending:{user_code}"))
        .arg("EX")
        .arg(DEVICE_CODE_TTL_SECONDS)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

    // Store user_code → device_code reverse mapping (browser uses this)
    let _: () = redis::cmd("SET")
        .arg(user_code_key(&user_code))
        .arg(&device_code)
        .arg("EX")
        .arg(DEVICE_CODE_TTL_SECONDS)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

    Ok(Json(DeviceCodeResponse {
        device_code,
        user_code,
        verification_uri: format!("{frontend_url}/authorize"),
        expires_in: DEVICE_CODE_TTL_SECONDS as u32,
        interval: 5,
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/v1/auth/device/token  (CLI polls this)
// ═══════════════════════════════════════════════════════════════════════════

async fn poll_device_token(
    State(state): State<AppState>,
    Json(body): Json<DeviceTokenRequest>,
) -> Result<Json<DeviceTokenResponse>, AppError> {
    let mut conn = state.redis.get_multiplexed_async_connection().await
        .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

    let value: Option<String> = redis::cmd("GET")
        .arg(device_code_key(&body.device_code))
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

    match value {
        None => {
            // Expired or never existed
            Ok(Json(DeviceTokenResponse {
                status: "expired".to_string(),
                access_token: None,
                token_type: None,
                expires_in: None,
            }))
        }
        Some(val) if val.starts_with("pending:") => {
            Ok(Json(DeviceTokenResponse {
                status: "pending".to_string(),
                access_token: None,
                token_type: None,
                expires_in: None,
            }))
        }
        Some(val) if val.starts_with("approved:") => {
            // Format: "approved:{user_id}"
            let user_id_str = val.strip_prefix("approved:").unwrap_or("");
            let user_id: uuid::Uuid = user_id_str.parse()
                .map_err(|_| AppError::Internal("Invalid user_id in device auth".to_string()))?;

            // Create refresh token and store in DB
            let (raw_refresh, token_hash, expires_at) = create_refresh_token(&user_id, &state.config);

            let _ = sqlx::query(
                "INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)"
            )
            .bind(uuid::Uuid::new_v4())
            .bind(user_id)
            .bind(&token_hash)
            .bind("mira-code-cli")
            .bind(expires_at)
            .execute(&state.db)
            .await;

            // Create API key for CLI
            let api_key = crate::models::api_key::generate_api_key();
            let key_hash = hash_token(&api_key, &state.config.secret_key);
            let key_prefix = &api_key[..16.min(api_key.len())];
            let key_name = format!("mira-cli-{}", chrono::Utc::now().format("%Y-%m-%d"));

            let _ = sqlx::query(
                "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, is_active) VALUES ($1, $2, $3, $4, $5, true)"
            )
            .bind(uuid::Uuid::new_v4())
            .bind(user_id)
            .bind(&key_name)
            .bind(&key_hash)
            .bind(key_prefix)
            .execute(&state.db)
            .await;

            // Clean up Redis
            let _: () = redis::cmd("DEL")
                .arg(device_code_key(&body.device_code))
                .query_async(&mut conn)
                .await
                .unwrap_or(());

            Ok(Json(DeviceTokenResponse {
                status: "approved".to_string(),
                access_token: Some(api_key), // Return the API key, not JWT
                token_type: Some("bearer".to_string()),
                expires_in: Some(state.config.access_token_expire_minutes * 60),
            }))
        }
        _ => {
            Ok(Json(DeviceTokenResponse {
                status: "error".to_string(),
                access_token: None,
                token_type: None,
                expires_in: None,
            }))
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/v1/auth/device/approve  (browser calls this)
// ═══════════════════════════════════════════════════════════════════════════

async fn approve_device_code(
    State(state): State<AppState>,
    crate::middleware::auth::AuthUser(user): crate::middleware::auth::AuthUser,
    Json(body): Json<ApproveRequest>,
) -> Result<Json<ApproveResponse>, AppError> {
    let normalized_code = body.user_code.to_uppercase().replace('-', "");

    let mut conn = state.redis.get_multiplexed_async_connection().await
        .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

    // Look up device_code from user_code
    let device_code: Option<String> = redis::cmd("GET")
        .arg(user_code_key(&body.user_code))
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

    let device_code = match device_code {
        Some(dc) => dc,
        None => {
            return Ok(Json(ApproveResponse {
                approved: false,
                error: Some("Code expired or invalid".to_string()),
            }));
        }
    };

    // Verify the device code is still pending
    let status: Option<String> = redis::cmd("GET")
        .arg(device_code_key(&device_code))
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

    match status {
        Some(val) if val.starts_with("pending:") => {
            // Approve: update device_code value to "approved:{user_id}"
            let _: () = redis::cmd("SET")
                .arg(device_code_key(&device_code))
                .arg(format!("approved:{}", user.id))
                .arg("EX")
                .arg(60u64) // Keep for 60s for CLI to poll
                .query_async(&mut conn)
                .await
                .map_err(|e| AppError::Internal(format!("Redis error: {e}")))?;

            // Clean up user_code mapping
            let _: () = redis::cmd("DEL")
                .arg(user_code_key(&body.user_code))
                .query_async(&mut conn)
                .await
                .unwrap_or(());

            Ok(Json(ApproveResponse {
                approved: true,
                error: None,
            }))
        }
        _ => {
            Ok(Json(ApproveResponse {
                approved: false,
                error: Some("Code already used or expired".to_string()),
            }))
        }
    }
}
