# Bridge Session Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the bridge session backend endpoints in Rust so the CLI can register environments and the CodePage can list sessions and relay messages — completing the remote control loop.

**Architecture:** The Rust backend adds three tables (`bridge_environments`, `bridge_messages`, `bridge_work_queue`) and two route groups: `/v1/environments/bridge` for CLI registration/polling/heartbeat, and `/code/sessions` for web app session listing/messaging. The CLI registers an environment, polls for work. The web sends a message, which is queued as work. The CLI picks it up, processes it, and sends back results which are stored and streamed to the web via SSE.

**Tech Stack:** Rust (Axum, SQLx, PostgreSQL, SSE via axum::response::Sse), existing auth middleware

---

## Task 1: Database migration — bridge tables

**Files:**
- Create: `backend-rust/migrations/017_bridge.sql`

```sql
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
```

---

## Task 2: Bridge models

**Files:**
- Create: `backend-rust/src/models/bridge.rs`
- Modify: `backend-rust/src/models/mod.rs`

```rust
// backend-rust/src/models/bridge.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BridgeEnvironment {
    pub id: Uuid,
    pub user_id: Uuid,
    pub organization_id: Uuid,
    pub machine_name: String,
    pub directory: String,
    pub branch: Option<String>,
    pub git_repo_url: Option<String>,
    pub max_sessions: i32,
    pub metadata: serde_json::Value,
    pub secret: String,
    pub status: String,
    pub last_heartbeat_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BridgeMessage {
    pub id: Uuid,
    pub environment_id: Uuid,
    pub role: String,
    pub content: String,
    pub thinking: Option<String>,
    pub steps: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BridgeWorkItem {
    pub id: Uuid,
    pub environment_id: Uuid,
    pub work_type: String,
    pub data: serde_json::Value,
    pub state: String,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub result: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}
```

Add to `models/mod.rs`:
```rust
pub mod bridge;
pub use bridge::{BridgeEnvironment, BridgeMessage, BridgeWorkItem};
```

---

## Task 3: Bridge DTOs in schema.rs

**Files:**
- Modify: `backend-rust/src/schema.rs`

Add before the Organization DTOs section:

```rust
// ═══════════════════════════════════════════════════════════════
//  Bridge DTOs (CLI ↔ Backend ↔ Web)
// ═══════════════════════════════════════════════════════════════

/// CLI → Backend: register environment
#[derive(Debug, Deserialize)]
pub struct RegisterEnvironmentRequest {
    pub machine_name: String,
    pub directory: String,
    pub branch: Option<String>,
    pub git_repo_url: Option<String>,
    #[serde(default = "default_max_sessions")]
    pub max_sessions: i32,
    #[serde(default)]
    pub metadata: serde_json::Value,
    /// Idempotent re-registration
    pub environment_id: Option<Uuid>,
}

fn default_max_sessions() -> i32 { 4 }

#[derive(Debug, Serialize)]
pub struct RegisterEnvironmentResponse {
    pub environment_id: Uuid,
    pub environment_secret: String,
}

/// CLI ← Backend: work item from poll
#[derive(Debug, Serialize)]
pub struct WorkResponse {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub type_: String,
    pub environment_id: Uuid,
    pub state: String,
    pub data: serde_json::Value,
    pub secret: String,
    pub created_at: DateTime<Utc>,
}

/// CLI → Backend: heartbeat response
#[derive(Debug, Serialize)]
pub struct HeartbeatResponse {
    pub lease_extended: bool,
    pub state: String,
    pub last_heartbeat: DateTime<Utc>,
    pub ttl_seconds: i64,
}

/// Web → Backend: send message to CLI
#[derive(Debug, Deserialize, Validate)]
pub struct BridgeMessageRequest {
    #[validate(length(min = 1, max = 32000))]
    pub content: String,
}

/// Web ← Backend: session list item
#[derive(Debug, Serialize)]
pub struct BridgeSessionResponse {
    pub id: Uuid,
    pub environment_id: Uuid,
    pub machine_name: String,
    pub directory: String,
    pub branch: Option<String>,
    pub git_repo_url: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Web ← Backend: message in session
#[derive(Debug, Serialize)]
pub struct BridgeMessageResponse {
    pub id: Uuid,
    pub role: String,
    pub content: String,
    pub thinking: Option<String>,
    pub steps: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Web ← Backend: session with messages
#[derive(Debug, Serialize)]
pub struct BridgeSessionWithMessages {
    pub id: Uuid,
    pub environment_id: Uuid,
    pub machine_name: String,
    pub directory: String,
    pub branch: Option<String>,
    pub git_repo_url: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<BridgeMessageResponse>,
    pub total_messages: i64,
    pub has_more: bool,
}
```

---

## Task 4: CLI-facing bridge routes (/v1/environments/bridge)

**Files:**
- Create: `backend-rust/src/routes/bridge.rs`

This file implements the endpoints the CLI's `bridgeApi.ts` calls:

1. `POST /v1/environments/bridge` — register environment
   - Auth: Bearer token (JWT or API key)
   - Creates `bridge_environments` row with generated secret
   - Returns `{ environment_id, environment_secret }`

2. `GET /v1/environments/:id/work/poll` — poll for work
   - Auth: environment_secret header
   - Returns oldest pending work item, or empty 200

3. `POST /v1/environments/:id/work/:work_id/ack` — acknowledge work
   - Updates work state to 'acknowledged'

4. `POST /v1/environments/:id/work/:work_id/heartbeat` — heartbeat
   - Updates `last_heartbeat_at`, returns lease info

5. `POST /v1/environments/:id/work/:work_id/stop` — complete work with result
   - Stores result in work_queue, marks completed
   - Creates assistant message in bridge_messages

6. `DELETE /v1/environments/bridge/:id` — deregister
   - Marks environment as 'offline', or deletes it

Use `AuthUser` or `ApiKeyUser` extractor — the CLI sends either JWT or API key via Bearer header. Validate that the environment belongs to the authenticated user.

---

## Task 5: Web-facing code routes (/code/sessions)

**Files:**
- Create: `backend-rust/src/routes/code.rs`

This file implements the endpoints the web app's `api-code.ts` calls:

1. `GET /code/sessions` — list environments for user's org
   - Auth: JWT Bearer
   - Query: `SELECT * FROM bridge_environments WHERE organization_id = $1 ORDER BY created_at DESC`
   - Auto-mark environments as 'offline' if `last_heartbeat_at` > 60s ago

2. `GET /code/sessions/:id` — get environment with messages
   - Auth: JWT Bearer, verify org membership
   - Paginated messages (limit/offset query params)
   - Returns `BridgeSessionWithMessages`

3. `POST /code/sessions/:id/messages` — send message to CLI
   - Auth: JWT Bearer, verify org membership
   - Store user message in `bridge_messages`
   - Create work item in `bridge_work_queue` with the message content
   - Return SSE stream that:
     - Emits `data: {"type":"processing"}` immediately
     - Polls `bridge_work_queue` for the work item to be completed (every 500ms)
     - When completed, reads the result and streams it as token events
     - Emits `data: {"type":"done"}` at the end
   - Timeout after 120 seconds

4. `DELETE /code/sessions/:id` — disconnect environment
   - Auth: JWT Bearer, verify org membership
   - Sets environment status to 'offline'

---

## Task 6: Register routes in router

**Files:**
- Modify: `backend-rust/src/routes/mod.rs`

Add:
```rust
pub mod bridge;
pub mod code;
```

In `create_router()`:
```rust
        .nest("/v1/environments", bridge::bridge_routes())
        .nest("/api/v1/code", code::code_routes())
```

Note: bridge routes use `/v1/` (no `/api/` prefix) to match CLI expectations.

---

## Task 7: Commit and push

```bash
cd vmira
git add backend-rust/
git commit -m "feat: bridge session backend — environment registration, work polling, message relay

- Migration 017: bridge_environments, bridge_messages, bridge_work_queue
- CLI routes: POST /v1/environments/bridge (register), GET .../work/poll,
  POST .../work/ack, POST .../work/heartbeat, DELETE (deregister)
- Web routes: GET /code/sessions (list), GET /code/sessions/:id (detail),
  POST /code/sessions/:id/messages (send + SSE stream), DELETE (disconnect)
- Org-scoped: environments tied to user's active organization
- Heartbeat-based liveness: auto-offline after 60s"
git push
```
