-- Billing system: user balance, transactions ledger, and model pricing
-- All monetary values stored in kopecks (1 ruble = 100 kopecks) for precision.

-- User balance columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_kopecks BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent_kopecks BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_topped_up_kopecks BIGINT NOT NULL DEFAULT 0;

-- Transactions ledger — every balance change
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'charge', 'topup', 'refund', 'bonus', 'adjustment'
    amount_kopecks BIGINT NOT NULL, -- positive = credit, negative = debit
    balance_after_kopecks BIGINT NOT NULL, -- balance snapshot after this transaction
    description TEXT,
    -- For charges, link to the usage record
    usage_record_id UUID REFERENCES usage_records(id) ON DELETE SET NULL,
    -- For topups, link to payment
    payment_id VARCHAR(128), -- YooKassa payment ID
    payment_method VARCHAR(50), -- 'card', 'sbp', 'yoomoney', 'mir'
    -- Metadata
    model VARCHAR(50),
    input_tokens INTEGER,
    output_tokens INTEGER,
    -- 54-FZ fiscal receipt
    receipt_id VARCHAR(128),
    receipt_status VARCHAR(20), -- 'pending', 'sent', 'error'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_created ON transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_payment ON transactions (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions (type, created_at DESC);

-- Model pricing table (in kopecks per 1000 tokens)
CREATE TABLE IF NOT EXISTS model_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    input_price_per_1k_kopecks INTEGER NOT NULL, -- kopecks per 1000 input tokens
    output_price_per_1k_kopecks INTEGER NOT NULL, -- kopecks per 1000 output tokens
    thinking_surcharge_percent INTEGER NOT NULL DEFAULT 0, -- extra % for reasoning tokens
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    min_plan VARCHAR(20) NOT NULL DEFAULT 'free', -- minimum plan required
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default pricing
INSERT INTO model_pricing (model, display_name, input_price_per_1k_kopecks, output_price_per_1k_kopecks, thinking_surcharge_percent, min_plan) VALUES
    ('mira', 'Mira Fast', 10, 30, 0, 'free'),
    ('mira-thinking', 'Mira Thinking', 15, 50, 50, 'free'),
    ('mira-pro', 'Mira Pro', 30, 90, 0, 'pro'),
    ('mira-max', 'Mira Max', 150, 600, 0, 'max')
ON CONFLICT (model) DO NOTHING;
