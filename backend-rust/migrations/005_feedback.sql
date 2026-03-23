-- User feedback on AI responses — structured for model improvement.
--
-- Key training signals:
--   rating + categories → classify failure modes (hallucination, instruction-following, etc.)
--   correction          → gold-standard expected output for fine-tuning pairs
--   severity            → prioritize which failures matter most
--   model (from messages table join) → track per-model quality
--
-- Query for training data:
--   SELECT f.*, m.content as response, m.model,
--          (SELECT content FROM messages WHERE conversation_id = m.conversation_id AND role='user'
--           ORDER BY created_at DESC LIMIT 1) as prompt
--   FROM message_feedback f JOIN messages m ON m.id = f.message_id
--   WHERE f.rating = 'bad' AND f.correction IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating VARCHAR(10) NOT NULL CHECK (rating IN ('good', 'bad')),
    severity VARCHAR(10) CHECK (severity IN ('minor', 'major', 'critical')),
    categories TEXT[] NOT NULL DEFAULT '{}',
    comment TEXT,
    correction TEXT,  -- "what the model SHOULD have said" — key for fine-tuning
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_message ON message_feedback (message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON message_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON message_feedback (rating, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_training ON message_feedback (rating, severity) WHERE correction IS NOT NULL;
