//! GET /api/v1/models — dynamically serve available models.
//!
//! This endpoint lets the CLI fetch the current model list without hardcoding.
//! Models can be updated server-side without requiring CLI releases.
//! No authentication required — model list is public.

use axum::{routing::get, Json, Router};
use serde::Serialize;

use crate::db::AppState;

#[derive(Serialize)]
struct ModelInfo {
    id: String,
    name: String,
    description: String,
    context_window: u32,
    max_output_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    requires_plan: Option<String>,
}

#[derive(Serialize)]
struct ModelsResponse {
    models: Vec<ModelInfo>,
    default: String,
}

pub fn models_routes() -> Router<AppState> {
    Router::new().route("/models", get(list_models))
}

async fn list_models() -> Json<ModelsResponse> {
    // Models served by Mira infrastructure.
    // Update this list to add/remove models without CLI changes.
    let models = vec![
        ModelInfo {
            id: "mira".to_string(),
            name: "Mira".to_string(),
            description: "General-purpose assistant".to_string(),
            context_window: 32768,
            max_output_tokens: 4096,
            requires_plan: None,
        },
        ModelInfo {
            id: "mira-thinking".to_string(),
            name: "Mira Thinking".to_string(),
            description: "Extended reasoning for complex tasks".to_string(),
            context_window: 32768,
            max_output_tokens: 8192,
            requires_plan: Some("pro".to_string()),
        },
        ModelInfo {
            id: "mira-pro".to_string(),
            name: "Mira Pro".to_string(),
            description: "Advanced model for professional use".to_string(),
            context_window: 65536,
            max_output_tokens: 8192,
            requires_plan: Some("pro".to_string()),
        },
        ModelInfo {
            id: "mira-max".to_string(),
            name: "Mira Max".to_string(),
            description: "Most capable model with maximum context".to_string(),
            context_window: 131072,
            max_output_tokens: 16384,
            requires_plan: Some("max".to_string()),
        },
    ];

    Json(ModelsResponse {
        default: "mira".to_string(),
        models,
    })
}
