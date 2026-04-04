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
use crate::services::billing;
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
        "mira" | "mira-thinking" | "mira-pro" | "mira-max" => {}
        _ => {
            return Err(AppError::BadRequest(
                "Invalid model. Must be one of: mira, mira-thinking, mira-pro, mira-max".to_string(),
            ));
        }
    }

    // Enforce subscription expiry — downgrades expired code_plan to "free" in DB
    let code_plan = crate::services::subscription::check_and_enforce_expiry(
        &state.db, user.id, "code",
    ).await.unwrap_or_else(|_| user.code_plan.clone());

    // Determine effective plan: use code_plan for API key users (CLI),
    // fall back to general plan if code_plan is not set
    let effective_plan_owned: String;
    let effective_plan = if code_plan != "free" {
        effective_plan_owned = code_plan;
        &effective_plan_owned
    } else {
        &user.plan
    };

    // Enforce model access by plan
    if let Ok(pricing) = billing::get_pricing(&state.db, &body.model).await {
        let plan_rank = |p: &str| match p {
            "free" => 0, "pro" => 1, "max" => 2, "enterprise" => 3, _ => 0,
        };
        if plan_rank(effective_plan) < plan_rank(&pricing.min_plan) {
            return Err(AppError::Forbidden(format!(
                "Model {} requires {} plan or higher",
                body.model, pricing.min_plan
            )));
        }
    }

    // Pre-check: require balance only for pay-per-use (no active subscription).
    // Users with an active code_plan subscription don't need balance.
    let has_active_subscription = effective_plan != "free"
        && user.code_plan_expires_at.map_or(false, |exp| exp > Utc::now());
    if !has_active_subscription && effective_plan != "free" && user.balance_kopecks <= 0 {
        return Err(AppError::PaymentRequired(
            "Insufficient balance. Please top up your account.".to_string(),
        ));
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

    // Daily message limit — if exceeded but user has balance, allow as paid overage
    let daily_limit: i64 = match effective_plan.as_str() {
        "free" => 20,
        "pro" => 500,
        "max" | "enterprise" => -1,
        _ => 20,
    };
    let mut is_overage = false;
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
            if locked_user.allow_overage_billing && locked_user.balance_kopecks > 0 {
                is_overage = true;
            } else {
                tx.commit().await?;
                return Err(AppError::RateLimited { retry_after: 3600 });
            }
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
                    .unwrap_or(false) // fail CLOSED
            }
            Err(_) => false, // fail CLOSED
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

    // Strip system messages — the CLI sends its own system prompt but we don't
    // want it reaching the model (reduces model capacity, adds wrong instructions)
    let history: Vec<ChatMessage> = body
        .messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| ChatMessage {
            role: m.role.clone(),
            content: sanitize::sanitize_input(&m.content),
            tool_calls: None,
            tool_call_id: None,
            name: None,
            attachments: vec![],
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
        let history_clone = history.clone();
        let user_id = user.id;
        let user_plan = effective_plan.to_string();
        let user_in_overage = is_overage;
        let user_name_scrub = Some(user.name.clone());
        let user_email_scrub = user.email.clone();
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
                &user_plan,
                false,
                &state_clone.config,
                None, None, None,
                user_name_scrub.clone(), user_email_scrub.clone(),
                None, // no project instructions for API completions
                None, // no project_id for API completions
            );

            tokio::pin!(ai_stream);

            loop {
                tokio::select! {
                    event_opt = ai_stream.next() => {
                        match event_opt {
                            Some(ai_proxy::AiEvent::Token(chunk)) => {
                                if total_size + chunk.len() > MAX_RESPONSE_SIZE {
                                    tracing::warn!("AI response exceeded maximum size, truncating");
                                    break;
                                }
                                // Sanitize each token before sending to the client
                                let chunk = sanitize::sanitize_output(&chunk);
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
                            // Ignore search events in OpenAI-compatible endpoint
                            Some(_) => {}
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

            // ── Billing charge (paid plans + overage) ──────────────
            if status == "completed" && (user_plan != "free" || user_in_overage) {
                match billing::get_pricing(&state_clone.db, &model_clone).await {
                    Ok(pricing) => {
                        let charge = billing::calculate_charge(&pricing, input_tokens, output_tokens_count);
                        if charge > 0 {
                            let desc = format!(
                                "{} — {} in / {} out tokens",
                                pricing.display_name, input_tokens, output_tokens_count
                            );
                            if let Err(e) = billing::charge_user(
                                &state_clone.db,
                                user_id,
                                charge,
                                &desc,
                                Some(record.id),
                                &model_clone,
                                input_tokens,
                                output_tokens_count,
                            ).await {
                                tracing::error!(error = %e, user_id = %user_id, cost = charge, "BILLING CHARGE FAILED — user received unpaid response");
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!(error = %e, model = %model_clone, "no pricing for model (billing skipped)");
                    }
                }
            }

            // ── Bridge sync: store messages for remote control viewers ──
            if status == "completed" && !full_content.is_empty() {
                // Find user's active bridge environment
                let bridge_env = sqlx::query_scalar::<_, uuid::Uuid>(
                    "SELECT id FROM bridge_environments WHERE user_id = $1 AND status = 'connected' LIMIT 1"
                )
                .bind(user_id)
                .fetch_optional(&state_clone.db)
                .await
                .ok()
                .flatten();

                if let Some(env_id) = bridge_env {
                    // Store user message (last user message from history)
                    // Skip system prompts, CLI commands, and XML-tagged messages
                    if let Some(last_user) = history_clone.iter().rev().find(|m| {
                        m.role == "user"
                            && !m.content.contains("<command-name>")
                            && !m.content.contains("<local-command-stdout>")
                            && !m.content.contains("<system-reminder>")
                            && !m.content.trim().starts_with('/')
                    }) {
                        let _ = sqlx::query(
                            "INSERT INTO bridge_messages (environment_id, role, content, created_at) VALUES ($1, 'user', $2, $3)"
                        )
                        .bind(env_id)
                        .bind(&last_user.content)
                        .bind(Utc::now() - chrono::Duration::milliseconds(100))
                        .execute(&state_clone.db)
                        .await;
                    }

                    // Store assistant response
                    let _ = sqlx::query(
                        "INSERT INTO bridge_messages (environment_id, role, content, created_at) VALUES ($1, 'assistant', $2, $3)"
                    )
                    .bind(env_id)
                    .bind(&full_content)
                    .bind(Utc::now())
                    .execute(&state_clone.db)
                    .await;
                }
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
            effective_plan,
            false,
            &state.config,
            None, None, None,
            Some(user.name.clone()), user.email.clone(),
            None, // no project instructions for API completions
            None, // no project_id for API completions
        );

        tokio::pin!(ai_stream);

        const MAX_RESPONSE_SIZE: usize = 256 * 1024;
        let mut full_content = String::new();
        while let Some(event) = ai_stream.next().await {
            if let ai_proxy::AiEvent::Token(chunk) = event {
                if full_content.len() + chunk.len() > MAX_RESPONSE_SIZE {
                    tracing::warn!("AI response exceeded maximum size, truncating");
                    break;
                }
                full_content.push_str(&chunk);
            }
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

        // ── Billing charge (paid plans + overage) ──────────────
        if user.plan != "free" || is_overage {
            match billing::get_pricing(&state.db, &model).await {
                Ok(pricing) => {
                    let charge = billing::calculate_charge(&pricing, prompt_tokens as i32, completion_tokens as i32);
                    if charge > 0 {
                        let desc = format!(
                            "{} — {} in / {} out tokens",
                            pricing.display_name, prompt_tokens, completion_tokens
                        );
                        if let Err(e) = billing::charge_user(
                            &state.db,
                            user.id,
                            charge,
                            &desc,
                            Some(record.id),
                            &model,
                            prompt_tokens as i32,
                            completion_tokens as i32,
                        ).await {
                            tracing::warn!(error = %e, user_id = %user.id, "billing charge failed (non-fatal)");
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!(error = %e, model = %model, "no pricing for model (billing skipped)");
                }
            }
        }

        // ── Bridge sync (non-streaming path) ──
        if !full_content.is_empty() {
            let bridge_env = sqlx::query_scalar::<_, uuid::Uuid>(
                "SELECT id FROM bridge_environments WHERE user_id = $1 AND status = 'connected' LIMIT 1"
            )
            .bind(user.id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();

            if let Some(env_id) = bridge_env {
                if let Some(last_user) = history.iter().rev().find(|m| {
                    m.role == "user"
                        && !m.content.contains("<command-name>")
                        && !m.content.contains("<local-command-stdout>")
                        && !m.content.contains("<system-reminder>")
                        && !m.content.trim().starts_with('/')
                }) {
                    let _ = sqlx::query(
                        "INSERT INTO bridge_messages (environment_id, role, content, created_at) VALUES ($1, 'user', $2, $3)"
                    )
                    .bind(env_id)
                    .bind(&last_user.content)
                    .bind(Utc::now() - chrono::Duration::milliseconds(100))
                    .execute(&state.db)
                    .await;
                }
                let _ = sqlx::query(
                    "INSERT INTO bridge_messages (environment_id, role, content, created_at) VALUES ($1, 'assistant', $2, $3)"
                )
                .bind(env_id)
                .bind(&full_content)
                .bind(Utc::now())
                .execute(&state.db)
                .await;
            }
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
