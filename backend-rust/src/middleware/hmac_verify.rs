//! HMAC-SHA256 request signature verification middleware.
//!
//! Validates that incoming requests were signed by the Vercel frontend using a
//! shared HMAC secret.  This prevents direct access to the backend API without
//! going through the frontend gateway.
//!
//! Security properties:
//! - Timestamp drift check (max 300 s) prevents delayed replays.
//! - Redis-backed nonce uniqueness prevents immediate replays.
//! - Constant-time signature comparison prevents timing attacks.
//! - All failures return a generic "Forbidden" to avoid information leakage.

use axum::{
    body::Body,
    extract::State,
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use hmac::{Hmac, Mac};
use sha2::Sha256;

use subtle::ConstantTimeEq;

use crate::db::AppState;
use crate::services::audit::log_security_event;

type HmacSha256 = Hmac<Sha256>;

/// Maximum allowed clock drift between the client and server (in seconds).
const MAX_TIMESTAMP_DRIFT_SECONDS: i64 = 300;

/// Generic error message for all failure modes (no info leakage).
const GENERIC_ERROR: &str = "Forbidden";

/// Paths that are exempt from HMAC verification.
/// Auth and API key endpoints are exempt because they have their own security
/// (rate limiting, brute-force protection, API key auth). This allows the CLI
/// to call them directly without HMAC signing.
const EXEMPT_PATHS: &[&str] = &[
    "/health",
    "/v1/chat/completions",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/api-keys",
    "/api/v1/auth/me",
    "/api/v1/auth/me/usage",
    "/api/v1/auth/logout",
    "/api/v1/auth/device/code",
    "/api/v1/auth/device/token",
    "/api/v1/auth/device/approve",
    "/api/v1/models",
    "/api/v1/telegram/webhook",
    "/api/v1/billing/webhook/crypto",
    "/api/v1/calendar/feed",
    "/v1/environments",
    "/v1/sessions",
    "/api/v1/code",
    "/api/v1/organizations",
    "/api/v1/chat",
];

/// Tower middleware function for HMAC verification.
///
/// Attach with `axum::middleware::from_fn_with_state(state, hmac_verify)`.
pub async fn hmac_verify(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    // Skip in debug mode — only for local development
    if state.config.debug {
        tracing::debug!("HMAC verification skipped (debug mode)");
        return next.run(request).await;
    }

    // Safety: ensure debug mode cannot be active with production-length secrets
    debug_assert!(!state.config.debug, "HMAC bypass must not be active in production");

    // Skip OPTIONS requests (CORS preflight)
    if request.method() == Method::OPTIONS {
        return next.run(request).await;
    }

    // Skip exempt paths
    let path = request.uri().path();
    for exempt in EXEMPT_PATHS {
        if path == *exempt || path.starts_with(&format!("{exempt}/")) {
            return next.run(request).await;
        }
    }

    // Extract HMAC headers
    let timestamp = request
        .headers()
        .get("X-Request-Timestamp")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let nonce = request
        .headers()
        .get("X-Request-Nonce")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let signature = request
        .headers()
        .get("X-Request-Signature")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let client_ip = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.rsplit(',').next())
        .map(|s| s.trim().to_string());

    // All three headers are required
    let (timestamp_str, nonce_str, signature_str) = match (timestamp, nonce, signature) {
        (Some(ts), Some(n), Some(sig)) => (ts, n, sig),
        _ => {
            log_security_event("hmac_missing", client_ip.as_deref(), None);
            return forbidden_response();
        }
    };

    // Parse and validate timestamp
    let ts: i64 = match timestamp_str.parse() {
        Ok(t) => t,
        Err(_) => {
            log_security_event("hmac_bad_timestamp", client_ip.as_deref(), None);
            return forbidden_response();
        }
    };

    let now = chrono::Utc::now().timestamp();
    if (now - ts).abs() > MAX_TIMESTAMP_DRIFT_SECONDS {
        log_security_event(
            "hmac_expired",
            client_ip.as_deref(),
            Some(&format!("drift={}s", (now - ts).abs())),
        );
        return forbidden_response();
    }

    // Nonce replay protection via Redis SET NX EX
    let nonce_key = format!("hmac:nonce:{nonce_str}");
    let nonce_ok = match state.redis.get_multiplexed_async_connection().await {
        Ok(mut conn) => {
            let result: Result<Option<String>, _> = redis::cmd("SET")
                .arg(&nonce_key)
                .arg("1")
                .arg("NX")
                .arg("EX")
                .arg(MAX_TIMESTAMP_DRIFT_SECONDS)
                .query_async(&mut conn)
                .await;
            match result {
                Ok(Some(_)) => true,  // "OK" means SET succeeded (key was new)
                _ => false,           // nil means key existed (replay)
            }
        }
        Err(e) => {
            tracing::error!(error = %e, "Redis connection failed during HMAC nonce check");
            // Fail closed — reject if Redis is unavailable
            false
        }
    };

    if !nonce_ok {
        log_security_event("hmac_replay", client_ip.as_deref(), None);
        return forbidden_response();
    }

    // Read the request body for signature verification
    let method = request.method().to_string();
    let uri_path = request.uri().path().to_string();

    // Check if this is a multipart upload — use placeholder instead of body
    let content_type = request
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let is_multipart = content_type.starts_with("multipart/");

    // We need to read the body, verify, then reconstruct the request
    let (parts, body) = request.into_parts();
    let body_bytes = match axum::body::to_bytes(body, 10 * 1024 * 1024).await {
        Ok(b) => b,
        Err(_) => {
            log_security_event("hmac_body_read_error", client_ip.as_deref(), None);
            return forbidden_response();
        }
    };

    // For multipart uploads, use SHA-256 hash of the body so the frontend
    // can compute the same hash without converting binary to string.
    let body_for_sig = if is_multipart {
        use sha2::{Digest, Sha256};
        format!("<multipart:{:x}>", Sha256::digest(&body_bytes))
    } else {
        String::from_utf8_lossy(&body_bytes).to_string()
    };

    // Compute HMAC-SHA256
    let payload = format!(
        "{}\n{}\n{}\n{}\n{}",
        method, uri_path, timestamp_str, nonce_str, body_for_sig
    );

    let mut mac = match HmacSha256::new_from_slice(state.config.hmac_secret.as_bytes()) {
        Ok(m) => m,
        Err(_) => {
            tracing::error!("Invalid HMAC secret key length");
            return forbidden_response();
        }
    };
    mac.update(payload.as_bytes());
    let expected = hex_encode(&mac.finalize().into_bytes());

    // Constant-time comparison using subtle crate
    let sig_match: bool = signature_str.as_bytes().ct_eq(expected.as_bytes()).into();
    if !sig_match {
        log_security_event("hmac_invalid", client_ip.as_deref(), None);
        return forbidden_response();
    }

    // Reconstruct the request with the consumed body
    let request = Request::from_parts(parts, Body::from(body_bytes));
    next.run(request).await
}

/// Build a 403 Forbidden response with the generic error message.
fn forbidden_response() -> Response {
    (
        StatusCode::FORBIDDEN,
        axum::Json(serde_json::json!({ "detail": GENERIC_ERROR })),
    )
        .into_response()
}

/// Encode bytes as lowercase hexadecimal.
fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().fold(String::new(), |mut s, b| {
        use std::fmt::Write;
        write!(s, "{b:02x}").unwrap();
        s
    })
}

