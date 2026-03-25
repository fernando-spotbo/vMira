//! AI model proxy with tool calling (web search), SSRF protection, and retry logic.

use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use futures_util::Stream;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio_stream::wrappers::ReceiverStream;

use crate::config::Config;
use crate::services::search;

// ── Constants ───────────────────────────────────────────────────────────────

/// System prompt with search and citation instructions.
pub const MIRA_SYSTEM_PROMPT: &str = "\
You are Mira, an AI assistant. Always reply in the user's language.\n\
You have tools: web_search, create_reminder, create_scheduled_content, propose_action.\n\
Use them when needed. Never say you can't — just call the tool.\n\
Never output raw XML, function calls, or internal syntax in your replies.\n\
Cite search sources as [1], [2], [3].";

/// Voice mode system prompt — short, conversational, TTS-friendly, multilingual.
pub const MIRA_VOICE_PROMPT: &str = "\
Ты Мира — голосовой AI-ассистент. Пользователь разговаривает с тобой голосом.\n\n\
ПРАВИЛА ДЛЯ ГОЛОСОВОГО РЕЖИМА:\n\
- Отвечай ОЧЕНЬ КОРОТКО: 1-2 предложения максимум. Это живой разговор, не лекция.\n\
- НЕ используй markdown, списки, заголовки, звёздочки, номера. Только чистый текст.\n\
- Говори естественно, как человек в разговоре.\n\
- Если нужен длинный ответ, дай краткую суть и предложи уточнить.\n\
- НЕ используй ссылки [1], [2] — пользователь не видит текст, он слушает.\n\n\
ЯЗЫКИ:\n\
- Отвечай НА ТОМ ЖЕ языке, на котором говорит пользователь.\n\
- Ты полиглот: русский, английский, испанский, французский, немецкий, китайский, японский, корейский, арабский, хинди, португальский, итальянский, турецкий и другие.\n\
- Переключайся между языками мгновенно.\n\
- Если пользователь просит перевести — переводи на указанный язык.\n\n\
ОПРЕДЕЛЕНИЕ ЯЗЫКА:\n\
Если сообщение пользователя выглядит бессмысленно, содержит набор несвязных слогов или слов, \
которые не складываются в осмысленную фразу — скорее всего, распознавание речи настроено на неправильный язык. \
В этом случае попытайся угадать настоящий язык пользователя и ответь ТОЛЬКО одной строкой в формате:\n\
LANG:xx-XX\n\
Например: LANG:es-ES или LANG:en-US или LANG:fr-FR\n\
НЕ добавляй ничего кроме этой строки. Пользователь будет автоматически переключён.";

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

    if allowed_hosts.is_empty() {
        return Ok(());
    }

    if allowed_hosts.iter().any(|h| h == host) {
        Ok(())
    } else {
        Err(format!("Хост «{host}» не входит в список разрешённых для AI-модели"))
    }
}

// ── API call helper ─────────────────────────────────────────────────────────

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
) -> Pin<Box<dyn Stream<Item = AiEvent> + Send>> {
    let url = format!("{}/chat/completions", config.ai_model_url);
    let api_key = config.ai_model_api_key.clone();
    let allowed_hosts = config.ai_model_allowed_hosts.clone();
    let max_search = search_results_for_plan(user_plan);
    let config = Arc::new(config.clone());

    let (tx, rx) = tokio::sync::mpsc::channel::<AiEvent>(32);

    let tz = user_timezone.unwrap_or_else(|| "Europe/Moscow".to_string());
    let system_prompt = if voice_mode { MIRA_VOICE_PROMPT } else { MIRA_SYSTEM_PROMPT };

    // Inject current datetime in the USER'S timezone for correct reminder time resolution
    let now_utc = chrono::Utc::now();
    let offset_hours: i64 = match tz.as_str() {
        "Europe/Kaliningrad" => 2,
        "Europe/Moscow" => 3,
        "Europe/Samara" => 4,
        "Asia/Yekaterinburg" => 5,
        "Asia/Omsk" => 6,
        "Asia/Novosibirsk" | "Asia/Krasnoyarsk" => 7,
        "Asia/Irkutsk" => 8,
        "Asia/Yakutsk" => 9,
        "Asia/Vladivostok" => 10,
        "Asia/Magadan" => 11,
        "Asia/Kamchatka" => 12,
        _ => 3,
    };
    let now_local = now_utc + chrono::Duration::hours(offset_hours);
    let datetime_context = format!(
        "\n\nТекущая дата и время: {}+{:02}:00. Часовой пояс: {}. ВСЕ remind_at значения должны использовать этот часовой пояс (+{:02}:00).",
        now_local.format("%Y-%m-%dT%H:%M:%S"), offset_hours, tz, offset_hours
    );

    let mut full_messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": format!("{}{}", system_prompt, datetime_context),
    })];
    for m in &messages {
        full_messages.push(json!({
            "role": m.role,
            "content": m.content,
        }));
    }

    let upstream_model = match model.as_str() {
        "mira" => "deepseek-chat",
        "mira-thinking" => "deepseek-reasoner",
        "mira-pro" => "deepseek-chat",
        "mira-max" => "deepseek-chat",
        other => other,
    };
    let upstream_model = upstream_model.to_string();

    // Tool calling is supported on deepseek-chat (not deepseek-reasoner)
    let supports_tools = upstream_model == "deepseek-chat";

    tokio::spawn(async move {
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
        let mut body = json!({
            "model": upstream_model,
            "messages": full_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": false,
        });

        if supports_tools {
            body["tools"] = json!([web_search_tool(), reminder_tool(), scheduled_content_tool(), propose_action_tool(), read_calendar_tool(), read_memory_tool()]);
        }

        let data = match call_model(&client, &url, &api_key, &body).await {
            Ok(d) => d,
            Err(e) => {
                let _ = tx.send(AiEvent::Token(format!("Ошибка: {e}"))).await;
                return;
            }
        };

        let choice = match data.choices.first() {
            Some(c) => c,
            None => {
                let _ = tx.send(AiEvent::Token("Модель не ответила.".to_string())).await;
                return;
            }
        };

        // ── Check for tool calls ────────────────────────────────
        if let Some(tool_calls) = &choice.message.tool_calls {
            for tc in tool_calls {
                let tool_result_content: String;

                if tc.function.name == "web_search" {
                    let args: SearchArgs = match serde_json::from_str(&tc.function.arguments) {
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
                } else if tc.function.name == "create_reminder" {
                    // Parse reminder args
                    #[derive(serde::Deserialize)]
                    struct ReminderArgs {
                        title: String,
                        remind_at: String,
                        channels: Option<Vec<String>>,
                        recurrence: Option<String>,
                    }

                    let args: ReminderArgs = match serde_json::from_str(&tc.function.arguments) {
                        Ok(a) => a,
                        Err(e) => {
                            tracing::warn!(error = %e, "Failed to parse reminder args");
                            tool_result_content = format!("Failed to parse reminder arguments: {e}");
                            // Still add tool call + result to messages so model can respond
                            full_messages.push(json!({
                                "role": "assistant", "content": null,
                                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "create_reminder", "arguments": tc.function.arguments}}]
                            }));
                            full_messages.push(json!({"role": "tool", "tool_call_id": tc.id, "content": tool_result_content}));
                            continue;
                        }
                    };

                    // Try to create the reminder in the database
                    if let (Some(uid), Some(ref pool)) = (user_id, &db) {
                        // Validate title length and rrule
                        let title = if args.title.len() > 200 {
                            args.title[..200].to_string()
                        } else {
                            args.title.clone()
                        };

                        // Validate RRULE: reject INTERVAL=0 and overly long strings
                        if let Some(ref rrule) = args.recurrence {
                            if rrule.len() > 200 || rrule.contains("INTERVAL=0") {
                                tool_result_content = "Invalid recurrence rule".to_string();
                                full_messages.push(json!({
                                    "role": "assistant", "content": null,
                                    "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "create_reminder", "arguments": tc.function.arguments}}]
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
                                .bind(&tz)
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
                } else if tc.function.name == "create_scheduled_content" {
                    #[derive(serde::Deserialize)]
                    struct ScheduledContentArgs {
                        title: String,
                        prompt: String,
                        schedule_at: String,
                        recurrence: String,
                    }

                    let args: ScheduledContentArgs = match serde_json::from_str(&tc.function.arguments) {
                        Ok(a) => a,
                        Err(e) => {
                            tracing::warn!(error = %e, "Failed to parse scheduled content args");
                            tool_result_content = format!("Failed to parse arguments: {e}");
                            full_messages.push(json!({
                                "role": "assistant", "content": null,
                                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "create_scheduled_content", "arguments": tc.function.arguments}}]
                            }));
                            full_messages.push(json!({"role": "tool", "tool_call_id": tc.id, "content": tool_result_content}));
                            continue;
                        }
                    };

                    if let (Some(uid), Some(ref pool)) = (user_id, &db) {
                        let title = if args.title.len() > 200 { args.title[..200].to_string() } else { args.title.clone() };
                        let prompt = if args.prompt.len() > 2000 { args.prompt[..2000].to_string() } else { args.prompt.clone() };

                        // Validate RRULE
                        if args.recurrence.len() > 200 || args.recurrence.contains("INTERVAL=0") {
                            tool_result_content = "Invalid recurrence rule".to_string();
                            full_messages.push(json!({
                                "role": "assistant", "content": null,
                                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "create_scheduled_content", "arguments": tc.function.arguments}}]
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
                                    .bind(&tz)
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
                } else if tc.function.name == "propose_action" {
                    #[derive(serde::Deserialize)]
                    struct ActionArgs {
                        action_type: String,
                        description: String,
                        payload: serde_json::Value,
                    }

                    let args: ActionArgs = match serde_json::from_str(&tc.function.arguments) {
                        Ok(a) => a,
                        Err(e) => {
                            tool_result_content = format!("Failed to parse action args: {e}");
                            full_messages.push(json!({
                                "role": "assistant", "content": null,
                                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": "propose_action", "arguments": tc.function.arguments}}]
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

                            match crate::services::stock::get_stock_quote(symbol).await {
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
                                    tool_result_content = format!(
                                        "Action proposed and shown to user for confirmation. Type: {}. Description: {}. \
                                         Tell the user you've prepared the action and they can confirm or cancel it using the card below.",
                                        args.action_type, args.description
                                    );
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
                } else if tc.function.name == "read_calendar" {
                    #[derive(serde::Deserialize)]
                    struct CalArgs { start_date: String, end_date: String }

                    if let Ok(args) = serde_json::from_str::<CalArgs>(&tc.function.arguments) {
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
                } else if tc.function.name == "read_memory" {
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
                    tracing::warn!(tool = %tc.function.name, "Unknown tool call");
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
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }]
                }));

                full_messages.push(json!({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_result_content
                }));
            }

            // Make the second API call without tools (just generate the response)
            let body2 = json!({
                "model": upstream_model,
                "messages": full_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": false,
            });

            let data2 = match call_model(&client, &url, &api_key, &body2).await {
                Ok(d) => d,
                Err(e) => {
                    let _ = tx.send(AiEvent::Token(format!("Ошибка: {e}"))).await;
                    return;
                }
            };

            let raw_content = data2
                .choices
                .first()
                .and_then(|c| c.message.content.as_deref())
                .unwrap_or("");

            let (_thinking, visible) = parse_thinking(raw_content);
            let visible = crate::services::sanitize::sanitize_output(&visible);
            if !visible.trim().is_empty() {
                let _ = tx.send(AiEvent::Token(visible)).await;
            }
        } else {
            // No tool calls — direct response
            let raw_content = choice.message.content.as_deref().unwrap_or("");
            let (_thinking, visible) = parse_thinking(raw_content);
            let visible = crate::services::sanitize::sanitize_output(&visible);
            if !visible.trim().is_empty() {
                let _ = tx.send(AiEvent::Token(visible)).await;
            } else if !raw_content.trim().is_empty() {
                // Model output was entirely DSML/internal syntax — retry without tools
                tracing::warn!("Model output was entirely internal syntax, retrying without tools");
                let mut retry_body = body.clone();
                retry_body["tools"] = serde_json::json!([]);
                if let Ok(retry_data) = call_model(&client, &url, &api_key, &retry_body).await {
                    if let Some(rc) = retry_data.choices.first().and_then(|c| c.message.content.as_deref()) {
                        let (_, rv) = parse_thinking(rc);
                        let rv = crate::services::sanitize::sanitize_output(&rv);
                        if !rv.trim().is_empty() {
                            let _ = tx.send(AiEvent::Token(rv)).await;
                        }
                    }
                }
            }
        }
    });

    Box::pin(ReceiverStream::new(rx))
}
