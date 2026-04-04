//! AI model proxy with tool calling (web search), SSRF protection, and retry logic.

use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use base64::Engine as _;
use futures_util::Stream;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio_stream::wrappers::ReceiverStream;

use once_cell::sync::OnceCell;

use crate::config::Config;
use crate::services::search;

/// Cached local model ID — fetched once from /v1/models on the local server.
static LOCAL_MODEL_ID: OnceCell<String> = OnceCell::new();

/// Resolve the actual model ID from the local llama-server.
/// Fetches /v1/models once and caches the result.
async fn resolve_local_model_id(config: &std::sync::Arc<Config>) -> Option<String> {
    if let Some(id) = LOCAL_MODEL_ID.get() {
        return Some(id.clone());
    }

    let url = format!("{}/v1/models", config.ai_model_url);
    let resp = reqwest::Client::new()
        .get(&url)
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .ok()?;

    let data: serde_json::Value = resp.json().await.ok()?;
    let model_id = data["data"][0]["id"].as_str()
        .or_else(|| data["models"][0]["model"].as_str())?
        .to_string();

    let _ = LOCAL_MODEL_ID.set(model_id.clone());
    tracing::info!(model_id = %model_id, "Resolved local model ID");
    Some(model_id)
}

// ── Constants ───────────────────────────────────────────────────────────────

/// Tool-calling hints only — no personality or language instructions.
/// The model responds naturally without a system prompt; these are
/// injected only when project instructions or datetime context is needed.
pub const MIRA_TOOL_HINTS: &str = "\
Cite search sources as [1], [2], [3].\n\
Never output raw XML, function calls, or internal syntax in your replies.";

/// Voice mode — keep responses short for TTS.
pub const MIRA_VOICE_PROMPT: &str = "\
Voice mode. Reply in 1-2 sentences max. No markdown.";

const MAX_RETRIES: u32 = 2;
const INITIAL_BACKOFF: Duration = Duration::from_millis(500);

/// Search results limit per plan.
pub fn search_results_for_plan(plan: &str) -> usize {
    match plan {
        "free" => 4,
        "pro" => 10,
        "max" => 20,
        "enterprise" => 20,
        _ => 4,
    }
}

// ── Event types ─────────────────────────────────────────────────────────────

/// Events emitted by the AI proxy stream.
#[derive(Debug, Clone)]
pub enum AiEvent {
    /// Text chunk from the model.
    Token(String),
    /// Search is being performed.
    SearchStarted { query: String },
    /// Search results arrived.
    SearchResults {
        query: String,
        results: Vec<search::SearchResult>,
    },
    /// A reminder was created via tool call.
    ReminderCreated {
        id: String,
        title: String,
        remind_at: String,
        rrule: Option<String>,
        channels: Vec<String>,
    },
    /// An action was proposed by the AI for user confirmation.
    ActionProposed {
        id: String,
        action_type: String,
        payload: serde_json::Value,
    },
    /// Scheduled AI content was created via tool call.
    ScheduledContentCreated {
        id: String,
        title: String,
        prompt: String,
        schedule_at: String,
        rrule: String,
    },
    /// Thinking/reasoning chunk from the model (streamed before visible content).
    Thinking(String),
}

// ── Message types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Attached files (images, PDFs, text) to include as multimodal content blocks.
    #[serde(skip)]
    pub attachments: Vec<MessageAttachment>,
}

/// An attachment resolved from the database for inclusion in AI requests.
/// Uses pre-extracted content (process-and-discard) — no disk read needed.
#[derive(Debug, Clone)]
pub struct MessageAttachment {
    pub mime_type: String,
    pub original_filename: String,
    pub storage_path: String,
    /// Pre-extracted content from the upload step. If present, used directly
    /// instead of reading the file from disk.
    pub extracted_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

// ── OpenAI-compatible response structures ───────────────────────────────────

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: Option<String>,
    tool_calls: Option<Vec<ToolCall>>,
}

// ── Search tool arguments ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SearchArgs {
    query: String,
}

// ── Tool definition ────────────────────────────────────────────────────────

fn web_search_tool() -> serde_json::Value {
    json!({
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for current information. Use when the user asks about recent events, news, prices, weather, dates, facts that may have changed, or anything you're not certain about.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query in the language most appropriate for the question"
                    }
                },
                "required": ["query"]
            }
        }
    })
}

fn reminder_tool() -> serde_json::Value {
    json!({
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": "Create a reminder or scheduled notification for the user. Use when the user says: remind me, напомни, напомни мне, не забудь, don't forget, set a reminder, поставь напоминание, or uses time expressions like 'через 5 минут', 'завтра в 10', 'every Monday', 'каждый понедельник'. Always resolve relative times to absolute ISO 8601 datetimes using the current time provided in the system prompt.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short summary of what to remind about (max 200 chars, in the user's language)"
                    },
                    "remind_at": {
                        "type": "string",
                        "description": "ISO 8601 datetime for when to send the reminder (e.g. 2026-03-25T10:00:00+03:00). Resolve relative times using the current datetime from the system prompt."
                    },
                    "channels": {
                        "type": "array",
                        "items": { "type": "string", "enum": ["in_app", "telegram"] },
                        "description": "Delivery channels. Default ['in_app']. Add 'telegram' if user says: via telegram, в телеграм, через телеграм, в тг, send to telegram."
                    },
                    "recurrence": {
                        "type": "string",
                        "description": "RFC 5545 RRULE string if recurring (e.g. FREQ=DAILY, FREQ=WEEKLY;BYDAY=MO,WE,FR, FREQ=MONTHLY). Null or omit for one-time reminders."
                    }
                },
                "required": ["title", "remind_at"]
            }
        }
    })
}

fn scheduled_content_tool() -> serde_json::Value {
    json!({
        "type": "function",
        "function": {
            "name": "create_scheduled_content",
            "description": "Create a recurring AI-generated content delivery (рассылка). Use when the user asks for regular content like: \
                утренний брифинг, дайджест новостей, ежедневная мотивация, daily briefing, morning digest, \
                'присылай мне каждый день', 'send me every morning', погоду каждый день, рецепт дня, \
                обучающий контент, цитату дня. This creates a scheduled item that will generate fresh AI content each time it fires.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short name for this scheduled content (e.g. 'Утренний брифинг', 'Цитата дня')"
                    },
                    "prompt": {
                        "type": "string",
                        "description": "The prompt that will be used to generate content each time. Be specific and detailed. \
                            Example: 'Составь краткий утренний брифинг: 3 главные новости мира, погода в Москве, одна мотивационная цитата. Формат: короткие абзацы.'"
                    },
                    "schedule_at": {
                        "type": "string",
                        "description": "ISO 8601 datetime for the first delivery. Use the user's timezone from the system prompt."
                    },
                    "recurrence": {
                        "type": "string",
                        "description": "RFC 5545 RRULE string (e.g. FREQ=DAILY, FREQ=WEEKLY;BYDAY=MO,WE,FR). Required for scheduled content."
                    }
                },
                "required": ["title", "prompt", "schedule_at", "recurrence"]
            }
        }
    })
}

fn propose_action_tool() -> serde_json::Value {
    json!({
        "type": "function",
        "function": {
            "name": "propose_action",
            "description": "Propose an action card for the user. Use when the user asks to DO something or when a rich interactive card is better than plain text. \
                Action types:\n\
                - 'send_telegram': send a message to user's Telegram. Payload: {message: 'text'}\n\
                - 'send_email': compose an email. Payload: {to: 'email', subject: 'subject', body: 'text'}\n\
                - 'create_draft': create an editable text draft (letter, post, message, code). Payload: {title: 'Draft title', content: 'full text', format: 'text'|'markdown'}\n\
                - 'translate': show translation. Payload: {target_text: 'translated text only', source_lang: 'auto-detected', target_lang: 'target language code'}. Do NOT include source_text — the frontend already has it from the user's message.\n\
                - 'set_timer': set a countdown timer. Payload: {seconds: 300, label: 'Timer label'}\n\
                - 'create_code': generate code. Payload: {language: 'python', title: 'Description', code: 'full code here'}\n\
                - 'show_weather': show real-time weather card. Payload: {city: 'city name'}. The backend fetches real data from Open-Meteo. Just pass the city name.\n\
                - 'show_stock': show stock/index price card. Payload: {symbol: 'AAPL'}. Supports US stocks (AAPL, TSLA, SPY, MSFT) and Russian stocks (SBER, GAZP, LKOH, IMOEX). Backend fetches real data.\n\
                - 'calculate': show calculation/conversion result. Payload: {expression: '15% of 48000', result: '7200', details: 'optional explanation'}. For currency: {expression: '150 USD to RUB', result: '~13 500 ₽', details: 'по курсу ~90 ₽/$ '}\n\
                - 'create_event': show calendar event card. Payload: {title: 'Meeting', date: '2026-03-28', time: '15:00', end_time: '16:00', location: 'Office', description: 'optional'}\n\
                - 'save_memory': save a fact about the user. Payload: {key: 'city', value: 'Moscow'}. Use when user shares personal info (name, city, job, preferences). Say what you saved briefly.\n\
                For weather: just pass city name, backend fetches real data. Don't use web_search for weather.\n\
                For save_memory: save when user shares personal info (name, city, preferences).\n\
                ALWAYS call this immediately — do NOT ask follow-up questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": ["send_telegram", "send_email", "create_draft", "translate", "set_timer", "create_code", "show_weather", "show_stock", "calculate", "create_event", "save_memory"],
                        "description": "Type of action"
                    },
                    "description": {
                        "type": "string",
                        "description": "Brief human-readable description in the user's language"
                    },
                    "payload": {
                        "type": "object",
                        "description": "Action-specific data (see type descriptions above)"
                    }
                },
                "required": ["action_type", "description", "payload"]
            }
        }
    })
}

fn read_memory_tool() -> serde_json::Value {
    json!({
        "type": "function",
        "function": {
            "name": "read_memory",
            "description": "Read saved facts about the user. Use when the user asks: what do you know about me, my name, where do I live, мои данные, что ты обо мне знаешь. Also use proactively when personalizing responses.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    })
}

fn read_calendar_tool() -> serde_json::Value {
    json!({
        "type": "function",
        "function": {
            "name": "read_calendar",
            "description": "Read the user's calendar events and reminders for a date range. Use when the user asks: what do I have today, am I free at, what's on my calendar, show my schedule, что у меня на сегодня, мои дела на завтра, свободен ли я.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": { "type": "string", "description": "Start date ISO 8601 (YYYY-MM-DD)" },
                    "end_date": { "type": "string", "description": "End date ISO 8601 (YYYY-MM-DD)" }
                },
                "required": ["start_date", "end_date"]
            }
        }
    })
}

// ── Thinking parser ─────────────────────────────────────────────────────────

pub fn parse_thinking(content: &str) -> (Option<String>, String) {
    let Some(start) = content.find("<think>") else {
        return (None, content.to_string());
    };

    let after_tag = start + "<think>".len();

    let Some(end) = content[after_tag..].find("</think>") else {
        let thinking = content[after_tag..].trim().to_string();
        let visible = content[..start].trim().to_string();
        let thinking = if thinking.is_empty() { None } else { Some(thinking) };
        return (thinking, visible);
    };

    let think_text = content[after_tag..after_tag + end].trim().to_string();
    let after_close = after_tag + end + "</think>".len();
    let before = &content[..start];
    let after = &content[after_close..];
    let visible = format!("{}{}", before.trim(), after.trim()).trim().to_string();
    let thinking = if think_text.is_empty() { None } else { Some(think_text) };
    (thinking, visible)
}

// ── SSRF protection ─────────────────────────────────────────────────────────

fn validate_host(url: &str, allowed_hosts: &[String]) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|e| format!("Некорректный URL модели: {e}"))?;

    let scheme = parsed.scheme();
    let host = parsed.host_str().unwrap_or("");
    let is_local = host == "localhost" || host == "127.0.0.1" || host.starts_with("10.") || host.starts_with("172.") || host.starts_with("192.168.");

    if scheme != "https" && scheme != "http" {
        return Err(format!("Запрещённая схема URL: {scheme}"));
    }
    // Allow http for local/internal addresses; require https for external
    if scheme != "https" && !is_local {
        return Err(format!("Разрешена только HTTPS-схема для внешних адресов, получена: {scheme}"));
    }

    if let Some(port) = parsed.port() {
        // Allow non-standard ports for local addresses
        if !is_local && port != 443 && port != 80 {
            return Err(format!("Нестандартный порт запрещён: {port}"));
        }
    }

    if host.is_empty() {
        return Err("URL модели не содержит хост".to_string());
    }

    // If no allowlist is configured, only allow local addresses
    if allowed_hosts.is_empty() {
        if is_local {
            return Ok(());
        }
        return Err("AI_MODEL_ALLOWED_HOSTS не настроен — внешние хосты запрещены".to_string());
    }

    if allowed_hosts.iter().any(|h| h == host) {
        Ok(())
    } else {
        Err(format!("Хост «{host}» не входит в список разрешённых для AI-модели"))
    }
}

// ── Attachment → content block conversion ──────────────────────────────────

const IMAGE_MIMES: &[&str] = &["image/jpeg", "image/png", "image/webp", "image/gif"];

/// Convert attachment to text content blocks for the AI model.
/// Uses pre-extracted content when available (process-and-discard flow).
/// Falls back to reading from disk for legacy attachments that still have files.
fn resolve_attachment_content(att: &MessageAttachment) -> Result<Vec<serde_json::Value>, String> {
    // Fast path: use pre-extracted content (new process-and-discard flow)
    if let Some(ref content) = att.extracted_content {
        if !content.is_empty() {
            return Ok(vec![json!({
                "type": "text",
                "text": content,
            })]);
        }
    }

    // Legacy path: read from disk (for attachments uploaded before process-and-discard)
    let data = match std::fs::read(&att.storage_path) {
        Ok(d) => d,
        Err(_) => {
            // File gone (cleaned up or never stored) — show metadata only
            return Ok(vec![json!({
                "type": "text",
                "text": format!("[File: {} ({})]", att.original_filename, att.mime_type),
            })]);
        }
    };

    if IMAGE_MIMES.iter().any(|m| *m == att.mime_type) {
        let size_kb = data.len() / 1024;
        let dims = image::io::Reader::new(std::io::Cursor::new(&data))
            .with_guessed_format()
            .ok()
            .and_then(|r| r.into_dimensions().ok());
        let dim_str = match dims {
            Some((w, h)) => format!("{w}×{h}"),
            None => "unknown".to_string(),
        };
        Ok(vec![json!({
            "type": "text",
            "text": format!("[Image: {} | {} | {}KB | {}]", att.original_filename, att.mime_type, size_kb, dim_str),
        })])
    } else if att.mime_type == "application/pdf" {
        // PDF: extract text
        match pdf_extract::extract_text_from_mem(&data) {
            Ok(text) => {
                let trimmed = text.trim();
                if trimmed.is_empty() {
                    Ok(vec![json!({
                        "type": "text",
                        "text": format!("[PDF «{}» — не удалось извлечь текст (возможно, отсканированный документ)]", att.original_filename),
                    })])
                } else {
                    // Limit extracted text to ~32k chars to avoid blowing up context
                    let capped = if trimmed.len() > 32_000 {
                        format!("{}…\n[Текст обрезан, всего {} символов]", &trimmed[..32_000], trimmed.len())
                    } else {
                        trimmed.to_string()
                    };
                    Ok(vec![json!({
                        "type": "text",
                        "text": format!("📄 Содержимое PDF «{}»:\n\n{}", att.original_filename, capped),
                    })])
                }
            }
            Err(e) => {
                tracing::warn!(file = %att.original_filename, error = %e, "PDF text extraction failed");
                Ok(vec![json!({
                    "type": "text",
                    "text": format!("[PDF «{}» — ошибка извлечения текста]", att.original_filename),
                })])
            }
        }
    } else if att.mime_type == "text/plain" {
        // Text file: read as UTF-8
        let text = String::from_utf8_lossy(&data);
        let capped = if text.len() > 32_000 {
            format!("{}…\n[Текст обрезан, всего {} символов]", &text[..32_000], text.len())
        } else {
            text.to_string()
        };
        Ok(vec![json!({
            "type": "text",
            "text": format!("📎 Файл «{}»:\n\n{}", att.original_filename, capped),
        })])
    } else {
        Ok(vec![json!({
            "type": "text",
            "text": format!("[Файл «{}» — формат {} не поддерживается для анализа]", att.original_filename, att.mime_type),
        })])
    }
}

// ── Streaming response helper ───────────────────────────────────────────────

/// Stream the model response token-by-token via SSE, sending each chunk
/// through the channel as an AiEvent::Token. Returns the accumulated full text.
async fn stream_model_response(
    client: &reqwest::Client,
    url: &str,
    api_key: &str,
    body: &serde_json::Value,
    tx: &tokio::sync::mpsc::Sender<AiEvent>,
    pii_map: &std::collections::HashMap<String, String>,
) -> Result<String, String> {
    let mut stream_body = body.clone();
    stream_body["stream"] = serde_json::json!(true);
    // Remove tools for the streaming call (final response only)
    stream_body.as_object_mut().map(|o| o.remove("tools"));

    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&stream_body)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Stream request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Модель вернула статус {status}: {text}"));
    }

    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut full_content = String::new();
    let mut in_thinking = false;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE lines
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }
            let data = &line[6..];
            if data == "[DONE]" {
                break;
            }

            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                // Extract delta content from streaming response
                if let Some(delta) = parsed.pointer("/choices/0/delta") {
                    // Stream reasoning_content as thinking events
                    if let Some(think_text) = delta.get("reasoning_content").and_then(|v| v.as_str()) {
                        if !think_text.is_empty() {
                            let _ = tx.send(AiEvent::Thinking(think_text.to_string())).await;
                        }
                        in_thinking = true;
                        continue;
                    }
                    // Handle regular content
                    if let Some(text) = delta.get("content").and_then(|v| v.as_str()) {
                        if in_thinking {
                            in_thinking = false;
                        }
                        if !text.is_empty() {
                            let restored = if pii_map.is_empty() { text.to_string() } else { crate::services::pii_scrub::restore(text, pii_map) };
                            full_content.push_str(&restored);
                            let _ = tx.send(AiEvent::Token(restored)).await;
                        }
                    }
                }
            }
        }
    }

    Ok(full_content)
}

// ── Streaming call with tool-call detection ─────────────────────────────────

/// A tool call accumulated from streaming deltas.
#[derive(Debug, Clone)]
struct StreamedToolCall {
    id: String,
    function_name: String,
    function_arguments: String,
}

/// Stream tokens to the user AND accumulate any tool call deltas.
/// Returns (streamed_visible_content, Vec<tool_calls>).
/// If the model produces content tokens, they are sent immediately via `tx`.
/// If the model produces tool calls, they are collected and returned for execution.
async fn stream_with_tools(
    client: &reqwest::Client,
    url: &str,
    api_key: &str,
    body: &serde_json::Value,
    tx: &tokio::sync::mpsc::Sender<AiEvent>,
    pii_map: &std::collections::HashMap<String, String>,
) -> Result<(String, Vec<StreamedToolCall>), String> {
    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(body)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("Stream request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Модель вернула статус {status}: {text}"));
    }

    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut full_content = String::new();
    let mut tool_calls: Vec<StreamedToolCall> = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || !line.starts_with("data: ") { continue; }
            let data = &line[6..];
            if data == "[DONE]" { break; }

            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = parsed.pointer("/choices/0/delta") {
                    // Stream reasoning_content as thinking events
                    if let Some(think_text) = delta.get("reasoning_content").and_then(|v| v.as_str()) {
                        if !think_text.is_empty() {
                            let _ = tx.send(AiEvent::Thinking(think_text.to_string())).await;
                        }
                        continue;
                    }

                    // Accumulate tool call deltas
                    if let Some(tcs) = delta.get("tool_calls").and_then(|v| v.as_array()) {
                        for tc_delta in tcs {
                            let idx = tc_delta.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                            // Extend tool_calls vec if needed
                            while tool_calls.len() <= idx {
                                tool_calls.push(StreamedToolCall {
                                    id: String::new(),
                                    function_name: String::new(),
                                    function_arguments: String::new(),
                                });
                            }
                            if let Some(id) = tc_delta.get("id").and_then(|v| v.as_str()) {
                                tool_calls[idx].id = id.to_string();
                            }
                            if let Some(func) = tc_delta.get("function") {
                                if let Some(name) = func.get("name").and_then(|v| v.as_str()) {
                                    tool_calls[idx].function_name.push_str(name);
                                }
                                if let Some(args) = func.get("arguments").and_then(|v| v.as_str()) {
                                    tool_calls[idx].function_arguments.push_str(args);
                                }
                            }
                        }
                    }

                    // Stream content tokens to user
                    if let Some(text) = delta.get("content").and_then(|v| v.as_str()) {
                        if !text.is_empty() {
                            let restored = if pii_map.is_empty() { text.to_string() } else { crate::services::pii_scrub::restore(text, pii_map) };
                            full_content.push_str(&restored);
                            let _ = tx.send(AiEvent::Token(restored)).await;
                        }
                    }
                }
            }
        }
    }

    // Filter out empty tool calls (deltas that never got a name)
    tool_calls.retain(|tc| !tc.function_name.is_empty());

    Ok((full_content, tool_calls))
}

// ── API call helper (non-streaming, kept for potential fallback) ─────────────

async fn call_model(
    client: &reqwest::Client,
    url: &str,
    api_key: &str,
    body: &serde_json::Value,
) -> Result<ChatCompletionResponse, String> {
    let mut attempt = 0u32;
    let mut backoff = INITIAL_BACKOFF;

    loop {
        let result = client
            .post(url)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("Content-Type", "application/json")
            .json(body)
            .timeout(Duration::from_secs(120))
            .send()
            .await;

        match result {
            Ok(resp) if resp.status().is_success() => {
                return resp.json::<ChatCompletionResponse>().await
                    .map_err(|e| format!("Failed to parse AI response: {e}"));
            }
            Ok(resp) => {
                let status = resp.status();
                let body_text = resp.text().await.unwrap_or_default();
                tracing::warn!(status = %status, body = %body_text, attempt = attempt + 1, "upstream AI non-success");

                if attempt < MAX_RETRIES {
                    attempt += 1;
                    tokio::time::sleep(backoff).await;
                    backoff *= 2;
                    continue;
                }
                return Err(format!("Модель вернула статус {status}. Попробуйте позже."));
            }
            Err(e) => {
                tracing::warn!(error = %e, attempt = attempt + 1, "upstream AI request failed");
                if attempt < MAX_RETRIES {
                    attempt += 1;
                    tokio::time::sleep(backoff).await;
                    backoff *= 2;
                    continue;
                }
                return Err("Не удалось связаться с моделью. Попробуйте позже.".to_string());
            }
        }
    }
}

// ── Streaming proxy with tool calling ──────────────────────────────────────

pub fn stream_ai_response(
    messages: Vec<ChatMessage>,
    model: String,
    temperature: f64,
    max_tokens: u32,
    user_plan: &str,
    voice_mode: bool,
    config: &Config,
    user_id: Option<uuid::Uuid>,
    db: Option<sqlx::PgPool>,
    user_timezone: Option<String>,
    user_name: Option<String>,
    user_email: Option<String>,
    project_instructions: Option<String>,
) -> Pin<Box<dyn Stream<Item = AiEvent> + Send>> {
    let url = format!("{}/chat/completions", config.ai_model_url);
    let api_key = config.ai_model_api_key.clone();
    let allowed_hosts = config.ai_model_allowed_hosts.clone();
    let max_search = search_results_for_plan(user_plan);
    let config = Arc::new(config.clone());
    let user_name_for_scrub = user_name;
    let user_email_for_scrub = user_email;

    let (tx, rx) = tokio::sync::mpsc::channel::<AiEvent>(32);

    // PII restoration closure — wraps tx.send to auto-restore PII in tokens
    // (pii_mapping is populated during message scrubbing below)

    let tz_name = user_timezone.unwrap_or_else(|| "Europe/Moscow".to_string());

    // Resolve the user's IANA timezone via chrono-tz (full database, handles
    // DST, works for any timezone worldwide — not just hardcoded Russian ones).
    let now_utc = chrono::Utc::now();
    let datetime_context = match tz_name.parse::<chrono_tz::Tz>() {
        Ok(tz) => {
            use chrono::{TimeZone, Offset};
            let now_local = tz.from_utc_datetime(&now_utc.naive_utc());
            let offset = now_local.offset().fix();
            let total_secs = offset.local_minus_utc();
            let offset_h = total_secs / 3600;
            let offset_m = (total_secs % 3600).abs() / 60;
            let offset_str = if offset_m == 0 {
                format!("{:+03}:00", offset_h)
            } else {
                format!("{:+03}:{:02}", offset_h, offset_m)
            };
            format!(
                "\n\nCurrent date and time: {}{} ({})",
                now_local.format("%Y-%m-%dT%H:%M:%S"), offset_str, tz_name
            )
        }
        Err(_) => {
            // Unknown timezone string — fall back to UTC
            tracing::warn!(tz = %tz_name, "Unknown timezone, falling back to UTC");
            format!(
                "\n\nCurrent date and time: {}+00:00 (UTC)",
                now_utc.format("%Y-%m-%dT%H:%M:%S")
            )
        }
    };

    // ── PII scrubbing: strip personal data before it reaches the GPU server ──
    // System prompt is safe (no user data). Only scrub user/assistant messages.
    let user_name = user_name_for_scrub.as_deref();
    let user_email = user_email_for_scrub.as_deref();
    let mut pii_mapping = std::collections::HashMap::new();

    // Voice mode gets a short system prompt for TTS-friendly output.
    // Regular chat: no system prompt — model responds naturally.
    // Only inject context (datetime, project instructions, tool hints) when needed.
    let project_context = match &project_instructions {
        Some(instr) if !instr.is_empty() => format!("\n\n--- Project Instructions ---\n{}", instr),
        _ => String::new(),
    };
    let mut full_messages: Vec<serde_json::Value> = Vec::new();
    if voice_mode {
        full_messages.push(json!({
            "role": "system",
            "content": format!("{}{}{}", MIRA_VOICE_PROMPT, project_context, datetime_context),
        }));
    } else {
        // Minimal context: datetime + project instructions + tool hints (no personality prompt)
        let extra_context = format!("{}{}{}", MIRA_TOOL_HINTS, project_context, datetime_context).trim().to_string();
        full_messages.push(json!({
            "role": "system",
            "content": extra_context,
        }));
    }
    for m in &messages {
        let scrubbed = crate::services::pii_scrub::scrub(&m.content, user_name, user_email);
        pii_mapping.extend(scrubbed.mapping);

        if m.attachments.is_empty() {
            // Plain text message — no attachments
            full_messages.push(json!({
                "role": m.role,
                "content": scrubbed.scrubbed,
            }));
        } else {
            // Message with attachments — resolve to text and combine into a single string
            // (current model is text-only, no vision support for content arrays)
            let mut parts: Vec<String> = Vec::new();

            if !scrubbed.scrubbed.is_empty() {
                parts.push(scrubbed.scrubbed);
            }

            for att in &m.attachments {
                match resolve_attachment_content(att) {
                    Ok(blocks) => {
                        for block in blocks {
                            if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                                parts.push(text.to_string());
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!(file = %att.original_filename, error = %e, "Failed to resolve attachment");
                        parts.push(format!("[Файл «{}» не удалось обработать]", att.original_filename));
                    }
                }
            }

            full_messages.push(json!({
                "role": m.role,
                "content": parts.join("\n\n"),
            }));
        }
    }

    // Mira model supports tool calling via chatml template
    let supports_tools = !model.contains("thinking");
    let model_for_resolve = model.clone();

    // Clone PII mapping for the async streaming closure
    let pii_map = pii_mapping.clone();

    tokio::spawn(async move {
        // Map user-facing model names to the actual model ID on the local server.
        // The llama-server requires the exact GGUF filename. We auto-detect it
        // from /v1/models on first use, falling back to the user-facing name.
        let upstream_model = if model_for_resolve.starts_with("mira") {
            resolve_local_model_id(&config).await.unwrap_or_else(|| model_for_resolve.clone())
        } else {
            model_for_resolve.clone()
        };
        // Helper: restore PII in a token string before sending to the user
        let restore_pii = |text: String| -> String {
            if pii_map.is_empty() { text } else { crate::services::pii_scrub::restore(&text, &pii_map) }
        };
        if let Err(e) = validate_host(&url, &allowed_hosts) {
            tracing::error!(error = %e, "SSRF protection triggered");
            let _ = tx.send(AiEvent::Token(format!("Ошибка безопасности: {e}"))).await;
            return;
        }

        // Inject lightweight context counts (not raw data) — model uses tools for details
        if let (Some(uid), Some(ref pool)) = (user_id, &db) {
            let mem_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM user_memory WHERE user_id = $1"
            ).bind(uid).fetch_one(pool).await.unwrap_or((0,));

            let reminder_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM reminders WHERE user_id = $1 AND status = 'pending'"
            ).bind(uid).fetch_one(pool).await.unwrap_or((0,));

            let today_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM reminders WHERE user_id = $1 AND status = 'pending' AND remind_at >= $2 AND remind_at < $3"
            ).bind(uid).bind(chrono::Utc::now()).bind(chrono::Utc::now() + chrono::Duration::days(1))
            .fetch_one(pool).await.unwrap_or((0,));

            let event_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM calendar_events WHERE user_id = $1 AND start_at >= $2 AND start_at < $3"
            ).bind(uid).bind(chrono::Utc::now()).bind(chrono::Utc::now() + chrono::Duration::days(3))
            .fetch_one(pool).await.unwrap_or((0,));

            // Only inject a brief summary line — tools fetch actual data on demand
            let mut context_parts = Vec::new();
            if mem_count.0 > 0 { context_parts.push(format!("{} saved memories", mem_count.0)); }
            if reminder_count.0 > 0 { context_parts.push(format!("{} pending reminders ({} today)", reminder_count.0, today_count.0)); }
            if event_count.0 > 0 { context_parts.push(format!("{} calendar events (next 3 days)", event_count.0)); }

            if !context_parts.is_empty() {
                let ctx = format!("\n\nUser context: {}. Use read_memory/read_calendar tools for details.", context_parts.join(", "));
                if let Some(sys) = full_messages.first_mut() {
                    if let Some(content) = sys.get_mut("content") {
                        *content = json!(format!("{}{}", content.as_str().unwrap_or(""), ctx));
                    }
                }
            }
        }

        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("Failed to build HTTP client");

        // ── First call (with tools if supported) ────────────────
        // ── Single streaming call with tool detection ────────────────
        // Stream tokens directly. If the model requests tool calls,
        // we detect them from the stream, execute the tools, then
        // stream a follow-up call with the tool results.
        let mut body = json!({
            "model": upstream_model,
            "messages": full_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": true,
        });

        if voice_mode {
            // Disable thinking for instant responses — no <think> tags generated
            body["enable_thinking"] = json!(false);
            body["tools"] = json!([web_search_tool()]);
        } else if supports_tools {
            body["tools"] = json!([web_search_tool(), reminder_tool(), scheduled_content_tool(), propose_action_tool(), read_calendar_tool(), read_memory_tool()]);
        }

        // Stream the first call — tokens go to user immediately,
        // tool calls are accumulated for post-processing
        let stream_result = stream_with_tools(&client, &url, &api_key, &body, &tx, &pii_map).await;

        let (streamed_content, tool_calls) = match stream_result {
            Ok(r) => r,
            Err(e) => {
                let _ = tx.send(AiEvent::Token(format!("Ошибка: {e}"))).await;
                return;
            }
        };

        // ── If tool calls were detected, execute them and stream follow-up ──
        if !tool_calls.is_empty() {
            for tc in tool_calls {
                let tool_result_content: String;

                if tc.function_name == "web_search" {
                    let args: SearchArgs = match serde_json::from_str(&tc.function_arguments) {
                        Ok(a) => a,
                        Err(e) => {
                            tracing::warn!(error = %e, "Failed to parse search args");
                            continue;
                        }
                    };

                    // Emit search started event
                    let _ = tx.send(AiEvent::SearchStarted { query: args.query.clone() }).await;

                    // Execute search
                    let search_result = search::web_search(&args.query, max_search, &config).await;

                    let results_for_event;
                    match search_result {
                        Ok(sr) => {
                            let mut content = sr.results.iter().enumerate().map(|(i, r)| {
                                format!("{}. {} — {}\n   {}", i + 1, r.title, r.url, r.content)
                            }).collect::<Vec<_>>().join("\n\n");
                            content.push_str("\n\n[ВАЖНО: В ответе ОБЯЗАТЕЛЬНО указывай номера источников в квадратных скобках, например [1], [2], после каждого факта.]");
                            results_for_event = sr.results.clone();
                            tool_result_content = content;
                        }
                        Err(e) => {
                            tracing::warn!(error = %e, "Web search failed");
                            results_for_event = vec![];
                            tool_result_content = format!("Search failed: {e}");
                        }
                    };

                    // Emit search results event
                    let _ = tx.send(AiEvent::SearchResults {
                        query: args.query.clone(),
                        results: results_for_event,
                    }).await;
                } else if tc.function_name == "create_reminder" {
                    // Parse reminder args
                    #[derive(serde::Deserialize)]
                    struct ReminderArgs {
                        title: String,
                        remind_at: String,
                        channels: Option<Vec<String>>,
                        recurrence: Option<String>,
                    }

                    let args: ReminderArgs = match serde_json::from_str(&tc.function_arguments) {
                        Ok(a) => a,
                        Err(e) => {
                            tracing::warn!(error = %e, "Failed to parse reminder args");
                            tool_result_content = format!("Failed to parse reminder arguments: {e}");
                            // Still add tool call + result to messages so model can respond
                            full_messages.push(json!({
                                "role": "assistant", "content": null,
                                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "create_reminder", "arguments": tc.function_arguments}}]
                            }));
                            full_messages.push(json!({"role": "tool", "tool_call_id": tc.id, "content": tool_result_content}));
                            continue;
                        }
                    };

                    // Try to create the reminder in the database
                    if let (Some(uid), Some(ref pool)) = (user_id, &db) {
                        // Validate title length and rrule
                        let title = if args.title.chars().count() > 200 {
                            args.title.chars().take(200).collect::<String>()
                        } else {
                            args.title.clone()
                        };

                        // Validate RRULE: reject INTERVAL=0 and overly long strings
                        if let Some(ref rrule) = args.recurrence {
                            if rrule.len() > 200 || rrule.contains("INTERVAL=0") {
                                tool_result_content = "Invalid recurrence rule".to_string();
                                full_messages.push(json!({
                                    "role": "assistant", "content": null,
                                    "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "create_reminder", "arguments": tc.function_arguments}}]
                                }));
                                full_messages.push(json!({"role": "tool", "tool_call_id": tc.id, "content": tool_result_content}));
                                continue;
                            }
                        }

                        // Determine channels — default to in_app
                        let mut channels = args.channels.unwrap_or_else(|| vec!["in_app".to_string()]);
                        if channels.is_empty() { channels.push("in_app".to_string()); }
                        let mut telegram_not_linked = false;

                        // If telegram requested, check if user has linked their account
                        if channels.contains(&"telegram".to_string()) {
                            let tg_linked: bool = sqlx::query_scalar::<_, bool>(
                                "SELECT EXISTS(SELECT 1 FROM telegram_links WHERE user_id = $1 AND is_active = true)"
                            )
                            .bind(uid)
                            .fetch_one(pool)
                            .await
                            .unwrap_or(false);

                            if !tg_linked {
                                telegram_not_linked = true;
                                // Remove telegram from channels — don't store undeliverable channel
                                channels.retain(|c| c != "telegram");
                                if channels.is_empty() { channels.push("in_app".to_string()); }
                            }
                        }

                        let remind_at = chrono::DateTime::parse_from_rfc3339(&args.remind_at)
                            .or_else(|_| chrono::DateTime::parse_from_str(&args.remind_at, "%Y-%m-%dT%H:%M:%S%z"))
                            .map(|dt| dt.with_timezone(&chrono::Utc));

                        match remind_at {
                            Ok(dt) => {
                                let result = sqlx::query_scalar::<_, uuid::Uuid>(
                                    "INSERT INTO reminders (user_id, title, remind_at, user_timezone, rrule, channels)
                                     VALUES ($1, $2, $3, $4, $5, $6)
                                     RETURNING id"
                                )
                                .bind(uid)
                                .bind(&title)
                                .bind(dt)
                                .bind(&tz_name)
                                .bind(&args.recurrence)
                                .bind(&channels)
                                .fetch_one(pool)
                                .await;

                                match result {
                                    Ok(id) => {
                                        tracing::info!(reminder_id = %id, "Reminder created via AI tool");
                                        let _ = tx.send(AiEvent::ReminderCreated {
                                            id: id.to_string(),
                                            title: args.title.clone(),
                                            remind_at: args.remind_at.clone(),
                                            rrule: args.recurrence.clone(),
                                            channels: channels.clone(),
                                        }).await;
                                        let mut msg = format!("Reminder created. Respond briefly: confirm the reminder title and time in a natural, human-friendly way (e.g. 'через 2 минуты' or 'завтра в 10:00'). Do NOT show the ID or ISO datetime to the user.");
                                        if telegram_not_linked {
                                            msg.push_str(" IMPORTANT: User wanted Telegram delivery but hasn't linked Telegram. Tell them briefly: go to Settings → Notifications → Connect Telegram.");
                                        }
                                        tool_result_content = msg;
                                    }
                                    Err(e) => {
                                        tracing::error!(error = %e, "Failed to create reminder");
                                        tool_result_content = format!("Failed to save reminder: {e}");
                                    }
                                }
                            }
                            Err(_) => {
                                tool_result_content = format!("Invalid datetime format: {}. Use ISO 8601 format.", args.remind_at);
                            }
                        }
                    } else {
                        tool_result_content = "Reminder creation is not available for guest users.".to_string();
                    }
                } else if tc.function_name == "create_scheduled_content" {
                    #[derive(serde::Deserialize)]
                    struct ScheduledContentArgs {
                        title: String,
                        prompt: String,
                        schedule_at: String,
                        recurrence: String,
                    }

                    let args: ScheduledContentArgs = match serde_json::from_str(&tc.function_arguments) {
                        Ok(a) => a,
                        Err(e) => {
                            tracing::warn!(error = %e, "Failed to parse scheduled content args");
                            tool_result_content = format!("Failed to parse arguments: {e}");
                            full_messages.push(json!({
                                "role": "assistant", "content": null,
                                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "create_scheduled_content", "arguments": tc.function_arguments}}]
                            }));
                            full_messages.push(json!({"role": "tool", "tool_call_id": tc.id, "content": tool_result_content}));
                            continue;
                        }
                    };

                    if let (Some(uid), Some(ref pool)) = (user_id, &db) {
                        let title = if args.title.chars().count() > 200 { args.title.chars().take(200).collect::<String>() } else { args.title.clone() };
                        let prompt = if args.prompt.chars().count() > 2000 { args.prompt.chars().take(2000).collect::<String>() } else { args.prompt.clone() };

                        // Validate RRULE
                        if args.recurrence.len() > 200 || args.recurrence.contains("INTERVAL=0") {
                            tool_result_content = "Invalid recurrence rule".to_string();
                            full_messages.push(json!({
                                "role": "assistant", "content": null,
                                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "create_scheduled_content", "arguments": tc.function_arguments}}]
                            }));
                            full_messages.push(json!({"role": "tool", "tool_call_id": tc.id, "content": tool_result_content}));
                            continue;
                        }

                        let schedule_at = chrono::DateTime::parse_from_rfc3339(&args.schedule_at)
                            .or_else(|_| chrono::DateTime::parse_from_str(&args.schedule_at, "%Y-%m-%dT%H:%M:%S%z"))
                            .map(|dt| dt.with_timezone(&chrono::Utc));

                        match schedule_at {
                            Ok(dt) => {
                                // Anti-fatigue: max 5 scheduled_content per user
                                let sc_count: i64 = sqlx::query_scalar(
                                    "SELECT COUNT(*) FROM reminders WHERE user_id = $1 AND type = 'scheduled_content' AND status = 'pending'"
                                )
                                .bind(uid)
                                .fetch_one(pool)
                                .await
                                .unwrap_or(0);

                                if sc_count >= 5 {
                                    tool_result_content = "Maximum 5 active scheduled content items. User should cancel one before creating a new one.".to_string();
                                } else {
                                    // Auto-include telegram if user has it linked
                                    let has_tg: bool = sqlx::query_scalar(
                                        "SELECT EXISTS(SELECT 1 FROM telegram_links WHERE user_id = $1 AND is_active = true)"
                                    ).bind(uid).fetch_one(pool).await.unwrap_or(false);
                                    let channels = if has_tg { "{in_app,telegram}" } else { "{in_app}" };

                                    let result = sqlx::query_scalar::<_, uuid::Uuid>(
                                        "INSERT INTO reminders (user_id, type, title, prompt, remind_at, user_timezone, rrule, channels)
                                         VALUES ($1, 'scheduled_content', $2, $3, $4, $5, $6, $7)
                                         RETURNING id"
                                    )
                                    .bind(uid)
                                    .bind(&title)
                                    .bind(&prompt)
                                    .bind(dt)
                                    .bind(&tz_name)
                                    .bind(&args.recurrence)
                                    .bind(channels)
                                    .fetch_one(pool)
                                    .await;

                                    match result {
                                        Ok(id) => {
                                            tracing::info!(id = %id, "Scheduled content created via AI tool");
                                            let _ = tx.send(AiEvent::ScheduledContentCreated {
                                                id: id.to_string(),
                                                title: args.title.clone(),
                                                prompt: args.prompt.clone(),
                                                schedule_at: args.schedule_at.clone(),
                                                rrule: args.recurrence.clone(),
                                            }).await;
                                            tool_result_content = "Scheduled content created. Confirm briefly in a friendly way. Do NOT show ID or ISO dates to the user.".to_string();
                                        }
                                        Err(e) => {
                                            tracing::error!(error = %e, "Failed to create scheduled content");
                                            tool_result_content = format!("Failed to save: {e}");
                                        }
                                    }
                                }
                            }
                            Err(_) => {
                                tool_result_content = format!("Invalid datetime format: {}. Use ISO 8601.", args.schedule_at);
                            }
                        }
                    } else {
                        tool_result_content = "Scheduled content is not available for guest users.".to_string();
                    }
                } else if tc.function_name == "propose_action" {
                    #[derive(serde::Deserialize)]
                    struct ActionArgs {
                        action_type: String,
                        description: String,
                        payload: serde_json::Value,
                    }

                    let args: ActionArgs = match serde_json::from_str(&tc.function_arguments) {
                        Ok(a) => a,
                        Err(e) => {
                            tool_result_content = format!("Failed to parse action args: {e}");
                            full_messages.push(json!({
                                "role": "assistant", "content": null,
                                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "propose_action", "arguments": tc.function_arguments}}]
                            }));
                            full_messages.push(json!({"role": "tool", "tool_call_id": tc.id, "content": tool_result_content}));
                            continue;
                        }
                    };

                    if let (Some(uid), Some(ref pool)) = (user_id, &db) {
                        // Validate action type
                        let valid_types = ["send_telegram", "send_email", "create_draft", "translate", "set_timer", "create_code", "show_weather", "show_stock", "calculate", "create_event", "save_memory"];
                        if !valid_types.contains(&args.action_type.as_str()) {
                            tool_result_content = format!("Unsupported action type: {}", args.action_type);
                        } else if args.action_type == "save_memory" {
                            // Save memory directly to DB — no action card (max 100 per user)
                            let key = args.payload.get("key").and_then(|v| v.as_str()).unwrap_or("fact");
                            let value = args.payload.get("value").and_then(|v| v.as_str()).unwrap_or("");
                            if !value.is_empty() {
                                let count: (i64,) = sqlx::query_as(
                                    "SELECT COUNT(*) FROM user_memory WHERE user_id = $1"
                                ).bind(uid).fetch_one(pool).await.unwrap_or((0,));

                                if count.0 >= 100 {
                                    tool_result_content = "Memory limit reached (100). Tell user to delete old memories to save new ones.".to_string();
                                } else {
                                let _ = sqlx::query(
                                    "INSERT INTO user_memory (user_id, key, value)
                                     VALUES ($1, $2, $3)
                                     ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = now()"
                                )
                                .bind(uid)
                                .bind(key)
                                .bind(value)
                                .execute(pool)
                                .await;
                                tool_result_content = format!("Memory saved: {} = {}. Confirm briefly to the user.", key, value);
                                }
                            } else {
                                tool_result_content = "Empty value, nothing saved.".to_string();
                            }
                        } else if args.action_type == "show_weather" {
                            // Fetch real weather data from Open-Meteo
                            let city = args.payload.get("city")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Moscow");

                            match crate::services::weather::get_weather(city).await {
                                Ok(weather) => {
                                    let forecast_json: Vec<serde_json::Value> = weather.forecast.iter().map(|f| {
                                        json!({"day": f.day, "temp": format!("{}°/{}", f.temp_max.round(), f.temp_min.round()), "icon": f.icon})
                                    }).collect();

                                    let hourly_json: Vec<serde_json::Value> = weather.hourly.iter().map(|h| {
                                    json!({"time": h.time, "temp": h.temp.round(), "icon": h.icon, "precip": h.precip_prob})
                                }).collect();

                                let weather_payload = json!({
                                    "city": weather.city,
                                    "summary": format!("{}°C, {}", weather.temperature.round(), weather.description),
                                    "forecast": forecast_json,
                                    "hourly": hourly_json,
                                    "description": args.description,
                                    "wind": format!("{} км/ч", weather.wind_speed),
                                    "wind_gusts": weather.wind_gusts.map(|g| format!("{} км/ч", g.round())),
                                    "feels_like": format!("{}°C", weather.feels_like.round()),
                                    "humidity": weather.humidity.map(|h| format!("{}%", h.round())),
                                    "uv_index": weather.uv_index.map(|u| (u * 10.0).round() / 10.0),
                                    "precip_prob": weather.precipitation_probability.map(|p| format!("{}%", p.round())),
                                    "precip_sum": weather.precipitation_sum.map(|p| format!("{} мм", p)),
                                    "sunrise": weather.sunrise,
                                    "sunset": weather.sunset,
                                    "is_day": weather.is_day,
                                });

                                    let result = sqlx::query_scalar::<_, uuid::Uuid>(
                                        "INSERT INTO actions (user_id, type, payload, status)
                                         VALUES ($1, 'show_weather', $2, 'executed')
                                         RETURNING id"
                                    )
                                    .bind(uid)
                                    .bind(&weather_payload)
                                    .fetch_one(pool)
                                    .await;

                                    match result {
                                        Ok(id) => {
                                            let _ = tx.send(AiEvent::ActionProposed {
                                                id: id.to_string(),
                                                action_type: "show_weather".to_string(),
                                                payload: weather_payload,
                                            }).await;
                                            tool_result_content = format!(
                                                "Weather card shown. Current: {}°C, {}. Respond briefly mentioning the weather.",
                                                weather.temperature.round(), weather.description
                                            );
                                        }
                                        Err(e) => {
                                            tool_result_content = format!("Failed to create weather card: {e}");
                                        }
                                    }
                                }
                                Err(e) => {
                                    tracing::error!(error = %e, "Weather fetch failed");
                                    tool_result_content = format!("Weather fetch failed: {e}. Tell user the weather service is temporarily unavailable.");
                                }
                            }
                        } else if args.action_type == "show_stock" {
                            let symbol = args.payload.get("symbol")
                                .and_then(|v| v.as_str())
                                .unwrap_or("SPY");

                            match crate::services::stock::get_stock_quote(symbol, None).await {
                                Ok(quote) => {
                                    let stock_payload = json!({
                                        "symbol": quote.symbol,
                                        "name": quote.name,
                                        "price": quote.price,
                                        "open": quote.open,
                                        "previous_close": quote.previous_close,
                                        "change": quote.change,
                                        "change_percent": quote.change_percent,
                                        "high": quote.high,
                                        "low": quote.low,
                                        "currency": quote.currency,
                                        "source": quote.source,
                                        "updated": quote.updated,
                                        "description": args.description,
                                        "chart": quote.chart,
                                    });

                                    let result = sqlx::query_scalar::<_, uuid::Uuid>(
                                        "INSERT INTO actions (user_id, type, payload, status)
                                         VALUES ($1, 'show_stock', $2, 'executed')
                                         RETURNING id"
                                    )
                                    .bind(uid)
                                    .bind(&stock_payload)
                                    .fetch_one(pool)
                                    .await;

                                    match result {
                                        Ok(id) => {
                                            let _ = tx.send(AiEvent::ActionProposed {
                                                id: id.to_string(),
                                                action_type: "show_stock".to_string(),
                                                payload: stock_payload,
                                            }).await;
                                            let direction = if quote.change >= 0.0 { "up" } else { "down" };
                                            tool_result_content = format!(
                                                "Stock card shown. {} is {} {:.2} ({}{:.2}%). Respond briefly.",
                                                quote.symbol, direction, quote.change.abs(),
                                                if quote.change >= 0.0 { "+" } else { "" }, quote.change_percent
                                            );
                                        }
                                        Err(e) => {
                                            tool_result_content = format!("Failed to create stock card: {e}");
                                        }
                                    }
                                }
                                Err(e) => {
                                    tracing::error!(error = %e, "Stock fetch failed");
                                    tool_result_content = format!("Stock fetch failed: {e}. Tell user the stock data is temporarily unavailable.");
                                }
                            }
                        } else {
                            // Store full payload with description
                            let mut full_payload = args.payload.clone();
                            if let Some(obj) = full_payload.as_object_mut() {
                                obj.insert("description".to_string(), json!(args.description));
                            }

                            let result = sqlx::query_scalar::<_, uuid::Uuid>(
                                "INSERT INTO actions (user_id, type, payload, status)
                                 VALUES ($1, $2, $3, 'proposed')
                                 RETURNING id"
                            )
                            .bind(uid)
                            .bind(&args.action_type)
                            .bind(&full_payload)
                            .fetch_one(pool)
                            .await;

                            match result {
                                Ok(id) => {
                                    tracing::info!(action_id = %id, action_type = %args.action_type, "Action proposed via AI tool");

                                    // Persist create_event to calendar_events table
                                    if args.action_type == "create_event" {
                                        if let Some(obj) = full_payload.as_object() {
                                            let title = obj.get("title").and_then(|v| v.as_str()).unwrap_or("Event");
                                            let date = obj.get("date").and_then(|v| v.as_str()).unwrap_or("");
                                            let time = obj.get("time").and_then(|v| v.as_str()).unwrap_or("12:00");
                                            let end_time = obj.get("end_time").and_then(|v| v.as_str());
                                            let location = obj.get("location").and_then(|v| v.as_str());
                                            let desc = obj.get("description").and_then(|v| v.as_str());

                                            if let Ok(start) = chrono::NaiveDateTime::parse_from_str(
                                                &format!("{}T{}:00", date, time), "%Y-%m-%dT%H:%M:%S"
                                            ) {
                                                let start_utc = start.and_utc();
                                                let end_utc = end_time.and_then(|et| {
                                                    chrono::NaiveDateTime::parse_from_str(
                                                        &format!("{}T{}:00", date, et), "%Y-%m-%dT%H:%M:%S"
                                                    ).ok()
                                                }).map(|e| e.and_utc());

                                                let _ = sqlx::query(
                                                    "INSERT INTO calendar_events (user_id, action_id, title, description, location, start_at, end_at, source)
                                                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'mira')"
                                                )
                                                .bind(uid)
                                                .bind(id)
                                                .bind(title)
                                                .bind(desc)
                                                .bind(location)
                                                .bind(start_utc)
                                                .bind(end_utc)
                                                .execute(pool)
                                                .await;
                                            }
                                        }
                                    }

                                    let _ = tx.send(AiEvent::ActionProposed {
                                        id: id.to_string(),
                                        action_type: args.action_type.clone(),
                                        payload: full_payload.clone(),
                                    }).await;
                                    // Client-side actions auto-execute — don't tell model to ask for confirmation
                                    let needs_confirm = args.action_type == "send_telegram" || args.action_type == "send_email";
                                    tool_result_content = if needs_confirm {
                                        format!("Action card shown. The user can confirm or cancel. Type: {}.", args.action_type)
                                    } else {
                                        format!("Done. The {} card is now visible to the user. Respond briefly.", args.action_type)
                                    };
                                }
                                Err(e) => {
                                    tracing::error!(error = %e, "Failed to create action");
                                    tool_result_content = format!("Failed to propose action: {e}");
                                }
                            }
                        }
                    } else {
                        tool_result_content = "Actions are not available for guest users.".to_string();
                    }
                } else if tc.function_name == "read_calendar" {
                    #[derive(serde::Deserialize)]
                    struct CalArgs { start_date: String, end_date: String }

                    if let Ok(args) = serde_json::from_str::<CalArgs>(&tc.function_arguments) {
                        if let (Some(uid), Some(ref pool)) = (user_id, &db) {
                            let start = chrono::NaiveDate::parse_from_str(&args.start_date, "%Y-%m-%d")
                                .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc());
                            let end = chrono::NaiveDate::parse_from_str(&args.end_date, "%Y-%m-%d")
                                .map(|d| d.and_hms_opt(23, 59, 59).unwrap().and_utc());

                            if let (Ok(start), Ok(end)) = (start, end) {
                                // Fetch reminders
                                let reminders = sqlx::query_as::<_, (String, chrono::DateTime<chrono::Utc>, Option<String>)>(
                                    "SELECT title, remind_at, body FROM reminders
                                     WHERE user_id = $1 AND status = 'pending' AND remind_at >= $2 AND remind_at <= $3
                                     ORDER BY remind_at LIMIT 50"
                                )
                                .bind(uid).bind(start).bind(end)
                                .fetch_all(pool).await.unwrap_or_default();

                                // Fetch calendar events
                                let events = sqlx::query_as::<_, (String, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>, Option<String>)>(
                                    "SELECT title, start_at, end_at, location FROM calendar_events
                                     WHERE user_id = $1 AND start_at >= $2 AND start_at <= $3
                                     ORDER BY start_at LIMIT 50"
                                )
                                .bind(uid).bind(start).bind(end)
                                .fetch_all(pool).await.unwrap_or_default();

                                let mut items = Vec::new();
                                for (title, at, body) in &reminders {
                                    let line = format!("- [{}] Reminder: {}{}", at.format("%m-%d %H:%M"), title,
                                        body.as_deref().map(|b| format!(" ({})", b)).unwrap_or_default());
                                    items.push(line);
                                }
                                for (title, start, end, loc) in &events {
                                    let end_str = end.map(|e| format!(" - {}", e.format("%H:%M"))).unwrap_or_default();
                                    let loc_str = loc.as_deref().map(|l| format!(" @ {}", l)).unwrap_or_default();
                                    items.push(format!("- [{}{}] {}{}", start.format("%m-%d %H:%M"), end_str, title, loc_str));
                                }

                                if items.is_empty() {
                                    tool_result_content = format!("No events or reminders found between {} and {}.", args.start_date, args.end_date);
                                } else {
                                    tool_result_content = format!("Calendar for {} to {}:\n{}", args.start_date, args.end_date, items.join("\n"));
                                }
                            } else {
                                tool_result_content = "Invalid date format. Use YYYY-MM-DD.".to_string();
                            }
                        } else {
                            tool_result_content = "Calendar is not available for guest users.".to_string();
                        }
                    } else {
                        tool_result_content = "Invalid arguments for read_calendar.".to_string();
                    }
                } else if tc.function_name == "read_memory" {
                    if let (Some(uid), Some(ref pool)) = (user_id, &db) {
                        let memories: Vec<(String, String)> = sqlx::query_as(
                            "SELECT key, value FROM user_memory WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50"
                        )
                        .bind(uid)
                        .fetch_all(pool)
                        .await
                        .unwrap_or_default();

                        if memories.is_empty() {
                            tool_result_content = "No saved memories for this user.".to_string();
                        } else {
                            let items: Vec<String> = memories.iter().map(|(k, v)| format!("- {}: {}", k, v)).collect();
                            tool_result_content = format!("User memories ({}):\n{}", memories.len(), items.join("\n"));
                        }
                    } else {
                        tool_result_content = "Memory is not available for guest users.".to_string();
                    }
                } else {
                    tracing::warn!(tool = %tc.function_name, "Unknown tool call");
                    continue;
                }

                // ── Add tool call + result to messages for second call ───
                full_messages.push(json!({
                    "role": "assistant",
                    "content": null,
                    "tool_calls": [{
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function_name,
                            "arguments": tc.function_arguments
                        }
                    }]
                }));

                full_messages.push(json!({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_result_content
                }));
            }

            // Stream the second call (post-tool response) token-by-token
            let body2 = json!({
                "model": upstream_model,
                "messages": full_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            });

            match stream_model_response(&client, &url, &api_key, &body2, &tx, &pii_map).await {
                Ok(_content) => { /* tokens already sent via tx */ }
                Err(e) => {
                    let _ = tx.send(AiEvent::Token(format!("Ошибка: {e}"))).await;
                    return;
                }
            }
        }
        // If no tool calls, tokens were already streamed to the user — nothing else to do.
    });

    Box::pin(ReceiverStream::new(rx))
}
