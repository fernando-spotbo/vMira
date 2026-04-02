-- Subscription system: time-limited plans for Chat and Mira Code products.
-- Separate from API balance-based billing (balance_kopecks stays unchanged).

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product VARCHAR(20) NOT NULL,     -- 'chat' or 'code'
    plan VARCHAR(20) NOT NULL,        -- 'pro' or 'max'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    payment_id VARCHAR(128),          -- CryptoCloud invoice UUID
    payment_method VARCHAR(50),       -- 'crypto:BTC', 'crypto:USDT_TRC20', etc.
    amount_kopecks BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'expired', 'cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_user_product ON subscriptions (user_id, product, status);
CREATE INDEX IF NOT EXISTS idx_sub_expires ON subscriptions (expires_at) WHERE status = 'active';

-- Product-specific plan fields on users (separate from API plan)
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_plan VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS code_plan VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_plan_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS code_plan_expires_at TIMESTAMPTZ;
