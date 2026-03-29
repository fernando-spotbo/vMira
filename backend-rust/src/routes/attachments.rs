//! File upload and serving endpoints.
//!
//! POST /api/v1/chat/conversations/:conv_id/attachments  — upload file
//! GET  /api/v1/attachments/:id                          — serve file

use std::path::PathBuf;

use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Serialize;
use tokio::fs;
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::Attachment;

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

/// Max dimension for image compression (pixels).
const MAX_IMAGE_DIM: u32 = 1024;

// ═══════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════

/// Routes nested under `/api/v1/chat/conversations/:conv_id/attachments`.
pub fn upload_routes() -> Router<AppState> {
    Router::new().route("/", post(upload_attachment))
}

/// Routes nested under `/api/v1/attachments`.
pub fn serve_routes() -> Router<AppState> {
    Router::new().route("/{attachment_id}", get(serve_attachment))
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

fn attachment_response(a: &Attachment) -> AttachmentResponse {
    AttachmentResponse {
        id: a.id,
        conversation_id: a.conversation_id,
        message_id: a.message_id,
        filename: a.filename.clone(),
        original_filename: a.original_filename.clone(),
        mime_type: a.mime_type.clone(),
        size_bytes: a.size_bytes,
        compressed_size: a.compressed_size,
        width: a.width,
        height: a.height,
        url: format!("/api/v1/attachments/{}", a.id),
        created_at: a.created_at,
    }
}

// ═══════════════════════════════════════════════════════════════
//  POST — upload
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

    // Limit attachments per conversation to prevent abuse
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

    // Ensure upload directory exists
    let upload_dir = PathBuf::from(&state.config.upload_dir);
    fs::create_dir_all(&upload_dir).await.map_err(|e| {
        tracing::error!(error = %e, "Failed to create upload directory");
        AppError::Internal("Storage error".to_string())
    })?;

    // Process multipart — max 10 files per upload
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

        let original_filename = field
            .file_name()
            .unwrap_or("upload")
            .to_string();

        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        // Validate MIME type
        if !ALLOWED_MIME_TYPES.contains(&content_type.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Unsupported file type: {}. Allowed: {}",
                content_type,
                ALLOWED_MIME_TYPES.join(", ")
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
        let attachment_id = Uuid::new_v4();
        let ext = extension_for_mime(&content_type);
        let stored_filename = format!("{}{}", attachment_id, ext);
        let storage_path = upload_dir.join(&stored_filename);

        // Process image: resize + compress to WebP
        let (final_data, final_mime, width, height, compressed_size) =
            if IMAGE_MIME_TYPES.contains(&content_type.as_str()) {
                match compress_image(&data) {
                    Ok(result) => result,
                    Err(e) => {
                        tracing::warn!(error = %e, "Image compression failed, storing original");
                        (data.to_vec(), content_type.clone(), None, None, None)
                    }
                }
            } else {
                (data.to_vec(), content_type.clone(), None, None, None)
            };

        // Recompute filename with correct extension after compression
        let final_ext = extension_for_mime(&final_mime);
        let final_filename = format!("{}{}", attachment_id, final_ext);
        let final_path = upload_dir.join(&final_filename);

        // Write to disk
        fs::write(&final_path, &final_data).await.map_err(|e| {
            tracing::error!(error = %e, path = %final_path.display(), "Failed to write file");
            AppError::Internal("Storage write error".to_string())
        })?;

        let file_size = final_data.len() as i64;

        // Save to DB
        let attachment = sqlx::query_as::<_, Attachment>(
            "INSERT INTO attachments (id, conversation_id, user_id, filename, original_filename, mime_type, size_bytes, compressed_size, storage_path, width, height, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *",
        )
        .bind(attachment_id)
        .bind(conv_id)
        .bind(user.id)
        .bind(&final_filename)
        .bind(&original_filename)
        .bind(&final_mime)
        .bind(file_size)
        .bind(compressed_size.or(Some(raw_size)))
        .bind(final_path.to_string_lossy().as_ref())
        .bind(width)
        .bind(height)
        .bind(Utc::now())
        .fetch_one(&state.db)
        .await?;

        results.push(attachment_response(&attachment));
    }

    if results.is_empty() {
        return Err(AppError::BadRequest(
            "No file field found in request".to_string(),
        ));
    }

    Ok((StatusCode::CREATED, Json(results)))
}

// ═══════════════════════════════════════════════════════════════
//  GET — serve file
// ═══════════════════════════════════════════════════════════════

async fn serve_attachment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(attachment_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let attachment = sqlx::query_as::<_, Attachment>(
        "SELECT * FROM attachments WHERE id = $1",
    )
    .bind(attachment_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Attachment not found".to_string()))?;

    // Verify user owns the conversation
    let _conv = sqlx::query_as::<_, crate::models::Conversation>(
        "SELECT * FROM conversations WHERE id = $1 AND user_id = $2",
    )
    .bind(attachment.conversation_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Attachment not found".to_string()))?;

    // Read file — validate path is within upload directory to prevent path traversal
    let path = PathBuf::from(&attachment.storage_path);
    let canonical = path.canonicalize().map_err(|e| {
        tracing::error!(error = %e, path = %path.display(), "Failed to canonicalize attachment path");
        AppError::NotFound("Attachment not found".to_string())
    })?;
    let upload_dir = PathBuf::from(&state.config.upload_dir).canonicalize().map_err(|e| {
        tracing::error!(error = %e, "Upload directory not accessible");
        AppError::Internal("Storage configuration error".to_string())
    })?;
    if !canonical.starts_with(&upload_dir) {
        tracing::error!(path = %canonical.display(), upload_dir = %upload_dir.display(), "Path traversal attempt");
        return Err(AppError::NotFound("Attachment not found".to_string()));
    }

    let data = fs::read(&canonical).await.map_err(|e| {
        tracing::error!(error = %e, path = %canonical.display(), "Failed to read attachment");
        AppError::Internal("Storage read error".to_string())
    })?;

    let body = Body::from(data);

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, attachment.mime_type.clone()),
            (
                header::CACHE_CONTROL,
                "public, max-age=31536000, immutable".to_string(),
            ),
            (
                header::CONTENT_DISPOSITION,
                if IMAGE_MIME_TYPES.contains(&attachment.mime_type.as_str()) {
                    "inline".to_string()
                } else {
                    format!(
                        "attachment; filename=\"{}\"",
                        attachment.original_filename
                            .replace('"', "")
                            .replace('\r', "")
                            .replace('\n', "")
                            .replace('\0', "")
                    )
                },
            ),
        ],
        body,
    ))
}

// ═══════════════════════════════════════════════════════════════
//  Image compression
// ═══════════════════════════════════════════════════════════════

/// Resize image to max MAX_IMAGE_DIM, encode as WebP.
/// Returns (data, mime_type, width, height, compressed_size).
fn compress_image(
    raw: &[u8],
) -> Result<(Vec<u8>, String, Option<i32>, Option<i32>, Option<i64>), String> {
    use image::ImageReader;
    use std::io::Cursor;

    let reader = ImageReader::new(Cursor::new(raw))
        .with_guessed_format()
        .map_err(|e| format!("Failed to detect image format: {e}"))?;

    // Check dimensions BEFORE decoding to prevent decompression bombs
    // (a 10MB PNG can decompress to several GB of pixel data)
    let (check_w, check_h) = {
        let reader2 = ImageReader::new(Cursor::new(raw))
            .with_guessed_format()
            .map_err(|e| format!("Failed to detect format: {e}"))?;
        reader2.into_dimensions().map_err(|e| format!("Failed to read dimensions: {e}"))?
    };
    const MAX_PIXELS: u64 = 4096 * 4096; // ~16 megapixels (safe for chat app, prevents decompression bombs)
    if (check_w as u64) * (check_h as u64) > MAX_PIXELS {
        return Err(format!("Image too large: {}x{} exceeds maximum dimensions", check_w, check_h));
    }

    let img = reader
        .decode()
        .map_err(|e| format!("Failed to decode image: {e}"))?;

    let (w, h) = (img.width(), img.height());

    // Resize if needed (maintain aspect ratio)
    let resized = if w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM {
        img.resize(
            MAX_IMAGE_DIM,
            MAX_IMAGE_DIM,
            image::imageops::FilterType::Lanczos3,
        )
    } else {
        img
    };

    let (final_w, final_h) = (resized.width(), resized.height());

    // Encode as WebP — the `image` crate supports WebP encoding natively
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    resized
        .write_to(&mut cursor, image::ImageFormat::WebP)
        .map_err(|e| format!("WebP encoding failed: {e}"))?;

    let compressed_size = buf.len() as i64;

    Ok((
        buf,
        "image/webp".to_string(),
        Some(final_w as i32),
        Some(final_h as i32),
        Some(compressed_size),
    ))
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

fn extension_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        "application/pdf" => ".pdf",
        "text/plain" => ".txt",
        _ => "",
    }
}
