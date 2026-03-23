//! Message feedback routes — like/dislike with optional details.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;

// ── Router ──────────────────────────────────────────────────

pub fn feedback_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/messages/{message_id}/feedback",
            post(submit_feedback).get(get_feedback),
        )
}

// ── DTOs ────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct FeedbackRequest {
    #[validate(custom(function = "validate_rating"))]
    pub rating: String,

    #[validate(custom(function = "validate_severity"))]
    pub severity: Option<String>,

    #[serde(default)]
    pub categories: Vec<String>,

    #[validate(length(max = 2000))]
    pub comment: Option<String>,

    #[validate(length(max = 10000))]
    pub correction: Option<String>,
}

fn validate_severity(sev: &str) -> Result<(), validator::ValidationError> {
    match sev {
        "minor" | "major" | "critical" => Ok(()),
        _ => {
            let mut err = validator::ValidationError::new("severity");
            err.message = Some("Severity must be 'minor', 'major', or 'critical'".into());
            Err(err)
        }
    }
}

fn validate_rating(rating: &str) -> Result<(), validator::ValidationError> {
    match rating {
        "good" | "bad" => Ok(()),
        _ => {
            let mut err = validator::ValidationError::new("rating");
            err.message = Some("Rating must be 'good' or 'bad'".into());
            Err(err)
        }
    }
}

#[derive(Debug, Serialize)]
pub struct FeedbackResponse {
    pub id: Uuid,
    pub message_id: Uuid,
    pub rating: String,
    pub severity: Option<String>,
    pub categories: Vec<String>,
    pub comment: Option<String>,
    pub correction: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct FeedbackRow {
    id: Uuid,
    message_id: Uuid,
    user_id: Uuid,
    rating: String,
    severity: Option<String>,
    categories: Vec<String>,
    comment: Option<String>,
    correction: Option<String>,
    created_at: DateTime<Utc>,
}

// ── POST /messages/:id/feedback ─────────────────────────────

async fn submit_feedback(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(message_id): Path<Uuid>,
    Json(body): Json<FeedbackRequest>,
) -> Result<impl IntoResponse, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    // Validate categories — aligned with training signal taxonomy
    let allowed_categories = [
        // Bad: failure modes
        "hallucination", "factual_error", "ignored_instructions", "wrong_language",
        "harmful", "off_topic", "too_long", "too_short", "outdated", "repetitive",
        // Good: quality signals
        "accurate", "well_written", "creative", "helpful", "good_search",
        // Shared
        "other",
    ];
    for cat in &body.categories {
        if !allowed_categories.contains(&cat.as_str()) {
            return Err(AppError::BadRequest(format!("Invalid category: {cat}")));
        }
    }

    // Verify the message exists and belongs to a conversation the user owns
    let msg = sqlx::query_as::<_, crate::models::Message>(
        "SELECT m.* FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE m.id = $1 AND c.user_id = $2"
    )
    .bind(message_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Message not found".to_string()))?;

    // Only allow feedback on assistant messages
    if msg.role != "assistant" {
        return Err(AppError::BadRequest("Feedback is only for assistant messages".to_string()));
    }

    // Upsert feedback (one per user per message)
    let row = sqlx::query_as::<_, FeedbackRow>(
        "INSERT INTO message_feedback (id, message_id, user_id, rating, severity, categories, comment, correction, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET rating = $4, severity = $5, categories = $6, comment = $7, correction = $8, created_at = $9
         RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(message_id)
    .bind(user.id)
    .bind(&body.rating)
    .bind(&body.severity)
    .bind(&body.categories)
    .bind(&body.comment)
    .bind(&body.correction)
    .bind(Utc::now())
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::OK, Json(FeedbackResponse {
        id: row.id,
        message_id: row.message_id,
        rating: row.rating,
        severity: row.severity,
        categories: row.categories,
        comment: row.comment,
        correction: row.correction,
        created_at: row.created_at,
    })))
}

// ── GET /messages/:id/feedback ──────────────────────────────

async fn get_feedback(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(message_id): Path<Uuid>,
) -> Result<Json<Option<FeedbackResponse>>, AppError> {
    let row = sqlx::query_as::<_, FeedbackRow>(
        "SELECT * FROM message_feedback WHERE message_id = $1 AND user_id = $2"
    )
    .bind(message_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(row.map(|r| FeedbackResponse {
        id: r.id,
        message_id: r.message_id,
        rating: r.rating,
        severity: r.severity,
        categories: r.categories,
        comment: r.comment,
        correction: r.correction,
        created_at: r.created_at,
    })))
}
