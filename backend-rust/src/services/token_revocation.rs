//! Redis-backed token revocation.
//!
//! When a user's tokens need to be invalidated (logout-all, password change,
//! security incident) we set a short-lived key in Redis.  The auth middleware
//! checks this key on every request and rejects tokens issued to revoked users.

use redis::AsyncCommands;

// ── Public API ──────────────────────────────────────────────────────────────

/// Mark all tokens for `user_id` as revoked for `ttl_seconds`.
///
/// The TTL should match (or slightly exceed) the access-token lifetime so that
/// the revocation key naturally expires once all outstanding access tokens have
/// also expired.
pub async fn revoke_user_tokens(
    redis: &redis::Client,
    user_id: &str,
    ttl_seconds: u64,
) -> Result<(), RevocationError> {
    let mut conn = redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| RevocationError::Redis(e.to_string()))?;

    let key = revocation_key(user_id);

    conn.set_ex::<_, _, ()>(&key, "1", ttl_seconds)
        .await
        .map_err(|e| RevocationError::Redis(e.to_string()))?;

    tracing::info!(user_id = user_id, ttl = ttl_seconds, "user tokens revoked");

    Ok(())
}

/// Check whether the given user's tokens are currently revoked.
pub async fn is_user_revoked(
    redis: &redis::Client,
    user_id: &str,
) -> Result<bool, RevocationError> {
    let mut conn = redis
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| RevocationError::Redis(e.to_string()))?;

    let key = revocation_key(user_id);

    let exists: bool = conn
        .exists(&key)
        .await
        .map_err(|e| RevocationError::Redis(e.to_string()))?;

    Ok(exists)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Build the Redis key for a user's revocation flag.
fn revocation_key(user_id: &str) -> String {
    format!("revoked:{user_id}")
}

// ── Error type ──────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum RevocationError {
    #[error("redis error: {0}")]
    Redis(String),
}
