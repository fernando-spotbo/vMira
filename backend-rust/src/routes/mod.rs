//! Top-level router builder.

pub mod admin;
pub mod api_keys;
pub mod auth;
pub mod billing;
pub mod chat;
pub mod completions;
pub mod health;
pub mod sessions;

use axum::{routing::get, Router};

use crate::db::AppState;

/// Build the complete Axum application router.
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health_check))
        .nest("/api/v1/auth", auth::auth_routes())
        .nest("/api/v1/chat", chat::chat_routes())
        .nest("/api/v1/billing", billing::billing_routes())
        .nest("/api/v1/api-keys", api_keys::api_key_routes())
        .nest("/api/v1/sessions", sessions::session_routes())
        .nest("/api/v1/admin", admin::admin_routes())
        .nest("/v1", completions::completions_routes())
        .with_state(state)
}
