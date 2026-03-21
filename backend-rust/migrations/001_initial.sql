-- 001_initial.sql
-- Foundation schema for Mira API (Rust rewrite)

-- ═══════════════════════════════════════════════════════════════
--  Users
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email                   TEXT UNIQUE,
    phone                   TEXT UNIQUE,
    name                    TEXT        NOT NULL,
    password_hash           TEXT,

    -- OAuth provider identifiers
    vk_id                   TEXT UNIQUE,
    yandex_id               TEXT UNIQUE,
    google_id               TEXT UNIQUE,

    avatar_url              TEXT,
    language                TEXT        NOT NULL DEFAULT 'ru',
    plan                    TEXT        NOT NULL DEFAULT 'free',

    -- Usage tracking
    daily_messages_used     INT         NOT NULL DEFAULT 0,
    daily_reset_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Account status
    is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
    is_verified             BOOLEAN     NOT NULL DEFAULT FALSE,
    is_admin                BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Brute-force protection
    failed_login_attempts   INT         NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,

    -- TOTP 2FA
    totp_secret             TEXT,

    -- 152-FZ consent tracking
    consent_personal_data    BOOLEAN     NOT NULL DEFAULT FALSE,
    consent_personal_data_at TIMESTAMPTZ,
    consent_marketing        BOOLEAN     NOT NULL DEFAULT FALSE,
    consent_marketing_at     TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email       ON users (email)     WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone       ON users (phone)     WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_vk_id       ON users (vk_id)    WHERE vk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_yandex_id   ON users (yandex_id) WHERE yandex_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_id   ON users (google_id) WHERE google_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
--  Conversations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL DEFAULT 'New chat',
    model       TEXT        NOT NULL DEFAULT 'mira',
    starred     BOOLEAN     NOT NULL DEFAULT FALSE,
    archived    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_user_id      ON conversations (user_id);
-- Active (non-archived) conversations per user, newest first
CREATE INDEX IF NOT EXISTS idx_conv_user_active   ON conversations (user_id, created_at DESC)
    WHERE archived = FALSE;

-- ═══════════════════════════════════════════════════════════════
--  Messages
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id   UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role              TEXT        NOT NULL,
    content           TEXT        NOT NULL DEFAULT '',
    steps             JSONB,
    input_tokens      INT,
    output_tokens     INT,
    model             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_conv_id       ON messages (conversation_id);
-- Messages within a conversation, chronological
CREATE INDEX IF NOT EXISTS idx_msg_conv_created   ON messages (conversation_id, created_at ASC);
-- Global message timeline (admin analytics)
CREATE INDEX IF NOT EXISTS idx_msg_created        ON messages (created_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  API Keys
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    key_hash        TEXT        NOT NULL,
    key_prefix      TEXT        NOT NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    requests_today  INT         NOT NULL DEFAULT 0,
    total_requests  INT         NOT NULL DEFAULT 0,
    total_tokens    INT         NOT NULL DEFAULT 0,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_apikey_hash         ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_apikey_user_id             ON api_keys (user_id);
-- Fast lookup for authentication (active keys only)
CREATE INDEX IF NOT EXISTS idx_apikey_hash_active          ON api_keys (key_hash)
    WHERE is_active = TRUE;

-- ═══════════════════════════════════════════════════════════════
--  Refresh Tokens (sessions)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL,
    user_agent  TEXT,
    ip_address  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rt_token_hash  ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_rt_user_id            ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_rt_user_created       ON refresh_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apikey_user_active     ON api_keys (user_id, created_at DESC) WHERE is_active = TRUE;
