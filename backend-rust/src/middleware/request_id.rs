//! Request ID middleware for distributed tracing.
//!
//! Generates a UUID v4 for every incoming HTTP request and attaches it as the
//! `X-Request-Id` response header.  The ID is always server-generated — client-
//! provided values are never trusted.

use axum::{
    body::Body,
    http::Request,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

/// Axum middleware that generates a unique request ID and adds it to the
/// response as `X-Request-Id`.
///
/// Attach with `axum::middleware::from_fn(request_id)`.
pub async fn request_id(request: Request<Body>, next: Next) -> Response {
    let id = Uuid::new_v4().to_string();

    let mut response = next.run(request).await;

    response.headers_mut().insert(
        "x-request-id",
        id.parse().expect("UUID is a valid header value"),
    );

    response
}
