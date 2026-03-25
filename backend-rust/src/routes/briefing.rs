//! Daily briefing — live-assembled dashboard data (weather, reminders, events).

use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::services::weather;

// ── Routes ───────────────────────────────────────────────────────────────

pub fn briefing_routes() -> Router<AppState> {
    Router::new()
        .route("/briefing", get(get_briefing))
        .route("/briefing/settings", get(get_briefing_settings).put(update_briefing_settings))
}

// ── Briefing Data ────────────────────────────────────────────────────────

#[derive(Serialize)]
struct BriefingResponse {
    date: String,
    weather: Option<WeatherSummary>,
    reminders: Vec<BriefingReminder>,
    events: Vec<BriefingEvent>,
    stats: BriefingStats,
}

#[derive(Serialize)]
struct WeatherSummary {
    city: String,
    temperature: f64,
    description: String,
    icon: String,
    feels_like: f64,
    wind_speed: f64,
    humidity: Option<f64>,
    forecast: Vec<weather::ForecastDay>,
}

#[derive(Serialize, sqlx::FromRow)]
struct BriefingReminder {
    id: Uuid,
    title: String,
    body: Option<String>,
    remind_at: chrono::DateTime<Utc>,
    rrule: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct BriefingEvent {
    id: Uuid,
    title: String,
    description: Option<String>,
    location: Option<String>,
    start_at: chrono::DateTime<Utc>,
    end_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Serialize)]
struct BriefingStats {
    total_reminders_pending: i64,
    total_events_this_week: i64,
    memories_saved: i64,
}

async fn get_briefing(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<BriefingResponse>, AppError> {
    let now = Utc::now();
    let today_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
    let today_end = now.date_naive().and_hms_opt(23, 59, 59).unwrap().and_utc();
    let week_end = now + chrono::Duration::days(7);

    // Fetch today's reminders
    let reminders = sqlx::query_as::<_, BriefingReminder>(
        "SELECT id, title, body, remind_at, rrule FROM reminders
         WHERE user_id = $1 AND status = 'pending' AND remind_at >= $2 AND remind_at <= $3
         ORDER BY remind_at LIMIT 20"
    )
    .bind(user.id).bind(today_start).bind(today_end)
    .fetch_all(&state.db).await?;

    // Fetch today's events
    let events = sqlx::query_as::<_, BriefingEvent>(
        "SELECT id, title, description, location, start_at, end_at FROM calendar_events
         WHERE user_id = $1 AND start_at >= $2 AND start_at <= $3
         ORDER BY start_at LIMIT 20"
    )
    .bind(user.id).bind(today_start).bind(today_end)
    .fetch_all(&state.db).await?;

    // Stats
    let total_reminders: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM reminders WHERE user_id = $1 AND status = 'pending'"
    ).bind(user.id).fetch_one(&state.db).await.unwrap_or((0,));

    let total_events_week: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM calendar_events WHERE user_id = $1 AND start_at >= $2 AND start_at <= $3"
    ).bind(user.id).bind(today_start).bind(week_end)
    .fetch_one(&state.db).await.unwrap_or((0,));

    let memories: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM user_memory WHERE user_id = $1"
    ).bind(user.id).fetch_one(&state.db).await.unwrap_or((0,));

    // Weather — try to get user's city from memory
    let city: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM user_memory WHERE user_id = $1 AND key IN ('city', 'location', 'город') LIMIT 1"
    ).bind(user.id).fetch_optional(&state.db).await.unwrap_or(None);

    let weather_data = if let Some((city_name,)) = city {
        match weather::get_weather(&city_name).await {
            Ok(w) => Some(WeatherSummary {
                city: w.city,
                temperature: w.temperature,
                description: w.description,
                icon: w.icon,
                feels_like: w.feels_like,
                wind_speed: w.wind_speed,
                humidity: w.humidity,
                forecast: w.forecast,
            }),
            Err(_) => None,
        }
    } else {
        None
    };

    Ok(Json(BriefingResponse {
        date: now.format("%Y-%m-%d").to_string(),
        weather: weather_data,
        reminders,
        events,
        stats: BriefingStats {
            total_reminders_pending: total_reminders.0,
            total_events_this_week: total_events_week.0,
            memories_saved: memories.0,
        },
    }))
}

// ── Briefing Settings ────────────────────────────────────────────────────

#[derive(Serialize)]
struct BriefingSettingsResponse {
    enabled: bool,
    time: String,
}

async fn get_briefing_settings(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<BriefingSettingsResponse>, AppError> {
    let row = sqlx::query_as::<_, (bool, chrono::NaiveTime)>(
        "SELECT briefing_enabled, briefing_time FROM notification_settings WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some((enabled, time)) => Ok(Json(BriefingSettingsResponse {
            enabled,
            time: time.format("%H:%M").to_string(),
        })),
        None => Ok(Json(BriefingSettingsResponse {
            enabled: false,
            time: "08:00".to_string(),
        })),
    }
}

#[derive(Deserialize)]
struct UpdateBriefingSettings {
    enabled: Option<bool>,
    time: Option<String>,
}

async fn update_briefing_settings(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<UpdateBriefingSettings>,
) -> Result<Json<BriefingSettingsResponse>, AppError> {
    // Upsert notification_settings with briefing fields
    sqlx::query(
        "INSERT INTO notification_settings (user_id, briefing_enabled, briefing_time)
         VALUES ($1, COALESCE($2, false), COALESCE($3, '08:00'::TIME))
         ON CONFLICT (user_id) DO UPDATE SET
           briefing_enabled = COALESCE($2, notification_settings.briefing_enabled),
           briefing_time = COALESCE($3, notification_settings.briefing_time),
           updated_at = now()"
    )
    .bind(user.id)
    .bind(body.enabled)
    .bind(body.time.as_ref().and_then(|t| chrono::NaiveTime::parse_from_str(t, "%H:%M").ok()))
    .execute(&state.db)
    .await?;

    get_briefing_settings(State(state), AuthUser(user)).await
}
