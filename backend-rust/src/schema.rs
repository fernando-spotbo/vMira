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
pub struct TelegramAuthRequest {
    pub id: i64,
    pub first_name: String,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub photo_url: Option<String>,
    pub auth_date: i64,
    pub hash: String,
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

    /// Opt-in to overage billing (continue past daily limits at per-token cost)
    pub allow_overage_billing: Option<bool>,

    /// Switch active organization (must be a member)
    pub active_organization_id: Option<Uuid>,
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
    pub balance_kopecks: i64,
    pub daily_messages_used: i32,
    pub allow_overage_billing: bool,
    pub chat_plan: String,
    pub chat_plan_expires_at: Option<DateTime<Utc>>,
    pub code_plan: String,
    pub code_plan_expires_at: Option<DateTime<Utc>>,
    pub organization_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ═══════════════════════════════════════════════════════════════
//  Chat DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Validate)]
pub struct MessageRequest {
    #[validate(length(min = 1, max = 32000), custom(function = "validate_no_null_bytes"))]
    pub content: String,

    #[serde(default = "default_model")]
    pub model: String,

    #[serde(default)]
    pub voice: bool,

    /// IDs of previously uploaded attachments to link to this message
    #[serde(default)]
    pub attachment_ids: Vec<uuid::Uuid>,

    /// If true, this is a retry/resend — delete the previous identical user message
    /// and its assistant response before processing.
    #[serde(default)]
    pub resend: bool,
}

fn default_model() -> String {
    "mira".to_string()
}

#[derive(Debug, Deserialize, Validate)]
pub struct ConversationCreate {
    #[validate(length(min = 1, max = 256), custom(function = "validate_no_null_bytes"))]
    #[serde(default = "default_title")]
    pub title: String,

    #[serde(default = "default_model")]
    pub model: String,

    pub project_id: Option<Uuid>,
}

fn default_title() -> String {
    "New chat".to_string()
}

#[derive(Debug, Deserialize, Validate)]
pub struct ConversationUpdate {
    #[validate(length(max = 256), custom(function = "validate_no_null_bytes"))]
    pub title: Option<String>,
    pub starred: Option<bool>,
    pub archived: Option<bool>,
    /// Set to a project UUID to assign, or null to unassign.
    pub project_id: Option<Option<Uuid>>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<Uuid>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<MessageResponse>,
    pub total_messages: i64,
    pub has_more: bool,
}

// ═══════════════════════════════════════════════════════════════
//  Project DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Validate)]
pub struct ProjectCreate {
    #[validate(length(min = 1, max = 128))]
    pub name: String,

    #[validate(length(max = 16))]
    pub emoji: Option<String>,

    #[validate(length(max = 10000))]
    pub instructions: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ProjectUpdate {
    #[validate(length(min = 1, max = 128))]
    pub name: Option<String>,

    #[validate(length(max = 16))]
    pub emoji: Option<String>,

    #[validate(length(max = 10000))]
    pub instructions: Option<String>,

    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub name: String,
    pub emoji: Option<String>,
    pub instructions: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ProjectFileResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub url: String,
    pub created_at: DateTime<Utc>,
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
    /// Where to redirect after payment (used by frontend for navigation)
    #[serde(default)]
    pub return_url: String,
}

#[derive(Debug, Serialize)]
pub struct TopupResponse {
    pub payment_url: String,
    pub payment_id: String,
    pub amount_kopecks: i64,
    pub provider: String,
}

// ── Subscription DTOs ─────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SubscribeRequest {
    /// Product: "chat" or "code"
    pub product: String,
    /// Plan: "pro" or "max"
    pub plan: String,
}

#[derive(Debug, Serialize)]
pub struct SubscribeResponse {
    pub payment_url: String,
    pub payment_id: String,
    pub product: String,
    pub plan: String,
    pub amount_kopecks: i64,
    pub expires_at: String,
}

// ── Refund DTOs ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RefundRequest {
    /// Subscription ID to refund
    pub subscription_id: Uuid,
    /// Wallet address to send refund to (USDT TRC20 by default)
    pub wallet_address: String,
    /// Optional: override refund currency (default USDT_TRC20)
    pub currency: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RefundResponse {
    pub refund_kopecks: i64,
    pub refund_rubles: String,
    pub usdt_amount: f64,
    pub currency: String,
    pub wallet_address: String,
    pub withdrawal_id: String,
    pub days_used: i64,
}

// ── Pricing ───────────────────────────────────────────────

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
//  Bridge DTOs (CLI <-> Backend <-> Web)
// ═══════════════════════════════════════════════════════════════

/// CLI -> Backend: register environment
#[derive(Debug, Deserialize)]
pub struct RegisterEnvironmentRequest {
    pub machine_name: String,
    pub directory: String,
    pub branch: Option<String>,
    pub git_repo_url: Option<String>,
    #[serde(default = "default_max_sessions")]
    pub max_sessions: i32,
    #[serde(default)]
    pub metadata: serde_json::Value,
    /// Idempotent re-registration
    pub environment_id: Option<Uuid>,
}

fn default_max_sessions() -> i32 {
    4
}

#[derive(Debug, Serialize)]
pub struct RegisterEnvironmentResponse {
    pub environment_id: Uuid,
    pub environment_secret: String,
}

/// CLI <- Backend: work item from poll
#[derive(Debug, Serialize)]
pub struct WorkResponse {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub type_: String,
    pub environment_id: Uuid,
    pub state: String,
    pub data: serde_json::Value,
    pub secret: String,
    pub created_at: DateTime<Utc>,
}

/// CLI <- Backend: heartbeat response
#[derive(Debug, Serialize)]
pub struct HeartbeatResponse {
    pub lease_extended: bool,
    pub state: String,
    pub last_heartbeat: DateTime<Utc>,
    pub ttl_seconds: i64,
}

/// Web -> Backend: send message to CLI
#[derive(Debug, Deserialize, Validate)]
pub struct BridgeMessageRequest {
    #[validate(length(min = 1, max = 32000))]
    pub content: String,
}

/// Web <- Backend: session list item
#[derive(Debug, Serialize)]
pub struct BridgeSessionResponse {
    pub id: Uuid,
    pub environment_id: Uuid,
    pub machine_name: String,
    pub directory: String,
    pub branch: Option<String>,
    pub git_repo_url: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Web <- Backend: message in session history
#[derive(Debug, Serialize)]
pub struct BridgeMessageResponse {
    pub id: Uuid,
    pub role: String,
    pub content: String,
    pub thinking: Option<String>,
    pub steps: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Web <- Backend: session with messages
#[derive(Debug, Serialize)]
pub struct BridgeSessionWithMessages {
    pub id: Uuid,
    pub environment_id: Uuid,
    pub machine_name: String,
    pub directory: String,
    pub branch: Option<String>,
    pub git_repo_url: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<BridgeMessageResponse>,
    pub total_messages: i64,
    pub has_more: bool,
}

// ═══════════════════════════════════════════════════════════════
//  Organization DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Validate)]
pub struct CreateOrganizationRequest {
    #[validate(length(min = 1, max = 128))]
    pub name: String,

    #[validate(length(min = 1, max = 128), regex(path = *SLUG_RE))]
    pub slug: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateOrganizationRequest {
    #[validate(length(min = 1, max = 128))]
    pub name: Option<String>,

    #[validate(length(min = 1, max = 128), regex(path = *SLUG_RE))]
    pub slug: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct InviteMemberRequest {
    pub user_id: Uuid,

    #[validate(custom(function = "validate_org_role"))]
    #[serde(default = "default_member_role")]
    pub role: String,
}

fn default_member_role() -> String {
    "member".to_string()
}

fn validate_org_role(role: &str) -> Result<(), validator::ValidationError> {
    match role {
        "admin" | "member" => Ok(()),
        _ => {
            let mut err = validator::ValidationError::new("role");
            err.message = Some("Role must be 'admin' or 'member'".into());
            Err(err)
        }
    }
}

#[derive(Debug, Serialize)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub owner_id: Uuid,
    pub is_personal: bool,
    pub plan: String,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct OrganizationMemberResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

// ═══════════════════════════════════════════════════════════════
//  Shared validation regex (lazy-static via std::sync::LazyLock)
// ═══════════════════════════════════════════════════════════════

use std::sync::LazyLock;

static PHONE_RE: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^\+7\d{10}$").expect("valid regex"));

static SLUG_RE: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$").expect("valid regex"));

/// Reject strings containing null bytes (prevents PostgreSQL text column crashes).
pub fn validate_no_null_bytes(s: &str) -> Result<(), validator::ValidationError> {
    if s.contains('\0') {
        let mut err = validator::ValidationError::new("null_bytes");
        err.message = Some("Input must not contain null bytes".into());
        return Err(err);
    }
    Ok(())
}
