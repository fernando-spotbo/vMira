//! Chat CRUD routes + SSE streaming for messages.

use std::convert::Infallible;
use std::time::Duration;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use futures_util::StreamExt;
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{Conversation, Message};
use crate::schema::{
    ConversationCreate, ConversationResponse, ConversationUpdate, ConversationWithMessages,
    MessageRequest, MessageResponse,
};
use crate::services::ai_proxy::{self, ChatMessage};
use crate::services::audit::{log_api_event, log_security_event};
use crate::services::moderation::{self, block_message};
use crate::services::rate_limit;
use crate::services::sanitize;

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn chat_routes() -> Router<AppState> {
    Router::new()
        .route("/conversations", get(list_conversations).post(create_conversation))
        .route(
            "/conversations/{conv_id}",
            get(get_conversation)
                .patch(update_conversation)
                .delete(delete_conversation),
        )
        .route("/conversations/{conv_id}/messages", post(send_message))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

fn conv_response(c: &Conversation) -> ConversationResponse {
    ConversationResponse {
        id: c.id,
        title: c.title.clone(),
        model: c.model.clone(),
        starred: c.starred,
        archived: c.archived,
        created_at: c.created_at,
        updated_at: c.updated_at,
    }
}

fn msg_response(m: &Message) -> MessageResponse {
    MessageResponse {
        id: m.id,
        role: m.role.clone(),
        content: m.content.clone(),
        steps: m.steps.clone(),
        input_tokens: m.input_tokens,
        output_tokens: m.output_tokens,
        model: m.model.clone(),
        created_at: m.created_at,
    }
}

/// Plan-based daily message limits.
fn plan_limit(plan: &str) -> i64 {
    match plan {
        "free" => 20,
        "pro" => 500,
        "max" | "enterprise" => -1, // unlimited
        _ => 20,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pagination
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct PaginationParams {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_limit() -> i64 {
    50
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /conversations
// ═══════════════════════════════════════════════════════════════════════════

async fn list_conversations(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<ConversationResponse>>, AppError> {
    let limit = params.limit.min(200);
    let offset = params.offset.max(0);

    let conversations = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations
         WHERE user_id = $1 AND archived = false
         ORDER BY updated_at DESC
         LIMIT $2 OFFSET $3"
    )
    .bind(user.id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(conversations.iter().map(conv_response).collect()))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /conversations
// ═══════════════════════════════════════════════════════════════════════════

async fn create_conversation(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<ConversationCreate>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let now = Utc::now();
    let conv = sqlx::query_as::<_, Conversation>(
        "INSERT INTO conversations (id, user_id, title, model, starred, archived, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, false, $5, $5)
         RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind(&body.title)
    .bind(&body.model)
    .bind(now)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(conv_response(&conv))))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /conversations/:id
// ═══════════════════════════════════════════════════════════════════════════

async fn get_conversation(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(conv_id): Path<Uuid>,
) -> Result<Json<ConversationWithMessages>, AppError> {
    let conv = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND user_id = $2"
    )
    .bind(conv_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    let messages = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC"
    )
    .bind(conv_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(ConversationWithMessages {
        id: conv.id,
        title: conv.title,
        model: conv.model,
        starred: conv.starred,
        archived: conv.archived,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        messages: messages.iter().map(msg_response).collect(),
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
//  PATCH /conversations/:id
// ═══════════════════════════════════════════════════════════════════════════

async fn update_conversation(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(conv_id): Path<Uuid>,
    Json(body): Json<ConversationUpdate>,
) -> Result<Json<ConversationResponse>, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let conv = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND user_id = $2"
    )
    .bind(conv_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    let title = body.title.as_deref().unwrap_or(&conv.title);
    let starred = body.starred.unwrap_or(conv.starred);
    let archived = body.archived.unwrap_or(conv.archived);

    let updated = sqlx::query_as::<_, Conversation>(
        "UPDATE conversations SET title = $1, starred = $2, archived = $3, updated_at = $4
         WHERE id = $5
         RETURNING *"
    )
    .bind(title)
    .bind(starred)
    .bind(archived)
    .bind(Utc::now())
    .bind(conv_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(conv_response(&updated)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /conversations/:id
// ═══════════════════════════════════════════════════════════════════════════

async fn delete_conversation(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(conv_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let _conv = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND user_id = $2"
    )
    .bind(conv_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    // Delete messages first, then conversation
    sqlx::query("DELETE FROM messages WHERE conversation_id = $1")
        .bind(conv_id)
        .execute(&state.db)
        .await?;

    sqlx::query("DELETE FROM conversations WHERE id = $1")
        .bind(conv_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /conversations/:id/messages  (SSE streaming)
// ═══════════════════════════════════════════════════════════════════════════

async fn send_message(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(conv_id): Path<Uuid>,
    Json(body): Json<MessageRequest>,
) -> Result<impl IntoResponse, AppError> {
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

    // Check concurrent SSE streams
    let stream_key = format!("streams:{}", user.id);
    let active_streams: i64 = {
        match state.redis.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                redis::cmd("GET")
                    .arg(&stream_key)
                    .query_async::<Option<String>>(&mut conn)
                    .await
                    .ok()
                    .flatten()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0)
            }
            Err(_) => 0,
        }
    };

    if active_streams >= state.config.max_concurrent_streams_per_user as i64 {
        return Err(AppError::RateLimited { retry_after: 5 });
    }

    // Daily message limit (atomic check + increment with row lock in transaction)
    let limit = plan_limit(&user.plan);
    if limit != -1 {
        let now = Utc::now();

        let mut tx = state.db.begin().await?;

        // Lock the row
        let locked_user = sqlx::query_as::<_, crate::models::User>(
            "SELECT * FROM users WHERE id = $1 FOR UPDATE"
        )
        .bind(user.id)
        .fetch_one(&mut *tx)
        .await?;

        let mut daily_used = locked_user.daily_messages_used;
        let daily_reset = locked_user.daily_reset_at;

        // Reset counter if new day
        if daily_reset.date_naive() < now.date_naive() {
            daily_used = 0;
            sqlx::query("UPDATE users SET daily_messages_used = 0, daily_reset_at = $1 WHERE id = $2")
                .bind(now)
                .bind(user.id)
                .execute(&mut *tx)
                .await?;
        }

        if daily_used >= limit as i32 {
            tx.commit().await?;
            return Err(AppError::RateLimited { retry_after: 3600 });
        }

        // Increment
        sqlx::query("UPDATE users SET daily_messages_used = daily_messages_used + 1 WHERE id = $1")
            .bind(user.id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
    }

    // Sanitize input
    let content = sanitize::sanitize_input(&body.content);

    // Content moderation
    let mod_result = moderation::moderate_input(&content);
    if mod_result.blocked {
        log_security_event(
            "content_blocked",
            None,
            Some(&format!("user={} category={:?}", user.id, mod_result.category)),
        );
        return Err(AppError::Unprocessable(
            block_message(&user.language).to_string(),
        ));
    }
    if mod_result.category.as_deref() == Some("prompt_injection") {
        log_security_event(
            "prompt_injection_detected",
            None,
            Some(&format!("user={} conv={conv_id}", user.id)),
        );
    }

    // Verify conversation ownership
    let conv = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND user_id = $2"
    )
    .bind(conv_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    // Save user message
    let user_msg_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO messages (id, conversation_id, role, content, created_at)
         VALUES ($1, $2, 'user', $3, $4)"
    )
    .bind(user_msg_id)
    .bind(conv.id)
    .bind(&content)
    .bind(Utc::now())
    .execute(&state.db)
    .await?;

    // Auto-title on first message
    let msg_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages WHERE conversation_id = $1")
        .bind(conv.id)
        .fetch_one(&state.db)
        .await?;

    if msg_count <= 1 {
        let title = &content[..content.len().min(80)];
        sqlx::query("UPDATE conversations SET title = $1 WHERE id = $2")
            .bind(title)
            .bind(conv.id)
            .execute(&state.db)
            .await?;
    }

    log_api_event(
        "send_message",
        &user.id,
        Some("conversation"),
        Some(&conv_id.to_string()),
        None,
        None,
    );

    // Build history (last 50 messages)
    let history_rows = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT 50"
    )
    .bind(conv.id)
    .fetch_all(&state.db)
    .await?;

    let history: Vec<ChatMessage> = history_rows
        .into_iter()
        .rev()
        .map(|m| ChatMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    // Increment stream counter atomically
    {
        if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
            let _: Result<(i64, bool), _> = redis::pipe()
                .atomic()
                .cmd("INCR").arg(&stream_key)
                .cmd("EXPIRE").arg(&stream_key).arg(300)
                .query_async(&mut conn)
                .await;
        }
    }

    // Build SSE stream
    let model_name = body.model.clone();
    let conversation_id = conv.id;
    let _user_language = user.language.clone();
    let state_clone = state.clone();
    let stream_key_clone = stream_key.clone();

    let stream = async_stream::stream! {
        const MAX_RESPONSE_SIZE: usize = 256 * 1024;
        let mut full_content = String::new();

        let ai_stream = ai_proxy::stream_ai_response(
            history,
            model_name.clone(),
            0.7,
            4096,
            &state_clone.config,
        );

        tokio::pin!(ai_stream);

        while let Some(chunk) = ai_stream.next().await {
            if full_content.len() + chunk.len() > MAX_RESPONSE_SIZE {
                tracing::warn!("AI response exceeded maximum size, truncating");
                break;
            }
            full_content.push_str(&chunk);
            let event = Event::default().data(&chunk);
            yield Ok::<_, Infallible>(event);
        }

        // Send DONE marker
        yield Ok(Event::default().data("[DONE]"));

        // Release stream counter atomically (decrement only if positive)
        if let Ok(mut conn) = state_clone.redis.get_multiplexed_async_connection().await {
            let script = redis::Script::new(r#"
                local val = tonumber(redis.call('GET', KEYS[1]) or '0')
                if val > 0 then
                    return redis.call('DECR', KEYS[1])
                end
                return val
            "#);
            let _: Result<i64, _> = script
                .key(&stream_key_clone)
                .invoke_async(&mut conn)
                .await;
        }

        // Moderate + save assistant message
        if !full_content.is_empty() {
            let output_mod = moderation::moderate_output(&full_content);
            let final_content = if output_mod.blocked {
                log_security_event("output_blocked", None, Some(&format!("category={:?}", output_mod.category)));
                block_message("ru").to_string()
            } else {
                sanitize::sanitize_output(&full_content)
            };

            let save_result = sqlx::query(
                "INSERT INTO messages (id, conversation_id, role, content, model, created_at)
                 VALUES ($1, $2, 'assistant', $3, $4, $5)"
            )
            .bind(Uuid::new_v4())
            .bind(conversation_id)
            .bind(&final_content)
            .bind(&model_name)
            .bind(Utc::now())
            .execute(&state_clone.db)
            .await;

            if let Err(e) = save_result {
                tracing::error!(
                    error = %e,
                    conv_id = %conversation_id,
                    "Failed to save assistant message"
                );
            }

            // Update conversation's updated_at
            let _ = sqlx::query("UPDATE conversations SET updated_at = $1 WHERE id = $2")
                .bind(Utc::now())
                .bind(conversation_id)
                .execute(&state_clone.db)
                .await;
        }
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    ))
}
