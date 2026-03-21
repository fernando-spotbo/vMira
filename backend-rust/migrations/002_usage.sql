-- 002_usage.sql
-- Usage metering table for billing and analytics

CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    request_id VARCHAR(64) NOT NULL,
    model VARCHAR(50) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    queue_duration_ms INTEGER NOT NULL DEFAULT 0,
    processing_duration_ms INTEGER NOT NULL DEFAULT 0,
    total_duration_ms INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    cancelled_at TIMESTAMPTZ,
    error_message TEXT,
    cost_microcents BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_user_created ON usage_records (user_id, created_at DESC);
CREATE INDEX idx_usage_apikey ON usage_records (api_key_id, created_at DESC) WHERE api_key_id IS NOT NULL;
CREATE INDEX idx_usage_status ON usage_records (status) WHERE status != 'completed';
CREATE INDEX idx_usage_created ON usage_records (created_at);
