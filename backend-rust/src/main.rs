mod config;
mod db;
mod error;
mod middleware;
mod models;
mod routes;
mod schema;
mod services;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::State;
use axum::http::{header, HeaderName, HeaderValue, Method, Request};
use axum::middleware as axum_mw;
use axum::response::Response;
use axum::Router;
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use axum::extract::DefaultBodyLimit;

use crate::config::Config;
use crate::db::{create_pg_pool, create_redis_client, AppState};

// ═══════════════════════════════════════════════════════════════
//  Entry point
// ═══════════════════════════════════════════════════════════════

#[tokio::main]
async fn main() {
    // Load .env (ignore errors -- the file may not exist in production)
    let _ = dotenvy::dotenv();

    // Tracing / logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "mira_api=debug,tower_http=info".into()),
        )
        .json()
        .init();

    let config = Config::from_env();
    tracing::info!(app = %config.app_name, debug = config.debug, "Starting Mira API");

    let pg_pool = create_pg_pool(&config).await;
    let redis_client = create_redis_client(&config);
    let state = AppState {
        db: pg_pool,
        redis: redis_client,
        config: Arc::new(config),
    };

    // Spawn background reminder scheduler
    let scheduler_state = state.clone();
    tokio::spawn(async move {
        services::scheduler::run_reminder_scheduler(scheduler_state).await;
    });

    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("Failed to bind to 0.0.0.0:8000");

    tracing::info!("Listening on 0.0.0.0:8000");

    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("Server error");
}

// ═══════════════════════════════════════════════════════════════
//  Router construction
// ═══════════════════════════════════════════════════════════════

fn build_router(state: AppState) -> Router {
    let allowed_origins: Vec<HeaderValue> = state
        .config
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::COOKIE,
            HeaderName::from_static("x-request-timestamp"),
            HeaderName::from_static("x-request-nonce"),
            HeaderName::from_static("x-request-signature"),
        ])
        .allow_credentials(true)
        .max_age(Duration::from_secs(86400));

    // Build the application router from route modules
    routes::create_router(state.clone())
        .layer(axum_mw::from_fn(middleware::request_id::request_id))
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            security_headers_middleware,
        ))
        .layer(axum_mw::from_fn_with_state(
            state.clone(),
            middleware::hmac_verify::hmac_verify,
        ))
        .layer(CompressionLayer::new())
        .layer(RequestBodyLimitLayer::new(12 * 1024 * 1024)) // 12 MiB (allows 10MB uploads + multipart overhead; route-level DefaultBodyLimit further restricts non-upload routes)
        .layer(TimeoutLayer::new(Duration::from_secs(30)))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
}

// ═══════════════════════════════════════════════════════════════
//  Security headers middleware
// ═══════════════════════════════════════════════════════════════

async fn security_headers_middleware(
    State(_state): State<AppState>,
    request: Request<Body>,
    next: axum::middleware::Next,
) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    headers.insert("X-Content-Type-Options", "nosniff".parse().unwrap());
    headers.insert("X-Frame-Options", "DENY".parse().unwrap());
    headers.insert(
        "X-XSS-Protection",
        "1; mode=block".parse().unwrap(),
    );
    headers.insert(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload"
            .parse()
            .unwrap(),
    );
    headers.insert(
        "Referrer-Policy",
        "strict-origin-when-cross-origin".parse().unwrap(),
    );
    headers.insert(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()".parse().unwrap(),
    );
    headers.insert(
        "Cache-Control",
        "no-store, no-cache, must-revalidate".parse().unwrap(),
    );

    response
}

// ═══════════════════════════════════════════════════════════════
//  Graceful shutdown
// ═══════════════════════════════════════════════════════════════

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => tracing::info!("Received CTRL+C, starting graceful shutdown"),
        _ = terminate => tracing::info!("Received SIGTERM, starting graceful shutdown"),
    }
}
