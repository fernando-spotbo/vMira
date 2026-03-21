use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Tracks every AI generation for billing and analytics.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UsageRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub api_key_id: Option<Uuid>,
    pub conversation_id: Option<Uuid>,
    pub request_id: String,
    pub model: String,
    pub input_tokens: i32,
    pub output_tokens: i32,
    pub total_tokens: i32,
    pub queue_duration_ms: i32,
    pub processing_duration_ms: i32,
    pub total_duration_ms: i32,
    pub status: String,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub cost_microcents: i64,
    pub created_at: DateTime<Utc>,
}
