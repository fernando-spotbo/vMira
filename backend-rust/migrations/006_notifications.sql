-- 006_notifications.sql
-- Reminders, in-app notifications, Telegram links, notification preferences

-- Reminders (source of truth for all scheduled items)
CREATE TABLE reminders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL DEFAULT 'reminder'
                    CHECK (type IN ('reminder', 'scheduled_content')),
    title           TEXT NOT NULL,
    body            TEXT,
    prompt          TEXT,
    source_message  TEXT,
    remind_at       TIMESTAMPTZ NOT NULL,
    user_timezone   TEXT NOT NULL DEFAULT 'Europe/Moscow',
    rrule           TEXT,
    recurrence_end  TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'fired', 'cancelled', 'snoozed')),
    channels        TEXT[] NOT NULL DEFAULT '{in_app}',
    fired_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    retry_count     INT NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE
);

-- Critical index: scheduler queries this every 30s
CREATE INDEX idx_reminders_pending_due
    ON reminders (remind_at) WHERE status = 'pending';

-- User's reminders list
CREATE INDEX idx_reminders_user_status
    ON reminders (user_id, status, remind_at);

-- In-app notifications (bell icon feed)
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_id     UUID REFERENCES reminders(id) ON DELETE SET NULL,
    type            TEXT NOT NULL DEFAULT 'reminder'
                    CHECK (type IN ('reminder', 'system', 'action')),
    title           TEXT NOT NULL,
    body            TEXT,
    read            BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, created_at DESC) WHERE read = false;
CREATE INDEX idx_notifications_user_all
    ON notifications (user_id, created_at DESC);

-- Telegram account linking (created now, used in Phase 2)
CREATE TABLE telegram_links (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    chat_id         BIGINT NOT NULL UNIQUE,
    username        TEXT,
    timezone        TEXT NOT NULL DEFAULT 'Europe/Moscow',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User notification preferences
CREATE TABLE notification_settings (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_enabled   BOOLEAN NOT NULL DEFAULT false,
    telegram_enabled BOOLEAN NOT NULL DEFAULT false,
    timezone        TEXT NOT NULL DEFAULT 'Europe/Moscow',
    quiet_start     TIME DEFAULT '23:00',
    quiet_end       TIME DEFAULT '07:00',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
