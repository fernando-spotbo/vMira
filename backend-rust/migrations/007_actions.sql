-- Agentic actions: proposed by AI, confirmed by user, executed by backend
CREATE TABLE actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id      UUID,  -- chat message that proposed this action
    type            TEXT NOT NULL,  -- 'send_telegram', 'send_email', etc.
    payload         JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed', 'confirmed', 'executing', 'executed', 'cancelled', 'failed')),
    result          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_at     TIMESTAMPTZ
);

CREATE INDEX idx_actions_user ON actions (user_id, created_at DESC);
CREATE INDEX idx_actions_status ON actions (status) WHERE status = 'proposed';
