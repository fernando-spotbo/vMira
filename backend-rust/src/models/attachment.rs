use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub message_id: Option<Uuid>,
    pub user_id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub compressed_size: Option<i64>,
    pub storage_path: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub extracted_content: Option<String>,
    pub created_at: DateTime<Utc>,
}
