//! Chat CRUD routes + SSE streaming with queue, cancellation, and metering.

use std::convert::Infallible;
use std::time::{Duration, Instant};

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
use tokio_util::sync::CancellationToken;
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{Conversation, Message, UsageRecord};
use crate::schema::{
    ConversationCreate, ConversationResponse, ConversationUpdate, ConversationWithMessages,
    MessageRequest, MessageResponse,
};
use crate::services::ai_proxy::{self, ChatMessage};
use crate::services::audit::{log_api_event, log_security_event};
use crate::services::billing;
use crate::services::moderation::{self, block_message};
use crate::services::queue;
use crate::services::rate_limit;
use crate::services::sanitize;
use crate::services::usage;

/// Addendum appended to system prompt for Telegram-originated messages.
pub const TELEGRAM_SYSTEM_ADDENDUM: &str = "\
Ты Мира — AI-ассистент. Пользователь пишет через Telegram.\n\
Отвечай кратко (1-3 абзаца). Не используй markdown — только чистый текст.\n\
Можешь использовать эмодзи умеренно.\n\
Если пользователь просит напомнить — ответь что напоминание уже настроено в приложении.";

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
        // Anonymous endpoint — no auth required, rate limited by IP+device
        .route("/anonymous", post(anonymous_stream))
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
        project_id: c.project_id,
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
        attachments: None,
        created_at: m.created_at,
    }
}

fn msg_response_with_attachments(m: &Message, attachments: Vec<crate::models::Attachment>) -> MessageResponse {
    let att_briefs: Vec<crate::schema::AttachmentBrief> = attachments
        .into_iter()
        .map(|a| crate::schema::AttachmentBrief {
            id: a.id,
            filename: a.filename,
            original_filename: a.original_filename,
            mime_type: a.mime_type.clone(),
            size_bytes: a.size_bytes,
            width: a.width,
            height: a.height,
            url: format!("/api/v1/attachments/{}", a.id),
        })
        .collect();

    MessageResponse {
        id: m.id,
        role: m.role.clone(),
        content: m.content.clone(),
        steps: m.steps.clone(),
        input_tokens: m.input_tokens,
        output_tokens: m.output_tokens,
        model: m.model.clone(),
        attachments: if att_briefs.is_empty() { None } else { Some(att_briefs) },
        created_at: m.created_at,
    }
}

/// Plan-based daily message limits.
/// Free plan gets generous limits (GPT approach — fast responses, no hard wall).
fn plan_limit(plan: &str) -> i64 {
    match plan {
        "free" => 1000,
        "pro" => 5000,
        "max" | "enterprise" => -1, // unlimited
        _ => 1000,
    }
}

/// Check if a user's plan meets the minimum required for a model.
/// Plan hierarchy: free < pro < max < enterprise.
fn plan_meets_minimum(user_plan: &str, min_plan: &str) -> bool {
    let rank = |p: &str| match p {
        "free" => 0,
        "pro" => 1,
        "max" => 2,
        "enterprise" => 3,
        _ => 0,
    };
    rank(user_plan) >= rank(min_plan)
}

/// Approximate token count by splitting on whitespace (rough heuristic).
fn approx_tokens(text: &str) -> i32 {
    // ~0.75 words per token is the common approximation; we use word count
    // as a conservative upper bound since we lack a real tokenizer.
    text.split_whitespace().count() as i32
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

    let org_id = user.active_organization_id.unwrap_or(user.id);
    let conversations = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations
         WHERE organization_id = $1 AND archived = false
         ORDER BY updated_at DESC
         LIMIT $2 OFFSET $3"
    )
    .bind(org_id)
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

    // Limit total conversations per org to prevent storage abuse
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let conv_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM conversations WHERE organization_id = $1"
    )
    .bind(org_id)
    .fetch_one(&state.db)
    .await?;

    let chat_plan_for_limit = crate::services::subscription::check_and_enforce_expiry(
        &state.db, user.id, "chat",
    ).await.unwrap_or_else(|_| "free".to_string());
    let max_conversations: i64 = match chat_plan_for_limit.as_str() {
        "free" => 100,
        "pro" => 1000,
        "max" | "enterprise" => 10000,
        _ => 100,
    };

    if conv_count >= max_conversations {
        return Err(AppError::BadRequest(format!(
            "Maximum {} conversations reached for your plan",
            max_conversations
        )));
    }

    let now = Utc::now();
    let conv = sqlx::query_as::<_, Conversation>(
        "INSERT INTO conversations (id, user_id, organization_id, title, model, starred, archived, project_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, false, $6, $7, $7)
         RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind(org_id)
    .bind(&body.title)
    .bind(&body.model)
    .bind(body.project_id)
    .bind(now)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(conv_response(&conv))))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /conversations/:id
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct MessagePagination {
    #[serde(default = "default_msg_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_msg_limit() -> i64 {
    50
}

async fn get_conversation(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(conv_id): Path<Uuid>,
    Query(pg): Query<MessagePagination>,
) -> Result<Json<ConversationWithMessages>, AppError> {
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let conv = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND organization_id = $2"
    )
    .bind(conv_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    let msg_limit = pg.limit.min(200).max(1);
    let msg_offset = pg.offset.max(0);

    // Total message count for pagination
    let total_messages: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM messages WHERE conversation_id = $1"
    )
    .bind(conv_id)
    .fetch_one(&state.db)
    .await?;

    // Load messages: get the last N by using a subquery that picks from the end
    // offset=0 means the most recent `limit` messages
    let messages = sqlx::query_as::<_, Message>(
        "SELECT * FROM (
            SELECT * FROM messages WHERE conversation_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        ) sub ORDER BY created_at ASC"
    )
    .bind(conv_id)
    .bind(msg_limit)
    .bind(msg_offset)
    .fetch_all(&state.db)
    .await?;

    // Load attachments only for the fetched messages
    let msg_ids: Vec<Uuid> = messages.iter().map(|m| m.id).collect();
    let attachments = if msg_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, crate::models::Attachment>(
            "SELECT * FROM attachments WHERE message_id = ANY($1) ORDER BY created_at ASC"
        )
        .bind(&msg_ids)
        .fetch_all(&state.db)
        .await?
    };

    // Group attachments by message_id
    let mut att_by_msg: std::collections::HashMap<uuid::Uuid, Vec<crate::models::Attachment>> =
        std::collections::HashMap::new();
    for a in attachments {
        if let Some(mid) = a.message_id {
            att_by_msg.entry(mid).or_default().push(a);
        }
    }

    let msg_responses: Vec<MessageResponse> = messages
        .iter()
        .map(|m| {
            let atts = att_by_msg.remove(&m.id).unwrap_or_default();
            msg_response_with_attachments(m, atts)
        })
        .collect();

    let loaded = msg_offset + msg_limit;
    Ok(Json(ConversationWithMessages {
        id: conv.id,
        title: conv.title,
        model: conv.model,
        starred: conv.starred,
        archived: conv.archived,
        project_id: conv.project_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        messages: msg_responses,
        total_messages,
        has_more: loaded < total_messages,
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

    let org_id = user.active_organization_id.unwrap_or(user.id);
    let conv = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND organization_id = $2"
    )
    .bind(conv_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    let title = body.title.as_deref().unwrap_or(&conv.title);
    let starred = body.starred.unwrap_or(conv.starred);
    let archived = body.archived.unwrap_or(conv.archived);
    let project_id = match &body.project_id {
        Some(pid) => *pid,       // explicitly set (Some(uuid) or None/null)
        None => conv.project_id, // not provided — keep current
    };

    let updated = sqlx::query_as::<_, Conversation>(
        "UPDATE conversations SET title = $1, starred = $2, archived = $3, project_id = $4, updated_at = $5
         WHERE id = $6
         RETURNING *"
    )
    .bind(title)
    .bind(starred)
    .bind(archived)
    .bind(project_id)
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
    // Use a transaction to atomically verify ownership and delete.
    // The SELECT ... FOR UPDATE locks the conversation row, preventing
    // concurrent message inserts from creating orphaned rows.
    let mut tx = state.db.begin().await?;

    let org_id = user.active_organization_id.unwrap_or(user.id);
    let _conv = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND organization_id = $2 FOR UPDATE"
    )
    .bind(conv_id)
    .bind(org_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    sqlx::query("DELETE FROM messages WHERE conversation_id = $1")
        .bind(conv_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM conversations WHERE id = $1")
        .bind(conv_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(StatusCode::NO_CONTENT)
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /conversations/:id/messages  (SSE streaming with queue + metering)
// ═══════════════════════════════════════════════════════════════════════════

async fn send_message(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(conv_id): Path<Uuid>,
    Json(body): Json<MessageRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    // Check chat subscription expiry (downgrades to free if expired)
    let chat_plan = crate::services::subscription::check_and_enforce_expiry(
        &state.db, user.id, "chat"
    ).await.unwrap_or_else(|_| "free".to_string());

    // Validate model against allowlist
    match body.model.as_str() {
        "mira" | "mira-thinking" | "mira-pro" | "mira-max" => {}
        _ => {
            return Err(AppError::BadRequest(
                "Invalid model. Must be one of: mira, mira-thinking, mira-pro, mira-max".to_string(),
            ));
        }
    }

    // Enforce model access by chat subscription plan
    if let Ok(pricing) = billing::get_pricing(&state.db, &body.model).await {
        if !plan_meets_minimum(&chat_plan, &pricing.min_plan) {
            return Err(AppError::Forbidden(format!(
                "Model {} requires {} plan or higher. Current chat plan: {}",
                body.model, pricing.min_plan, chat_plan
            )));
        }
    }

    // Rate limit user (per-minute)
    rate_limit::rate_limit_user(&state.redis, &user.id.to_string(), &state.config)
        .await
        .map_err(|e| match e {
            rate_limit::RateLimitError::Exceeded { retry_after_seconds } => {
                AppError::RateLimited { retry_after: retry_after_seconds as u32 }
            }
            rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
        })?;

    // Free chat plan: additional hourly rate limit (10 messages/hour)
    let is_free = chat_plan == "free";
    if is_free {
        let hourly_key = format!("rl:hourly:{}", user.id);
        let (hourly_ok, _) = rate_limit::check_rate_limit(&state.redis, &hourly_key, 10, 3600)
            .await
            .map_err(|e| match e {
                rate_limit::RateLimitError::Exceeded { retry_after_seconds } => {
                    AppError::RateLimited { retry_after: retry_after_seconds as u32 }
                }
                rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
            })?;
        if !hourly_ok {
            return Err(AppError::RateLimited { retry_after: 3600 });
        }
    }

    // Atomically check-and-increment concurrent SSE streams using a Lua script.
    // This prevents TOCTOU race conditions where two requests both read the
    // counter before either increments it.
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
                    .unwrap_or(false) // fail CLOSED if Redis is down
            }
            Err(_) => false, // fail CLOSED
        }
    };

    if !stream_acquired {
        return Err(AppError::RateLimited { retry_after: 5 });
    }

    // Daily message limit based on chat subscription plan
    let limit = plan_limit(&chat_plan);
    let mut is_overage = false;
    if limit != -1 {
        let now = Utc::now();

        let mut tx = state.db.begin().await?;

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
            // Limit exceeded — allow only if user opted in AND has balance
            if locked_user.allow_overage_billing && locked_user.balance_kopecks > 0 {
                is_overage = true;
            } else {
                tx.commit().await?;
                return Err(AppError::RateLimited { retry_after: 3600 });
            }
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

    // Verify conversation ownership (org-scoped)
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let conv = sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND organization_id = $2"
    )
    .bind(conv_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    // If this is a resend/retry, remove the previous version of this message
    // and any assistant responses that followed it, so the model gets clean history.
    if body.resend {
        // Find the last user message with identical content
        let old_msg = sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE conversation_id = $1 AND role = 'user' AND content = $2
             ORDER BY created_at DESC LIMIT 1"
        )
        .bind(conv.id)
        .bind(&content)
        .fetch_optional(&state.db)
        .await?;

        if let Some(old) = old_msg {
            // Delete the old user message and all messages after it (assistant responses)
            sqlx::query(
                "DELETE FROM messages WHERE conversation_id = $1 AND created_at >= $2"
            )
            .bind(conv.id)
            .bind(old.created_at)
            .execute(&state.db)
            .await?;
        }
    }

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

    // Link uploaded attachments to this message (only ones belonging to this conversation+user)
    if body.attachment_ids.len() > 20 {
        return Err(AppError::BadRequest("Too many attachments (max 20)".to_string()));
    }
    if !body.attachment_ids.is_empty() {
        sqlx::query(
            "UPDATE attachments SET message_id = $1
             WHERE id = ANY($2) AND conversation_id = $3 AND user_id = $4 AND message_id IS NULL"
        )
        .bind(user_msg_id)
        .bind(&body.attachment_ids)
        .bind(conv.id)
        .bind(user.id)
        .execute(&state.db)
        .await?;
    }

    // Auto-title on first message
    let msg_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages WHERE conversation_id = $1")
        .bind(conv.id)
        .fetch_one(&state.db)
        .await?;

    if msg_count <= 1 {
        let title: String = content.chars().take(80).collect();
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

    // Collect message IDs for attachment lookup
    let msg_ids: Vec<uuid::Uuid> = history_rows.iter().map(|m| m.id).collect();

    // Fetch all attachments for these messages in one query
    let attachments = if msg_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, crate::models::Attachment>(
            "SELECT * FROM attachments WHERE message_id = ANY($1) ORDER BY created_at ASC"
        )
        .bind(&msg_ids)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    };

    // Group attachments by message_id
    let mut att_by_msg: std::collections::HashMap<uuid::Uuid, Vec<crate::services::ai_proxy::MessageAttachment>> =
        std::collections::HashMap::new();
    for att in attachments {
        if let Some(mid) = att.message_id {
            att_by_msg.entry(mid).or_default().push(
                crate::services::ai_proxy::MessageAttachment {
                    mime_type: att.mime_type,
                    original_filename: att.original_filename,
                    storage_path: att.storage_path,
                    extracted_content: att.extracted_content,
                }
            );
        }
    }

    let history: Vec<ChatMessage> = history_rows
        .into_iter()
        .rev()
        .map(|m| {
            let msg_attachments = att_by_msg.remove(&m.id).unwrap_or_default();
            ChatMessage {
                role: m.role,
                content: m.content,
                tool_calls: None,
                tool_call_id: None,
                name: None,
                attachments: msg_attachments,
            }
        })
        .collect();

    // Calculate input tokens from history
    let input_tokens: i32 = history.iter().map(|m| approx_tokens(&m.content)).sum();

    // Stream counter was already atomically incremented above.

    // Build SSE stream with queue, cancellation, and metering
    let model_name = body.model.clone();
    let voice_mode = body.voice;
    let conversation_id = conv.id;
    let conv_project_id = conv.project_id;
    let user_id = user.id;
    let user_plan = chat_plan.clone();
    let user_in_overage = is_overage;
    let _user_language = user.language.clone();
    let user_name_scrub = Some(user.name.clone());
    let user_email_scrub = user.email.clone();
    let state_clone = state.clone();
    let stream_key_clone = stream_key.clone();
    let request_id = format!("req-{}", Uuid::new_v4());
    let cancel_token = CancellationToken::new();
    let cancel_clone = cancel_token.clone();

    let stream = async_stream::stream! {
        let overall_start = Instant::now();
        let mut queue_duration_ms: i32 = 0;
        let mut processing_duration_ms: i32 = 0;
        let mut status = "completed".to_string();
        let mut error_message: Option<String> = None;
        let mut output_tokens: i32 = 0;

        const MAX_RESPONSE_SIZE: usize = 256 * 1024;
        let mut full_content = String::new();
        let mut search_steps: Vec<serde_json::Value> = Vec::new();
        let mut reminder_data: Option<serde_json::Value> = None;
        let mut scheduled_content_data: Option<serde_json::Value> = None;
        let mut action_data: Option<serde_json::Value> = None;

        // ── Step 1: Try to acquire a GPU slot ──────────────────────
        let queue_start = Instant::now();
        let slot_guard = match queue::try_acquire_slot(
            &state_clone.redis,
            &request_id,
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
                    let event_data = serde_json::json!({
                        "type": "error",
                        "message": "Queue is full, please try again later"
                    });
                    yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));
                    status = "error".to_string();
                    error_message = Some("Queue full".to_string());

                    // Record usage with error
                    let total_duration_ms = overall_start.elapsed().as_millis() as i32;
                    let cost = usage::estimate_cost(&model_name, input_tokens, 0);
                    let record = UsageRecord {
                        id: Uuid::new_v4(),
                        user_id,
                        api_key_id: None,
                        conversation_id: Some(conversation_id),
                        request_id: request_id.clone(),
                        model: model_name.clone(),
                        input_tokens,
                        output_tokens: 0,
                        total_tokens: input_tokens,
                        queue_duration_ms: 0,
                        processing_duration_ms: 0,
                        total_duration_ms,
                        status: status.clone(),
                        cancelled_at: None,
                        error_message: error_message.clone(),
                        cost_microcents: cost,
                        created_at: Utc::now(),
                    };
                    let _ = usage::record_usage(&state_clone.db, &record).await;

                    // Release stream counter
                    if let Ok(mut conn) = state_clone.redis.get_multiplexed_async_connection().await {
                        let script = redis::Script::new(r#"
                            local val = tonumber(redis.call('GET', KEYS[1]) or '0')
                            if val > 0 then return redis.call('DECR', KEYS[1]) end
                            return val
                        "#);
                        let _: Result<i64, _> = script.key(&stream_key_clone).invoke_async(&mut conn).await;
                    }
                    return;
                }

                // Enqueue and stream position updates
                let position = match queue::enqueue_request(
                    &state_clone.redis,
                    &request_id,
                    &user_id.to_string(),
                ).await {
                    Ok(pos) => pos,
                    Err(e) => {
                        tracing::error!(error = %e, "failed to enqueue request");
                        let event_data = serde_json::json!({
                            "type": "error",
                            "message": "Failed to enqueue request"
                        });
                        yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));
                        // Release stream counter
                        if let Ok(mut conn) = state_clone.redis.get_multiplexed_async_connection().await {
                            let script = redis::Script::new(r#"
                                local val = tonumber(redis.call('GET', KEYS[1]) or '0')
                                if val > 0 then return redis.call('DECR', KEYS[1]) end
                                return val
                            "#);
                            let _: Result<i64, _> = script.key(&stream_key_clone).invoke_async(&mut conn).await;
                        }
                        return;
                    }
                };

                // Send initial queue position
                let event_data = serde_json::json!({
                    "type": "queue",
                    "position": position,
                    "estimated_wait": position * 5,
                });
                yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));

                // Poll for slot availability
                let mut acquired_guard: Option<queue::SlotGuard> = None;
                loop {
                    if cancel_clone.is_cancelled() {
                        let _ = queue::dequeue_request(&state_clone.redis, &request_id).await;
                        status = "cancelled".to_string();
                        break;
                    }

                    match queue::try_acquire_slot(&state_clone.redis, &request_id, &state_clone.config).await {
                        Ok(Some(guard)) => {
                            let _ = queue::dequeue_request(&state_clone.redis, &request_id).await;
                            acquired_guard = Some(guard);
                            break;
                        }
                        Ok(None) => {
                            // Update position
                            let pos = queue::get_queue_position(&state_clone.redis, &request_id).await.unwrap_or(0);
                            let event_data = serde_json::json!({
                                "type": "queue",
                                "position": pos,
                                "estimated_wait": pos * 5,
                            });
                            yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));

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
                    // Handle early cancellation while queuing
                    let total_duration_ms = overall_start.elapsed().as_millis() as i32;
                    let cost = usage::estimate_cost(&model_name, input_tokens, 0);
                    let record = UsageRecord {
                        id: Uuid::new_v4(),
                        user_id,
                        api_key_id: None,
                        conversation_id: Some(conversation_id),
                        request_id: request_id.clone(),
                        model: model_name.clone(),
                        input_tokens,
                        output_tokens: 0,
                        total_tokens: input_tokens,
                        queue_duration_ms,
                        processing_duration_ms: 0,
                        total_duration_ms,
                        status: status.clone(),
                        cancelled_at: Some(Utc::now()),
                        error_message: None,
                        cost_microcents: cost,
                        created_at: Utc::now(),
                    };
                    let _ = usage::record_usage(&state_clone.db, &record).await;

                    // Release stream counter
                    if let Ok(mut conn) = state_clone.redis.get_multiplexed_async_connection().await {
                        let script = redis::Script::new(r#"
                            local val = tonumber(redis.call('GET', KEYS[1]) or '0')
                            if val > 0 then return redis.call('DECR', KEYS[1]) end
                            return val
                        "#);
                        let _: Result<i64, _> = script.key(&stream_key_clone).invoke_async(&mut conn).await;
                    }
                    return;
                }

                acquired_guard
            }
            Err(e) => {
                tracing::error!(error = %e, "failed to check GPU slot");
                // Proceed without queue (degraded mode)
                None
            }
        };

        // ── Step 2: Stream AI response ─────────────────────────────

        // Free users: 1s deprioritization delay (paid users go first)
        if user_plan == "free" {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        let event_data = serde_json::json!({"type": "processing"});
        yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));

        let processing_start = Instant::now();

        // Fetch user's timezone from notification settings
        let user_tz: Option<String> = sqlx::query_scalar(
            "SELECT timezone FROM notification_settings WHERE user_id = $1"
        )
        .bind(user.id)
        .fetch_optional(&state_clone.db)
        .await
        .ok()
        .flatten();

        // Fetch project instructions if conversation belongs to a project
        let project_instructions = if let Some(pid) = conv_project_id {
            sqlx::query_scalar::<_, Option<String>>(
                "SELECT instructions FROM projects WHERE id = $1"
            )
            .bind(pid)
            .fetch_optional(&state_clone.db)
            .await
            .ok()
            .flatten()
            .flatten()
        } else {
            None
        };

        let ai_stream = ai_proxy::stream_ai_response(
            history,
            model_name.clone(),
            0.7,
            if voice_mode { 1024 } else if user_plan == "free" { 2048 } else { 4096 },
            &user_plan,
            voice_mode,
            &state_clone.config,
            Some(user.id),
            Some(state_clone.db.clone()),
            user_tz,
            user_name_scrub.clone(),
            user_email_scrub.clone(),
            project_instructions,
        );

        tokio::pin!(ai_stream);

        loop {
            tokio::select! {
                event_opt = ai_stream.next() => {
                    match event_opt {
                        Some(ai_proxy::AiEvent::Token(chunk)) => {
                            if full_content.len() + chunk.len() > MAX_RESPONSE_SIZE {
                                tracing::warn!("AI response exceeded maximum size, truncating");
                                break;
                            }
                            // Sanitize each token before sending to the client
                            let chunk = sanitize::sanitize_output(&chunk);
                            full_content.push_str(&chunk);
                            let event_data = serde_json::json!({
                                "type": "token",
                                "content": chunk,
                            });
                            yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));
                        }
                        Some(ai_proxy::AiEvent::Thinking(chunk)) => {
                            // Show thinking for thinking/pro/max models, hide for mira (fast)
                            if model_name != "mira" {
                                let event_data = serde_json::json!({
                                    "type": "thinking",
                                    "content": chunk,
                                });
                                yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));
                            }
                        }
                        Some(ai_proxy::AiEvent::SearchStarted { query }) => {
                            let event_data = serde_json::json!({
                                "type": "search",
                                "query": query,
                            });
                            yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));
                        }
                        Some(ai_proxy::AiEvent::SearchResults { query, results }) => {
                            let results_json: Vec<serde_json::Value> = results.iter().map(|r| serde_json::json!({
                                "title": r.title,
                                "url": r.url,
                                "domain": r.domain,
                                "content": r.content,
                            })).collect();

                            // Collect for DB persistence
                            search_steps.push(serde_json::json!({
                                "query": query,
                                "resultCount": results_json.len(),
                                "results": results_json.iter().map(|r| serde_json::json!({
                                    "title": r["title"],
                                    "domain": r["domain"],
                                    "url": r["url"],
                                })).collect::<Vec<_>>(),
                            }));

                            let event_data = serde_json::json!({
                                "type": "search_results",
                                "query": query,
                                "results": results_json,
                            });
                            yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));
                        }
                        Some(ai_proxy::AiEvent::ReminderCreated { id, title, remind_at, rrule, channels }) => {
                            let rd = serde_json::json!({
                                "type": "reminder_created",
                                "id": id,
                                "title": title,
                                "remind_at": remind_at,
                                "rrule": rrule,
                                "channels": channels,
                            });
                            reminder_data = Some(rd.clone());
                            yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&rd).unwrap_or_default()));
                        }
                        Some(ai_proxy::AiEvent::ScheduledContentCreated { id, title, prompt, schedule_at, rrule }) => {
                            let sc = serde_json::json!({
                                "type": "scheduled_content_created",
                                "id": id,
                                "title": title,
                                "prompt": prompt,
                                "schedule_at": schedule_at,
                                "rrule": rrule,
                            });
                            scheduled_content_data = Some(sc.clone());
                            yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&sc).unwrap_or_default()));
                        }
                        Some(ai_proxy::AiEvent::ActionProposed { id, action_type, payload }) => {
                            let ap = serde_json::json!({
                                "type": "action_proposed",
                                "id": id,
                                "action_type": action_type,
                                "payload": payload,
                            });
                            action_data = Some(ap.clone());
                            yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&ap).unwrap_or_default()));
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
        output_tokens = approx_tokens(&full_content);

        // ── Step 3: Release GPU slot ───────────────────────────────
        drop(slot_guard);

        // ── Step 4: Record usage ───────────────────────────────────
        let total_duration_ms = overall_start.elapsed().as_millis() as i32;
        let total_tokens = input_tokens + output_tokens;
        let cost = usage::estimate_cost(&model_name, input_tokens, output_tokens);

        let cancelled_at = if status == "cancelled" {
            Some(Utc::now())
        } else {
            None
        };

        let record = UsageRecord {
            id: Uuid::new_v4(),
            user_id,
            api_key_id: None,
            conversation_id: Some(conversation_id),
            request_id: request_id.clone(),
            model: model_name.clone(),
            input_tokens,
            output_tokens,
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

        // ── Step 5: Billing charge (paid plans + overage) ──────────
        let mut charge_kopecks: i64 = 0;
        if status == "completed" && (user_plan != "free" || user_in_overage) {
            // Paid users and free users in overage are charged per-token
            match billing::get_pricing(&state_clone.db, &model_name).await {
                Ok(pricing) => {
                    charge_kopecks = billing::calculate_charge(&pricing, input_tokens, output_tokens);
                    if charge_kopecks > 0 {
                        let desc = format!(
                            "{} — {} in / {} out tokens",
                            pricing.display_name, input_tokens, output_tokens
                        );
                        if let Err(e) = billing::charge_user(
                            &state_clone.db,
                            user_id,
                            charge_kopecks,
                            &desc,
                            Some(record.id),
                            &model_name,
                            input_tokens,
                            output_tokens,
                        ).await {
                            tracing::error!(error = %e, user_id = %user_id, cost = charge_kopecks, "BILLING CHARGE FAILED — user received unpaid response");
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!(error = %e, model = %model_name, "no pricing for model (billing skipped)");
                }
            }
        }

        // ── Step 6: Send done event ────────────────────────────────
        if status == "completed" {
            let done_data = serde_json::json!({
                "type": "done",
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                    "cost_microcents": cost,
                    "charge_kopecks": charge_kopecks,
                },
            });
            yield Ok(Event::default().data(serde_json::to_string(&done_data).unwrap_or_default()));
        }

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
        if !full_content.is_empty() && status == "completed" {
            let output_mod = moderation::moderate_output(&full_content);
            let final_content = if output_mod.blocked {
                log_security_event("output_blocked", None, Some(&format!("category={:?}", output_mod.category)));
                block_message("ru").to_string()
            } else {
                sanitize::sanitize_output(&full_content)
            };

            // Build steps JSON if we have search data
            let steps_json: Option<serde_json::Value> = if !search_steps.is_empty() || reminder_data.is_some() || scheduled_content_data.is_some() || action_data.is_some() {
                let mut steps = Vec::new();
                if !search_steps.is_empty() {
                    steps.push(serde_json::json!({
                        "type": "reasoning",
                        "summary": search_steps.iter()
                            .map(|s| s["query"].as_str().unwrap_or(""))
                            .collect::<Vec<_>>()
                            .join(", "),
                        "searches": search_steps,
                    }));
                }
                if let Some(ref rd) = reminder_data {
                    steps.push(rd.clone());
                }
                if let Some(ref sc) = scheduled_content_data {
                    steps.push(sc.clone());
                }
                if let Some(ref ap) = action_data {
                    steps.push(ap.clone());
                }
                steps.push(serde_json::json!({
                    "type": "text",
                    "content": final_content,
                }));
                Some(serde_json::json!(steps))
            } else {
                None
            };

            let save_result = sqlx::query(
                "INSERT INTO messages (id, conversation_id, role, content, steps, model, input_tokens, output_tokens, created_at)
                 VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8)"
            )
            .bind(Uuid::new_v4())
            .bind(conversation_id)
            .bind(&final_content)
            .bind(&steps_json)
            .bind(&model_name)
            .bind(input_tokens)
            .bind(output_tokens)
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

            // Clear extracted_content — it was only needed for the AI request.
            // No point storing extracted text after the model has processed it.
            let _ = sqlx::query(
                "UPDATE attachments SET extracted_content = NULL \
                 WHERE conversation_id = $1 AND extracted_content IS NOT NULL"
            )
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

// ═══════════════════════════════════════════════════════════════════════════
//  POST /anonymous  (guest streaming — no auth, no storage, IP+device rate limit)
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct AnonymousRequest {
    content: String,
    device_id: String,
}

async fn anonymous_stream(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<AnonymousRequest>,
) -> Result<impl IntoResponse, AppError> {
    let content = body.content.trim().to_string();
    if content.is_empty() || content.len() > 4000 {
        return Err(AppError::BadRequest("Message too short or too long".into()));
    }

    // Device ID validation — only allow safe characters
    let device_id = body.device_id.trim();
    if device_id.is_empty() || device_id.len() > 64 {
        return Err(AppError::BadRequest("Invalid device ID".into()));
    }
    if !device_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err(AppError::BadRequest("Invalid device ID format".into()));
    }

    // Extract client IP
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.rsplit(',').next()) // rightmost = IP added by trusted proxy
        .unwrap_or("unknown")
        .trim()
        .to_string();

    // Rate limit: 5 messages per day by IP + device hash
    let rate_key = {
        use sha2::{Digest, Sha256};
        let hash = Sha256::digest(format!("{}:{}", client_ip, device_id).as_bytes());
        format!("anon:rate:{:x}", hash)
    };

    let (allowed, _remaining) = rate_limit::check_rate_limit(
        &state.redis,
        &rate_key,
        5,    // max 5 messages per day
        86400, // 24 hours
    )
    .await
    .map_err(|e| match e {
        rate_limit::RateLimitError::Exceeded { .. } => {
            AppError::RateLimited { retry_after: 3600 }
        }
        rate_limit::RateLimitError::Redis(msg) => AppError::Internal(msg),
    })?;

    if !allowed {
        return Err(AppError::RateLimited { retry_after: 3600 });
    }

    // Content moderation
    let mod_result = moderation::moderate_input(&content);
    if mod_result.blocked {
        return Err(AppError::BadRequest("Message blocked by content filter".into()));
    }

    let config = state.config.clone();

    let stream = async_stream::stream! {
        // ── Deprioritize: 2s delay (authenticated users go first) ──
        tokio::time::sleep(Duration::from_secs(2)).await;

        let event_data = serde_json::json!({"type": "processing"});
        yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&event_data).unwrap_or_default()));

        let messages = vec![ChatMessage {
            role: "user".into(),
            content: content.clone(),
            tool_calls: None,
            tool_call_id: None,
            name: None,
            attachments: vec![],
        }];

        let ai_stream = ai_proxy::stream_ai_response(
            messages,
            "mira".into(),
            0.7,
            1024, // shorter responses for guests
            "free",
            false,
            &config,
            None,  // no user_id for guests
            None,  // no db for guests
            None,  // no timezone for guests
            None,  // no user name for guests
            None,  // no user email for guests
            None,  // no project instructions for guests
        );

        tokio::pin!(ai_stream);

        let mut total_bytes: usize = 0;
        const ANON_MAX_RESPONSE: usize = 64 * 1024; // 64 KB cap for anonymous streams

        loop {
            match ai_stream.next().await {
                Some(ai_proxy::AiEvent::Token(chunk)) => {
                    total_bytes += chunk.len();
                    if total_bytes > ANON_MAX_RESPONSE {
                        let err = serde_json::json!({"type": "error", "message": "Response size limit reached"});
                        yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&err).unwrap_or_default()));
                        break;
                    }
                    let clean = sanitize::sanitize_output(&chunk);
                    let data = serde_json::json!({"type": "token", "content": clean});
                    yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&data).unwrap_or_default()));
                }
                Some(ai_proxy::AiEvent::SearchStarted { query }) => {
                    let data = serde_json::json!({"type": "search", "query": query});
                    yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&data).unwrap_or_default()));
                }
                Some(ai_proxy::AiEvent::SearchResults { query, results }) => {
                    let data = serde_json::json!({"type": "search_results", "query": query, "results": results});
                    yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&data).unwrap_or_default()));
                }
                Some(ai_proxy::AiEvent::ReminderCreated { .. }) => {
                    // Guests can't create reminders — ignore
                }
                Some(ai_proxy::AiEvent::ScheduledContentCreated { .. }) => {
                    // Guests can't create scheduled content — ignore
                }
                Some(ai_proxy::AiEvent::ActionProposed { .. }) => {
                    // Guests can't propose actions — ignore
                }
                Some(ai_proxy::AiEvent::Thinking(_)) => {
                    // Guests use mira (fast) — no thinking display
                }
                None => break,
            }
        }

        let done = serde_json::json!({"type": "done"});
        yield Ok::<_, Infallible>(Event::default().data(serde_json::to_string(&done).unwrap_or_default()));
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    ))
}
