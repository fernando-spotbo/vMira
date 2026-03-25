//! Calendar routes — ICS feed, feed tokens, events CRUD, Google Calendar OAuth.

use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::services::token::{generate_token, hash_token};

// ── Routes ───────────────────────────────────────────────────────────────

pub fn calendar_routes() -> Router<AppState> {
    Router::new()
        // Feed token management (authenticated)
        .route("/calendar/feed-token", post(generate_feed_token))
        .route("/calendar/feed-token", delete(revoke_feed_token))
        .route("/calendar/feed-token/status", get(feed_token_status))
        // Calendar events CRUD (authenticated)
        .route("/calendar/events", get(list_events))
        .route("/calendar/events", post(create_event))
        .route("/calendar/events/{id}", delete(delete_event))
        // OAuth for all providers: google, outlook, yandex (authenticated)
        .route("/calendar/{provider}/auth", get(provider_auth_url))
        .route("/calendar/{provider}/callback", get(provider_callback))
        .route("/calendar/{provider}/disconnect", delete(provider_disconnect))
        .route("/calendar/{provider}/status", get(provider_status))
        // ICS feed (unauthenticated — token in URL)
        .route("/calendar/feed/{token}", get(ics_feed))
}

// ── Feed Token ───────────────────────────────────────────────────────────

#[derive(Serialize)]
struct FeedTokenResponse {
    url: String,
}

async fn generate_feed_token(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<FeedTokenResponse>, AppError> {
    let raw_token = generate_token();
    let token_hash = hash_token(&raw_token, &state.config.secret_key);

    // Upsert — one feed token per user
    sqlx::query(
        "INSERT INTO calendar_feed_tokens (user_id, token_hash)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, created_at = now()"
    )
    .bind(user.id)
    .bind(&token_hash)
    .execute(&state.db)
    .await?;

    let url = format!("https://api.vmira.ai/api/v1/calendar/feed/{}.ics", raw_token);
    Ok(Json(FeedTokenResponse { url }))
}

async fn revoke_feed_token(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM calendar_feed_tokens WHERE user_id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
struct FeedTokenStatus {
    active: bool,
    created_at: Option<String>,
    last_fetched_at: Option<String>,
}

async fn feed_token_status(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<FeedTokenStatus>, AppError> {
    let row = sqlx::query_as::<_, (chrono::DateTime<Utc>, Option<chrono::DateTime<Utc>>)>(
        "SELECT created_at, last_fetched_at FROM calendar_feed_tokens WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some((created, fetched)) => Ok(Json(FeedTokenStatus {
            active: true,
            created_at: Some(created.to_rfc3339()),
            last_fetched_at: fetched.map(|f| f.to_rfc3339()),
        })),
        None => Ok(Json(FeedTokenStatus {
            active: false,
            created_at: None,
            last_fetched_at: None,
        })),
    }
}

// ── ICS Feed ─────────────────────────────────────────────────────────────

async fn ics_feed(
    State(state): State<AppState>,
    Path(token_path): Path<String>,
) -> Result<Response, StatusCode> {
    // Strip .ics suffix if present
    let token = token_path.strip_suffix(".ics").unwrap_or(&token_path);
    let token_hash = hash_token(token, &state.config.secret_key);

    // Look up user by feed token hash
    let user_id: Option<(Uuid,)> = sqlx::query_as(
        "UPDATE calendar_feed_tokens SET last_fetched_at = now()
         WHERE token_hash = $1
         RETURNING user_id"
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = match user_id {
        Some((id,)) => id,
        None => return Err(StatusCode::NOT_FOUND),
    };

    // Fetch pending reminders
    let reminders = sqlx::query_as::<_, IcsReminder>(
        "SELECT id, title, body, remind_at, rrule, user_timezone
         FROM reminders
         WHERE user_id = $1 AND status = 'pending'
         ORDER BY remind_at"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Fetch calendar events
    let events = sqlx::query_as::<_, IcsEvent>(
        "SELECT id, title, description, location, start_at, end_at, all_day, rrule, user_timezone
         FROM calendar_events
         WHERE user_id = $1
         ORDER BY start_at"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Generate ICS
    let ics = build_ics(&reminders, &events);

    Ok((
        [
            (header::CONTENT_TYPE, "text/calendar; charset=utf-8"),
            (header::CACHE_CONTROL, "no-cache, no-store, must-revalidate"),
            (header::CONTENT_DISPOSITION, "inline; filename=\"mira.ics\""),
        ],
        ics,
    ).into_response())
}

#[derive(sqlx::FromRow)]
struct IcsReminder {
    id: Uuid,
    title: String,
    body: Option<String>,
    remind_at: chrono::DateTime<Utc>,
    rrule: Option<String>,
    user_timezone: String,
}

#[derive(sqlx::FromRow)]
struct IcsEvent {
    id: Uuid,
    title: String,
    description: Option<String>,
    location: Option<String>,
    start_at: chrono::DateTime<Utc>,
    end_at: Option<chrono::DateTime<Utc>>,
    all_day: bool,
    rrule: Option<String>,
    user_timezone: String,
}

fn build_ics(reminders: &[IcsReminder], events: &[IcsEvent]) -> String {
    let now = Utc::now().format("%Y%m%dT%H%M%SZ");
    let mut ics = String::with_capacity(4096);

    ics.push_str("BEGIN:VCALENDAR\r\n");
    ics.push_str("VERSION:2.0\r\n");
    ics.push_str("PRODID:-//V-Corp//Mira AI//EN\r\n");
    ics.push_str("CALSCALE:GREGORIAN\r\n");
    ics.push_str("METHOD:PUBLISH\r\n");
    ics.push_str("X-WR-CALNAME:Mira\r\n");

    // Reminders as VEVENT
    for r in reminders {
        let dtstart = r.remind_at.format("%Y%m%dT%H%M%SZ");
        let dtend = (r.remind_at + chrono::Duration::minutes(30)).format("%Y%m%dT%H%M%SZ");

        ics.push_str("BEGIN:VEVENT\r\n");
        ics.push_str(&format!("UID:reminder-{}@vmira.ai\r\n", r.id));
        ics.push_str(&format!("DTSTAMP:{}\r\n", now));
        ics.push_str(&format!("DTSTART:{}\r\n", dtstart));
        ics.push_str(&format!("DTEND:{}\r\n", dtend));
        ics.push_str(&format!("SUMMARY:{}\r\n", ics_escape(&r.title)));
        if let Some(ref body) = r.body {
            if !body.is_empty() {
                ics.push_str(&format!("DESCRIPTION:{}\r\n", ics_escape(body)));
            }
        }
        if let Some(ref rrule) = r.rrule {
            if !rrule.is_empty() {
                ics.push_str(&format!("RRULE:{}\r\n", rrule));
            }
        }
        ics.push_str("BEGIN:VALARM\r\n");
        ics.push_str("TRIGGER:-PT10M\r\n");
        ics.push_str("ACTION:DISPLAY\r\n");
        ics.push_str(&format!("DESCRIPTION:{}\r\n", ics_escape(&r.title)));
        ics.push_str("END:VALARM\r\n");
        ics.push_str("END:VEVENT\r\n");
    }

    // Calendar events as VEVENT
    for e in events {
        ics.push_str("BEGIN:VEVENT\r\n");
        ics.push_str(&format!("UID:event-{}@vmira.ai\r\n", e.id));
        ics.push_str(&format!("DTSTAMP:{}\r\n", now));

        if e.all_day {
            let date = e.start_at.format("%Y%m%d");
            ics.push_str(&format!("DTSTART;VALUE=DATE:{}\r\n", date));
            if let Some(end) = e.end_at {
                ics.push_str(&format!("DTEND;VALUE=DATE:{}\r\n", end.format("%Y%m%d")));
            }
        } else {
            ics.push_str(&format!("DTSTART:{}\r\n", e.start_at.format("%Y%m%dT%H%M%SZ")));
            let end = e.end_at.unwrap_or(e.start_at + chrono::Duration::hours(1));
            ics.push_str(&format!("DTEND:{}\r\n", end.format("%Y%m%dT%H%M%SZ")));
        }

        ics.push_str(&format!("SUMMARY:{}\r\n", ics_escape(&e.title)));
        if let Some(ref desc) = e.description {
            if !desc.is_empty() {
                ics.push_str(&format!("DESCRIPTION:{}\r\n", ics_escape(desc)));
            }
        }
        if let Some(ref loc) = e.location {
            if !loc.is_empty() {
                ics.push_str(&format!("LOCATION:{}\r\n", ics_escape(loc)));
            }
        }
        if let Some(ref rrule) = e.rrule {
            if !rrule.is_empty() {
                ics.push_str(&format!("RRULE:{}\r\n", rrule));
            }
        }
        ics.push_str("END:VEVENT\r\n");
    }

    ics.push_str("END:VCALENDAR\r\n");
    ics
}

/// ICS text escaping: backslash-escape commas, semicolons, backslashes, and newlines.
fn ics_escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace(';', "\\;")
        .replace(',', "\\,")
        .replace('\n', "\\n")
        .replace('\r', "")
}

// ── Calendar Events CRUD ─────────────────────────────────────────────────

#[derive(Deserialize)]
struct ListEventsQuery {
    start: Option<String>,
    end: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct CalendarEventRow {
    id: Uuid,
    title: String,
    description: Option<String>,
    location: Option<String>,
    start_at: chrono::DateTime<Utc>,
    end_at: Option<chrono::DateTime<Utc>>,
    all_day: bool,
    rrule: Option<String>,
    source: String,
    created_at: chrono::DateTime<Utc>,
}

async fn list_events(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(q): Query<ListEventsQuery>,
) -> Result<Json<Vec<CalendarEventRow>>, AppError> {
    let start = q.start
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc())
        .unwrap_or_else(|| Utc::now() - chrono::Duration::days(7));
    let end = q.end
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .map(|d| d.and_hms_opt(23, 59, 59).unwrap().and_utc())
        .unwrap_or_else(|| Utc::now() + chrono::Duration::days(30));

    let events = sqlx::query_as::<_, CalendarEventRow>(
        "SELECT id, title, description, location, start_at, end_at, all_day, rrule, source, created_at
         FROM calendar_events
         WHERE user_id = $1 AND start_at >= $2 AND start_at <= $3
         ORDER BY start_at
         LIMIT 200"
    )
    .bind(user.id)
    .bind(start)
    .bind(end)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(events))
}

#[derive(Deserialize)]
struct CreateEventBody {
    title: String,
    description: Option<String>,
    location: Option<String>,
    start_at: String,
    end_at: Option<String>,
    all_day: Option<bool>,
    rrule: Option<String>,
}

async fn create_event(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<CreateEventBody>,
) -> Result<(StatusCode, Json<CalendarEventRow>), AppError> {
    let start = chrono::DateTime::parse_from_rfc3339(&body.start_at)
        .map_err(|_| AppError::BadRequest("Invalid start_at date".into()))?
        .with_timezone(&Utc);
    let end = body.end_at.as_ref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc));

    let event = sqlx::query_as::<_, CalendarEventRow>(
        "INSERT INTO calendar_events (user_id, title, description, location, start_at, end_at, all_day, rrule, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'mira')
         RETURNING id, title, description, location, start_at, end_at, all_day, rrule, source, created_at"
    )
    .bind(user.id)
    .bind(body.title.trim())
    .bind(body.description.as_deref())
    .bind(body.location.as_deref())
    .bind(start)
    .bind(end)
    .bind(body.all_day.unwrap_or(false))
    .bind(body.rrule.as_deref())
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(event)))
}

async fn delete_event(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query(
        "DELETE FROM calendar_events WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(user.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Event not found".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ── Generic Calendar OAuth (Google, Outlook, Yandex) ─────────────────────

struct ProviderConfig {
    auth_url: &'static str,
    token_url: &'static str,
    scope: &'static str,
    extra_params: &'static str, // e.g. "&access_type=offline&prompt=consent"
}

fn get_provider_config(provider: &str) -> Option<ProviderConfig> {
    match provider {
        "google" => Some(ProviderConfig {
            auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
            token_url: "https://oauth2.googleapis.com/token",
            scope: "https://www.googleapis.com/auth/calendar.events",
            extra_params: "&access_type=offline&prompt=consent",
        }),
        "outlook" => Some(ProviderConfig {
            auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            scope: "Calendars.ReadWrite offline_access",
            extra_params: "&response_mode=query",
        }),
        "yandex" => Some(ProviderConfig {
            auth_url: "https://oauth.yandex.ru/authorize",
            token_url: "https://oauth.yandex.ru/token",
            scope: "calendar:all",
            extra_params: "&force_confirm=yes",
        }),
        _ => None,
    }
}

fn get_provider_credentials<'a>(config: &'a crate::config::Config, provider: &str) -> (&'a str, &'a str) {
    match provider {
        "google" => (&config.google_client_id, &config.google_client_secret),
        "outlook" => (&config.microsoft_client_id, &config.microsoft_client_secret),
        "yandex" => (&config.yandex_calendar_client_id, &config.yandex_calendar_client_secret),
        _ => ("", ""),
    }
}

#[derive(Serialize)]
struct AuthUrlResponse {
    url: String,
}

async fn provider_auth_url(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(provider): Path<String>,
) -> Result<Json<AuthUrlResponse>, AppError> {
    let pc = get_provider_config(&provider)
        .ok_or_else(|| AppError::BadRequest(format!("Unknown provider: {provider}")))?;
    let (client_id, _) = get_provider_credentials(&state.config, &provider);
    if client_id.is_empty() {
        return Err(AppError::BadRequest(format!("{provider} calendar not configured")));
    }

    // Store CSRF state in Redis (5 min TTL) — includes provider name
    let csrf_state = generate_token();
    let redis_key = format!("cal_oauth:{}:{}", provider, csrf_state);
    let mut conn = state.redis.get_multiplexed_async_connection().await
        .map_err(|e| AppError::Internal(format!("Redis: {e}")))?;
    redis::cmd("SETEX")
        .arg(&redis_key)
        .arg(300)
        .arg(user.id.to_string())
        .query_async::<()>(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Redis: {e}")))?;

    let raw_redirect = format!("https://vmira.ai/api/calendar/{}/callback", provider);
    let redirect_uri = urlencoding::encode(&raw_redirect);
    let scope = urlencoding::encode(pc.scope);

    let url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}{}&state={}",
        pc.auth_url, client_id, redirect_uri, scope, pc.extra_params, csrf_state
    );

    Ok(Json(AuthUrlResponse { url }))
}

#[derive(Deserialize)]
struct OAuthCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

async fn provider_callback(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(q): Query<OAuthCallbackQuery>,
) -> Result<Response, AppError> {
    if let Some(error) = q.error {
        let desc = q.error_description.unwrap_or_default();
        return Ok(callback_html(&provider, &format!("Authorization denied: {} {}", error, desc)).into_response());
    }

    let pc = get_provider_config(&provider)
        .ok_or_else(|| AppError::BadRequest(format!("Unknown provider: {provider}")))?;
    let (client_id, client_secret) = get_provider_credentials(&state.config, &provider);

    let code = q.code.ok_or_else(|| AppError::BadRequest("Missing code".into()))?;
    let csrf_state = q.state.ok_or_else(|| AppError::BadRequest("Missing state".into()))?;

    // Verify CSRF state from Redis
    let redis_key = format!("cal_oauth:{}:{}", provider, csrf_state);
    let mut conn = state.redis.get_multiplexed_async_connection().await
        .map_err(|e| AppError::Internal(format!("Redis: {e}")))?;
    let user_id_str: Option<String> = redis::cmd("GETDEL")
        .arg(&redis_key)
        .query_async(&mut conn)
        .await
        .map_err(|e| AppError::Internal(format!("Redis: {e}")))?;

    let user_id: Uuid = user_id_str
        .ok_or_else(|| AppError::BadRequest("Invalid or expired state".into()))?
        .parse()
        .map_err(|_| AppError::BadRequest("Invalid state".into()))?;

    // Exchange code for tokens
    let redirect_uri = format!("https://vmira.ai/api/calendar/{}/callback", provider);
    let client = reqwest::Client::new();
    let token_resp = client
        .post(pc.token_url)
        .form(&[
            ("code", code.as_str()),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("{provider} token exchange: {e}")))?;

    if !token_resp.status().is_success() {
        let body = token_resp.text().await.unwrap_or_default();
        tracing::error!(provider = %provider, "Token exchange failed: {}", body);
        return Ok(callback_html(&provider, &format!("Failed to connect {}", provider)).into_response());
    }

    let tokens: OAuthTokenResponse = token_resp.json().await
        .map_err(|e| AppError::Internal(format!("Parse tokens: {e}")))?;

    let expires_at = tokens.expires_in.map(|s| Utc::now() + chrono::Duration::seconds(s));

    // Upsert connection
    sqlx::query(
        "INSERT INTO calendar_connections (user_id, provider, access_token, refresh_token, token_expires_at, calendar_id)
         VALUES ($1, $2, $3, $4, $5, 'primary')
         ON CONFLICT (user_id, provider) DO UPDATE SET
           access_token = $3, refresh_token = COALESCE($4, calendar_connections.refresh_token),
           token_expires_at = $5, updated_at = now()"
    )
    .bind(user_id)
    .bind(&provider)
    .bind(&tokens.access_token)
    .bind(&tokens.refresh_token)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    let name = match provider.as_str() {
        "google" => "Google Calendar",
        "outlook" => "Outlook Calendar",
        "yandex" => "Yandex Calendar",
        _ => &provider,
    };
    Ok(callback_html(&provider, &format!("{} connected!", name)).into_response())
}

#[derive(Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
}

fn callback_html(provider: &str, message: &str) -> Response {
    let html = format!(
        r#"<!DOCTYPE html><html><head><title>Mira</title></head>
        <body style="background:#161616;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
            <p style="font-size:18px">{message}</p>
            <p style="color:#666;font-size:14px">This window will close automatically</p>
        </div>
        <script>
            window.opener && window.opener.postMessage({{ type: "calendar_connected", provider: "{provider}" }}, "*");
            setTimeout(() => window.close(), 2000);
        </script>
        </body></html>"#
    );
    (
        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
        html,
    ).into_response()
}

async fn provider_disconnect(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(provider): Path<String>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM calendar_connections WHERE user_id = $1 AND provider = $2")
        .bind(user.id)
        .bind(&provider)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
struct ProviderStatusResponse {
    connected: bool,
    last_synced_at: Option<String>,
}

async fn provider_status(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(provider): Path<String>,
) -> Result<Json<ProviderStatusResponse>, AppError> {
    let row = sqlx::query_as::<_, (Option<chrono::DateTime<Utc>>,)>(
        "SELECT last_synced_at FROM calendar_connections WHERE user_id = $1 AND provider = $2"
    )
    .bind(user.id)
    .bind(&provider)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some((synced,)) => Ok(Json(ProviderStatusResponse {
            connected: true,
            last_synced_at: synced.map(|s| s.to_rfc3339()),
        })),
        None => Ok(Json(ProviderStatusResponse {
            connected: false,
            last_synced_at: None,
        })),
    }
}
