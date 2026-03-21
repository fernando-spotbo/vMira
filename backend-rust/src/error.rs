use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

/// Unified error type used by all handlers and services.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    Unauthorized(String),

    #[error("{0}")]
    Forbidden(String),

    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Conflict(String),

    #[error("Rate limit exceeded, retry after {retry_after} seconds")]
    RateLimited { retry_after: u32 },

    #[error("{0}")]
    Internal(String),

    #[error("{0}")]
    Unprocessable(String),

    #[error("{0}")]
    PaymentRequired(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, detail) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg.clone()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            AppError::RateLimited { retry_after } => (
                StatusCode::TOO_MANY_REQUESTS,
                format!("Rate limit exceeded, retry after {retry_after} seconds"),
            ),
            AppError::Internal(msg) => {
                tracing::error!(error = %msg, "Internal server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
            AppError::Unprocessable(msg) => (StatusCode::UNPROCESSABLE_ENTITY, msg.clone()),
            AppError::PaymentRequired(msg) => (StatusCode::PAYMENT_REQUIRED, msg.clone()),
        };

        let mut response = (status, axum::Json(json!({ "detail": detail }))).into_response();

        if let AppError::RateLimited { retry_after } = &self {
            response.headers_mut().insert(
                "Retry-After",
                retry_after
                    .to_string()
                    .parse()
                    .expect("valid header value"),
            );
        }

        response
    }
}

// ── From implementations ─────────────────────────────────────

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => AppError::NotFound("Resource not found".to_string()),
            sqlx::Error::Database(ref db_err) => {
                // PostgreSQL unique-violation SQLSTATE = 23505
                if db_err.code().as_deref() == Some("23505") {
                    AppError::Conflict("Resource already exists".to_string())
                } else {
                    tracing::error!(error = %err, "Database error");
                    AppError::Internal("Database error".to_string())
                }
            }
            _ => {
                tracing::error!(error = %err, "Database error");
                AppError::Internal("Database error".to_string())
            }
        }
    }
}

impl From<redis::RedisError> for AppError {
    fn from(err: redis::RedisError) -> Self {
        tracing::error!(error = %err, "Redis error");
        AppError::Internal("Cache service error".to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        use jsonwebtoken::errors::ErrorKind;
        match err.kind() {
            ErrorKind::ExpiredSignature => {
                AppError::Unauthorized("Token has expired".to_string())
            }
            ErrorKind::InvalidToken
            | ErrorKind::InvalidSignature
            | ErrorKind::InvalidAlgorithm => {
                AppError::Unauthorized("Invalid token".to_string())
            }
            _ => {
                tracing::error!(error = %err, "JWT error");
                AppError::Unauthorized("Authentication error".to_string())
            }
        }
    }
}
