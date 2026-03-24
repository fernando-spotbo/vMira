//! Telegram Bot webhook handler + account linking endpoints.
//!
//! - POST /api/v1/telegram/webhook — Telegram sends updates here (HMAC-exempt)
//! - POST /api/v1/telegram/link-token — generate a one-time deep-link token (auth required)
//! - GET  /api/v1/telegram/status — check linking status (auth required)
//! - DELETE /api/v1/telegram/unlink — remove telegram link (auth required)

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::TelegramLink;
use crate::services::telegram::{TelegramBot, TgUpdate};

// ── Routes ───────────────────────────────────────────────────────────────

pub fn telegram_routes() -> Router<AppState> {
    Router::new()
        .route("/telegram/webhook", post(webhook_handler))
        .route("/telegram/link-token", post(generate_link_token))
        .route("/telegram/status", get(link_status))
        .route("/telegram/unlink", delete(unlink))
}

// ── Webhook handler ─────────────────────────────────────────────────────

async fn webhook_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(update): Json<TgUpdate>,
) -> StatusCode {
    // Verify Telegram's secret_token header
    let expected = &state.config.telegram_webhook_secret;
    if !expected.is_empty() {
        let provided = headers
            .get("x-telegram-bot-api-secret-token")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if provided != expected {
            tracing::warn!("Telegram webhook: invalid secret token");
            return StatusCode::FORBIDDEN;
        }
    }

    let bot = TelegramBot::new(&state.config.telegram_bot_token);
    if !bot.is_configured() {
        tracing::warn!("Telegram webhook received but bot token not configured");
        return StatusCode::OK;
    }

    // Handle callback queries (inline keyboard button presses)
    if let Some(cb) = update.callback_query {
        tokio::spawn(handle_callback_query(state.clone(), bot, cb));
        return StatusCode::OK;
    }

    // Handle messages
    if let Some(msg) = update.message {
        let text = msg.text.clone().unwrap_or_default();
        let chat_id = msg.chat.id;

        // Handle /start command with deep link payload
        if text.starts_with("/start") {
            let payload = text.strip_prefix("/start").map(|s| s.trim()).unwrap_or("");
            if !payload.is_empty() {
                tokio::spawn(handle_deep_link(
                    state.clone(),
                    bot,
                    chat_id,
                    msg.from.as_ref().and_then(|u| u.username.clone()),
                    payload.to_string(),
                ));
            } else {
                tokio::spawn(handle_start(bot, chat_id));
            }
            return StatusCode::OK;
        }

        // Handle /help
        if text.starts_with("/help") {
            tokio::spawn(handle_help(bot, chat_id));
            return StatusCode::OK;
        }

        // Handle /unlink
        if text.starts_with("/unlink") {
            tokio::spawn(handle_unlink_command(state.clone(), bot, chat_id));
            return StatusCode::OK;
        }

        // Two-way chat: forward message to AI
        if msg.voice.is_some() {
            tokio::spawn(handle_voice_message(state.clone(), bot, msg));
        } else if !text.is_empty() {
            tokio::spawn(handle_text_message(state.clone(), bot, chat_id, text));
        }
    }

    StatusCode::OK
}

// ── Callback query handler (snooze/dismiss) ─────────────────────────────

async fn handle_callback_query(
    state: AppState,
    bot: TelegramBot,
    cb: crate::services::telegram::TgCallbackQuery,
) {
    let data = cb.data.unwrap_or_default();
    let parts: Vec<&str> = data.splitn(3, ':').collect();

    match parts.as_slice() {
        ["snooze", reminder_id, minutes_str] => {
            let Ok(minutes) = minutes_str.parse::<i64>() else {
                let _ = bot.answer_callback_query(&cb.id, Some("Ошибка")).await;
                return;
            };
            let Ok(rid) = Uuid::parse_str(reminder_id) else {
                let _ = bot.answer_callback_query(&cb.id, Some("Ошибка")).await;
                return;
            };

            // Snooze the reminder
            let result = sqlx::query(
                "UPDATE reminders SET
                    status = 'pending',
                    remind_at = now() + make_interval(mins => $1::double precision),
                    fired_at = NULL,
                    updated_at = now()
                 WHERE id = $2"
            )
            .bind(minutes as f64)
            .bind(rid)
            .execute(&state.db)
            .await;

            match result {
                Ok(_) => {
                    let _ = bot.answer_callback_query(&cb.id, Some(&format!("⏰ Отложено на {} мин", minutes))).await;
                    // Update the message to show snoozed status
                    if let Some(msg) = &cb.message {
                        let _ = bot.edit_message_text(
                            msg.chat.id,
                            msg.message_id,
                            &format!("⏸ <b>Отложено на {} мин</b>", minutes),
                            None,
                        ).await;
                    }
                }
                Err(e) => {
                    tracing::error!(error = %e, "Failed to snooze reminder via Telegram");
                    let _ = bot.answer_callback_query(&cb.id, Some("Ошибка при откладывании")).await;
                }
            }
        }
        ["dismiss", reminder_id] => {
            let _ = bot.answer_callback_query(&cb.id, Some("✓ Готово")).await;
            // Remove inline keyboard from message
            if let Some(msg) = &cb.message {
                let original_text = msg.text.clone().unwrap_or_else(|| "✓ Готово".into());
                let _ = bot.edit_message_text(
                    msg.chat.id,
                    msg.message_id,
                    &format!("{}\n\n<i>✓ Выполнено</i>", crate::services::telegram::format_reminder_html(
                        &original_text, None
                    )),
                    None, // no keyboard = removes it
                ).await;
            }
            let _ = reminder_id; // reminder stays as fired
        }
        _ => {
            let _ = bot.answer_callback_query(&cb.id, None).await;
        }
    }
}

// ── Deep link account linking ───────────────────────────────────────────

async fn handle_deep_link(
    state: AppState,
    bot: TelegramBot,
    chat_id: i64,
    username: Option<String>,
    token: String,
) {
    // Look up the token in Redis
    let token_key = format!("tg:link:{}", token);
    let user_id: Option<String> = match state.redis.get_multiplexed_async_connection().await {
        Ok(mut conn) => {
            let result: Result<Option<String>, _> = redis::cmd("GET")
                .arg(&token_key)
                .query_async(&mut conn)
                .await;
            if let Ok(val) = result {
                // Delete the token after use (one-time)
                let _: Result<(), _> = redis::cmd("DEL")
                    .arg(&token_key)
                    .query_async(&mut conn)
                    .await;
                val
            } else {
                None
            }
        }
        Err(e) => {
            tracing::error!(error = %e, "Redis error during deep link");
            None
        }
    };

    let Some(user_id_str) = user_id else {
        let _ = bot.send_message(
            chat_id,
            "❌ Ссылка недействительна или истекла. Попробуйте создать новую в настройках Mira.",
            None,
        ).await;
        return;
    };

    let Ok(user_id) = Uuid::parse_str(&user_id_str) else {
        let _ = bot.send_message(chat_id, "❌ Ошибка привязки.", None).await;
        return;
    };

    // Get user's timezone from settings
    let timezone: String = sqlx::query_scalar(
        "SELECT timezone FROM notification_settings WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Europe/Moscow".to_string());

    // Insert or update telegram_links
    let result = sqlx::query(
        "INSERT INTO telegram_links (user_id, chat_id, username, timezone, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (user_id) DO UPDATE SET
            chat_id = $2, username = $3, timezone = $4, is_active = true, linked_at = now()"
    )
    .bind(user_id)
    .bind(chat_id)
    .bind(&username)
    .bind(&timezone)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            // Also enable telegram in notification settings
            let _ = sqlx::query(
                "INSERT INTO notification_settings (user_id, telegram_enabled)
                 VALUES ($1, true)
                 ON CONFLICT (user_id) DO UPDATE SET telegram_enabled = true, updated_at = now()"
            )
            .bind(user_id)
            .execute(&state.db)
            .await;

            let _ = bot.send_message(
                chat_id,
                "✅ <b>Telegram подключен к Mira!</b>\n\n\
                 Теперь вы будете получать напоминания сюда.\n\
                 Также можете отправлять сообщения — Мира ответит прямо в чат.\n\n\
                 /help — справка\n\
                 /unlink — отвязать аккаунт",
                None,
            ).await;

            tracing::info!(user_id = %user_id, chat_id, "Telegram account linked");
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to link Telegram account");
            let _ = bot.send_message(chat_id, "❌ Ошибка при привязке аккаунта.", None).await;
        }
    }
}

// ── /start without payload ──────────────────────────────────────────────

async fn handle_start(bot: TelegramBot, chat_id: i64) {
    let _ = bot.send_message(
        chat_id,
        "👋 <b>Привет! Я Мира</b> — AI-ассистент.\n\n\
         Чтобы подключить аккаунт, перейдите в <b>Настройки → Уведомления</b> на сайте и нажмите «Подключить Telegram».\n\n\
         После привязки:\n\
         • Напоминания будут приходить сюда\n\
         • Можно писать мне прямо в чат\n\
         • Голосовые сообщения тоже поддерживаются\n\n\
         /help — справка",
        None,
    ).await;
}

// ── /help ───────────────────────────────────────────────────────────────

async fn handle_help(bot: TelegramBot, chat_id: i64) {
    let _ = bot.send_message(
        chat_id,
        "<b>Команды:</b>\n\n\
         /start — начало работы\n\
         /help — эта справка\n\
         /unlink — отвязать аккаунт\n\n\
         <b>Возможности:</b>\n\
         • Отправьте текст — Мира ответит\n\
         • Отправьте голосовое — Мира распознает и ответит\n\
         • Напоминания приходят с кнопками (отложить/готово)\n\n\
         🌐 <a href=\"https://vmira.ai\">vmira.ai</a>",
        None,
    ).await;
}

// ── /unlink command ─────────────────────────────────────────────────────

async fn handle_unlink_command(state: AppState, bot: TelegramBot, chat_id: i64) {
    let result = sqlx::query(
        "UPDATE telegram_links SET is_active = false WHERE chat_id = $1"
    )
    .bind(chat_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            let _ = bot.send_message(
                chat_id,
                "✅ Аккаунт отвязан. Уведомления больше не будут приходить сюда.\n\
                 Чтобы привязать снова — используйте ссылку из настроек на сайте.",
                None,
            ).await;
        }
        _ => {
            let _ = bot.send_message(
                chat_id,
                "Аккаунт не привязан.",
                None,
            ).await;
        }
    }
}

// ── Two-way chat: text message ──────────────────────────────────────────

async fn handle_text_message(
    state: AppState,
    bot: TelegramBot,
    chat_id: i64,
    text: String,
) {
    // Look up user by chat_id
    let link = sqlx::query_as::<_, TelegramLink>(
        "SELECT * FROM telegram_links WHERE chat_id = $1 AND is_active = true"
    )
    .bind(chat_id)
    .fetch_optional(&state.db)
    .await;

    let link = match link {
        Ok(Some(l)) => l,
        _ => {
            let _ = bot.send_message(
                chat_id,
                "Аккаунт не привязан. Привяжите в настройках на vmira.ai",
                None,
            ).await;
            return;
        }
    };

    // Show typing indicator
    let _ = bot.send_chat_action(chat_id, "typing").await;

    // Send a placeholder message that we'll edit with the streamed response
    let placeholder = match bot.send_message(chat_id, "⏳", None).await {
        Ok(msg) => msg,
        Err(e) => {
            tracing::error!(error = %e, "Failed to send placeholder message");
            return;
        }
    };

    // Build messages for AI (use last few messages from the Telegram conversation context)
    // For now, send just the user's message as a single-turn conversation
    let messages = vec![
        serde_json::json!({
            "role": "system",
            "content": format!(
                "{}\n\nТекущее время: {}. Часовой пояс пользователя: {}.\nКонтекст: пользователь пишет через Telegram. Отвечай кратко.",
                super::chat::TELEGRAM_SYSTEM_ADDENDUM,
                Utc::now().format("%Y-%m-%dT%H:%M:%S%:z"),
                link.timezone,
            )
        }),
        serde_json::json!({
            "role": "user",
            "content": text
        }),
    ];

    // Call AI model (non-streaming for Telegram — simpler and more reliable)
    let ai_response = call_ai_for_telegram(&state, messages).await;

    match ai_response {
        Ok(response_text) => {
            let escaped = telegram_html_escape(&response_text);
            let _ = bot.edit_message_text(chat_id, placeholder.message_id, &escaped, None).await;
        }
        Err(e) => {
            tracing::error!(error = %e, "AI response failed for Telegram");
            let _ = bot.edit_message_text(
                chat_id,
                placeholder.message_id,
                "❌ Не удалось получить ответ. Попробуйте позже.",
                None,
            ).await;
        }
    }
}

// ── Two-way chat: voice message ─────────────────────────────────────────

async fn handle_voice_message(
    state: AppState,
    bot: TelegramBot,
    msg: crate::services::telegram::TgMessage,
) {
    let chat_id = msg.chat.id;
    let voice = msg.voice.unwrap();

    // Look up user
    let link = sqlx::query_as::<_, TelegramLink>(
        "SELECT * FROM telegram_links WHERE chat_id = $1 AND is_active = true"
    )
    .bind(chat_id)
    .fetch_optional(&state.db)
    .await;

    let link = match link {
        Ok(Some(l)) => l,
        _ => {
            let _ = bot.send_message(chat_id, "Аккаунт не привязан.", None).await;
            return;
        }
    };

    let _ = bot.send_chat_action(chat_id, "typing").await;

    // Download the voice file from Telegram
    let file_info = match bot.get_file(&voice.file_id).await {
        Ok(f) => f,
        Err(e) => {
            tracing::error!(error = %e, "Failed to get voice file info");
            let _ = bot.send_message(chat_id, "❌ Не удалось обработать голосовое сообщение.", None).await;
            return;
        }
    };

    let file_path = match file_info.file_path {
        Some(p) => p,
        None => {
            let _ = bot.send_message(chat_id, "❌ Файл недоступен.", None).await;
            return;
        }
    };

    let audio_data = match bot.download_file(&file_path).await {
        Ok(d) => d,
        Err(e) => {
            tracing::error!(error = %e, "Failed to download voice file");
            let _ = bot.send_message(chat_id, "❌ Ошибка загрузки.", None).await;
            return;
        }
    };

    // Transcribe with Whisper
    let transcript = match transcribe_audio(&state, &audio_data).await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!(error = %e, "Whisper transcription failed");
            let _ = bot.send_message(chat_id, "❌ Не удалось распознать речь.", None).await;
            return;
        }
    };

    if transcript.trim().is_empty() {
        let _ = bot.send_message(chat_id, "🔇 Не удалось распознать текст.", None).await;
        return;
    }

    // Send the transcribed text, then process as regular text
    let placeholder = match bot.send_message(
        chat_id,
        &format!("🎤 <i>{}</i>\n\n⏳", telegram_html_escape(&transcript)),
        None,
    ).await {
        Ok(msg) => msg,
        Err(_) => return,
    };

    let messages = vec![
        serde_json::json!({
            "role": "system",
            "content": format!(
                "{}\n\nТекущее время: {}. Часовой пояс пользователя: {}.\nКонтекст: голосовое сообщение через Telegram. Отвечай кратко.",
                super::chat::TELEGRAM_SYSTEM_ADDENDUM,
                Utc::now().format("%Y-%m-%dT%H:%M:%S%:z"),
                link.timezone,
            )
        }),
        serde_json::json!({
            "role": "user",
            "content": transcript
        }),
    ];

    let ai_response = call_ai_for_telegram(&state, messages).await;

    match ai_response {
        Ok(response_text) => {
            let escaped = telegram_html_escape(&response_text);
            let _ = bot.edit_message_text(chat_id, placeholder.message_id, &escaped, None).await;
        }
        Err(e) => {
            tracing::error!(error = %e, "AI response failed for Telegram voice");
            let _ = bot.edit_message_text(
                chat_id,
                placeholder.message_id,
                "❌ Не удалось получить ответ.",
                None,
            ).await;
        }
    }
}

// ── AI call for Telegram (non-streaming) ────────────────────────────────

async fn call_ai_for_telegram(
    state: &AppState,
    messages: Vec<serde_json::Value>,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Map model to actual API model name
    let model = "deepseek-chat";
    let url = &state.config.ai_model_url;
    let api_key = &state.config.ai_model_api_key;

    if url.is_empty() || api_key.is_empty() {
        return Err("AI model not configured".into());
    }

    let body = json!({
        "model": model,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.7,
        "stream": false,
    });

    let resp = client
        .post(format!("{}/chat/completions", url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("AI request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("AI API returned {status}: {text}"));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI response: {e}"))?;

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Не удалось получить ответ")
        .to_string();

    Ok(content)
}

// ── Whisper transcription ───────────────────────────────────────────────

async fn transcribe_audio(state: &AppState, audio_data: &[u8]) -> Result<String, String> {
    let client = reqwest::Client::new();

    let part = reqwest::multipart::Part::bytes(audio_data.to_vec())
        .file_name("voice.ogg")
        .mime_str("audio/ogg")
        .map_err(|e| format!("Multipart error: {e}"))?;

    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("language", "ru");

    let resp = client
        .post(format!("{}/transcribe", state.config.whisper_url))
        .multipart(form)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Whisper request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Whisper returned {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse whisper response: {e}"))?;

    Ok(data["text"].as_str().unwrap_or("").to_string())
}

// ── Account linking API endpoints (auth required) ───────────────────────

#[derive(Serialize)]
struct LinkTokenResponse {
    token: String,
    bot_username: String,
    deep_link: String,
}

async fn generate_link_token(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<LinkTokenResponse>, AppError> {
    // Generate a random token
    let token: String = {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        (0..32)
            .map(|_| {
                let idx: u32 = rng.gen_range(0..36);
                if idx < 10 {
                    (b'0' + idx as u8) as char
                } else {
                    (b'a' + (idx - 10) as u8) as char
                }
            })
            .collect()
    };

    // Store in Redis with 10-minute TTL
    let token_key = format!("tg:link:{}", token);
    match state.redis.get_multiplexed_async_connection().await {
        Ok(mut conn) => {
            let _: Result<(), _> = redis::cmd("SET")
                .arg(&token_key)
                .arg(user.id.to_string())
                .arg("EX")
                .arg(600) // 10 minutes
                .query_async(&mut conn)
                .await;
        }
        Err(e) => {
            tracing::error!(error = %e, "Redis error generating link token");
            return Err(AppError::Internal("Failed to generate token".into()));
        }
    }

    let bot_username = "vMiraBot";
    let deep_link = format!("https://t.me/{}?start={}", bot_username, token);

    Ok(Json(LinkTokenResponse {
        token,
        bot_username: bot_username.into(),
        deep_link,
    }))
}

#[derive(Serialize)]
struct TelegramStatusResponse {
    linked: bool,
    username: Option<String>,
    chat_id: Option<i64>,
    linked_at: Option<String>,
}

async fn link_status(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<TelegramStatusResponse>, AppError> {
    let link = sqlx::query_as::<_, TelegramLink>(
        "SELECT * FROM telegram_links WHERE user_id = $1 AND is_active = true"
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    match link {
        Some(l) => Ok(Json(TelegramStatusResponse {
            linked: true,
            username: l.username,
            chat_id: Some(l.chat_id),
            linked_at: Some(l.linked_at.to_rfc3339()),
        })),
        None => Ok(Json(TelegramStatusResponse {
            linked: false,
            username: None,
            chat_id: None,
            linked_at: None,
        })),
    }
}

async fn unlink(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<StatusCode, AppError> {
    sqlx::query(
        "UPDATE telegram_links SET is_active = false WHERE user_id = $1"
    )
    .bind(user.id)
    .execute(&state.db)
    .await?;

    // Also disable telegram notifications
    sqlx::query(
        "UPDATE notification_settings SET telegram_enabled = false, updated_at = now()
         WHERE user_id = $1"
    )
    .bind(user.id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Helpers ─────────────────────────────────────────────────────────────

/// Escape text for Telegram HTML parse mode.
fn telegram_html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}
