//! Top-level router builder.

pub mod actions;
pub mod admin;
pub mod api_keys;
pub mod attachments;
pub mod auth;
pub mod billing;
pub mod calendar;
pub mod chat;
pub mod completions;
pub mod device_auth;
pub mod feedback;
pub mod health;
pub mod live_data;
pub mod models;
pub mod notifications;
pub mod organizations;
pub mod projects;
pub mod sessions;
pub mod telegram;
pub mod voice;

use axum::{extract::DefaultBodyLimit, routing::get, Router};

use crate::db::AppState;

/// Build the complete Axum application router.
pub fn create_router(state: AppState) -> Router {
    // Upload routes need a higher body limit (10 MB) than the global 2 MB.
    let upload_limit = state.config.max_upload_size;

    Router::new()
        .route("/health", get(health::health_check))
        .nest("/api/v1/auth", auth::auth_routes())
        .nest("/api/v1/auth", device_auth::device_auth_routes())
        .nest("/api/v1/chat", chat::chat_routes())
        .nest(
            "/api/v1/chat/projects",
            projects::project_routes()
                .layer(DefaultBodyLimit::max(upload_limit)),
        )
        .nest(
            "/api/v1/chat/conversations/{conv_id}/attachments",
            attachments::upload_routes()
                .layer(DefaultBodyLimit::max(upload_limit)),
        )
        .nest("/api/v1/attachments", attachments::serve_routes())
        .nest("/api/v1/chat", feedback::feedback_routes())
        .nest("/api/v1/billing", billing::billing_routes())
        .nest("/api/v1/organizations", organizations::organization_routes())
        .nest("/api/v1/api-keys", api_keys::api_key_routes())
        .nest("/api/v1/sessions", sessions::session_routes())
        .nest("/api/v1/admin", admin::admin_routes())
        .nest("/api/v1", notifications::notification_routes())
        .nest("/api/v1", telegram::telegram_routes())
        .nest("/api/v1", actions::action_routes())
        .nest("/api/v1", calendar::calendar_routes())
        .nest(
            "/api/v1/voice",
            voice::voice_routes()
                .layer(DefaultBodyLimit::max(upload_limit)),
        )
        .nest("/api/v1", models::models_routes())
        .nest("/api/v1/live", live_data::live_data_routes())
        .nest("/v1", completions::completions_routes())
        // Default 2MB body limit for all non-upload routes
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024))
        .with_state(state)
}
