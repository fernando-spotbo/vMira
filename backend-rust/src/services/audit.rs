//! Audit logging with PII hashing for 152-FZ compliance.
//!
//! All personally-identifiable fields (email, IP, user-agent) are hashed before
//! they reach the structured log output so that plain-text PII never hits disk.

use sha2::{Digest, Sha256};
use uuid::Uuid;

// ── PII hashing ─────────────────────────────────────────────────────────────

/// SHA-256 hash of a value, truncated to the first 16 hex characters.
/// Returns `"none"` when the input is `None`.
fn _hash_pii(value: Option<&str>) -> String {
    match value {
        Some(v) if !v.is_empty() => {
            let mut hasher = Sha256::new();
            hasher.update(v.as_bytes());
            let digest = hasher.finalize();
            // First 8 bytes → 16 hex chars
            digest
                .iter()
                .take(8)
                .fold(String::with_capacity(16), |mut s, b| {
                    use std::fmt::Write;
                    write!(s, "{b:02x}").unwrap();
                    s
                })
        }
        _ => "none".to_string(),
    }
}

// ── Auth event logging ──────────────────────────────────────────────────────

/// Log an authentication-related event (login, logout, token refresh, etc.).
pub fn log_auth_event(
    action: &str,
    user_id: Option<&Uuid>,
    email: Option<&str>,
    ip: Option<&str>,
    user_agent: Option<&str>,
    success: bool,
    detail: Option<&str>,
) {
    let uid = user_id
        .map(|u| u.to_string())
        .unwrap_or_else(|| "none".to_string());
    let email_hash = _hash_pii(email);
    let ip_hash = _hash_pii(ip);
    let ua_hash = _hash_pii(user_agent);
    let detail_str = detail.unwrap_or("");

    if success {
        tracing::info!(
            category = "auth",
            action = action,
            user_id = %uid,
            email_hash = %email_hash,
            ip_hash = %ip_hash,
            ua_hash = %ua_hash,
            success = true,
            detail = detail_str,
            "auth event"
        );
    } else {
        tracing::warn!(
            category = "auth",
            action = action,
            user_id = %uid,
            email_hash = %email_hash,
            ip_hash = %ip_hash,
            ua_hash = %ua_hash,
            success = false,
            detail = detail_str,
            "auth event FAILED"
        );
    }
}

// ── API event logging ───────────────────────────────────────────────────────

/// Log an API-layer event (resource access, mutation, etc.).
pub fn log_api_event(
    action: &str,
    user_id: &Uuid,
    resource: Option<&str>,
    resource_id: Option<&str>,
    ip: Option<&str>,
    detail: Option<&str>,
) {
    let ip_hash = _hash_pii(ip);
    tracing::info!(
        category = "api",
        action = action,
        user_id = %user_id,
        resource = resource.unwrap_or("none"),
        resource_id = resource_id.unwrap_or("none"),
        ip_hash = %ip_hash,
        detail = detail.unwrap_or(""),
        "api event"
    );
}

// ── Security event logging ──────────────────────────────────────────────────

/// Log a security-relevant event (rate limiting, injection attempt, etc.).
pub fn log_security_event(event: &str, ip: Option<&str>, detail: Option<&str>) {
    let ip_hash = _hash_pii(ip);
    tracing::warn!(
        category = "security",
        event = event,
        ip_hash = %ip_hash,
        detail = detail.unwrap_or(""),
        "security event"
    );
}
