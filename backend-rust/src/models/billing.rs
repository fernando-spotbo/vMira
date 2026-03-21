use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A single balance-changing event in the transactions ledger.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Transaction {
    pub id: Uuid,
    pub user_id: Uuid,
    #[sqlx(rename = "type")]
    pub r#type: String, // 'charge', 'topup', 'refund', 'bonus', 'adjustment'
    pub amount_kopecks: i64,
    pub balance_after_kopecks: i64,
    pub description: Option<String>,
    pub usage_record_id: Option<Uuid>,
    pub payment_id: Option<String>,
    pub payment_method: Option<String>,
    pub model: Option<String>,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub receipt_id: Option<String>,
    pub receipt_status: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Pricing configuration for a single model.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ModelPricing {
    pub id: Uuid,
    pub model: String,
    pub display_name: String,
    pub input_price_per_1k_kopecks: i32,
    pub output_price_per_1k_kopecks: i32,
    pub thinking_surcharge_percent: i32,
    pub is_active: bool,
    pub min_plan: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
