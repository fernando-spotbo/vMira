use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub name: String,
    pub password_hash: Option<String>,

    // OAuth provider identifiers
    pub vk_id: Option<String>,
    pub yandex_id: Option<String>,
    pub google_id: Option<String>,

    pub avatar_url: Option<String>,
    pub language: String,
    pub plan: String,

    // Usage tracking
    pub daily_messages_used: i32,
    pub daily_reset_at: DateTime<Utc>,

    // Account status
    pub is_active: bool,
    pub is_verified: bool,
    pub is_admin: bool,

    // Brute-force protection
    pub failed_login_attempts: i32,
    pub locked_until: Option<DateTime<Utc>>,

    // TOTP 2FA
    pub totp_secret: Option<String>,

    // 152-FZ consent tracking
    pub consent_personal_data: bool,
    pub consent_personal_data_at: Option<DateTime<Utc>>,
    pub consent_marketing: bool,
    pub consent_marketing_at: Option<DateTime<Utc>>,

    // Billing
    pub balance_kopecks: i64,
    pub total_spent_kopecks: i64,
    pub total_topped_up_kopecks: i64,

    // Overage billing opt-in (continue past daily limits at per-token cost)
    pub allow_overage_billing: bool,

    // Product-specific subscriptions (separate from API plan)
    pub chat_plan: String,
    pub chat_plan_expires_at: Option<DateTime<Utc>>,
    pub code_plan: String,
    pub code_plan_expires_at: Option<DateTime<Utc>>,

    pub active_organization_id: Option<Uuid>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
