//! Daily briefing — AI-generated, user-customized content.
//!
//! The user configures a natural language prompt ("TSLA pre-market, Moscow weather,
//! Celtics schedule"). The backend generates fresh content via the AI model + tools.

use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;

pub fn briefing_routes() -> Router<AppState> {
    Router::new()
        .route("/briefing", get(get_briefing))
        .route("/briefing/generate", get(generate_briefing))
        .route("/briefing/settings", get(get_briefing_settings).put(update_briefing_settings))
}

// ── Get cached briefing (or empty if none) ──────────────────────────────

#[derive(Serialize)]
struct BriefingResponse {
    configured: bool,
    prompt: Option<String>,
    content: Option<String>,
    generated_at: Option<String>,
    enabled: bool,
    time: String,
}

async fn get_briefing(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<BriefingResponse>, AppError> {
    let row = sqlx::query_as::<_, (
        bool, Option<chrono::NaiveTime>, Option<String>, Option<String>, Option<chrono::DateTime<Utc>>,
    )>(
        "SELECT briefing_enabled, briefing_time, briefing_prompt, briefing_last_content, briefing_last_generated
         FROM notification_settings WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some((enabled, time, prompt, content, generated_at)) => Ok(Json(BriefingResponse {
            configured: prompt.is_some() && !prompt.as_deref().unwrap_or("").is_empty(),
            prompt,
            content,
            generated_at: generated_at.map(|t| t.to_rfc3339()),
            enabled,
            time: time.map(|t| t.format("%H:%M").to_string()).unwrap_or_else(|| "08:00".to_string()),
        })),
        None => Ok(Json(BriefingResponse {
            configured: false,
            prompt: None,
            content: None,
            generated_at: None,
            enabled: false,
            time: "08:00".to_string(),
        })),
    }
}

// ── Generate briefing on demand (called by frontend refresh or scheduler) ─

async fn generate_briefing(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<BriefingResponse>, AppError> {
    // Get user's prompt
    let row = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT briefing_prompt FROM notification_settings WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    let prompt = row
        .and_then(|(p,)| p)
        .filter(|p| !p.trim().is_empty())
        .ok_or_else(|| AppError::BadRequest("No briefing prompt configured. Tell Mira what you want in your daily briefing.".into()))?;

    // Generate via AI model
    let content = generate_briefing_content(&state, user.id, &prompt).await
        .map_err(|e| AppError::Internal(format!("Briefing generation failed: {e}")))?;

    // Cache the result
    sqlx::query(
        "UPDATE notification_settings SET briefing_last_content = $1, briefing_last_generated = now() WHERE user_id = $2"
    )
    .bind(&content)
    .bind(user.id)
    .execute(&state.db)
    .await?;

    get_briefing(State(state), AuthUser(user)).await
}

/// Call the AI model with the user's briefing prompt + web search tool.
pub async fn generate_briefing_content(
    state: &AppState,
    user_id: uuid::Uuid,
    prompt: &str,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("HTTP client: {e}"))?;

    // Build the briefing-specific system prompt
    let now = Utc::now();
    let system = format!(
        "You are Mira, generating a daily briefing. Current date: {}. \
         The user configured this briefing prompt: \"{}\"\n\n\
         Generate a concise, well-formatted briefing. Use web_search to find current data. \
         Format with markdown. Be factual, no filler. Include specific numbers, prices, times. \
         Reply in the user's language (match the prompt language).",
        now.format("%Y-%m-%d %H:%M UTC"), prompt
    );

    // Include user memories for personalization
    let memories: Vec<(String, String)> = sqlx::query_as(
        "SELECT key, value FROM user_memory WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mem_context = if !memories.is_empty() {
        let facts: Vec<String> = memories.iter().map(|(k, v)| format!("{}: {}", k, v)).collect();
        format!("\n\nUser context: {}", facts.join(", "))
    } else {
        String::new()
    };

    // Web search tool for real-time data
    let tools = serde_json::json!([{
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for current information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Search query" }
                },
                "required": ["query"]
            }
        }
    }]);

    let body = serde_json::json!({
        "model": "deepseek-chat",
        "messages": [
            { "role": "system", "content": format!("{}{}", system, mem_context) },
            { "role": "user", "content": format!("Generate my daily briefing based on my preferences: {}", prompt) }
        ],
        "tools": tools,
        "max_tokens": 2000,
        "temperature": 0.3
    });

    // First call — model may request web searches
    let resp = client.post(&state.config.ai_model_url)
        .header("Authorization", format!("Bearer {}", state.config.ai_model_api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(30))
        .send().await
        .map_err(|e| format!("AI request: {e}"))?;

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("AI parse: {e}"))?;

    let choice = data["choices"].get(0).ok_or("No choices in response")?;

    // Handle tool calls (web search)
    if let Some(tool_calls) = choice["message"]["tool_calls"].as_array() {
        let mut messages = vec![
            serde_json::json!({ "role": "system", "content": format!("{}{}", system, mem_context) }),
            serde_json::json!({ "role": "user", "content": format!("Generate my daily briefing: {}", prompt) }),
            choice["message"].clone(),
        ];

        for tc in tool_calls {
            let name = tc["function"]["name"].as_str().unwrap_or("");
            if name == "web_search" {
                let args: serde_json::Value = serde_json::from_str(
                    tc["function"]["arguments"].as_str().unwrap_or("{}")
                ).unwrap_or_default();
                let query = args["query"].as_str().unwrap_or("");

                let search_resp = crate::services::search::web_search(query, 5, &state.config).await;
                let results = search_resp.map(|r| r.results).unwrap_or_default();
                let result_text: Vec<String> = results.iter().enumerate()
                    .map(|(i, r)| format!("[{}] {} — {}", i + 1, r.title, r.content))
                    .collect();

                messages.push(serde_json::json!({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result_text.join("\n")
                }));
            }
        }

        // Second call with search results
        let body2 = serde_json::json!({
            "model": "deepseek-chat",
            "messages": messages,
            "max_tokens": 2000,
            "temperature": 0.3
        });

        let resp2 = client.post(&state.config.ai_model_url)
            .header("Authorization", format!("Bearer {}", state.config.ai_model_api_key))
            .header("Content-Type", "application/json")
            .json(&body2)
            .timeout(std::time::Duration::from_secs(30))
            .send().await
            .map_err(|e| format!("AI request 2: {e}"))?;

        let data2: serde_json::Value = resp2.json().await
            .map_err(|e| format!("AI parse 2: {e}"))?;

        let content = data2["choices"][0]["message"]["content"]
            .as_str().unwrap_or("Failed to generate briefing.").to_string();

        // Strip thinking tags
        let (_, visible) = crate::services::ai_proxy::parse_thinking(&content);
        let visible = crate::services::sanitize::sanitize_output(&visible);
        return Ok(visible);
    }

    // No tool calls — direct response
    let content = choice["message"]["content"]
        .as_str().unwrap_or("Failed to generate briefing.").to_string();
    let (_, visible) = crate::services::ai_proxy::parse_thinking(&content);
    let visible = crate::services::sanitize::sanitize_output(&visible);
    Ok(visible)
}

// ── Settings ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct BriefingSettingsResponse {
    enabled: bool,
    time: String,
    prompt: Option<String>,
}

async fn get_briefing_settings(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<BriefingSettingsResponse>, AppError> {
    let row = sqlx::query_as::<_, (bool, chrono::NaiveTime, Option<String>)>(
        "SELECT briefing_enabled, briefing_time, briefing_prompt FROM notification_settings WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some((enabled, time, prompt)) => Ok(Json(BriefingSettingsResponse {
            enabled,
            time: time.format("%H:%M").to_string(),
            prompt,
        })),
        None => Ok(Json(BriefingSettingsResponse {
            enabled: false,
            time: "08:00".to_string(),
            prompt: None,
        })),
    }
}

#[derive(Deserialize)]
struct UpdateBriefingSettings {
    enabled: Option<bool>,
    time: Option<String>,
    prompt: Option<String>,
}

async fn update_briefing_settings(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<UpdateBriefingSettings>,
) -> Result<Json<BriefingSettingsResponse>, AppError> {
    sqlx::query(
        "INSERT INTO notification_settings (user_id, briefing_enabled, briefing_time, briefing_prompt)
         VALUES ($1, COALESCE($2, false), COALESCE($3, '08:00'::TIME), $4)
         ON CONFLICT (user_id) DO UPDATE SET
           briefing_enabled = COALESCE($2, notification_settings.briefing_enabled),
           briefing_time = COALESCE($3, notification_settings.briefing_time),
           briefing_prompt = COALESCE($4, notification_settings.briefing_prompt),
           updated_at = now()"
    )
    .bind(user.id)
    .bind(body.enabled)
    .bind(body.time.as_ref().and_then(|t| chrono::NaiveTime::parse_from_str(t, "%H:%M").ok()))
    .bind(body.prompt.as_deref())
    .execute(&state.db)
    .await?;

    get_briefing_settings(State(state), AuthUser(user)).await
}
