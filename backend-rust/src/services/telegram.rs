//! Telegram Bot API client for sending messages, editing, and managing webhooks.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Telegram Bot API client.
#[derive(Clone)]
pub struct TelegramBot {
    token: String,
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
pub struct TelegramResponse<T> {
    pub ok: bool,
    pub result: Option<T>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TgUser {
    pub id: i64,
    pub first_name: String,
    pub username: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TgMessage {
    pub message_id: i64,
    pub chat: TgChat,
    pub from: Option<TgUser>,
    pub text: Option<String>,
    pub voice: Option<TgVoice>,
}

#[derive(Debug, Deserialize)]
pub struct TgChat {
    pub id: i64,
}

#[derive(Debug, Deserialize)]
pub struct TgVoice {
    pub file_id: String,
    pub duration: i64,
}

#[derive(Debug, Deserialize)]
pub struct TgCallbackQuery {
    pub id: String,
    pub from: TgUser,
    pub message: Option<TgMessage>,
    pub data: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TgFile {
    pub file_id: String,
    pub file_path: Option<String>,
}

/// Incoming webhook update from Telegram.
#[derive(Debug, Deserialize)]
pub struct TgUpdate {
    pub update_id: i64,
    pub message: Option<TgMessage>,
    pub callback_query: Option<TgCallbackQuery>,
}

/// Inline keyboard button.
#[derive(Debug, Serialize)]
pub struct InlineButton {
    pub text: String,
    pub callback_data: String,
}

impl TelegramBot {
    pub fn new(token: &str) -> Self {
        Self {
            token: token.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Check if the bot is configured (token is set).
    pub fn is_configured(&self) -> bool {
        !self.token.is_empty()
    }

    fn api_url(&self, method: &str) -> String {
        format!("https://api.telegram.org/bot{}/{}", self.token, method)
    }

    /// Call a Telegram Bot API method.
    async fn call(&self, method: &str, body: &Value) -> Result<Value, String> {
        let resp = self
            .client
            .post(&self.api_url(method))
            .json(body)
            .send()
            .await
            .map_err(|e| format!("Telegram API request failed: {e}"))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            tracing::error!(method, status = %status, body = %text, "Telegram API error");
            return Err(format!("Telegram API {method} returned {status}: {text}"));
        }

        serde_json::from_str(&text).map_err(|e| format!("Failed to parse Telegram response: {e}"))
    }

    /// Send a text message with optional inline keyboard.
    pub async fn send_message(
        &self,
        chat_id: i64,
        text: &str,
        keyboard: Option<Vec<Vec<InlineButton>>>,
    ) -> Result<TgMessage, String> {
        let mut body = json!({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
        });

        if let Some(kb) = keyboard {
            body["reply_markup"] = json!({ "inline_keyboard": kb });
        }

        let resp = self.call("sendMessage", &body).await?;
        let tg_resp: TelegramResponse<TgMessage> =
            serde_json::from_value(resp).map_err(|e| format!("Parse sendMessage: {e}"))?;

        tg_resp.result.ok_or_else(|| {
            tg_resp
                .description
                .unwrap_or_else(|| "Unknown error".into())
        })
    }

    /// Edit an existing message text.
    pub async fn edit_message_text(
        &self,
        chat_id: i64,
        message_id: i64,
        text: &str,
        keyboard: Option<Vec<Vec<InlineButton>>>,
    ) -> Result<(), String> {
        let mut body = json!({
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "parse_mode": "HTML",
        });

        if let Some(kb) = keyboard {
            body["reply_markup"] = json!({ "inline_keyboard": kb });
        }

        self.call("editMessageText", &body).await?;
        Ok(())
    }

    /// Answer a callback query (dismiss the loading indicator on inline button).
    pub async fn answer_callback_query(
        &self,
        callback_query_id: &str,
        text: Option<&str>,
    ) -> Result<(), String> {
        let mut body = json!({ "callback_query_id": callback_query_id });
        if let Some(t) = text {
            body["text"] = json!(t);
        }
        self.call("answerCallbackQuery", &body).await?;
        Ok(())
    }

    /// Register a webhook URL with Telegram.
    pub async fn set_webhook(&self, url: &str, secret_token: &str) -> Result<(), String> {
        let body = json!({
            "url": url,
            "secret_token": secret_token,
            "allowed_updates": ["message", "callback_query"],
            "max_connections": 40,
        });
        self.call("setWebhook", &body).await?;
        tracing::info!(url, "Telegram webhook registered");
        Ok(())
    }

    /// Remove the webhook.
    pub async fn delete_webhook(&self) -> Result<(), String> {
        self.call("deleteWebhook", &json!({})).await?;
        Ok(())
    }

    /// Get info about the bot.
    pub async fn get_me(&self) -> Result<TgUser, String> {
        let resp = self.call("getMe", &json!({})).await?;
        let tg_resp: TelegramResponse<TgUser> =
            serde_json::from_value(resp).map_err(|e| format!("Parse getMe: {e}"))?;
        tg_resp
            .result
            .ok_or_else(|| tg_resp.description.unwrap_or_else(|| "Unknown error".into()))
    }

    /// Get file path for downloading.
    pub async fn get_file(&self, file_id: &str) -> Result<TgFile, String> {
        let body = json!({ "file_id": file_id });
        let resp = self.call("getFile", &body).await?;
        let tg_resp: TelegramResponse<TgFile> =
            serde_json::from_value(resp).map_err(|e| format!("Parse getFile: {e}"))?;
        tg_resp
            .result
            .ok_or_else(|| tg_resp.description.unwrap_or_else(|| "Unknown error".into()))
    }

    /// Download a file by its file_path.
    pub async fn download_file(&self, file_path: &str) -> Result<Vec<u8>, String> {
        let url = format!(
            "https://api.telegram.org/file/bot{}/{}",
            self.token, file_path
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Download failed: {e}"))?;
        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("Read bytes failed: {e}"))
    }

    /// Send a "typing" action indicator.
    pub async fn send_chat_action(&self, chat_id: i64, action: &str) -> Result<(), String> {
        let body = json!({ "chat_id": chat_id, "action": action });
        self.call("sendChatAction", &body).await?;
        Ok(())
    }
}

/// Build inline keyboard for reminder notifications.
pub fn reminder_keyboard(reminder_id: &str) -> Vec<Vec<InlineButton>> {
    vec![vec![
        InlineButton {
            text: "⏰ 15 мин".into(),
            callback_data: format!("snooze:{}:15", reminder_id),
        },
        InlineButton {
            text: "⏰ 1 час".into(),
            callback_data: format!("snooze:{}:60", reminder_id),
        },
        InlineButton {
            text: "✓ Готово".into(),
            callback_data: format!("dismiss:{}", reminder_id),
        },
    ]]
}

/// Format a reminder notification as HTML for Telegram.
pub fn format_reminder_html(title: &str, body: Option<&str>) -> String {
    let mut msg = format!("🔔 <b>Напоминание</b>\n\n{}", html_escape(title));
    if let Some(b) = body {
        if !b.is_empty() {
            msg.push_str(&format!("\n\n{}", html_escape(b)));
        }
    }
    msg
}

/// Escape HTML special characters for Telegram.
pub fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}
