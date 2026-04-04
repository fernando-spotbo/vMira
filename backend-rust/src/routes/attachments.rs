//! File upload and serving endpoints.
//!
//! Process-and-discard approach: files are processed on upload (text extracted,
//! image metadata captured), the extracted content is stored in the DB, and the
//! original file is never written to disk.
//!
//! POST /api/v1/chat/conversations/:conv_id/attachments  — upload & process
//! GET  /api/v1/attachments/:id                          — returns metadata only

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Serialize;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════

const ALLOWED_MIME_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
];

const IMAGE_MIME_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp", "image/gif"];

// ═══════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════

/// Routes nested under `/api/v1/chat/conversations/:conv_id/attachments`.
pub fn upload_routes() -> Router<AppState> {
    Router::new().route("/", post(upload_attachment))
}

/// Routes nested under `/api/v1/attachments`.
pub fn serve_routes() -> Router<AppState> {
    Router::new().route("/{attachment_id}", get(get_attachment_meta))
}

// ═══════════════════════════════════════════════════════════════
//  DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct AttachmentResponse {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub message_id: Option<Uuid>,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub compressed_size: Option<i64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub url: String,
    pub created_at: chrono::DateTime<Utc>,
}

// ═══════════════════════════════════════════════════════════════
//  POST — upload, process, discard
// ═══════════════════════════════════════════════════════════════

async fn upload_attachment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(conv_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    // Verify conversation ownership
    let _conv = sqlx::query_as::<_, crate::models::Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND user_id = $2",
    )
    .bind(conv_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Conversation not found".to_string()))?;

    // Limit attachments per conversation
    let attachment_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM attachments WHERE conversation_id = $1")
            .bind(conv_id)
            .fetch_one(&state.db)
            .await?;

    if attachment_count >= 200 {
        return Err(AppError::BadRequest(
            "Maximum 200 attachments per conversation".to_string(),
        ));
    }

    const MAX_FILES_PER_UPLOAD: usize = 10;
    let mut results: Vec<AttachmentResponse> = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Invalid multipart data: {e}")))?
    {
        let field_name = field.name().unwrap_or("").to_string();
        if field_name != "file" {
            continue;
        }

        if results.len() >= MAX_FILES_PER_UPLOAD {
            return Err(AppError::BadRequest(format!(
                "Too many files. Maximum {} per upload.", MAX_FILES_PER_UPLOAD
            )));
        }

        let original_filename = field.file_name().unwrap_or("upload").to_string();
        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();

        if !ALLOWED_MIME_TYPES.contains(&content_type.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Unsupported file type: {}. Allowed: {}",
                content_type,
                ALLOWED_MIME_TYPES.join(", ")
            )));
        }

        let data = field.bytes().await.map_err(|e| {
            AppError::BadRequest(format!("Failed to read file: {e}"))
        })?;

        let raw_size = data.len() as i64;
        let max_size = state.config.max_upload_size as i64;
        if raw_size > max_size {
            return Err(AppError::BadRequest(format!(
                "File too large: {} bytes (max {} bytes)", raw_size, max_size
            )));
        }
        if raw_size == 0 {
            return Err(AppError::BadRequest("Empty file".to_string()));
        }

        let attachment_id = Uuid::new_v4();

        // ── Extract content from the file (process) ──
        let (extracted_content, width, height) = extract_content(&data, &content_type, &original_filename);

        // ── Save metadata + extracted content to DB (no file on disk) ──
        sqlx::query(
            "INSERT INTO attachments (id, conversation_id, user_id, filename, original_filename, \
             mime_type, size_bytes, compressed_size, storage_path, width, height, \
             extracted_content, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)"
        )
        .bind(attachment_id)
        .bind(conv_id)
        .bind(user.id)
        .bind(&original_filename) // filename = original (no stored file)
        .bind(&original_filename)
        .bind(&content_type)
        .bind(raw_size)
        .bind(None::<i64>) // no compression
        .bind("") // no storage_path — file is not stored
        .bind(width)
        .bind(height)
        .bind(&extracted_content)
        .bind(Utc::now())
        .execute(&state.db)
        .await?;

        results.push(AttachmentResponse {
            id: attachment_id,
            conversation_id: conv_id,
            message_id: None,
            filename: original_filename.clone(),
            original_filename,
            mime_type: content_type,
            size_bytes: raw_size,
            compressed_size: None,
            width,
            height,
            url: format!("/api/v1/attachments/{}", attachment_id),
            created_at: Utc::now(),
        });

        // ── Original file data is dropped here — never written to disk ──
    }

    if results.is_empty() {
        return Err(AppError::BadRequest("No file field found in request".to_string()));
    }

    Ok((StatusCode::CREATED, Json(results)))
}

// ═══════════════════════════════════════════════════════════════
//  GET — metadata only (no file download)
// ═══════════════════════════════════════════════════════════════

async fn get_attachment_meta(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(attachment_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query_as::<_, (Uuid, Uuid, Option<Uuid>, String, String, String, i64, Option<i64>, Option<i32>, Option<i32>, chrono::DateTime<Utc>)>(
        "SELECT a.id, a.conversation_id, a.message_id, a.filename, a.original_filename, \
         a.mime_type, a.size_bytes, a.compressed_size, a.width, a.height, a.created_at \
         FROM attachments a \
         JOIN conversations c ON c.id = a.conversation_id \
         WHERE a.id = $1 AND c.user_id = $2"
    )
    .bind(attachment_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Attachment not found".to_string()))?;

    Ok(Json(AttachmentResponse {
        id: row.0,
        conversation_id: row.1,
        message_id: row.2,
        filename: row.3,
        original_filename: row.4.clone(),
        mime_type: row.5,
        size_bytes: row.6,
        compressed_size: row.7,
        width: row.8,
        height: row.9,
        url: format!("/api/v1/attachments/{}", row.0),
        created_at: row.10,
    }))
}

// ═══════════════════════════════════════════════════════════════
//  Content extraction (process step)
// ═══════════════════════════════════════════════════════════════

/// Extract text/metadata from uploaded file. This is what the AI will see.
/// The original file is never stored — only the extracted content.
fn extract_content(data: &[u8], mime_type: &str, filename: &str) -> (String, Option<i32>, Option<i32>) {
    if IMAGE_MIME_TYPES.contains(&mime_type) {
        // Image: extract dimensions and metadata
        let size_kb = data.len() / 1024;
        let dims = image::io::Reader::new(std::io::Cursor::new(data))
            .with_guessed_format()
            .ok()
            .and_then(|r| {
                let (w, h) = r.into_dimensions().ok()?;
                Some((w, h))
            });
        let (w, h) = dims.unwrap_or((0, 0));
        let content = format!(
            "[Image: {} | {} | {}KB | {}×{}]",
            filename, mime_type, size_kb, w, h
        );
        (content, Some(w as i32), Some(h as i32))
    } else if mime_type == "application/pdf" {
        // PDF: extract text
        match pdf_extract::extract_text_from_mem(data) {
            Ok(text) => {
                let trimmed = text.trim();
                if trimmed.is_empty() {
                    (format!("[PDF: {} — could not extract text (possibly scanned)]", filename), None, None)
                } else {
                    let capped = if trimmed.len() > 32_000 {
                        format!("{}…\n[Truncated, total {} chars]", &trimmed[..32_000], trimmed.len())
                    } else {
                        trimmed.to_string()
                    };
                    (format!("Content of PDF '{}':\n\n{}", filename, capped), None, None)
                }
            }
            Err(e) => {
                tracing::warn!(file = %filename, error = %e, "PDF extraction failed");
                (format!("[PDF: {} — extraction error]", filename), None, None)
            }
        }
    } else if mime_type == "text/plain" {
        // Text file
        let text = String::from_utf8_lossy(data);
        let capped = if text.len() > 32_000 {
            format!("{}…\n[Truncated, total {} chars]", &text[..32_000], text.len())
        } else {
            text.to_string()
        };
        (format!("Content of file '{}':\n\n{}", filename, capped), None, None)
    } else {
        (format!("[File: {} — format {} not supported for analysis]", filename, mime_type), None, None)
    }
}
