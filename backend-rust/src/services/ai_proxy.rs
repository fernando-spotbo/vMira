//! AI model proxy with streaming, SSRF protection, and retry logic.

use std::pin::Pin;
use std::time::Duration;

use futures_util::Stream;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio_stream::wrappers::ReceiverStream;

use crate::config::Config;

// ── Constants ───────────────────────────────────────────────────────────────

/// Default system prompt injected into every conversation.
pub const MIRA_SYSTEM_PROMPT: &str = "Ты Мира. Думай кратко.";

/// Maximum retry attempts for upstream failures.
const MAX_RETRIES: u32 = 2;

/// Initial backoff duration (doubled on each retry).
const INITIAL_BACKOFF: Duration = Duration::from_millis(500);

// ── Message types ───────────────────────────────────────────────────────────

/// A single message in the chat completion request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// ── OpenAI-compatible response structures ───────────────────────────────────

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: Option<String>,
}

// ── SSE (Server-Sent Events) streaming structures ───────────────────────────

#[derive(Debug, Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

// ── Thinking parser ─────────────────────────────────────────────────────────

/// Parse `<think>…</think>` blocks from the AI response.
///
/// Returns `(thinking_content, visible_content)`.
pub fn parse_thinking(content: &str) -> (Option<String>, String) {
    // Find the opening tag
    let Some(start) = content.find("<think>") else {
        return (None, content.to_string());
    };

    let after_tag = start + "<think>".len();

    let Some(end) = content[after_tag..].find("</think>") else {
        // Unclosed tag — treat everything after <think> as thinking
        let thinking = content[after_tag..].trim().to_string();
        let visible = content[..start].trim().to_string();
        let thinking = if thinking.is_empty() {
            None
        } else {
            Some(thinking)
        };
        return (thinking, visible);
    };

    let think_text = content[after_tag..after_tag + end].trim().to_string();
    let after_close = after_tag + end + "</think>".len();
    let before = &content[..start];
    let after = &content[after_close..];
    let visible = format!("{}{}", before.trim(), after.trim())
        .trim()
        .to_string();

    let thinking = if think_text.is_empty() {
        None
    } else {
        Some(think_text)
    };

    (thinking, visible)
}

// ── SSRF protection ─────────────────────────────────────────────────────────

/// Validate that the target URL's host is in the allow-list, scheme is safe, and port is standard.
fn validate_host(url: &str, allowed_hosts: &[String]) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|e| format!("Некорректный URL модели: {e}"))?;

    // Scheme check: only allow HTTPS in production (HTTP allowed in debug/dev mode)
    let scheme = parsed.scheme();
    if cfg!(debug_assertions) {
        if scheme != "https" && scheme != "http" {
            return Err(format!("Запрещённая схема URL: {scheme}"));
        }
    } else if scheme != "https" {
        return Err(format!("Разрешена только HTTPS-схема, получена: {scheme}"));
    }

    // Port check: block non-standard ports
    if let Some(port) = parsed.port() {
        if port != 443 && port != 80 {
            return Err(format!("Нестандартный порт запрещён: {port}"));
        }
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "URL модели не содержит хост".to_string())?;

    if allowed_hosts.is_empty() {
        // No allow-list configured — permit all (dev mode).
        return Ok(());
    }

    if allowed_hosts.iter().any(|h| h == host) {
        Ok(())
    } else {
        Err(format!(
            "Хост «{host}» не входит в список разрешённых для AI-модели"
        ))
    }
}

// ── Streaming proxy ─────────────────────────────────────────────────────────

/// Stream AI responses from the upstream model.
///
/// This performs a non-streaming POST to the upstream API (simpler to handle
/// with retries), parses `<think>` blocks, and yields the visible text as a
/// single-item stream.  Extend to true SSE streaming when needed.
pub fn stream_ai_response(
    messages: Vec<ChatMessage>,
    model: String,
    temperature: f64,
    max_tokens: u32,
    config: &Config,
) -> Pin<Box<dyn Stream<Item = String> + Send>> {
    let url = format!("{}/chat/completions", config.ai_model_url);
    let api_key = config.ai_model_api_key.clone();
    let allowed_hosts = config.ai_model_allowed_hosts.clone();

    let (tx, rx) = tokio::sync::mpsc::channel::<String>(32);

    // Build the full message list with system prompt.
    let mut full_messages = vec![ChatMessage {
        role: "system".to_string(),
        content: MIRA_SYSTEM_PROMPT.to_string(),
    }];
    full_messages.extend(messages);

    // Map internal model names to upstream provider model names
    let upstream_model = match model.as_str() {
        "mira" => "deepseek-chat",
        "mira-thinking" => "deepseek-reasoner",
        "mira-pro" => "deepseek-chat",
        "mira-max" => "deepseek-chat",
        other => other,
    };

    let body = json!({
        "model": upstream_model,
        "messages": full_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": false,
    });

    tokio::spawn(async move {
        // SSRF check
        if let Err(e) = validate_host(&url, &allowed_hosts) {
            tracing::error!(error = %e, "SSRF protection triggered");
            let _ = tx
                .send(format!(
                    "Ошибка безопасности: {e}"
                ))
                .await;
            return;
        }

        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("Failed to build HTTP client");

        let mut attempt = 0u32;
        let mut backoff = INITIAL_BACKOFF;

        loop {
            let result = client
                .post(&url)
                .header("Authorization", format!("Bearer {api_key}"))
                .header("Content-Type", "application/json")
                .json(&body)
                .timeout(Duration::from_secs(120))
                .send()
                .await;

            match result {
                Ok(resp) if resp.status().is_success() => {
                    match resp.json::<ChatCompletionResponse>().await {
                        Ok(data) => {
                            let raw_content = data
                                .choices
                                .first()
                                .and_then(|c| c.message.content.as_deref())
                                .unwrap_or("");

                            let (_thinking, visible) = parse_thinking(raw_content);
                            let _ = tx.send(visible).await;
                        }
                        Err(e) => {
                            tracing::error!(error = %e, "failed to parse AI response");
                            let _ = tx
                                .send(
                                    "Ошибка: не удалось обработать ответ от модели."
                                        .to_string(),
                                )
                                .await;
                        }
                    }
                    return;
                }
                Ok(resp) => {
                    let status = resp.status();
                    let body_text = resp.text().await.unwrap_or_default();
                    tracing::warn!(
                        status = %status,
                        body = %body_text,
                        attempt = attempt + 1,
                        "upstream AI returned non-success status"
                    );

                    if attempt < MAX_RETRIES {
                        attempt += 1;
                        tokio::time::sleep(backoff).await;
                        backoff *= 2;
                        continue;
                    }

                    let _ = tx
                        .send(format!(
                            "Ошибка: модель вернула статус {status}. Попробуйте позже."
                        ))
                        .await;
                    return;
                }
                Err(e) => {
                    tracing::warn!(error = %e, attempt = attempt + 1, "upstream AI request failed");

                    if attempt < MAX_RETRIES {
                        attempt += 1;
                        tokio::time::sleep(backoff).await;
                        backoff *= 2;
                        continue;
                    }

                    let _ = tx
                        .send(
                            "Ошибка: не удалось связаться с моделью. Попробуйте позже."
                                .to_string(),
                        )
                        .await;
                    return;
                }
            }
        }
    });

    Box::pin(ReceiverStream::new(rx))
}
