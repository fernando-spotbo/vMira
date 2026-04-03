use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BridgeEnvironment {
    pub id: Uuid,
    pub user_id: Uuid,
    pub organization_id: Uuid,
    pub machine_name: String,
    pub directory: String,
    pub branch: Option<String>,
    pub git_repo_url: Option<String>,
    pub max_sessions: i32,
    pub metadata: serde_json::Value,
    pub secret: String,
    pub status: String,
    pub last_heartbeat_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BridgeMessage {
    pub id: Uuid,
    pub environment_id: Uuid,
    pub role: String,
    pub content: String,
    pub thinking: Option<String>,
    pub steps: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BridgeWorkItem {
    pub id: Uuid,
    pub environment_id: Uuid,
    pub work_type: String,
    pub data: serde_json::Value,
    pub state: String,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub result: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}
