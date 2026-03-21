//! OpenAI-compatible POST /v1/chat/completions endpoint with queue, cancellation, and metering.

use std::convert::Infallible;
use std::time::{Duration, Instant};

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
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::ApiKeyUser;
use crate::models::UsageRecord;
use crate::schema::{
    ChatCompletionChoice, ChatCompletionMessage, ChatCompletionRequest, ChatCompletionResponse,
    ChatCompletionUsage,
};
use crate::services::ai_proxy::{self, ChatMessage};
use crate::services::audit::log_api_event;
use crate::services::moderation;
use crate::services::queue;
use crate::services::rate_limit;
use crate::services::sanitize;
use crate::services::usage;
use validator::Validate;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn completions_routes() -> Router<AppState> {
    Router::new().route("/chat/completions", post(chat_completions))
}

/// Approximate token count by splitting on whitespace.
fn approx_tokens(text: &str) -> i32 {
    text.split_whitespace().count() as i32
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

    // Validate individual message content length (same limit as chat endpoint: 32KB)
    for msg in &body.messages {
        if msg.content.len() > 32000 {
            return Err(AppError::Unprocessable(
                "Individual message content must not exceed 32000 characters".to_string(),
            ));
        }
    }

    // Validate model against allowlist
    match body.model.as_str() {
        "mira" | "mira-pro" | "mira-max" => {}
        _ => {
            return Err(AppError::BadRequest(
                "Invalid model. Must be one of: mira, mira-pro, mira-max".to_string(),
            ));
        }
    }

    // Rate limit user
    rate_limit::rate_limit_user(&state.redis, &user.id.to_string(), &state.config)
        .await
        .map_err(|e| match e {
            rate_limit::RateLimitError::Exceeded { retry_after_seconds } => {
                AppError::RateLimited { retry_after: retry_after_seconds as u32 }
            }
            rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
        })?;

    // Daily message limit (same logic as chat routes — prevents free-tier abuse via API keys)
    let daily_limit: i64 = match user.plan.as_str() {
        "free" => 20,
        "pro" => 500,
        "max" | "enterprise" => -1,
        _ => 20,
    };
    if daily_limit != -1 {
        let now = chrono::Utc::now();
        let mut tx = state.db.begin().await?;

        let locked_user = sqlx::query_as::<_, crate::models::User>(
            "SELECT * FROM users WHERE id = $1 FOR UPDATE"
        )
        .bind(user.id)
        .fetch_one(&mut *tx)
        .await?;

        let mut daily_used = locked_user.daily_messages_used;

        if locked_user.daily_reset_at.date_naive() < now.date_naive() {
            daily_used = 0;
            sqlx::query("UPDATE users SET daily_messages_used = 0, daily_reset_at = $1 WHERE id = $2")
                .bind(now)
                .bind(user.id)
                .execute(&mut *tx)
                .await?;
        }

        if daily_used >= daily_limit as i32 {
            tx.commit().await?;
            return Err(AppError::RateLimited { retry_after: 3600 });
        }

        sqlx::query("UPDATE users SET daily_messages_used = daily_messages_used + 1 WHERE id = $1")
            .bind(user.id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
    }

    // Concurrent stream limit (same as chat routes)
    let stream_key = format!("streams:{}", user.id);
    let max_streams = state.config.max_concurrent_streams_per_user as i64;
    let stream_acquired: bool = {
        match state.redis.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                let script = redis::Script::new(r#"
                    local current = tonumber(redis.call('GET', KEYS[1]) or '0')
                    if current < tonumber(ARGV[1]) then
                        redis.call('INCR', KEYS[1])
                        redis.call('EXPIRE', KEYS[1], 300)
                        return 1
                    end
                    return 0
                "#);
                script
                    .key(&stream_key)
                    .arg(max_streams)
                    .invoke_async::<i32>(&mut conn)
                    .await
                    .map(|v| v == 1)
                    .unwrap_or(true)
            }
            Err(_) => true,
        }
    };

    if !stream_acquired {
        return Err(AppError::RateLimited { retry_after: 5 });
    }

    log_api_event(
        "chat_completion",
        &user.id,
        Some("api"),
        None,
        None,
        Some(&format!("model={} stream={}", body.model, body.stream)),
    );

    // Moderate ALL messages, not just the last user message.
    // Attackers can embed prohibited content in system/assistant role messages
    // or in earlier user messages to bypass moderation.
    for msg in &body.messages {
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
    let max_tokens = body.max_tokens.unwrap_or(4096).min(16384); // Cap at 16K to prevent cost amplification

    // Calculate input tokens from messages
    let input_tokens: i32 = history.iter().map(|m| approx_tokens(&m.content)).sum();

    if body.stream {
        // Streaming mode: return SSE with OpenAI-format chunks + queue + metering
        let request_id = format!("chatcmpl-{}", &Uuid::new_v4().to_string()[..24]);
        let model_clone = model.clone();
        let state_clone = state.clone();
        let user_id = user.id;
        let cancel_token = CancellationToken::new();
        let cancel_clone = cancel_token.clone();
        let request_id_clone = request_id.clone();
        let stream_key_clone = stream_key.clone();

        let stream = async_stream::stream! {
            let overall_start = Instant::now();
            let mut queue_duration_ms: i32 = 0;
            let mut processing_duration_ms: i32 = 0;
            let mut status = "completed".to_string();
            let error_message: Option<String> = None;
            let mut output_tokens_count: i32 = 0;

            const MAX_RESPONSE_SIZE: usize = 256 * 1024;
            let mut total_size: usize = 0;
            let mut full_content = String::new();

            // ── Step 1: Try to acquire a GPU slot ──────────────────
            let queue_start = Instant::now();
            let slot_guard = match queue::try_acquire_slot(
                &state_clone.redis,
                &request_id_clone,
                &state_clone.config,
            ).await {
                Ok(Some(guard)) => {
                    queue_duration_ms = queue_start.elapsed().as_millis() as i32;
                    Some(guard)
                }
                Ok(None) => {
                    // Check queue size limit
                    let queue_stats = queue::get_queue_stats(&state_clone.redis, &state_clone.config).await;
                    let queue_full = match &queue_stats {
                        Ok(stats) => stats.queue_length >= state_clone.config.gpu_queue_max_size,
                        Err(_) => false,
                    };

                    if queue_full {
                        let error_data = serde_json::json!({
                            "error": {
                                "message": "Server is at capacity, please try again later",
                                "type": "server_error",
                                "code": "queue_full"
                            }
                        });
                        yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&error_data).unwrap_or_default()));
                        return;
                    }

                    // Enqueue and wait
                    let _position = match queue::enqueue_request(
                        &state_clone.redis,
                        &request_id_clone,
                        &user_id.to_string(),
                    ).await {
                        Ok(pos) => pos,
                        Err(e) => {
                            tracing::error!(error = %e, "failed to enqueue API request");
                            return;
                        }
                    };

                    // Poll for slot
                    let mut acquired_guard: Option<queue::SlotGuard> = None;
                    loop {
                        if cancel_clone.is_cancelled() {
                            let _ = queue::dequeue_request(&state_clone.redis, &request_id_clone).await;
                            status = "cancelled".to_string();
                            break;
                        }

                        match queue::try_acquire_slot(&state_clone.redis, &request_id_clone, &state_clone.config).await {
                            Ok(Some(guard)) => {
                                let _ = queue::dequeue_request(&state_clone.redis, &request_id_clone).await;
                                acquired_guard = Some(guard);
                                break;
                            }
                            Ok(None) => {
                                tokio::time::sleep(Duration::from_millis(500)).await;
                            }
                            Err(e) => {
                                tracing::error!(error = %e, "failed to acquire slot while waiting");
                                tokio::time::sleep(Duration::from_millis(500)).await;
                            }
                        }
                    }

                    queue_duration_ms = queue_start.elapsed().as_millis() as i32;

                    if status == "cancelled" {
                        return;
                    }

                    acquired_guard
                }
                Err(e) => {
                    tracing::error!(error = %e, "failed to check GPU slot");
                    None
                }
            };

            // ── Step 2: Stream AI response ─────────────────────────
            let processing_start = Instant::now();

            let ai_stream = ai_proxy::stream_ai_response(
                history,
                model_clone.clone(),
                temperature as f64,
                max_tokens,
                &state_clone.config,
            );

            tokio::pin!(ai_stream);

            loop {
                tokio::select! {
                    chunk_opt = ai_stream.next() => {
                        match chunk_opt {
                            Some(chunk) => {
                                if total_size + chunk.len() > MAX_RESPONSE_SIZE {
                                    tracing::warn!("AI response exceeded maximum size, truncating");
                                    break;
                                }
                                total_size += chunk.len();
                                full_content.push_str(&chunk);

                                let data = serde_json::json!({
                                    "id": request_id_clone,
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
                            None => break,
                        }
                    }
                    _ = cancel_clone.cancelled() => {
                        status = "cancelled".to_string();
                        break;
                    }
                }
            }

            processing_duration_ms = processing_start.elapsed().as_millis() as i32;
            output_tokens_count = approx_tokens(&full_content);

            // ── Step 3: Release GPU slot ───────────────────────────
            drop(slot_guard);

            // ── Step 4: Send final chunk + DONE ────────────────────
            if status == "completed" {
                let final_data = serde_json::json!({
                    "id": request_id_clone,
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
            }

            // ── Step 5: Record usage ───────────────────────────────
            let total_duration_ms = overall_start.elapsed().as_millis() as i32;
            let total_tokens = input_tokens + output_tokens_count;
            let cost = usage::estimate_cost(&model_clone, input_tokens, output_tokens_count);

            let cancelled_at = if status == "cancelled" {
                Some(Utc::now())
            } else {
                None
            };

            let record = UsageRecord {
                id: Uuid::new_v4(),
                user_id,
                api_key_id: None,
                conversation_id: None,
                request_id: request_id_clone.clone(),
                model: model_clone.clone(),
                input_tokens,
                output_tokens: output_tokens_count,
                total_tokens,
                queue_duration_ms,
                processing_duration_ms,
                total_duration_ms,
                status: status.clone(),
                cancelled_at,
                error_message: error_message.clone(),
                cost_microcents: cost,
                created_at: Utc::now(),
            };

            if let Err(e) = usage::record_usage(&state_clone.db, &record).await {
                tracing::error!(error = %e, "failed to record usage");
            }

            // Release concurrent stream counter
            if let Ok(mut conn) = state_clone.redis.get_multiplexed_async_connection().await {
                let script = redis::Script::new(r#"
                    local val = tonumber(redis.call('GET', KEYS[1]) or '0')
                    if val > 0 then return redis.call('DECR', KEYS[1]) end
                    return val
                "#);
                let _: Result<i64, _> = script.key(&stream_key_clone).invoke_async(&mut conn).await;
            }
        };

        Ok(Sse::new(stream)
            .keep_alive(
                KeepAlive::new()
                    .interval(Duration::from_secs(15))
                    .text("ping"),
            )
            .into_response())
    } else {
        // Non-streaming: collect full response with queue + metering
        let overall_start = Instant::now();
        let request_id = format!("chatcmpl-{}", &Uuid::new_v4().to_string()[..24]);

        // ── Step 1: Acquire GPU slot ───────────────────────────────
        let queue_start = Instant::now();
        let slot_guard = match queue::try_acquire_slot(
            &state.redis,
            &request_id,
            &state.config,
        ).await? {
            Some(guard) => Some(guard),
            None => {
                // Check queue size limit
                let queue_stats = queue::get_queue_stats(&state.redis, &state.config).await?;
                if queue_stats.queue_length >= state.config.gpu_queue_max_size {
                    return Err(AppError::RateLimited { retry_after: 10 });
                }

                // Enqueue and wait synchronously
                let _position = queue::enqueue_request(
                    &state.redis,
                    &request_id,
                    &user.id.to_string(),
                ).await?;

                let cancel_token = CancellationToken::new();
                let mut acquired = None;
                for _ in 0..120 {
                    // Max ~60 second wait
                    if let Some(guard) = queue::try_acquire_slot(
                        &state.redis,
                        &request_id,
                        &state.config,
                    ).await? {
                        let _ = queue::dequeue_request(&state.redis, &request_id).await;
                        acquired = Some(guard);
                        break;
                    }
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    if cancel_token.is_cancelled() {
                        let _ = queue::dequeue_request(&state.redis, &request_id).await;
                        return Err(AppError::BadRequest("Request cancelled".to_string()));
                    }
                }

                if acquired.is_none() {
                    let _ = queue::dequeue_request(&state.redis, &request_id).await;
                    return Err(AppError::RateLimited { retry_after: 10 });
                }

                acquired
            }
        };
        let queue_duration_ms = queue_start.elapsed().as_millis() as i32;

        // ── Step 2: Call AI model ──────────────────────────────────
        let processing_start = Instant::now();

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

        let processing_duration_ms = processing_start.elapsed().as_millis() as i32;

        // ── Step 3: Release GPU slot ───────────────────────────────
        drop(slot_guard);

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

        // ── Step 4: Record usage ───────────────────────────────────
        let total_duration_ms = overall_start.elapsed().as_millis() as i32;
        let cost = usage::estimate_cost(&model, prompt_tokens as i32, completion_tokens as i32);

        let record = UsageRecord {
            id: Uuid::new_v4(),
            user_id: user.id,
            api_key_id: None,
            conversation_id: None,
            request_id: request_id.clone(),
            model: model.clone(),
            input_tokens: prompt_tokens as i32,
            output_tokens: completion_tokens as i32,
            total_tokens: (prompt_tokens + completion_tokens) as i32,
            queue_duration_ms,
            processing_duration_ms,
            total_duration_ms,
            status: "completed".to_string(),
            cancelled_at: None,
            error_message: None,
            cost_microcents: cost,
            created_at: Utc::now(),
        };

        if let Err(e) = usage::record_usage(&state.db, &record).await {
            tracing::error!(error = %e, "failed to record usage");
        }

        let response = ChatCompletionResponse::new(
            request_id,
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

        // Release concurrent stream counter for non-streaming path
        if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
            let script = redis::Script::new(r#"
                local val = tonumber(redis.call('GET', KEYS[1]) or '0')
                if val > 0 then return redis.call('DECR', KEYS[1]) end
                return val
            "#);
            let _: Result<i64, _> = script.key(&stream_key).invoke_async(&mut conn).await;
        }

        Ok(Json(response).into_response())
    }
}
