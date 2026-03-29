//! Reminders & notifications CRUD routes.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put, delete},
    Json, Router,
};
use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::db::AppState;
use crate::error::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::{Notification, NotificationSettings, Reminder};

// ── Routes ───────────────────────────────────────────────────────────────

pub fn notification_routes() -> Router<AppState> {
    Router::new()
        .route("/notifications", get(list_notifications))
        .route("/notifications/{id}/read", post(mark_read))
        .route("/notifications/read-all", post(mark_all_read))
        .route("/reminders", get(list_reminders).post(create_reminder))
        .route("/reminders/{id}", put(update_reminder).delete(delete_reminder))
        .route("/reminders/{id}/snooze", post(snooze_reminder))
        .route("/notification-settings", get(get_settings).put(update_settings))
}

// ── Notifications ────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ListNotificationsQuery {
    unread: Option<bool>,
    limit: Option<i64>,
}

#[derive(Serialize)]
struct NotificationsListResponse {
    notifications: Vec<NotificationResponse>,
    unread_count: i64,
}

#[derive(Serialize)]
struct NotificationResponse {
    id: Uuid,
    #[serde(rename = "type")]
    type_: String,
    title: String,
    body: Option<String>,
    read: bool,
    reminder_id: Option<Uuid>,
    created_at: DateTime<Utc>,
}

impl From<Notification> for NotificationResponse {
    fn from(n: Notification) -> Self {
        Self {
            id: n.id,
            type_: n.type_,
            title: n.title,
            body: n.body,
            read: n.read,
            reminder_id: n.reminder_id,
            created_at: n.created_at,
        }
    }
}

async fn list_notifications(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(q): Query<ListNotificationsQuery>,
) -> Result<Json<NotificationsListResponse>, AppError> {
    let limit = q.limit.unwrap_or(50).min(100);

    let notifications = if q.unread.unwrap_or(false) {
        sqlx::query_as::<_, Notification>(
            "SELECT * FROM notifications WHERE user_id = $1 AND read = false
             ORDER BY created_at DESC LIMIT $2"
        )
        .bind(user.id)
        .bind(limit)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, Notification>(
            "SELECT * FROM notifications WHERE user_id = $1
             ORDER BY created_at DESC LIMIT $2"
        )
        .bind(user.id)
        .bind(limit)
        .fetch_all(&state.db)
        .await?
    };

    let unread_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false"
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(NotificationsListResponse {
        notifications: notifications.into_iter().map(Into::into).collect(),
        unread_count,
    }))
}

async fn mark_read(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let rows = sqlx::query(
        "UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(user.id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Notification not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn mark_all_read(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<StatusCode, AppError> {
    sqlx::query(
        "UPDATE notifications SET read = true WHERE user_id = $1 AND read = false"
    )
    .bind(user.id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Reminders ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ListRemindersQuery {
    status: Option<String>,
    limit: Option<i64>,
}

#[derive(Serialize)]
struct ReminderResponse {
    id: Uuid,
    #[serde(rename = "type")]
    type_: String,
    title: String,
    body: Option<String>,
    remind_at: DateTime<Utc>,
    user_timezone: String,
    rrule: Option<String>,
    status: String,
    channels: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<Reminder> for ReminderResponse {
    fn from(r: Reminder) -> Self {
        Self {
            id: r.id,
            type_: r.type_,
            title: r.title,
            body: r.body,
            remind_at: r.remind_at,
            user_timezone: r.user_timezone,
            rrule: r.rrule,
            status: r.status,
            channels: r.channels,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

async fn list_reminders(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(q): Query<ListRemindersQuery>,
) -> Result<Json<Vec<ReminderResponse>>, AppError> {
    let limit = q.limit.unwrap_or(100).min(500);

    let reminders = if let Some(status) = &q.status {
        sqlx::query_as::<_, Reminder>(
            "SELECT * FROM reminders WHERE user_id = $1 AND status = $2
             ORDER BY remind_at ASC LIMIT $3"
        )
        .bind(user.id)
        .bind(status)
        .bind(limit)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, Reminder>(
            "SELECT * FROM reminders WHERE user_id = $1
             ORDER BY remind_at ASC LIMIT $2"
        )
        .bind(user.id)
        .bind(limit)
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(reminders.into_iter().map(Into::into).collect()))
}

#[derive(Deserialize, Validate)]
struct CreateReminderRequest {
    #[validate(length(min = 1, max = 200))]
    title: String,
    #[validate(length(max = 2000))]
    body: Option<String>,
    remind_at: String, // ISO 8601
    timezone: Option<String>,
    rrule: Option<String>,
    channels: Option<Vec<String>>,
}

async fn create_reminder(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<CreateReminderRequest>,
) -> Result<(StatusCode, Json<ReminderResponse>), AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    let remind_at = DateTime::parse_from_rfc3339(&body.remind_at)
        .or_else(|_| DateTime::parse_from_str(&body.remind_at, "%Y-%m-%dT%H:%M:%S"))
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| AppError::BadRequest("Invalid remind_at datetime format".to_string()))?;

    // Validate timezone
    let tz = if let Some(tz) = &body.timezone {
        if !VALID_TIMEZONES.contains(&tz.as_str()) {
            return Err(AppError::BadRequest(format!("Unsupported timezone: {tz}")));
        }
        tz.clone()
    } else {
        sqlx::query_scalar::<_, String>(
            "SELECT timezone FROM notification_settings WHERE user_id = $1"
        )
        .bind(user.id)
        .fetch_optional(&state.db)
        .await?
        .unwrap_or_else(|| "Europe/Moscow".to_string())
    };

    // M5: Validate channels against whitelist
    let channels = body.channels.unwrap_or_else(|| vec!["in_app".to_string()]);
    for ch in &channels {
        if !VALID_CHANNELS.contains(&ch.as_str()) {
            return Err(AppError::BadRequest(format!("Invalid channel: {ch}")));
        }
    }
    if channels.is_empty() || channels.len() > 5 {
        return Err(AppError::BadRequest("1-5 channels required".to_string()));
    }

    // Validate RRULE if provided
    if let Some(ref rrule) = body.rrule {
        if rrule.len() > 200 {
            return Err(AppError::BadRequest("RRULE too long".to_string()));
        }
        // Whitelist known RRULE properties to prevent malformed rules
        let valid_props = ["FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY", "BYMONTH", "BYHOUR", "BYMINUTE", "WKST"];
        for part in rrule.split(';') {
            let key = part.split('=').next().unwrap_or("");
            if !valid_props.contains(&key) {
                return Err(AppError::BadRequest(format!("Invalid RRULE property: {key}")));
            }
        }
    }

    // M2: Atomic insert with count check (avoids TOCTOU race)
    let reminder = sqlx::query_as::<_, Reminder>(
        "INSERT INTO reminders (user_id, title, body, remind_at, user_timezone, rrule, channels)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE (SELECT COUNT(*) FROM reminders WHERE user_id = $1 AND status = 'pending') < 500
         RETURNING *"
    )
    .bind(user.id)
    .bind(&body.title)
    .bind(&body.body)
    .bind(remind_at)
    .bind(&tz)
    .bind(&body.rrule)
    .bind(&channels)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::BadRequest("Maximum 500 active reminders reached".to_string()))?;

    Ok((StatusCode::CREATED, Json(reminder.into())))
}

#[derive(Deserialize, Validate)]
struct UpdateReminderRequest {
    #[validate(length(min = 1, max = 200))]
    title: Option<String>,
    #[validate(length(max = 2000))]
    body: Option<String>,
    remind_at: Option<String>,
    rrule: Option<String>,
    channels: Option<Vec<String>>,
}

async fn update_reminder(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateReminderRequest>,
) -> Result<Json<ReminderResponse>, AppError> {
    body.validate().map_err(|e| AppError::Unprocessable(e.to_string()))?;

    // Verify ownership
    let existing = sqlx::query_as::<_, Reminder>(
        "SELECT * FROM reminders WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Reminder not found".to_string()))?;

    let title = body.title.unwrap_or(existing.title);
    let body_text = body.body.or(existing.body);
    let rrule = body.rrule.or(existing.rrule);
    let channels = body.channels.unwrap_or(existing.channels);

    let remind_at = if let Some(dt_str) = &body.remind_at {
        DateTime::parse_from_rfc3339(dt_str)
            .or_else(|_| DateTime::parse_from_str(dt_str, "%Y-%m-%dT%H:%M:%S"))
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|_| AppError::BadRequest("Invalid remind_at datetime format".to_string()))?
    } else {
        existing.remind_at
    };

    let reminder = sqlx::query_as::<_, Reminder>(
        "UPDATE reminders SET title = $1, body = $2, remind_at = $3, rrule = $4,
         channels = $5, updated_at = now()
         WHERE id = $6 AND user_id = $7
         RETURNING *"
    )
    .bind(&title)
    .bind(&body_text)
    .bind(remind_at)
    .bind(&rrule)
    .bind(&channels)
    .bind(id)
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    // Sync the updated reminder data back to the message steps JSONB
    // so it persists across page reloads (the frontend reads from message steps)
    let reminder_id_str = id.to_string();
    let updated_step = serde_json::json!({
        "type": "reminder_created",
        "id": reminder_id_str,
        "title": &title,
        "body": &body_text,
        "remind_at": remind_at.to_rfc3339(),
        "rrule": &rrule,
    });
    // Find messages containing this reminder ID in steps and update the step
    let like_pattern = format!("%{}%", reminder_id_str);
    let update_result = sqlx::query(
        "UPDATE messages SET steps = (
            SELECT jsonb_agg(
                CASE
                    WHEN elem->>'type' = 'reminder_created' AND elem->>'id' = $1
                    THEN $2::jsonb
                    ELSE elem
                END
            )
            FROM jsonb_array_elements(steps) AS elem
        )
        WHERE steps IS NOT NULL AND steps::text LIKE $3"
    )
    .bind(&reminder_id_str)
    .bind(updated_step)
    .bind(&like_pattern)
    .execute(&state.db)
    .await;

    if let Err(e) = update_result {
        tracing::error!(error = %e, reminder_id = %id, "Failed to sync reminder to message steps");
    }

    Ok(Json(reminder.into()))
}

async fn delete_reminder(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let rows = sqlx::query(
        "UPDATE reminders SET status = 'cancelled', updated_at = now()
         WHERE id = $1 AND user_id = $2 AND status = 'pending'"
    )
    .bind(id)
    .bind(user.id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::NotFound("Reminder not found or already fired".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct SnoozeRequest {
    duration_minutes: i64,
}

async fn snooze_reminder(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<SnoozeRequest>,
) -> Result<Json<ReminderResponse>, AppError> {
    if body.duration_minutes < 1 || body.duration_minutes > 10080 {
        return Err(AppError::BadRequest("Duration must be 1-10080 minutes".to_string()));
    }

    let reminder = sqlx::query_as::<_, Reminder>(
        "UPDATE reminders SET
            status = 'pending',
            remind_at = now() + make_interval(mins => $1::double precision),
            fired_at = NULL,
            updated_at = now()
         WHERE id = $2 AND user_id = $3
         RETURNING *"
    )
    .bind(body.duration_minutes as f64)
    .bind(id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Reminder not found".to_string()))?;

    Ok(Json(reminder.into()))
}

// ── Notification Settings ────────────────────────────────────────────────

#[derive(Serialize)]
struct SettingsResponse {
    email_enabled: bool,
    telegram_enabled: bool,
    timezone: String,
    quiet_start: Option<String>,
    quiet_end: Option<String>,
}

async fn get_settings(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<SettingsResponse>, AppError> {
    let settings = sqlx::query_as::<_, NotificationSettings>(
        "SELECT * FROM notification_settings WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;

    match settings {
        Some(s) => Ok(Json(SettingsResponse {
            email_enabled: s.email_enabled,
            telegram_enabled: s.telegram_enabled,
            timezone: s.timezone,
            quiet_start: s.quiet_start.map(|t| t.format("%H:%M").to_string()),
            quiet_end: s.quiet_end.map(|t| t.format("%H:%M").to_string()),
        })),
        None => Ok(Json(SettingsResponse {
            email_enabled: false,
            telegram_enabled: false,
            timezone: "Europe/Moscow".to_string(),
            quiet_start: Some("23:00".to_string()),
            quiet_end: Some("07:00".to_string()),
        })),
    }
}

#[derive(Deserialize)]
struct UpdateSettingsRequest {
    email_enabled: Option<bool>,
    telegram_enabled: Option<bool>,
    timezone: Option<String>,
    quiet_start: Option<String>,
    quiet_end: Option<String>,
}

const VALID_CHANNELS: &[&str] = &["in_app", "telegram", "email"];

const VALID_TIMEZONES: &[&str] = &[
    "Europe/Moscow", "Europe/Samara", "Asia/Yekaterinburg", "Asia/Omsk",
    "Asia/Novosibirsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Yakutsk",
    "Asia/Vladivostok", "Asia/Magadan", "Asia/Kamchatka", "Europe/Kaliningrad",
    "UTC",
];

async fn update_settings(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<UpdateSettingsRequest>,
) -> Result<Json<SettingsResponse>, AppError> {
    // Validate timezone against supported list
    if let Some(ref tz) = body.timezone {
        if !VALID_TIMEZONES.contains(&tz.as_str()) {
            return Err(AppError::BadRequest(format!("Unsupported timezone: {tz}")));
        }
    }

    let quiet_start = body.quiet_start
        .as_ref()
        .and_then(|s| NaiveTime::parse_from_str(s, "%H:%M").ok());
    let quiet_end = body.quiet_end
        .as_ref()
        .and_then(|s| NaiveTime::parse_from_str(s, "%H:%M").ok());

    // M6: Use COALESCE properly — bind NULLs when fields are not provided
    // so existing values are preserved, not reset to defaults.
    let settings = sqlx::query_as::<_, NotificationSettings>(
        "INSERT INTO notification_settings (user_id, email_enabled, telegram_enabled, timezone, quiet_start, quiet_end)
         VALUES ($1, COALESCE($2, false), COALESCE($3, false), COALESCE($4, 'Europe/Moscow'), $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
            email_enabled = COALESCE($2, notification_settings.email_enabled),
            telegram_enabled = COALESCE($3, notification_settings.telegram_enabled),
            timezone = COALESCE($4, notification_settings.timezone),
            quiet_start = COALESCE($5, notification_settings.quiet_start),
            quiet_end = COALESCE($6, notification_settings.quiet_end),
            updated_at = now()
         RETURNING *"
    )
    .bind(user.id)
    .bind(body.email_enabled)     // Option<bool> — NULL if not provided
    .bind(body.telegram_enabled)  // Option<bool> — NULL if not provided
    .bind(body.timezone.as_deref()) // Option<&str> — NULL if not provided
    .bind(quiet_start)
    .bind(quiet_end)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(SettingsResponse {
        email_enabled: settings.email_enabled,
        telegram_enabled: settings.telegram_enabled,
        timezone: settings.timezone,
        quiet_start: settings.quiet_start.map(|t| t.format("%H:%M").to_string()),
        quiet_end: settings.quiet_end.map(|t| t.format("%H:%M").to_string()),
    }))
}
