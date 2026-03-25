-- 010_briefing.sql
-- Add daily briefing settings to notification_settings

ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS briefing_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS briefing_time TIME NOT NULL DEFAULT '08:00',
    ADD COLUMN IF NOT EXISTS briefing_last_sent DATE;
