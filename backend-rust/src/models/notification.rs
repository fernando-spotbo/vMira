use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Reminder {
    pub id: Uuid,
    pub user_id: Uuid,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub type_: String,
    pub title: String,
    pub body: Option<String>,
    pub prompt: Option<String>,
    pub source_message: Option<String>,
    pub remind_at: DateTime<Utc>,
    pub user_timezone: String,
    pub rrule: Option<String>,
    pub recurrence_end: Option<DateTime<Utc>>,
    pub status: String,
    pub channels: Vec<String>,
    pub fired_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub retry_count: i32,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    pub reminder_id: Option<Uuid>,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub type_: String,
    pub title: String,
    pub body: Option<String>,
    pub read: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificationSettings {
    pub user_id: Uuid,
    pub email_enabled: bool,
    pub telegram_enabled: bool,
    pub timezone: String,
    pub quiet_start: Option<NaiveTime>,
    pub quiet_end: Option<NaiveTime>,
    pub updated_at: DateTime<Utc>,
    pub briefing_enabled: bool,
    pub briefing_time: NaiveTime,
    pub briefing_last_sent: Option<chrono::NaiveDate>,
    pub briefing_prompt: Option<String>,
    pub briefing_last_content: Option<String>,
    pub briefing_last_generated: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TelegramLink {
    pub user_id: Uuid,
    pub chat_id: i64,
    pub username: Option<String>,
    pub timezone: String,
    pub is_active: bool,
    pub linked_at: DateTime<Utc>,
}
