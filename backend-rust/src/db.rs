use std::sync::Arc;

use sqlx::postgres::{PgPool, PgPoolOptions};

use crate::config::Config;

/// Shared application state available to every handler via `axum::extract::State`.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: redis::Client,
    pub config: Arc<Config>,
}

/// Create the PostgreSQL connection pool from the application config.
///
/// Pool tuning rationale:
/// - `max_connections`: total ceiling (pool_size + overflow) to prevent DB exhaustion
/// - `min_connections`: warm pool avoids cold-start latency
/// - `acquire_timeout`: 10s allows queuing during brief spikes without hanging forever
/// - `idle_timeout`: 5 min recycles idle connections (frees server-side resources)
/// - `max_lifetime`: 15 min forces reconnection (picks up PG config changes, prevents stale)
pub async fn create_pg_pool(config: &Config) -> PgPool {
    // Enforce sslmode=require for non-localhost connections
    let db_url = if !config.database_url.contains("localhost")
        && !config.database_url.contains("127.0.0.1")
        && !config.database_url.contains("sslmode")
    {
        let sep = if config.database_url.contains('?') { "&" } else { "?" };
        format!("{}{}sslmode=require", config.database_url, sep)
    } else {
        config.database_url.clone()
    };

    PgPoolOptions::new()
        .max_connections(config.db_pool_size + config.db_max_overflow)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .idle_timeout(std::time::Duration::from_secs(300))
        .max_lifetime(std::time::Duration::from_secs(900))
        .connect(&db_url)
        .await
        .expect("Failed to create PostgreSQL pool")
}

/// Create a Redis client (connection manager is created lazily per request).
pub fn create_redis_client(config: &Config) -> redis::Client {
    redis::Client::open(config.redis_url.as_str())
        .expect("Invalid Redis URL")
}
