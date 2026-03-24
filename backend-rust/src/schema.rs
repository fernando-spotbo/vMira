use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ═══════════════════════════════════════════════════════════════
//  Auth DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 1, max = 128))]
    pub name: String,

    #[validate(email)]
    pub email: Option<String>,

    #[validate(regex(path = *PHONE_RE))]
    pub phone: Option<String>,

    #[validate(length(min = 8, max = 128))]
    pub password: String,

    pub consent_personal_data: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: Option<String>,

    #[validate(regex(path = *PHONE_RE))]
    pub phone: Option<String>,

    #[validate(length(min = 1))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct PhoneSmsRequest {
    #[validate(regex(path = *PHONE_RE))]
    pub phone: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct PhoneVerifyRequest {
    #[validate(regex(path = *PHONE_RE))]
    pub phone: String,

    #[validate(length(min = 4, max = 8))]
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct VkAuthRequest {
    pub code: String,
    pub redirect_uri: String,
    pub state: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct YandexAuthRequest {
    pub code: String,
    pub state: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GoogleAuthRequest {
    pub credential: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ForgotPasswordRequest {
    #[validate(email)]
    pub email: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ResetPasswordRequest {
    pub token: String,

    #[validate(length(min = 8, max = 128))]
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

impl TokenResponse {
    pub fn new(access_token: String, expires_in: i64) -> Self {
        Self {
            access_token,
            token_type: "bearer".to_string(),
            expires_in,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateUserRequest {
    #[validate(length(min = 1, max = 128))]
    pub name: Option<String>,

    #[validate(custom(function = "validate_language"))]
    pub language: Option<String>,
}

fn validate_language(lang: &str) -> Result<(), validator::ValidationError> {
    match lang {
        "ru" | "en" => Ok(()),
        _ => {
            let mut err = validator::ValidationError::new("language");
            err.message = Some("Language must be 'ru' or 'en'".into());
            Err(err)
        }
    }
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub plan: String,
    pub language: String,
    pub created_at: DateTime<Utc>,
}

// ═══════════════════════════════════════════════════════════════
//  Chat DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Validate)]
pub struct MessageRequest {
    #[validate(length(min = 1, max = 32000))]
    pub content: String,

    #[serde(default = "default_model")]
    pub model: String,

    #[serde(default)]
    pub voice: bool,

    /// IDs of previously uploaded attachments to link to this message
    #[serde(default)]
    pub attachment_ids: Vec<uuid::Uuid>,
}

fn default_model() -> String {
    "mira".to_string()
}

#[derive(Debug, Deserialize, Validate)]
pub struct ConversationCreate {
    #[validate(length(min = 1, max = 256))]
    #[serde(default = "default_title")]
    pub title: String,

    #[serde(default = "default_model")]
    pub model: String,
}

fn default_title() -> String {
    "New chat".to_string()
}

#[derive(Debug, Deserialize, Validate)]
pub struct ConversationUpdate {
    #[validate(length(max = 256))]
    pub title: Option<String>,
    pub starred: Option<bool>,
    pub archived: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct AttachmentBrief {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub id: Uuid,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<AttachmentBrief>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ConversationResponse {
    pub id: Uuid,
    pub title: String,
    pub model: String,
    pub starred: bool,
    pub archived: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ConversationWithMessages {
    pub id: Uuid,
    pub title: String,
    pub model: String,
    pub starred: bool,
    pub archived: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<MessageResponse>,
    pub total_messages: i64,
    pub has_more: bool,
}

// ═══════════════════════════════════════════════════════════════
//  OpenAI-Compatible DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ChatCompletionRequest {
    #[validate(length(max = 64))]
    pub model: String,
    #[validate(length(max = 200))]
    pub messages: Vec<ChatCompletionMessage>,

    #[serde(default = "default_temperature")]
    pub temperature: f32,

    pub max_tokens: Option<u32>,

    #[serde(default)]
    pub stream: bool,
}

fn default_temperature() -> f32 {
    0.7
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionChoice {
    pub index: u32,
    pub message: ChatCompletionMessage,
    pub finish_reason: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<ChatCompletionChoice>,
    pub usage: ChatCompletionUsage,
}

impl ChatCompletionResponse {
    /// Create a convenience wrapper that fills the constant `object` field.
    pub fn new(
        id: String,
        created: i64,
        model: String,
        choices: Vec<ChatCompletionChoice>,
        usage: ChatCompletionUsage,
    ) -> Self {
        Self {
            id,
            object: "chat.completion".to_string(),
            created,
            model,
            choices,
            usage,
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  API Key DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Validate)]
pub struct CreateKeyRequest {
    #[validate(length(min = 1, max = 128))]
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyResponse {
    pub id: Uuid,
    pub name: String,
    pub key_prefix: String,
    pub is_active: bool,
    pub total_requests: i32,
    pub total_tokens: i32,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyCreatedResponse {
    pub id: Uuid,
    pub name: String,
    pub key_prefix: String,
    pub is_active: bool,
    pub total_requests: i32,
    pub total_tokens: i32,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    /// The full key, shown only once at creation time.
    pub key: String,
}

// ═══════════════════════════════════════════════════════════════
//  Session DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: Uuid,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub is_current: bool,
}

// ═══════════════════════════════════════════════════════════════
//  Admin DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct AdminUserResponse {
    pub id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub plan: String,
    pub language: String,
    pub is_active: bool,
    pub daily_messages_used: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct UsageStats {
    pub total_users: i64,
    pub active_users_today: i64,
    pub total_conversations: i64,
    pub total_messages: i64,
    pub messages_today: i64,
    pub users_by_plan: HashMap<String, i64>,
}

// ═══════════════════════════════════════════════════════════════
//  Health DTO
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub db: String,
    pub redis: String,
}

// ═══════════════════════════════════════════════════════════════
//  Billing DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct BalanceResponse {
    pub balance_kopecks: i64,
    pub balance_rubles: String,
    pub spending: crate::services::billing::SpendingSummary,
}

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub amount_kopecks: i64,
    pub amount_rubles: String,
    pub balance_after_kopecks: i64,
    pub description: Option<String>,
    pub model: Option<String>,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub payment_method: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct TopupRequest {
    pub amount_rubles: f64,
    pub return_url: String,
}

#[derive(Debug, Serialize)]
pub struct TopupResponse {
    pub payment_url: String,
    pub payment_id: String,
    pub amount_kopecks: i64,
}

#[derive(Debug, Serialize)]
pub struct PricingResponse {
    pub models: Vec<ModelPricingResponse>,
}

#[derive(Debug, Serialize)]
pub struct ModelPricingResponse {
    pub model: String,
    pub display_name: String,
    pub input_price_per_1k_rubles: String,
    pub output_price_per_1k_rubles: String,
    pub thinking_surcharge_percent: i32,
    pub min_plan: String,
}

// ═══════════════════════════════════════════════════════════════
//  Shared validation regex (lazy-static via std::sync::LazyLock)
// ═══════════════════════════════════════════════════════════════

use std::sync::LazyLock;

static PHONE_RE: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^\+7\d{10}$").expect("valid regex"));
