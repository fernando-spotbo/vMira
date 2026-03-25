//! Action execution routes — confirm/cancel/execute proposed actions.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::Action;
use crate::services::telegram::{TelegramBot, html_escape};

// ── Routes ───────────────────────────────────────────────────────────────

pub fn action_routes() -> Router<AppState> {
    Router::new()
        .route("/actions/{id}/execute", post(execute_action))
        .route("/actions/{id}/cancel", post(cancel_action))
}

// ── Execute ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ActionResponse {
    id: Uuid,
    status: String,
    result: Option<serde_json::Value>,
}

async fn execute_action(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ActionResponse>, AppError> {
    // Load and verify ownership
    let action = sqlx::query_as::<_, Action>(
        "UPDATE actions SET status = 'executing'
         WHERE id = $1 AND user_id = $2 AND status = 'proposed'
         RETURNING *"
    )
    .bind(id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Action not found or already processed".into()))?;

    // Execute based on type
    let result = match action.type_.as_str() {
        "send_telegram" => execute_send_telegram(&state, &action).await,
        "send_email" => Ok(serde_json::json!({"status": "email_not_configured", "message": "Email sending is not yet configured"})),
        // Client-side actions — mark as executed immediately
        "create_draft" | "translate" | "set_timer" | "create_code"
        | "show_weather" | "calculate" | "create_event" => Ok(serde_json::json!({"status": "ok"})),
        _ => Err(format!("Unsupported action type: {}", action.type_)),
    };

    match result {
        Ok(result_data) => {
            sqlx::query(
                "UPDATE actions SET status = 'executed', result = $1, executed_at = now() WHERE id = $2"
            )
            .bind(&result_data)
            .bind(id)
            .execute(&state.db)
            .await?;

            Ok(Json(ActionResponse { id, status: "executed".into(), result: Some(result_data) }))
        }
        Err(error) => {
            let error_data = serde_json::json!({"error": error});
            sqlx::query(
                "UPDATE actions SET status = 'failed', result = $1 WHERE id = $2"
            )
            .bind(&error_data)
            .bind(id)
            .execute(&state.db)
            .await?;

            Ok(Json(ActionResponse { id, status: "failed".into(), result: Some(error_data) }))
        }
    }
}

// ── Cancel ──────────────────────────────────────────────────────────────

async fn cancel_action(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let rows = sqlx::query(
        "UPDATE actions SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status = 'proposed'"
    )
    .bind(id)
    .bind(user.id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Action not found or already processed".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ── Executors ───────────────────────────────────────────────────────────

async fn execute_send_telegram(state: &AppState, action: &Action) -> Result<serde_json::Value, String> {
    let bot_token = &state.config.telegram_bot_token;
    if bot_token.is_empty() {
        return Err("Telegram bot not configured".into());
    }

    // Get user's telegram link
    let link = sqlx::query_as::<_, crate::models::TelegramLink>(
        "SELECT * FROM telegram_links WHERE user_id = $1 AND is_active = true"
    )
    .bind(action.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| format!("DB error: {e}"))?
    .ok_or_else(|| "Telegram not linked. Connect in Settings → Notifications.".to_string())?;

    let message = action.payload["message"]
        .as_str()
        .ok_or("Missing message in payload")?;
    let to = action.payload["to"]
        .as_str()
        .unwrap_or("user");
    let description = action.payload["description"]
        .as_str()
        .unwrap_or("");

    let bot = TelegramBot::new(bot_token);

    // Send the message to the user's own Telegram chat
    // (In a full implementation, we'd resolve contact names to chat IDs.
    //  For now, we send to the user's linked chat as a "sent on your behalf" message.)
    let text = format!(
        "📤 <b>Действие выполнено</b>\n\n{}\n\n<i>Кому: {}</i>",
        html_escape(message),
        html_escape(to),
    );

    bot.send_message(link.chat_id, &text, None).await?;

    tracing::info!(action_id = %action.id, "Action executed: send_telegram");

    Ok(serde_json::json!({
        "sent": true,
        "to": to,
        "chat_id": link.chat_id,
    }))
}
