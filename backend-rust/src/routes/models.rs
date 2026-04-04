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
    Router::new()
        .route("/models", get(list_models))
        .route("/plans", get(list_plans))
}

/// GET /plans — returns all plan configs for frontend pricing pages
async fn list_plans() -> Json<serde_json::Value> {
    let plans: Vec<_> = crate::services::plans::all_plans()
        .into_iter()
        .map(|p| serde_json::json!({
            "name": p.name,
            "display_name": p.display_name,
            "rank": p.rank,
            "chat_daily_messages": p.chat_daily_messages,
            "code_daily_messages": p.code_daily_messages,
            "max_conversations": p.max_conversations,
            "monthly_token_limit": p.monthly_token_limit,
            "search_results": p.search_results,
            "max_response_tokens": p.max_response_tokens,
            "context_window": p.context_window,
            "chat_price_kopecks": p.chat_price_kopecks,
            "code_price_kopecks": p.code_price_kopecks,
            "chat_price_display": p.chat_price_display,
            "code_price_display": p.code_price_display,
            "chat_messages_display": p.chat_messages_display,
            "code_messages_display": p.code_messages_display,
            "api_input_price_per_1k": p.api_input_price_per_1k,
            "api_output_price_per_1k": p.api_output_price_per_1k,
            "api_thinking_surcharge_pct": p.api_thinking_surcharge_pct,
            "features": {
                "voice": p.has_voice,
                "search": p.has_search,
                "reminders": p.has_reminders,
                "calendar": p.has_calendar,
                "projects": p.has_projects,
                "remote_control": p.has_remote_control,
                "organizations": p.has_organizations,
            },
            "max_file_upload_mb": p.max_file_upload_mb,
            "max_org_members": p.max_org_members,
        }))
        .collect();
    Json(serde_json::json!({ "plans": plans }))
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
