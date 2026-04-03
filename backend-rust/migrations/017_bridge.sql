-- Bridge environments: registered CLI sessions
CREATE TABLE bridge_environments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    machine_name        VARCHAR(256) NOT NULL,
    directory           TEXT NOT NULL,
    branch              VARCHAR(256),
    git_repo_url        TEXT,
    max_sessions        INT NOT NULL DEFAULT 4,
    metadata            JSONB NOT NULL DEFAULT '{}',
    secret              VARCHAR(512) NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'connected',
    last_heartbeat_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bridge_env_user ON bridge_environments(user_id);
CREATE INDEX idx_bridge_env_org ON bridge_environments(organization_id);

-- Bridge messages: conversation history per environment
CREATE TABLE bridge_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id      UUID NOT NULL REFERENCES bridge_environments(id) ON DELETE CASCADE,
    role                VARCHAR(32) NOT NULL,
    content             TEXT NOT NULL DEFAULT '',
    thinking            TEXT,
    steps               JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bridge_msg_env ON bridge_messages(environment_id, created_at);

-- Bridge work queue: pending commands for CLI to pick up
CREATE TABLE bridge_work_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id      UUID NOT NULL REFERENCES bridge_environments(id) ON DELETE CASCADE,
    work_type           VARCHAR(32) NOT NULL DEFAULT 'session',
    data                JSONB NOT NULL DEFAULT '{}',
    state               VARCHAR(32) NOT NULL DEFAULT 'pending',
    acknowledged_at     TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    result              JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bridge_work_env ON bridge_work_queue(environment_id, state);
