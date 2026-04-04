//! Project CRUD routes — named groups for organizing conversations.
//! Includes project file management (upload, list, delete).

use std::path::PathBuf;

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use chrono::Utc;
use tokio::fs;
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{Project, ProjectFile};
use crate::schema::{ProjectCreate, ProjectFileResponse, ProjectResponse, ProjectUpdate};

// ═══════════════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════════════

const PROJECT_FILE_ALLOWED_MIMES: &[&str] = &[
    "application/pdf",
    "text/plain",
];

/// Maximum total file storage per project (50 MB)
const MAX_PROJECT_STORAGE_BYTES: i64 = 50 * 1024 * 1024;

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
        .route(
            "/{project_id}/files",
            get(list_project_files).post(upload_project_file),
        )
        .route(
            "/{project_id}/files/{file_id}",
            axum::routing::delete(delete_project_file),
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
        instructions: p.instructions.clone(),
        sort_order: p.sort_order,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

fn project_file_response(f: &ProjectFile) -> ProjectFileResponse {
    ProjectFileResponse {
        id: f.id,
        project_id: f.project_id,
        filename: f.filename.clone(),
        original_filename: f.original_filename.clone(),
        mime_type: f.mime_type.clone(),
        size_bytes: f.size_bytes,
        url: format!("/api/v1/chat/projects/{}/files/{}", f.project_id, f.id),
        created_at: f.created_at,
    }
}

fn extension_for_mime(mime: &str) -> &'static str {
    match mime {
        "application/pdf" => ".pdf",
        "text/plain" => ".txt",
        _ => "",
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /projects
// ═══════════════════════════════════════════════════════════════════════════

async fn list_projects(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<ProjectResponse>>, AppError> {
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let projects = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE organization_id = $1 ORDER BY sort_order ASC, created_at ASC"
    )
    .bind(org_id)
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

    // Limit projects per org
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM projects WHERE organization_id = $1"
    )
    .bind(org_id)
    .fetch_one(&state.db)
    .await?;

    if count >= 50 {
        return Err(AppError::BadRequest("Maximum 50 projects reached".to_string()));
    }

    // Next sort_order
    let max_order: Option<i32> = sqlx::query_scalar(
        "SELECT MAX(sort_order) FROM projects WHERE organization_id = $1"
    )
    .bind(org_id)
    .fetch_one(&state.db)
    .await?;

    let now = Utc::now();
    let project = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (id, user_id, organization_id, name, emoji, instructions, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind(org_id)
    .bind(&body.name)
    .bind(&body.emoji)
    .bind(&body.instructions)
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
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let project = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND organization_id = $2"
    )
    .bind(project_id)
    .bind(org_id)
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

    let org_id = user.active_organization_id.unwrap_or(user.id);
    let project = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND organization_id = $2"
    )
    .bind(project_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    let name = body.name.as_deref().unwrap_or(&project.name);
    let emoji = body.emoji.as_ref().map(|e| e.as_str()).unwrap_or(project.emoji.as_deref().unwrap_or(""));
    let emoji_opt = if emoji.is_empty() { None } else { Some(emoji) };
    let instructions = match &body.instructions {
        Some(instr) => Some(instr.as_str()),
        None => project.instructions.as_deref(),
    };
    let sort_order = body.sort_order.unwrap_or(project.sort_order);

    let updated = sqlx::query_as::<_, Project>(
        "UPDATE projects SET name = $1, emoji = $2, instructions = $3, sort_order = $4, updated_at = $5
         WHERE id = $6
         RETURNING *"
    )
    .bind(name)
    .bind(emoji_opt)
    .bind(instructions)
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
    // Verify ownership (org-scoped)
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND organization_id = $2)"
    )
    .bind(project_id)
    .bind(org_id)
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

// ═══════════════════════════════════════════════════════════════════════════
//  GET /projects/:id/files
// ═══════════════════════════════════════════════════════════════════════════

async fn list_project_files(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<ProjectFileResponse>>, AppError> {
    // Verify project ownership (org-scoped)
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let _project = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND organization_id = $2"
    )
    .bind(project_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    let files = sqlx::query_as::<_, ProjectFile>(
        "SELECT * FROM project_files WHERE project_id = $1 ORDER BY created_at ASC"
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(files.iter().map(project_file_response).collect()))
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /projects/:id/files  — upload file (multipart)
// ═══════════════════════════════════════════════════════════════════════════

async fn upload_project_file(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(project_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    // Verify project ownership (org-scoped)
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let _project = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND organization_id = $2"
    )
    .bind(project_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    // Limit files per project
    let file_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM project_files WHERE project_id = $1"
    )
    .bind(project_id)
    .fetch_one(&state.db)
    .await?;

    if file_count >= 50 {
        return Err(AppError::BadRequest(
            "Maximum 50 files per project".to_string(),
        ));
    }

    // Check total storage used by this project
    let total_storage: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(size_bytes), 0)::BIGINT FROM project_files WHERE project_id = $1"
    )
    .bind(project_id)
    .fetch_one(&state.db)
    .await?;

    if total_storage >= MAX_PROJECT_STORAGE_BYTES {
        return Err(AppError::BadRequest(format!(
            "Project storage limit reached ({} MB). Remove some files first.",
            MAX_PROJECT_STORAGE_BYTES / 1024 / 1024
        )));
    }

    // Ensure upload directory exists
    let upload_dir = PathBuf::from(&state.config.upload_dir).join("project_files");
    fs::create_dir_all(&upload_dir).await.map_err(|e| {
        tracing::error!(error = %e, "Failed to create project files upload directory");
        AppError::Internal("Storage error".to_string())
    })?;

    // Process multipart
    let mut results: Vec<ProjectFileResponse> = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Invalid multipart data: {e}")))?
    {
        let field_name = field.name().unwrap_or("").to_string();
        if field_name != "file" {
            continue;
        }

        if !results.is_empty() {
            return Err(AppError::BadRequest(
                "Only one file per upload allowed".to_string(),
            ));
        }

        let original_filename = field
            .file_name()
            .unwrap_or("upload")
            .to_string();

        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        // Validate MIME type (PDF and text only for project reference files)
        if !PROJECT_FILE_ALLOWED_MIMES.contains(&content_type.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Unsupported file type: {}. Allowed: {}",
                content_type,
                PROJECT_FILE_ALLOWED_MIMES.join(", ")
            )));
        }

        // Read file data with size limit
        let data = field.bytes().await.map_err(|e| {
            AppError::BadRequest(format!("Failed to read file: {e}"))
        })?;

        let raw_size = data.len() as i64;
        let max_size = state.config.max_upload_size as i64;
        if raw_size > max_size {
            return Err(AppError::BadRequest(format!(
                "File too large: {} bytes (max {} bytes)",
                raw_size, max_size
            )));
        }

        if raw_size == 0 {
            return Err(AppError::BadRequest("Empty file".to_string()));
        }

        // Generate unique filename
        let file_id = Uuid::new_v4();
        let ext = extension_for_mime(&content_type);
        let stored_filename = format!("{}{}", file_id, ext);
        let storage_path = upload_dir.join(&stored_filename);

        // Write to disk
        fs::write(&storage_path, &data).await.map_err(|e| {
            tracing::error!(error = %e, path = %storage_path.display(), "Failed to write project file");
            AppError::Internal("Storage write error".to_string())
        })?;

        // Save to DB
        let project_file = sqlx::query_as::<_, ProjectFile>(
            "INSERT INTO project_files (id, project_id, filename, original_filename, mime_type, size_bytes, storage_path, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *"
        )
        .bind(file_id)
        .bind(project_id)
        .bind(&stored_filename)
        .bind(&original_filename)
        .bind(&content_type)
        .bind(raw_size)
        .bind(storage_path.to_string_lossy().as_ref())
        .bind(Utc::now())
        .fetch_one(&state.db)
        .await?;

        results.push(project_file_response(&project_file));
    }

    if results.is_empty() {
        return Err(AppError::BadRequest(
            "No file field found in request".to_string(),
        ));
    }

    Ok((StatusCode::CREATED, Json(results)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /projects/:id/files/:file_id
// ═══════════════════════════════════════════════════════════════════════════

async fn delete_project_file(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path((project_id, file_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    // Verify project ownership (org-scoped)
    let org_id = user.active_organization_id.unwrap_or(user.id);
    let _project = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1 AND organization_id = $2"
    )
    .bind(project_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    // Fetch the file record
    let file = sqlx::query_as::<_, ProjectFile>(
        "SELECT * FROM project_files WHERE id = $1 AND project_id = $2"
    )
    .bind(file_id)
    .bind(project_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("File not found".to_string()))?;

    // Delete from DB
    sqlx::query("DELETE FROM project_files WHERE id = $1")
        .bind(file_id)
        .execute(&state.db)
        .await?;

    // Remove file from disk (best-effort)
    let path = PathBuf::from(&file.storage_path);
    if let Err(e) = fs::remove_file(&path).await {
        tracing::warn!(error = %e, path = %path.display(), "Failed to remove project file from disk");
    }

    Ok(StatusCode::NO_CONTENT)
}
