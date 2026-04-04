-- Remove duplicate legacy indexes (Alembic ix_* duplicates of Rust idx_*)
-- These exact-duplicate indexes waste storage and slow down writes.

-- users: keep idx_* (partial, more efficient), drop ix_* (full, wasteful)
DROP INDEX IF EXISTS ix_users_email;
DROP INDEX IF EXISTS ix_users_phone;
DROP INDEX IF EXISTS ix_users_vk_id;
DROP INDEX IF EXISTS ix_users_yandex_id;
DROP INDEX IF EXISTS ix_users_google_id;

-- api_keys: keep idx_*, drop ix_*
DROP INDEX IF EXISTS ix_api_keys_key_hash;
DROP INDEX IF EXISTS ix_api_keys_user_id;

-- refresh_tokens: keep idx_*, drop ix_*
DROP INDEX IF EXISTS ix_refresh_tokens_token_hash;
DROP INDEX IF EXISTS ix_refresh_tokens_user_id;

-- messages: keep idx_msg_conv_created (composite, covers both queries), drop singles
DROP INDEX IF EXISTS ix_messages_conversation_id;
DROP INDEX IF EXISTS idx_msg_conv_id;

-- conversations: keep idx_conv_user_active (partial), drop full duplicates
DROP INDEX IF EXISTS ix_conversations_user_id;
DROP INDEX IF EXISTS idx_conv_user_id;

-- usage_records: add TTL-friendly index for cleanup scheduler
CREATE INDEX IF NOT EXISTS idx_usage_records_cleanup
  ON usage_records (created_at)
  WHERE created_at < NOW() - INTERVAL '180 days';
