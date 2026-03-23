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
Ты Мира — умный AI-ассистент. Думай кратко.\n\
Если пользователь задаёт вопрос о текущих событиях, новостях, ценах, погоде, \
датах, фактах которые могли измениться, или о чём-то что ты не знаешь наверняка — \
используй функцию web_search для поиска актуальной информации.\n\n\
КРИТИЧЕСКИ ВАЖНО: Когда отвечаешь на основе результатов поиска, ты ДОЛЖЕН ставить номера источников \
в квадратных скобках [1], [2], [3] после каждого факта или утверждения. Номера соответствуют порядку \
результатов поиска. Без номеров ответ считается неполным.\n\
Пример: «Население Москвы составляет 13 млн человек [1]. Город основан в 1147 году [3].»";

/// Voice mode system prompt — short, conversational, TTS-friendly, multilingual.
pub const MIRA_VOICE_PROMPT: &str = "\
Ты Мира — голосовой AI-ассистент. Пользователь разговаривает с тобой голосом.\n\n\
ПРАВИЛА ДЛЯ ГОЛОСОВОГО РЕЖИМА:\n\
- Отвечай КОРОТКО: максимум 2-3 предложения. Это устная беседа, не эссе.\n\
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
    if cfg!(debug_assertions) {
        if scheme != "https" && scheme != "http" {
            return Err(format!("Запрещённая схема URL: {scheme}"));
        }
    } else if scheme != "https" {
        return Err(format!("Разрешена только HTTPS-схема, получена: {scheme}"));
    }

    if let Some(port) = parsed.port() {
        if port != 443 && port != 80 {
            return Err(format!("Нестандартный порт запрещён: {port}"));
        }
    }

    let host = parsed.host_str().ok_or_else(|| "URL модели не содержит хост".to_string())?;

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
) -> Pin<Box<dyn Stream<Item = AiEvent> + Send>> {
    let url = format!("{}/chat/completions", config.ai_model_url);
    let api_key = config.ai_model_api_key.clone();
    let allowed_hosts = config.ai_model_allowed_hosts.clone();
    let max_search = search_results_for_plan(user_plan);
    let config = Arc::new(config.clone());

    let (tx, rx) = tokio::sync::mpsc::channel::<AiEvent>(32);

    let system_prompt = if voice_mode { MIRA_VOICE_PROMPT } else { MIRA_SYSTEM_PROMPT };
    let mut full_messages: Vec<serde_json::Value> = vec![json!({
        "role": "system",
        "content": system_prompt,
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

    // Tool calling is only supported on deepseek-chat (not deepseek-reasoner)
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
            body["tools"] = json!([web_search_tool()]);
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
                if tc.function.name != "web_search" {
                    continue;
                }

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

                let (search_content, results_for_event) = match search_result {
                    Ok(sr) => {
                        let mut content = sr.results.iter().enumerate().map(|(i, r)| {
                            format!("{}. {} — {}\n   {}", i + 1, r.title, r.url, r.content)
                        }).collect::<Vec<_>>().join("\n\n");
                        content.push_str("\n\n[ВАЖНО: В ответе ОБЯЗАТЕЛЬНО указывай номера источников в квадратных скобках, например [1], [2], после каждого факта.]");
                        let results = sr.results.clone();
                        (content, results)
                    }
                    Err(e) => {
                        tracing::warn!(error = %e, "Web search failed");
                        (format!("Search failed: {e}"), vec![])
                    }
                };

                // Emit search results event
                let _ = tx.send(AiEvent::SearchResults {
                    query: args.query.clone(),
                    results: results_for_event,
                }).await;

                // ── Second call with tool results ───────────────
                // Add assistant message with tool_calls
                full_messages.push(json!({
                    "role": "assistant",
                    "content": null,
                    "tool_calls": [{
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": "web_search",
                            "arguments": tc.function.arguments
                        }
                    }]
                }));

                // Add tool result message
                full_messages.push(json!({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": search_content
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
