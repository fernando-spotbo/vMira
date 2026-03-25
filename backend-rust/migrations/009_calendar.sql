-- 009_calendar.sql
-- Calendar events, ICS feed tokens, and OAuth connections for calendar integrations

-- Calendar events (persisted from create_event actions + Google sync)
CREATE TABLE calendar_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_id       UUID REFERENCES actions(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    location        TEXT,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ,
    all_day         BOOLEAN NOT NULL DEFAULT false,
    user_timezone   TEXT NOT NULL DEFAULT 'Europe/Moscow',
    rrule           TEXT,
    source          TEXT NOT NULL DEFAULT 'mira'
                    CHECK (source IN ('mira', 'google', 'yandex')),
    external_id     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_user ON calendar_events (user_id, start_at);
CREATE INDEX idx_calendar_events_external ON calendar_events (user_id, source, external_id)
    WHERE external_id IS NOT NULL;

-- ICS feed tokens (one per user, long-lived, revocable)
CREATE TABLE calendar_feed_tokens (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_fetched_at TIMESTAMPTZ
);

-- OAuth connections for external calendar providers
CREATE TABLE calendar_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('google', 'yandex')),
    access_token    TEXT NOT NULL,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,
    calendar_id     TEXT,
    sync_enabled    BOOLEAN NOT NULL DEFAULT true,
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, provider)
);
