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
pub async fn create_pg_pool(config: &Config) -> PgPool {
    PgPoolOptions::new()
        .max_connections(config.db_pool_size + config.db_max_overflow)
        .min_connections(config.db_pool_size)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .idle_timeout(std::time::Duration::from_secs(600))
        .max_lifetime(std::time::Duration::from_secs(1800))
        .connect(&config.database_url)
        .await
        .expect("Failed to create PostgreSQL pool")
}

/// Create a Redis client (connection manager is created lazily per request).
pub fn create_redis_client(config: &Config) -> redis::Client {
    redis::Client::open(config.redis_url.as_str())
        .expect("Invalid Redis URL")
}
