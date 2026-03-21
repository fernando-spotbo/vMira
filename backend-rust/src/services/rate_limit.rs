//! Redis-based sliding-window rate limiter.
//!
//! Uses a sorted set per key where each member is a unique request ID scored by
//! its Unix-microsecond timestamp.  An atomic `MULTI/EXEC` pipeline trims
//! expired entries, inserts the new one, counts the window, and sets the TTL —
//! all in a single round-trip.

use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::config::Config;

// ── Core rate-limit check ───────────────────────────────────────────────────

/// Check whether a request identified by `key` is within its rate limit.
///
/// Returns `(allowed, remaining)` where `remaining` is the number of requests
/// still available in the current window.
pub async fn check_rate_limit(
    redis: &redis::Client,
    key: &str,
    max_requests: i64,
    window_seconds: i64,
) -> Result<(bool, i64), RateLimitError> {
    let mut conn = redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| RateLimitError::Redis(e.to_string()))?;

    let now_us = chrono::Utc::now().timestamp_micros();
    let window_us = window_seconds * 1_000_000;
    let min_score = now_us - window_us;

    // Unique member for this request
    let member = Uuid::new_v4().to_string();

    // Atomic pipeline: ZREMRANGEBYSCORE, ZADD, ZCARD, EXPIRE
    let result: ((), (), i64, ()) = redis::pipe()
        .atomic()
        .cmd("ZREMRANGEBYSCORE")
        .arg(key)
        .arg("-inf")
        .arg(min_score)
        .ignore()
        .cmd("ZADD")
        .arg(key)
        .arg(now_us)
        .arg(&member)
        .ignore()
        .cmd("ZCARD")
        .arg(key)
        .cmd("EXPIRE")
        .arg(key)
        .arg(window_seconds + 1) // slight buffer
        .ignore()
        .query_async(&mut conn)
        .await
        .map_err(|e| RateLimitError::Redis(e.to_string()))?;

    let count = result.2;
    let allowed = count <= max_requests;
    let remaining = (max_requests - count).max(0);

    Ok((allowed, remaining))
}

// ── Convenience helpers ─────────────────────────────────────────────────────

/// Check the general per-user rate limit; returns `Err(RateLimitError::Exceeded)`
/// if the user has exhausted their quota.
pub async fn rate_limit_user(
    redis: &redis::Client,
    user_id: &str,
    config: &Config,
) -> Result<(), RateLimitError> {
    let key = format!("rl:user:{user_id}");
    let (allowed, remaining) = check_rate_limit(
        redis,
        &key,
        config.rate_limit_requests as i64,
        config.rate_limit_window_seconds as i64,
    )
    .await?;

    if !allowed {
        tracing::warn!(
            user_id = user_id,
            remaining = remaining,
            "user rate limit exceeded"
        );
        return Err(RateLimitError::Exceeded {
            retry_after_seconds: config.rate_limit_window_seconds,
        });
    }

    Ok(())
}

/// Check the login-specific rate limit (5 attempts per 900 s).
pub async fn rate_limit_login(
    redis: &redis::Client,
    identifier: &str,
) -> Result<(), RateLimitError> {
    let key = format!("rl:login:{identifier}");
    let (allowed, _remaining) = check_rate_limit(redis, &key, 5, 900).await?;

    if !allowed {
        tracing::warn!(
            identifier_hash = %_hash_short(identifier),
            "login rate limit exceeded"
        );
        return Err(RateLimitError::Exceeded {
            retry_after_seconds: 900,
        });
    }

    Ok(())
}

/// Check the API-key authentication rate limit (10 per 60 s, keyed by IP).
pub async fn rate_limit_api_key_auth(
    redis: &redis::Client,
    ip: &str,
) -> Result<(), RateLimitError> {
    let key = format!("rl:apikey:{ip}");
    let (allowed, _remaining) = check_rate_limit(redis, &key, 10, 60).await?;

    if !allowed {
        tracing::warn!(ip = ip, "api-key auth rate limit exceeded");
        return Err(RateLimitError::Exceeded {
            retry_after_seconds: 60,
        });
    }

    Ok(())
}

// ── Error type ──────────────────────────────────────────────────────────────

/// Errors produced by the rate-limiting layer.
#[derive(Debug, thiserror::Error)]
pub enum RateLimitError {
    #[error("rate limit exceeded — retry after {retry_after_seconds}s")]
    Exceeded { retry_after_seconds: u64 },

    #[error("redis error: {0}")]
    Redis(String),
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Short SHA-256 prefix for logging identifiers without leaking PII.
fn _hash_short(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    digest
        .iter()
        .take(4)
        .fold(String::with_capacity(8), |mut s, b| {
            use std::fmt::Write;
            write!(s, "{b:02x}").unwrap();
            s
        })
}
