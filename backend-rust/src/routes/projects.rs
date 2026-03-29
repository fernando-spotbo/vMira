//! Project CRUD routes — named groups for organizing conversations.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use chrono::Utc;
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::Project;
use crate::schema::{ProjectCreate, ProjectResponse, ProjectUpdate};

// ═══════════════════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════════════════

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_projects).post(create_project))
        .route(
            "/{project_id}",
            get(get_project)
                .patch(update_project)
                .delete(delete_project),
        )
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

fn project_response(p: &Project) -> ProjectResponse {
    ProjectResponse {
        id: p.id,
        name: p.name.clone(),
        emoji: p.emoji.clone(),
        sort_order: p.sort_order,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /projects
// ═══════════════════════════════════════════════════════════════════════════

async fn list_projects(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<ProjectResponse>>, AppError> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC"
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(projects.iter().map(project_response).collect()))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /projects
// ═══════════════════════════════════════════════════════════════════════════

async fn create_project(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<ProjectCreate>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    // Limit projects per user
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM projects WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    if count >= 50 {
        return Err(AppError::BadRequest("Maximum 50 projects reached".to_string()));
    }

    // Next sort_order
    let max_order: Option<i32> = sqlx::query_scalar(
        "SELECT MAX(sort_order) FROM projects WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    let now = Utc::now();
    let project = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (id, user_id, name, emoji, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind(&body.name)
    .bind(&body.emoji)
    .bind(max_order.unwrap_or(-1) + 1)
    .bind(now)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(project_response(&project))))
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /projects/:id
// ═══════════════════════════════════════════════════════════════════════════

async fn get_project(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<ProjectResponse>, AppError> {
    let project = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND user_id = $2"
    )
    .bind(project_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    Ok(Json(project_response(&project)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  PATCH /projects/:id
// ═══════════════════════════════════════════════════════════════════════════

async fn update_project(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(project_id): Path<Uuid>,
    Json(body): Json<ProjectUpdate>,
) -> Result<Json<ProjectResponse>, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let project = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND user_id = $2"
    )
    .bind(project_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    let name = body.name.as_deref().unwrap_or(&project.name);
    let emoji = body.emoji.as_ref().map(|e| e.as_str()).unwrap_or(project.emoji.as_deref().unwrap_or(""));
    let emoji_opt = if emoji.is_empty() { None } else { Some(emoji) };
    let sort_order = body.sort_order.unwrap_or(project.sort_order);

    let updated = sqlx::query_as::<_, Project>(
        "UPDATE projects SET name = $1, emoji = $2, sort_order = $3, updated_at = $4
         WHERE id = $5
         RETURNING *"
    )
    .bind(name)
    .bind(emoji_opt)
    .bind(sort_order)
    .bind(Utc::now())
    .bind(project_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(project_response(&updated)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /projects/:id
// ═══════════════════════════════════════════════════════════════════════════

async fn delete_project(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Verify ownership
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND user_id = $2)"
    )
    .bind(project_id)
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(AppError::NotFound("Project not found".to_string()));
    }

    // Conversations with this project_id will get SET NULL (FK constraint)
    sqlx::query("DELETE FROM projects WHERE id = $1")
        .bind(project_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
