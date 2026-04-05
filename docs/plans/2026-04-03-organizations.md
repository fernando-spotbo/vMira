# Organizations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add organizations to the platform so every user belongs to an org (personal org auto-created at signup), enabling the CLI bridge's `getOrganizationUUID()` requirement and laying the foundation for team workspaces.

**Architecture:** PostgreSQL migration adds `organizations` and `organization_members` tables plus `active_organization_id` on users. The Rust backend auto-creates a personal org on registration, backfills existing users, and exposes org data via `/auth/me` and new `/organizations` endpoints. The CLI reads `organization_id` from the user profile response and caches it. The web app stores it from the auth response.

**Tech Stack:** Rust (Axum, SQLx, PostgreSQL), TypeScript (Next.js, React), mira-cli (TypeScript/Node)

---

## Part 1: Database Migration

### Task 1: Create organizations migration

**Files:**
- Create: `backend-rust/migrations/016_organizations.sql`

**Step 1: Write the migration**

```sql
-- Organizations table
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL,
    slug            VARCHAR(128) NOT NULL UNIQUE,
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_personal     BOOLEAN NOT NULL DEFAULT false,
    plan            VARCHAR(32) NOT NULL DEFAULT 'free',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Organization members (join table with roles)
CREATE TABLE organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(32) NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- Add active_organization_id to users
ALTER TABLE users ADD COLUMN active_organization_id UUID REFERENCES organizations(id);

-- Backfill: create a personal org for every existing user
-- Uses DO block for row-by-row insert since we need per-user UUIDs
DO $$
DECLARE
    u RECORD;
    org_id UUID;
BEGIN
    FOR u IN SELECT id, name FROM users LOOP
        org_id := gen_random_uuid();

        INSERT INTO organizations (id, name, slug, owner_id, is_personal, plan)
        VALUES (org_id, u.name, 'personal-' || u.id::text, u.id, true, 'free');

        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (org_id, u.id, 'owner');

        UPDATE users SET active_organization_id = org_id WHERE id = u.id;
    END LOOP;
END $$;
```

**Step 2: Verify migration runs**

Run: `cd backend-rust && cargo sqlx migrate run` (or apply via your deployment pipeline)

---

## Part 2: Rust Backend — Models & Routes

### Task 2: Add Organization model

**Files:**
- Create: `backend-rust/src/models/organization.rs`
- Modify: `backend-rust/src/models/mod.rs`

**Step 1: Create the model**

```rust
// backend-rust/src/models/organization.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub owner_id: Uuid,
    pub is_personal: bool,
    pub plan: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OrganizationMember {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub created_at: DateTime<Utc>,
}
```

**Step 2: Register in mod.rs**

Add to `backend-rust/src/models/mod.rs`:

```rust
pub mod organization;
pub use organization::{Organization, OrganizationMember};
```

---

### Task 3: Add Organization DTOs to schema.rs

**Files:**
- Modify: `backend-rust/src/schema.rs`

**Step 1: Add DTOs**

Append to end of `schema.rs` before the shared validation regex section:

```rust
// ═══════════════════════════════════════════════════════════════
//  Organization DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Validate)]
pub struct CreateOrganizationRequest {
    #[validate(length(min = 1, max = 128))]
    pub name: String,

    #[validate(length(min = 1, max = 128), regex(path = *SLUG_RE))]
    pub slug: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateOrganizationRequest {
    #[validate(length(min = 1, max = 128))]
    pub name: Option<String>,

    #[validate(length(min = 1, max = 128), regex(path = *SLUG_RE))]
    pub slug: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct InviteMemberRequest {
    pub user_id: Uuid,

    #[validate(custom(function = "validate_org_role"))]
    #[serde(default = "default_member_role")]
    pub role: String,
}

fn default_member_role() -> String {
    "member".to_string()
}

fn validate_org_role(role: &str) -> Result<(), validator::ValidationError> {
    match role {
        "owner" | "admin" | "member" => Ok(()),
        _ => {
            let mut err = validator::ValidationError::new("role");
            err.message = Some("Role must be 'owner', 'admin', or 'member'".into());
            Err(err)
        }
    }
}

#[derive(Debug, Serialize)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub owner_id: Uuid,
    pub is_personal: bool,
    pub plan: String,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct OrganizationMemberResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: Option<String>,
    pub role: String,
    pub created_at: DateTime<Utc>,
}
```

Also add the slug regex to the shared validation section at the bottom:

```rust
static SLUG_RE: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$").expect("valid regex"));
```

---

### Task 4: Update UserResponse to include organization_id

**Files:**
- Modify: `backend-rust/src/schema.rs` (UserResponse struct)
- Modify: `backend-rust/src/routes/auth.rs` (user_response helper)
- Modify: `backend-rust/src/models/user.rs` (User struct)

**Step 1: Add field to User model**

Add to `User` struct in `models/user.rs`:

```rust
    pub active_organization_id: Option<Uuid>,
```

**Step 2: Add field to UserResponse**

Add to `UserResponse` in `schema.rs`:

```rust
    pub organization_id: Option<Uuid>,
```

**Step 3: Update user_response helper**

In `routes/auth.rs`, update `user_response()` to include:

```rust
    organization_id: user.active_organization_id,
```

---

### Task 5: Auto-create personal org on registration

**Files:**
- Modify: `backend-rust/src/routes/auth.rs` (register handler, ~line 272-299)

**Step 1: After user INSERT, create personal org + membership + set active_organization_id**

After the `sqlx::query_as::<_, User>(INSERT INTO users ...)` block (after line 287), add:

```rust
    // Create personal organization
    let org_id = Uuid::new_v4();
    let org_slug = format!("personal-{}", user_id);

    sqlx::query(
        "INSERT INTO organizations (id, name, slug, owner_id, is_personal, plan)
         VALUES ($1, $2, $3, $4, true, 'free')"
    )
    .bind(org_id)
    .bind(&body.name)
    .bind(&org_slug)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    sqlx::query(
        "INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')"
    )
    .bind(org_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    // Set as active organization
    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET active_organization_id = $1 WHERE id = $2 RETURNING *"
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;
```

Note: the variable `user` gets reassigned here — the original `let user = ...` should become `let mut user = ...` or this block should shadow it.

Also do the same for all OAuth registration paths (vk_auth, yandex_auth, google_auth, phone_verify) — search for `INSERT INTO users` in auth.rs and add the org creation after each.

---

### Task 6: Create organizations routes

**Files:**
- Create: `backend-rust/src/routes/organizations.rs`
- Modify: `backend-rust/src/routes/mod.rs`

**Step 1: Create the routes file**

```rust
//! Organization management routes.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, patch},
    Json, Router,
};
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{Organization, OrganizationMember};
use crate::schema::{
    CreateOrganizationRequest, UpdateOrganizationRequest, InviteMemberRequest,
    OrganizationResponse, OrganizationMemberResponse,
};

pub fn organization_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_orgs).post(create_org))
        .route("/{id}", get(get_org).patch(update_org))
        .route("/{id}/members", get(list_members).post(add_member))
        .route("/{id}/members/{user_id}", delete(remove_member))
}

async fn list_orgs(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<OrganizationResponse>>, AppError> {
    let orgs = sqlx::query_as::<_, Organization>(
        "SELECT o.* FROM organizations o
         JOIN organization_members om ON om.organization_id = o.id
         WHERE om.user_id = $1
         ORDER BY o.is_personal DESC, o.name ASC"
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let mut responses = Vec::with_capacity(orgs.len());
    for org in &orgs {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM organization_members WHERE organization_id = $1"
        )
        .bind(org.id)
        .fetch_one(&state.db)
        .await?;

        responses.push(org_response(org, count));
    }

    Ok(Json(responses))
}

async fn create_org(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<CreateOrganizationRequest>,
) -> Result<(StatusCode, Json<OrganizationResponse>), AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    // Check slug uniqueness
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organizations WHERE slug = $1"
    )
    .bind(&body.slug)
    .fetch_one(&state.db)
    .await?;

    if exists > 0 {
        return Err(AppError::Conflict("Organization slug already taken".to_string()));
    }

    let org_id = Uuid::new_v4();
    let org = sqlx::query_as::<_, Organization>(
        "INSERT INTO organizations (id, name, slug, owner_id, is_personal, plan)
         VALUES ($1, $2, $3, $4, false, 'free')
         RETURNING *"
    )
    .bind(org_id)
    .bind(&body.name)
    .bind(&body.slug)
    .bind(user.id)
    .execute(&state.db)
    .await;

    let org = sqlx::query_as::<_, Organization>(
        "SELECT * FROM organizations WHERE id = $1"
    )
    .bind(org_id)
    .fetch_one(&state.db)
    .await?;

    // Add creator as owner
    sqlx::query(
        "INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')"
    )
    .bind(org_id)
    .bind(user.id)
    .execute(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(org_response(&org, 1))))
}

async fn get_org(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<OrganizationResponse>, AppError> {
    // Verify membership
    ensure_member(&state, id, user.id).await?;

    let org = sqlx::query_as::<_, Organization>(
        "SELECT * FROM organizations WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Organization not found".to_string()))?;

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organization_members WHERE organization_id = $1"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(org_response(&org, count)))
}

async fn update_org(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOrganizationRequest>,
) -> Result<Json<OrganizationResponse>, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;
    ensure_owner_or_admin(&state, id, user.id).await?;

    if let Some(ref slug) = body.slug {
        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM organizations WHERE slug = $1 AND id != $2"
        )
        .bind(slug)
        .bind(id)
        .fetch_one(&state.db)
        .await?;
        if exists > 0 {
            return Err(AppError::Conflict("Slug already taken".to_string()));
        }
    }

    sqlx::query(
        "UPDATE organizations SET
            name = COALESCE($1, name),
            slug = COALESCE($2, slug),
            updated_at = now()
         WHERE id = $3"
    )
    .bind(body.name.as_deref())
    .bind(body.slug.as_deref())
    .bind(id)
    .execute(&state.db)
    .await?;

    get_org(State(state), AuthUser(user), Path(id)).await
}

async fn list_members(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<OrganizationMemberResponse>>, AppError> {
    ensure_member(&state, id, user.id).await?;

    let members = sqlx::query_as::<_, (Uuid, Uuid, String, Option<String>, String, chrono::DateTime<chrono::Utc>)>(
        "SELECT om.id, om.user_id, u.name, u.email, om.role, om.created_at
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = $1
         ORDER BY om.created_at ASC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let responses: Vec<OrganizationMemberResponse> = members
        .into_iter()
        .map(|(mid, uid, name, email, role, created_at)| OrganizationMemberResponse {
            id: mid,
            user_id: uid,
            name,
            email,
            role,
            created_at,
        })
        .collect();

    Ok(Json(responses))
}

async fn add_member(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<InviteMemberRequest>,
) -> Result<(StatusCode, Json<OrganizationMemberResponse>), AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;
    ensure_owner_or_admin(&state, id, user.id).await?;

    // Check user exists
    let target = sqlx::query_as::<_, crate::models::User>(
        "SELECT * FROM users WHERE id = $1"
    )
    .bind(body.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Check not already a member
    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(body.user_id)
    .fetch_one(&state.db)
    .await?;

    if existing > 0 {
        return Err(AppError::Conflict("User is already a member".to_string()));
    }

    let member_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO organization_members (id, organization_id, user_id, role)
         VALUES ($1, $2, $3, $4)"
    )
    .bind(member_id)
    .bind(id)
    .bind(body.user_id)
    .bind(&body.role)
    .execute(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(OrganizationMemberResponse {
        id: member_id,
        user_id: body.user_id,
        name: target.name,
        email: target.email,
        role: body.role,
        created_at: chrono::Utc::now(),
    })))
}

async fn remove_member(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    ensure_owner_or_admin(&state, id, user.id).await?;

    // Can't remove the owner
    let org = sqlx::query_as::<_, Organization>(
        "SELECT * FROM organizations WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Organization not found".to_string()))?;

    if org.owner_id == target_user_id {
        return Err(AppError::Unprocessable("Cannot remove the organization owner".to_string()));
    }

    sqlx::query(
        "DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(target_user_id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Helpers ──

fn org_response(org: &Organization, member_count: i64) -> OrganizationResponse {
    OrganizationResponse {
        id: org.id,
        name: org.name.clone(),
        slug: org.slug.clone(),
        owner_id: org.owner_id,
        is_personal: org.is_personal,
        plan: org.plan.clone(),
        member_count,
        created_at: org.created_at,
        updated_at: org.updated_at,
    }
}

async fn ensure_member(state: &AppState, org_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let is_member: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND user_id = $2"
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    if is_member == 0 {
        return Err(AppError::Forbidden("Not a member of this organization".to_string()));
    }
    Ok(())
}

async fn ensure_owner_or_admin(state: &AppState, org_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2"
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    match role.as_deref() {
        Some("owner") | Some("admin") => Ok(()),
        Some(_) => Err(AppError::Forbidden("Requires owner or admin role".to_string())),
        None => Err(AppError::Forbidden("Not a member of this organization".to_string())),
    }
}
```

**Step 2: Register in mod.rs and router**

Add to `routes/mod.rs`:
```rust
pub mod organizations;
```

Add to `routes/mod.rs` `create_router()`:
```rust
        .nest("/api/v1/organizations", organizations::organization_routes())
```

---

### Task 7: Add org switching to PATCH /me

**Files:**
- Modify: `backend-rust/src/schema.rs` (UpdateUserRequest)
- Modify: `backend-rust/src/routes/auth.rs` (update_me handler)

**Step 1: Add active_organization_id to UpdateUserRequest**

```rust
pub struct UpdateUserRequest {
    // ... existing fields ...
    pub active_organization_id: Option<Uuid>,
}
```

**Step 2: In update_me handler, validate org membership before switching**

When `active_organization_id` is provided, check the user is a member before updating.

---

## Part 3: CLI — Wire getOrganizationUUID

### Task 8: Make getOrganizationUUID fetch from /auth/me

**Files:**
- Modify: `cli/mira-code/services/oauth/client.ts`
- Modify: `cli/mira-code/bridge/bridgeConfig.ts`
- Modify: `cli/mira-code/bridge/initReplBridge.ts`

**Step 1: Update getOrganizationUUID to fetch from API**

Replace the stub in `services/oauth/client.ts`:

```typescript
export async function getOrganizationUUID(): Promise<string | null> {
  // Try cached value first
  const cached = getCachedOrgUUID()
  if (cached) return cached

  // Fetch from /auth/me using the bridge access token
  try {
    const { getBridgeAccessToken, getBridgeBaseUrl } = await import('../bridge/bridgeConfig.js')
    const token = getBridgeAccessToken()
    if (!token) return null

    const baseUrl = getBridgeBaseUrl()
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return null

    const data = await res.json()
    const orgId = data.organization_id
    if (orgId) {
      cacheOrgUUID(orgId)
      return orgId
    }
    return null
  } catch {
    return null
  }
}

let _cachedOrgUUID: string | null = null

function getCachedOrgUUID(): string | null {
  return _cachedOrgUUID
}

function cacheOrgUUID(uuid: string): void {
  _cachedOrgUUID = uuid
}
```

**Step 2: Skip OAuth refresh when using API key**

In `bridge/initReplBridge.ts`, update the condition at line 168:

```typescript
  if (!getBridgeTokenOverride() && getMiraAIOAuthTokens()) {
    // OAuth-specific refresh logic...
  }
```

This adds `&& getMiraAIOAuthTokens()` — when the user has no OAuth tokens (API key auth), skip the entire OAuth refresh block.

---

## Part 4: Web App — Store org from auth response

### Task 9: Update AuthContext to store organization_id

**Files:**
- Modify: `vmira/src/context/AuthContext.tsx`

**Step 1: Add organization_id to User interface**

Add `organization_id?: string | null` to the user type in AuthContext (wherever the user interface is defined).

**Step 2: No other changes needed**

The field comes from `/auth/me` response automatically.

---

## Part 5: Proxy allowlist

### Task 10: Add organizations/ to proxy allowlist

**Files:**
- Modify: `vmira/src/app/api/proxy/[...path]/route.ts`

**Step 1: Add organizations/ to allowlist**

Find the allowlisted prefixes array and add `"organizations/"`.

---

## Part 6: Build, test, commit

### Task 11: Rebuild CLI and push all repos

**Step 1: Rebuild mira CLI**
```bash
cd cli/mira-code && npm run build
```

**Step 2: Commit backend**
```bash
cd vmira && git add backend-rust/ && git commit -m "feat: add organizations — tables, model, routes, auto-create on signup"
```

**Step 3: Commit CLI**
```bash
cd cli && git add mira-code/ && git commit -m "feat: getOrganizationUUID fetches from /auth/me, skip OAuth refresh for API key auth"
```

**Step 4: Commit web app**
```bash
cd vmira && git add src/ && git commit -m "feat: store organization_id from auth, add organizations to proxy allowlist"
```

**Step 5: Push all**
```bash
cd vmira && git push
cd cli && git push
```
