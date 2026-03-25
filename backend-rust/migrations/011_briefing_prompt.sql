-- 011_briefing_prompt.sql
-- Store user's custom briefing prompt + last generated content

ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS briefing_prompt TEXT,
    ADD COLUMN IF NOT EXISTS briefing_last_content TEXT,
    ADD COLUMN IF NOT EXISTS briefing_last_generated TIMESTAMPTZ;
