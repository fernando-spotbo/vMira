use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ApiKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub key_hash: String,
    pub key_prefix: String,
    pub is_active: bool,
    pub requests_today: i32,
    pub total_requests: i32,
    pub total_tokens: i32,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Generate a new API key in the format `sk-mira-{40 hex chars}`.
pub fn generate_api_key() -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: [u8; 20] = rng.gen();
    let hex: String = random_bytes.iter().map(|b| format!("{b:02x}")).collect();
    format!("sk-mira-{hex}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::token::hash_token;

    #[test]
    fn generated_key_has_correct_prefix() {
        let key = generate_api_key();
        assert!(key.starts_with("sk-mira-"));
        // 8 prefix chars + 40 hex chars = 48
        assert_eq!(key.len(), 48);
    }

    #[test]
    fn hash_is_deterministic() {
        let key = "sk-mira-abcdef1234567890abcdef1234567890abcdef12";
        let secret = "test-secret";
        assert_eq!(hash_token(key, secret), hash_token(key, secret));
    }

    #[test]
    fn different_secrets_produce_different_hashes() {
        let key = "sk-mira-abcdef1234567890abcdef1234567890abcdef12";
        assert_ne!(hash_token(key, "secret-a"), hash_token(key, "secret-b"));
    }
}
