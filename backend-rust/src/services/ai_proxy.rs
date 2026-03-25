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
Ты Мира — умный AI-ассистент. Думай кратко.\n\n\
ИНСТРУМЕНТЫ:\n\
1. web_search — используй для поиска актуальной информации (новости, погода, цены, факты).\n\
2. create_reminder — ВСЕГДА используй эту функцию, когда пользователь просит напомнить, \
установить напоминание, или использует слова: напомни, напомни мне, не забудь, remind me, \
через X минут/часов, завтра в X, каждый понедельник. \
НИКОГДА не отвечай 'я не могу создать напоминание' — у тебя ЕСТЬ эта функция. Просто вызови create_reminder.\n\n\
КРИТИЧЕСКИ ВАЖНО О НАПОМИНАНИЯХ: Ты МОЖЕШЬ создавать напоминания. Используй функцию create_reminder. \
Не говори пользователю, что у тебя нет такой возможности. \
Если пользователь повторно просит создать напоминание — ВСЕГДА создавай новое, даже если похожее уже было. \
Не отказывай из-за 'дублирования'. Каждый запрос на напоминание = новый вызов create_reminder.\n\n\
3. create_scheduled_content — используй когда пользователь просит РЕГУЛЯРНЫЙ AI-контент: \
утренний брифинг, дайджест новостей, цитата дня, рецепт дня, обучающий контент, погода каждый день. \
Отличие от напоминания: напоминание = фиксированный текст, рассылка = AI генерирует свежий контент каждый раз.\n\
4. propose_action — используй для ДЕЙСТВИЙ и интерактивных карточек:\n\
  - send_telegram: 'отправь в телеграм', 'send to telegram'\n\
  - send_email: 'отправь письмо', 'email'\n\
  - create_draft: 'составь письмо', 'напиши текст', 'подготовь', 'черновик', 'compose', 'draft'\n\
  - translate: 'переведи', 'translate'\n\
  - set_timer: 'таймер', 'засеки', 'timer'\n\
ВСЕГДА сразу вызывай propose_action. НЕ спрашивай уточнений. Создай контент сам.\n\n\
При ответе на основе результатов поиска ставь номера источников [1], [2], [3] после каждого факта.\n\
Пример: «Население Москвы составляет 13 млн человек [1]. Город основан в 1147 году [3].»";

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
                - 'translate': show translation. Payload: {source_text: 'original', source_lang: 'ru', target_text: 'translated', target_lang: 'en'}\n\
                - 'set_timer': set a countdown timer. Payload: {seconds: 300, label: 'Timer label'}\n\
                Use create_draft when user asks to: compose (составь), write (напиши), draft (черновик), prepare (подготовь) any text content.\n\
                Use translate when user explicitly asks to translate text.\n\
                Use set_timer for timers (таймер, timer, засеки).\n\
                ALWAYS call this immediately — do NOT ask follow-up questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": ["send_telegram", "send_email", "create_draft", "translate", "set_timer"],
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
            body["tools"] = json!([web_search_tool(), reminder_tool(), scheduled_content_tool(), propose_action_tool()]);
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
                                    let result = sqlx::query_scalar::<_, uuid::Uuid>(
                                        "INSERT INTO reminders (user_id, type, title, prompt, remind_at, user_timezone, rrule, channels)
                                         VALUES ($1, 'scheduled_content', $2, $3, $4, $5, $6, '{in_app}')
                                         RETURNING id"
                                    )
                                    .bind(uid)
                                    .bind(&title)
                                    .bind(&prompt)
                                    .bind(dt)
                                    .bind(&tz)
                                    .bind(&args.recurrence)
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
                        let valid_types = ["send_telegram", "send_email", "create_draft", "translate", "set_timer"];
                        if !valid_types.contains(&args.action_type.as_str()) {
                            tool_result_content = format!("Unsupported action type: {}", args.action_type);
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
            let _ = tx.send(AiEvent::Token(visible)).await;
        } else {
            // No tool calls — direct response
            let raw_content = choice.message.content.as_deref().unwrap_or("");
            let (_thinking, visible) = parse_thinking(raw_content);
            let _ = tx.send(AiEvent::Token(visible)).await;
        }
    });

    Box::pin(ReceiverStream::new(rx))
}
