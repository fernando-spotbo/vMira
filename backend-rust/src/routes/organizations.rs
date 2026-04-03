//! Organization CRUD routes and member management.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, patch, post},
    Json, Router,
};
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{Organization, OrganizationMember};
use crate::schema::{
    CreateOrganizationRequest, InviteMemberRequest, OrganizationMemberResponse,
    OrganizationResponse, UpdateOrganizationRequest,
};

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn organization_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_organizations).post(create_organization))
        .route(
            "/{id}",
            get(get_organization).patch(update_organization),
        )
        .route(
            "/{id}/members",
            get(list_members).post(add_member),
        )
        .route("/{id}/members/{user_id}", delete(remove_member))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

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

/// Verify that the user is a member of the organization.
async fn ensure_member(state: &AppState, org_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let is_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2)",
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden(
            "You are not a member of this organization".to_string(),
        ));
    }
    Ok(())
}

/// Verify that the user is an owner or admin of the organization.
async fn ensure_owner_or_admin(
    state: &AppState,
    org_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    match role.as_deref() {
        Some("owner") | Some("admin") => Ok(()),
        Some(_) => Err(AppError::Forbidden(
            "Owner or admin role required".to_string(),
        )),
        None => Err(AppError::Forbidden(
            "You are not a member of this organization".to_string(),
        )),
    }
}

/// Get the member count for an organization.
async fn member_count(state: &AppState, org_id: Uuid) -> Result<i64, AppError> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organization_members WHERE organization_id = $1",
    )
    .bind(org_id)
    .fetch_one(&state.db)
    .await?;

    Ok(count)
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /  — list user's organizations
// ═══════════════════════════════════════════════════════════════════════════

async fn list_organizations(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<OrganizationResponse>>, AppError> {
    // Single query with subquery for member_count (avoids N+1)
    let rows = sqlx::query_as::<_, (Uuid, String, String, Uuid, bool, String, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>, i64)>(
        "SELECT o.id, o.name, o.slug, o.owner_id, o.is_personal, o.plan, o.created_at, o.updated_at,
                (SELECT COUNT(*) FROM organization_members om2 WHERE om2.organization_id = o.id) AS member_count
         FROM organizations o
         JOIN organization_members om ON om.organization_id = o.id
         WHERE om.user_id = $1
         ORDER BY o.is_personal DESC, o.created_at ASC",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let response: Vec<OrganizationResponse> = rows
        .into_iter()
        .map(|(id, name, slug, owner_id, is_personal, plan, created_at, updated_at, mc)| {
            OrganizationResponse {
                id, name, slug, owner_id, is_personal, plan,
                member_count: mc,
                created_at, updated_at,
            }
        })
        .collect();

    Ok(Json(response))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /  — create new organization
// ═══════════════════════════════════════════════════════════════════════════

async fn create_organization(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<CreateOrganizationRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Unprocessable(e.to_string()))?;

    // Limit organizations per user
    let org_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM organizations WHERE owner_id = $1"
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    if org_count >= 10 {
        return Err(AppError::Forbidden("Organization limit reached (max 10)".to_string()));
    }

    // Check slug uniqueness
    let slug_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM organizations WHERE slug = $1)",
    )
    .bind(&body.slug)
    .fetch_one(&state.db)
    .await?;

    if slug_exists {
        return Err(AppError::Conflict(
            "Organization slug already taken".to_string(),
        ));
    }

    let now = chrono::Utc::now();
    let org_id = Uuid::new_v4();

    let mut tx = state.db.begin().await?;

    sqlx::query(
        "INSERT INTO organizations (id, name, slug, owner_id, is_personal, plan, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, 'free', $5, $5)",
    )
    .bind(org_id)
    .bind(&body.name)
    .bind(&body.slug)
    .bind(user.id)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    // Add creator as owner member
    sqlx::query(
        "INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
         VALUES ($1, $2, $3, 'owner', $4)",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind(user.id)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Fetch the created org for the response
    let org = sqlx::query_as::<_, Organization>(
        "SELECT * FROM organizations WHERE id = $1",
    )
    .bind(org_id)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(org_response(&org, 1))))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /{id}  — get organization details
// ═══════════════════════════════════════════════════════════════════════════

async fn get_organization(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<OrganizationResponse>, AppError> {
    ensure_member(&state, id, user.id).await?;

    let org = sqlx::query_as::<_, Organization>(
        "SELECT * FROM organizations WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Organization not found".to_string()))?;

    let count = member_count(&state, org.id).await?;
    Ok(Json(org_response(&org, count)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  PATCH /{id}  — update org name/slug (owner/admin only)
// ═══════════════════════════════════════════════════════════════════════════

async fn update_organization(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOrganizationRequest>,
) -> Result<Json<OrganizationResponse>, AppError> {
    body.validate()
        .map_err(|e| AppError::Unprocessable(e.to_string()))?;

    ensure_owner_or_admin(&state, id, user.id).await?;

    // Personal organizations cannot be renamed/re-slugged
    let org = sqlx::query_as::<_, Organization>(
        "SELECT * FROM organizations WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Organization not found".to_string()))?;

    if org.is_personal {
        return Err(AppError::Forbidden("Personal organizations cannot be modified".to_string()));
    }

    // If slug is being changed, check uniqueness
    if let Some(ref new_slug) = body.slug {
        if new_slug != &org.slug {
            let slug_exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM organizations WHERE slug = $1 AND id != $2)",
            )
            .bind(new_slug)
            .bind(id)
            .fetch_one(&state.db)
            .await?;

            if slug_exists {
                return Err(AppError::Conflict(
                    "Organization slug already taken".to_string(),
                ));
            }
        }
    }

    let name = body.name.as_deref().unwrap_or(&org.name);
    let slug = body.slug.as_deref().unwrap_or(&org.slug);

    let updated = sqlx::query_as::<_, Organization>(
        "UPDATE organizations SET name = $1, slug = $2, updated_at = $3 WHERE id = $4 RETURNING *",
    )
    .bind(name)
    .bind(slug)
    .bind(chrono::Utc::now())
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let count = member_count(&state, updated.id).await?;
    Ok(Json(org_response(&updated, count)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /{id}/members  — list members with user names
// ═══════════════════════════════════════════════════════════════════════════

async fn list_members(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<OrganizationMemberResponse>>, AppError> {
    ensure_member(&state, id, user.id).await?;

    // Check if caller is owner/admin (they see full emails; members see masked)
    let caller_role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let can_see_emails = matches!(caller_role.as_deref(), Some("owner") | Some("admin"));

    let rows = sqlx::query_as::<_, (Uuid, Uuid, String, Option<String>, String, chrono::DateTime<chrono::Utc>)>(
        "SELECT om.id, om.user_id, u.name, u.email, om.role, om.created_at
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = $1
         ORDER BY om.created_at ASC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let response: Vec<OrganizationMemberResponse> = rows
        .into_iter()
        .map(|(member_id, member_user_id, name, email, role, created_at)| {
            // Mask email for non-admin callers (privacy / 152-FZ)
            let masked_email = if can_see_emails || member_user_id == user.id {
                email
            } else {
                email.map(|e| mask_email(&e))
            };
            OrganizationMemberResponse {
                id: member_id,
                user_id: member_user_id,
                name,
                email: masked_email,
                role,
                created_at,
            }
        })
        .collect();

    Ok(Json(response))
}

/// Mask an email address for non-privileged viewers: "us***@example.com"
fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let visible = if local.len() <= 2 { local.len() } else { 2 };
            format!("{}***@{}", &local[..visible], domain)
        }
        None => "***".to_string(),
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /{id}/members  — add member (owner/admin only)
// ═══════════════════════════════════════════════════════════════════════════

async fn add_member(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<InviteMemberRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate()
        .map_err(|e| AppError::Unprocessable(e.to_string()))?;

    ensure_owner_or_admin(&state, id, user.id).await?;

    // Verify the organization exists
    let _org = sqlx::query_as::<_, Organization>(
        "SELECT * FROM organizations WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Organization not found".to_string()))?;

    // Verify the target user exists
    let _target_user: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)",
    )
    .bind(body.user_id)
    .fetch_one(&state.db)
    .await?;

    if !_target_user {
        return Err(AppError::NotFound("User not found".to_string()));
    }

    // Check if already a member
    let already_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2)",
    )
    .bind(id)
    .bind(body.user_id)
    .fetch_one(&state.db)
    .await?;

    if already_member {
        return Err(AppError::Conflict(
            "User is already a member of this organization".to_string(),
        ));
    }

    // Cannot add someone as owner (there should be only one owner)
    if body.role == "owner" {
        return Err(AppError::Unprocessable(
            "Cannot add a member with owner role".to_string(),
        ));
    }

    // Only the owner can grant admin role
    if body.role == "admin" {
        let org = sqlx::query_as::<_, Organization>(
            "SELECT * FROM organizations WHERE id = $1"
        )
        .bind(id)
        .fetch_one(&state.db)
        .await?;

        if org.owner_id != user.id {
            return Err(AppError::Forbidden("Only the owner can assign the admin role".to_string()));
        }
    }

    let now = chrono::Utc::now();
    let member = sqlx::query_as::<_, OrganizationMember>(
        "INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(body.user_id)
    .bind(&body.role)
    .bind(now)
    .fetch_one(&state.db)
    .await?;

    // Fetch the user's name/email for the response
    let (name, email): (String, Option<String>) = sqlx::query_as(
        "SELECT name, email FROM users WHERE id = $1",
    )
    .bind(body.user_id)
    .fetch_one(&state.db)
    .await?;

    let response = OrganizationMemberResponse {
        id: member.id,
        user_id: member.user_id,
        name,
        email,
        role: member.role,
        created_at: member.created_at,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /{id}/members/{user_id}  — remove member (owner/admin only)
// ═══════════════════════════════════════════════════════════════════════════

async fn remove_member(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    ensure_owner_or_admin(&state, id, user.id).await?;

    // Fetch the member record
    let member = sqlx::query_as::<_, OrganizationMember>(
        "SELECT * FROM organization_members WHERE organization_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(target_user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    // Cannot remove the owner
    if member.role == "owner" {
        return Err(AppError::Forbidden(
            "Cannot remove the organization owner".to_string(),
        ));
    }

    sqlx::query("DELETE FROM organization_members WHERE id = $1")
        .bind(member.id)
        .execute(&state.db)
        .await?;

    // If removed user's active org was this one, switch to their personal org
    sqlx::query(
        "UPDATE users SET active_organization_id = (
            SELECT o.id FROM organizations o
            JOIN organization_members om ON om.organization_id = o.id
            WHERE om.user_id = $1 AND o.is_personal = true
            LIMIT 1
        ) WHERE id = $1 AND active_organization_id = $2"
    )
    .bind(target_user_id)
    .bind(id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
