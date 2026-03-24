//! Background reminder scheduler — polls DB every 30s for due reminders.

use std::time::Duration;

use chrono::{Datelike, NaiveTime, Utc, Weekday};
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::AppState;
use crate::models::{NotificationSettings, Reminder, TelegramLink};
use crate::services::telegram::{format_reminder_html, reminder_keyboard, TelegramBot};

/// Main scheduler loop — spawned as a tokio task in main.rs.
pub async fn run_reminder_scheduler(state: AppState) {
    tracing::info!("Reminder scheduler started (30s interval)");
    let mut interval = tokio::time::interval(Duration::from_secs(30));

    loop {
        interval.tick().await;
        if let Err(e) = process_due_reminders(&state).await {
            tracing::error!(error = %e, "Reminder scheduler error");
        }
    }
}

async fn process_due_reminders(state: &AppState) -> Result<(), sqlx::Error> {
    // Atomically fetch + mark as fired using SKIP LOCKED to avoid double-fire
    let due = sqlx::query_as::<_, Reminder>(
        "UPDATE reminders SET status = 'fired', fired_at = now()
         WHERE id IN (
             SELECT id FROM reminders
             WHERE status = 'pending' AND remind_at <= now()
             ORDER BY remind_at
             LIMIT 100
             FOR UPDATE SKIP LOCKED
         )
         RETURNING *"
    )
    .fetch_all(&state.db)
    .await?;

    if due.is_empty() {
        return Ok(());
    }

    tracing::info!(count = due.len(), "Processing due reminders");

    for reminder in due {
        // Load user's notification settings for quiet hours check
        let settings = get_settings(&state.db, reminder.user_id).await;

        if is_quiet_hours(&settings) {
            // Reschedule to after quiet hours
            if let Err(e) = reschedule_after_quiet(&state.db, &reminder, &settings).await {
                tracing::error!(reminder_id = %reminder.id, error = %e, "Failed to reschedule after quiet hours");
            }
            continue;
        }

        // Create in-app notification
        if let Err(e) = create_notification(&state.db, &reminder).await {
            tracing::error!(reminder_id = %reminder.id, error = %e, "Failed to create notification");
        }

        // Send Telegram notification if enabled
        if settings.telegram_enabled {
            if let Err(e) = send_telegram_notification(state, &reminder).await {
                tracing::error!(reminder_id = %reminder.id, error = %e, "Failed to send Telegram notification");
            }
        }

        // Handle recurrence — schedule next occurrence
        if let Some(ref rrule) = reminder.rrule {
            if let Err(e) = schedule_next(&state.db, &reminder, rrule).await {
                tracing::error!(reminder_id = %reminder.id, error = %e, "Failed to schedule next occurrence");
            }
        }
    }

    Ok(())
}

async fn get_settings(db: &PgPool, user_id: Uuid) -> NotificationSettings {
    sqlx::query_as::<_, NotificationSettings>(
        "SELECT * FROM notification_settings WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| NotificationSettings {
        user_id,
        email_enabled: false,
        telegram_enabled: false,
        timezone: "Europe/Moscow".to_string(),
        quiet_start: Some(NaiveTime::from_hms_opt(23, 0, 0).unwrap()),
        quiet_end: Some(NaiveTime::from_hms_opt(7, 0, 0).unwrap()),
        updated_at: Utc::now(),
    })
}

fn is_quiet_hours(settings: &NotificationSettings) -> bool {
    let (Some(start), Some(end)) = (settings.quiet_start, settings.quiet_end) else {
        return false;
    };

    // Parse timezone, fallback to UTC
    let now_utc = Utc::now();
    let offset_hours = match settings.timezone.as_str() {
        "Europe/Moscow" => 3,
        "Europe/Samara" => 4,
        "Asia/Yekaterinburg" => 5,
        "Asia/Omsk" => 6,
        "Asia/Novosibirsk" | "Asia/Krasnoyarsk" => 7,
        "Asia/Irkutsk" => 8,
        "Asia/Yakutsk" => 9,
        "Asia/Vladivostok" => 10,
        "Asia/Magadan" => 11,
        "Asia/Kamchatka" => 12,
        _ => 3, // default Moscow
    };

    let now_local = now_utc + chrono::Duration::hours(offset_hours);
    let time_local = now_local.time();

    if start <= end {
        // No midnight wrap (e.g., 09:00 - 17:00)
        time_local >= start && time_local < end
    } else {
        // Midnight wrap (e.g., 23:00 - 07:00)
        time_local >= start || time_local < end
    }
}

async fn reschedule_after_quiet(
    db: &PgPool,
    reminder: &Reminder,
    settings: &NotificationSettings,
) -> Result<(), sqlx::Error> {
    let end = settings.quiet_end.unwrap_or(NaiveTime::from_hms_opt(7, 0, 0).unwrap());

    // Reschedule to today's quiet_end or tomorrow's if quiet_end already passed
    let offset_hours = match settings.timezone.as_str() {
        "Europe/Moscow" => 3,
        "Europe/Samara" => 4,
        "Asia/Yekaterinburg" => 5,
        _ => 3,
    };

    let now = Utc::now();
    let today = (now + chrono::Duration::hours(offset_hours)).date_naive();
    let target_local = today.and_time(end);
    let target_utc = target_local - chrono::Duration::hours(offset_hours);

    let target = if target_utc.and_utc() <= now {
        // quiet_end already passed today, schedule for tomorrow
        (target_utc + chrono::Duration::days(1)).and_utc()
    } else {
        target_utc.and_utc()
    };

    sqlx::query(
        "UPDATE reminders SET status = 'pending', fired_at = NULL, remind_at = $1
         WHERE id = $2"
    )
    .bind(target)
    .bind(reminder.id)
    .execute(db)
    .await?;

    tracing::info!(reminder_id = %reminder.id, rescheduled_to = %target, "Rescheduled reminder after quiet hours");
    Ok(())
}

async fn create_notification(db: &PgPool, reminder: &Reminder) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO notifications (user_id, reminder_id, type, title, body)
         VALUES ($1, $2, 'reminder', $3, $4)"
    )
    .bind(reminder.user_id)
    .bind(reminder.id)
    .bind(&reminder.title)
    .bind(&reminder.body)
    .execute(db)
    .await?;

    tracing::info!(
        reminder_id = %reminder.id,
        user_id = %reminder.user_id,
        title = %reminder.title,
        "Notification created"
    );
    Ok(())
}

/// Schedule the next occurrence of a recurring reminder.
/// Supports basic RRULE patterns — full parser can be added later.
async fn schedule_next(
    db: &PgPool,
    reminder: &Reminder,
    rrule: &str,
) -> Result<(), sqlx::Error> {
    let next = compute_next(reminder.remind_at, rrule);

    let Some(next_at) = next else {
        tracing::debug!(reminder_id = %reminder.id, "No next occurrence for rrule: {}", rrule);
        return Ok(());
    };

    // Check recurrence_end
    if let Some(end) = reminder.recurrence_end {
        if next_at > end {
            tracing::debug!(reminder_id = %reminder.id, "Recurrence ended");
            return Ok(());
        }
    }

    sqlx::query(
        "INSERT INTO reminders (user_id, type, title, body, remind_at, user_timezone, rrule, recurrence_end, channels)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
    )
    .bind(reminder.user_id)
    .bind(&reminder.type_)
    .bind(&reminder.title)
    .bind(&reminder.body)
    .bind(next_at)
    .bind(&reminder.user_timezone)
    .bind(rrule)
    .bind(reminder.recurrence_end)
    .bind(&reminder.channels)
    .execute(db)
    .await?;

    tracing::info!(
        reminder_id = %reminder.id,
        next_at = %next_at,
        "Scheduled next recurrence"
    );
    Ok(())
}

/// Compute next occurrence from a simplified RRULE.
/// Supports: FREQ=DAILY, FREQ=WEEKLY;BYDAY=MO,WE,FR, FREQ=MONTHLY
fn compute_next(
    last_at: chrono::DateTime<Utc>,
    rrule: &str,
) -> Option<chrono::DateTime<Utc>> {
    let parts: std::collections::HashMap<&str, &str> = rrule
        .split(';')
        .filter_map(|p| p.split_once('='))
        .collect();

    let freq = parts.get("FREQ")?;

    match *freq {
        "DAILY" => {
            let interval: i64 = parts.get("INTERVAL")
                .and_then(|v| v.parse().ok())
                .unwrap_or(1);
            Some(last_at + chrono::Duration::days(interval))
        }
        "WEEKLY" => {
            let interval: i64 = parts.get("INTERVAL")
                .and_then(|v| v.parse().ok())
                .unwrap_or(1);

            if let Some(byday) = parts.get("BYDAY") {
                let target_days: Vec<Weekday> = byday
                    .split(',')
                    .filter_map(parse_weekday)
                    .collect();

                if target_days.is_empty() {
                    return Some(last_at + chrono::Duration::weeks(interval));
                }

                // Find next matching weekday after last_at
                for offset in 1..=7 * interval + 7 {
                    let candidate = last_at + chrono::Duration::days(offset);
                    if target_days.contains(&candidate.weekday()) {
                        return Some(candidate);
                    }
                }
                None
            } else {
                Some(last_at + chrono::Duration::weeks(interval))
            }
        }
        "MONTHLY" => {
            let interval: u32 = parts.get("INTERVAL")
                .and_then(|v| v.parse().ok())
                .unwrap_or(1);

            let naive = last_at.naive_utc();
            let mut month = naive.month() + interval;
            let mut year = naive.year();
            while month > 12 {
                month -= 12;
                year += 1;
            }

            let day = naive.day().min(28); // safe for all months
            let next_naive = chrono::NaiveDate::from_ymd_opt(year, month, day)?
                .and_time(naive.time());
            Some(next_naive.and_utc())
        }
        _ => None,
    }
}

fn parse_weekday(s: &str) -> Option<Weekday> {
    match s.trim() {
        "MO" => Some(Weekday::Mon),
        "TU" => Some(Weekday::Tue),
        "WE" => Some(Weekday::Wed),
        "TH" => Some(Weekday::Thu),
        "FR" => Some(Weekday::Fri),
        "SA" => Some(Weekday::Sat),
        "SU" => Some(Weekday::Sun),
        _ => None,
    }
}

/// Send a reminder notification via Telegram.
async fn send_telegram_notification(
    state: &AppState,
    reminder: &Reminder,
) -> Result<(), String> {
    let bot_token = &state.config.telegram_bot_token;
    if bot_token.is_empty() {
        return Ok(()); // Bot not configured, skip silently
    }

    // Look up user's Telegram link
    let link = sqlx::query_as::<_, TelegramLink>(
        "SELECT * FROM telegram_links WHERE user_id = $1 AND is_active = true"
    )
    .bind(reminder.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    let Some(link) = link else {
        return Ok(()); // No active Telegram link
    };

    let bot = TelegramBot::new(bot_token);
    let text = format_reminder_html(&reminder.title, reminder.body.as_deref());
    let keyboard = reminder_keyboard(&reminder.id.to_string());

    bot.send_message(link.chat_id, &text, Some(keyboard)).await?;

    tracing::info!(
        reminder_id = %reminder.id,
        chat_id = link.chat_id,
        "Telegram notification sent"
    );

    Ok(())
}
