//! OpenAI-compatible POST /v1/chat/completions endpoint for the developer API.

use std::convert::Infallible;
use std::time::Duration;

use axum::{
    extract::State,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::post,
    Json, Router,
};
use chrono::Utc;
use futures_util::StreamExt;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::ApiKeyUser;
use crate::schema::{
    ChatCompletionChoice, ChatCompletionMessage, ChatCompletionRequest, ChatCompletionResponse,
    ChatCompletionUsage,
};
use crate::services::ai_proxy::{self, ChatMessage};
use crate::services::audit::log_api_event;
use crate::services::moderation;
use crate::services::rate_limit;
use crate::services::sanitize;
use validator::Validate;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn completions_routes() -> Router<AppState> {
    Router::new().route("/chat/completions", post(chat_completions))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /v1/chat/completions
// ═══════════════════════════════════════════════════════════════════════════

async fn chat_completions(
    State(state): State<AppState>,
    ApiKeyUser(user): ApiKeyUser,
    Json(body): Json<ChatCompletionRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Validate request
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    // Rate limit user
    rate_limit::rate_limit_user(&state.redis, &user.id.to_string(), &state.config)
        .await
        .map_err(|e| match e {
            rate_limit::RateLimitError::Exceeded { retry_after_seconds } => {
                AppError::RateLimited { retry_after: retry_after_seconds as u32 }
            }
            rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
        })?;

    log_api_event(
        "chat_completion",
        &user.id,
        Some("api"),
        None,
        None,
        Some(&format!("model={} stream={}", body.model, body.stream)),
    );

    // Moderate + sanitize the last user message
    let last_user_msg = body
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user");

    if let Some(msg) = last_user_msg {
        let mod_result = moderation::moderate_input(&msg.content);
        if mod_result.blocked {
            return Err(AppError::Unprocessable(
                serde_json::json!({
                    "error": "content_blocked",
                    "category": mod_result.category,
                })
                .to_string(),
            ));
        }
    }

    let history: Vec<ChatMessage> = body
        .messages
        .iter()
        .map(|m| ChatMessage {
            role: m.role.clone(),
            content: sanitize::sanitize_input(&m.content),
        })
        .collect();

    let model = body.model.clone();
    let temperature = body.temperature;
    let max_tokens = body.max_tokens.unwrap_or(4096);

    if body.stream {
        // Streaming mode: return SSE with OpenAI-format chunks
        let request_id = format!("chatcmpl-{}", &Uuid::new_v4().to_string()[..24]);
        let model_clone = model.clone();
        let state_clone = state.clone();

        let stream = async_stream::stream! {
            const MAX_RESPONSE_SIZE: usize = 256 * 1024;
            let mut total_size: usize = 0;

            let ai_stream = ai_proxy::stream_ai_response(
                history,
                model_clone.clone(),
                temperature as f64,
                max_tokens,
                &state_clone.config,
            );

            tokio::pin!(ai_stream);

            while let Some(chunk) = ai_stream.next().await {
                if total_size + chunk.len() > MAX_RESPONSE_SIZE {
                    tracing::warn!("AI response exceeded maximum size, truncating");
                    break;
                }
                total_size += chunk.len();

                let data = serde_json::json!({
                    "id": request_id,
                    "object": "chat.completion.chunk",
                    "created": Utc::now().timestamp(),
                    "model": model_clone,
                    "choices": [{
                        "index": 0,
                        "delta": { "content": chunk },
                        "finish_reason": serde_json::Value::Null,
                    }],
                });

                yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&data).unwrap_or_default()));
            }

            // Final chunk
            let final_data = serde_json::json!({
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": Utc::now().timestamp(),
                "model": model_clone,
                "choices": [{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop",
                }],
            });

            yield Ok(Event::default().data(serde_json::to_string(&final_data).unwrap_or_default()));
            yield Ok(Event::default().data("[DONE]"));
        };

        Ok(Sse::new(stream)
            .keep_alive(
                KeepAlive::new()
                    .interval(Duration::from_secs(15))
                    .text("ping"),
            )
            .into_response())
    } else {
        // Non-streaming: collect full response
        let ai_stream = ai_proxy::stream_ai_response(
            history.clone(),
            model.clone(),
            temperature as f64,
            max_tokens,
            &state.config,
        );

        tokio::pin!(ai_stream);

        const MAX_RESPONSE_SIZE: usize = 256 * 1024;
        let mut full_content = String::new();
        while let Some(chunk) = ai_stream.next().await {
            if full_content.len() + chunk.len() > MAX_RESPONSE_SIZE {
                tracing::warn!("AI response exceeded maximum size, truncating");
                break;
            }
            full_content.push_str(&chunk);
        }

        // Moderate + sanitize output
        let output_mod = moderation::moderate_output(&full_content);
        if output_mod.blocked {
            full_content = "I cannot provide that response.".to_string();
        }
        full_content = sanitize::sanitize_output(&full_content);

        // Estimate token counts
        let prompt_tokens: u32 = body
            .messages
            .iter()
            .map(|m| m.content.split_whitespace().count() as u32)
            .sum();
        let completion_tokens = full_content.split_whitespace().count() as u32;

        let response = ChatCompletionResponse::new(
            format!("chatcmpl-{}", &Uuid::new_v4().to_string()[..24]),
            Utc::now().timestamp(),
            model,
            vec![ChatCompletionChoice {
                index: 0,
                message: ChatCompletionMessage {
                    role: "assistant".to_string(),
                    content: full_content,
                },
                finish_reason: "stop".to_string(),
            }],
            ChatCompletionUsage {
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
            },
        );

        Ok(Json(response).into_response())
    }
}
