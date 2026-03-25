//! Background reminder scheduler — polls DB every 30s for due reminders.

use std::time::Duration;

use chrono::{Datelike, Utc, Weekday};
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::AppState;
use crate::models::{NotificationSettings, Reminder, TelegramLink};
use crate::services::telegram::{format_reminder_html, reminder_keyboard, TelegramBot};

/// Main scheduler loop — spawned as a tokio task in main.rs.
pub async fn run_reminder_scheduler(state: AppState) {
    tracing::info!("Reminder scheduler started (30s interval)");
    let mut interval = tokio::time::interval(Duration::from_secs(30));

    // Briefing check runs every 5 minutes (not every 30s)
    let mut briefing_counter: u32 = 0;

    loop {
        interval.tick().await;
        if let Err(e) = process_due_reminders(&state).await {
            tracing::error!(error = %e, "Reminder scheduler error");
        }
        // Check briefings every ~5 min (10 ticks * 30s)
        briefing_counter += 1;
        if briefing_counter >= 10 {
            briefing_counter = 0;
            if let Err(e) = process_due_briefings(&state).await {
                tracing::error!(error = %e, "Briefing scheduler error");
            }
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
        // Load user's notification settings for channel checks
        let settings = get_settings(&state.db, reminder.user_id).await;

        // For scheduled_content: generate AI content before notification
        let delivery_title;
        let delivery_body;
        if reminder.type_ == "scheduled_content" {
            if let Some(ref prompt) = reminder.prompt {
                match generate_ai_content(state, prompt).await {
                    Ok(content) => {
                        delivery_title = reminder.title.clone();
                        delivery_body = Some(content);
                    }
                    Err(e) => {
                        tracing::error!(reminder_id = %reminder.id, error = %e, "Failed to generate scheduled content");
                        delivery_title = reminder.title.clone();
                        delivery_body = Some("Не удалось сгенерировать контент. Попробуем в следующий раз.".to_string());
                    }
                }
            } else {
                delivery_title = reminder.title.clone();
                delivery_body = reminder.body.clone();
            }
        } else {
            delivery_title = reminder.title.clone();
            delivery_body = reminder.body.clone();
        }

        // Create in-app notification with generated content
        if let Err(e) = create_notification(&state.db, &reminder, &delivery_title, delivery_body.as_deref()).await {
            tracing::error!(reminder_id = %reminder.id, error = %e, "Failed to create notification");
        }

        // Send Telegram notification if enabled and channel includes telegram
        if settings.telegram_enabled && reminder.channels.contains(&"telegram".to_string()) {
            if let Err(e) = send_telegram_notification_with_content(state, &reminder, &delivery_title, delivery_body.as_deref()).await {
                tracing::error!(reminder_id = %reminder.id, error = %e, "Failed to send Telegram notification");
            }
        }

        // Send email notification if channel includes email
        if settings.email_enabled && reminder.channels.contains(&"email".to_string()) {
            if let Err(e) = send_email_notification(state, &reminder, &delivery_title, delivery_body.as_deref()).await {
                tracing::error!(reminder_id = %reminder.id, error = %e, "Failed to send email notification");
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
        quiet_start: None,
        quiet_end: None,
        updated_at: Utc::now(),
        briefing_enabled: false,
        briefing_time: chrono::NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
        briefing_last_sent: None,
    })
}

async fn create_notification(db: &PgPool, reminder: &Reminder, title: &str, body: Option<&str>) -> Result<(), sqlx::Error> {
    let notif_type = if reminder.type_ == "scheduled_content" { "scheduled_content" } else { "reminder" };
    sqlx::query(
        "INSERT INTO notifications (user_id, reminder_id, type, title, body)
         VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(reminder.user_id)
    .bind(reminder.id)
    .bind(notif_type)
    .bind(title)
    .bind(body)
    .execute(db)
    .await?;

    tracing::info!(reminder_id = %reminder.id, "Notification created");
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

    // H5: Enforce 500 reminder limit for recurring reminders too
    let active_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reminders WHERE user_id = $1 AND status = 'pending'"
    )
    .bind(reminder.user_id)
    .fetch_one(db)
    .await?;

    if active_count >= 500 {
        tracing::warn!(reminder_id = %reminder.id, "Recurrence limit reached (500 pending)");
        return Ok(());
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
            // H4: Cap interval to prevent DoS (max 365 days)
            let interval: i64 = parts.get("INTERVAL")
                .and_then(|v| v.parse().ok())
                .unwrap_or(1)
                .max(1).min(365);
            Some(last_at + chrono::Duration::days(interval))
        }
        "WEEKLY" => {
            let interval: i64 = parts.get("INTERVAL")
                .and_then(|v| v.parse().ok())
                .unwrap_or(1)
                .max(1).min(52);

            if let Some(byday) = parts.get("BYDAY") {
                let target_days: Vec<Weekday> = byday
                    .split(',')
                    .filter_map(parse_weekday)
                    .collect();

                if target_days.is_empty() {
                    return Some(last_at + chrono::Duration::weeks(interval));
                }

                // Find next matching weekday (bounded loop: max 14 iterations)
                for offset in 1..=14 {
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
                .unwrap_or(1)
                .max(1).min(12);

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

/// Generate AI content from a prompt (for scheduled_content type).
async fn generate_ai_content(state: &AppState, prompt: &str) -> Result<String, String> {
    let url = &state.config.ai_model_url;
    let api_key = &state.config.ai_model_api_key;

    if url.is_empty() || api_key.is_empty() {
        return Err("AI model not configured".into());
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": format!(
                    "Ты Мира — AI-ассистент. Сгенерируй контент по запросу пользователя. \
                     Текущая дата: {}. Пиши на русском, кратко и по делу (3-5 абзацев макс). \
                     Не используй markdown заголовки. Можешь использовать эмодзи умеренно.",
                    chrono::Utc::now().format("%Y-%m-%d %H:%M")
                )
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 1024,
        "temperature": 0.8,
        "stream": false,
    });

    let resp = client
        .post(format!("{}/chat/completions", url))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("AI request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("AI API returned {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("Parse error: {e}"))?;

    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Контент недоступен")
        .to_string())
}

/// Send a Telegram notification with custom title/body content.
async fn send_telegram_notification_with_content(
    state: &AppState,
    reminder: &Reminder,
    title: &str,
    body: Option<&str>,
) -> Result<(), String> {
    let bot_token = &state.config.telegram_bot_token;
    if bot_token.is_empty() {
        return Ok(());
    }

    let link = sqlx::query_as::<_, TelegramLink>(
        "SELECT * FROM telegram_links WHERE user_id = $1 AND is_active = true"
    )
    .bind(reminder.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    let Some(link) = link else {
        return Ok(());
    };

    let bot = TelegramBot::new(bot_token);

    if reminder.type_ == "scheduled_content" {
        // Scheduled content: send as a rich message without snooze/dismiss buttons
        let mut msg = format!("📋 <b>{}</b>\n\n", crate::services::telegram::html_escape(title));
        if let Some(b) = body {
            msg.push_str(&crate::services::telegram::html_escape(b));
        }
        bot.send_message(link.chat_id, &msg, None).await?;
    } else {
        // Regular reminder: send with inline keyboard
        let text = format_reminder_html(title, body);
        let keyboard = reminder_keyboard(&reminder.id.to_string());
        bot.send_message(link.chat_id, &text, Some(keyboard)).await?;
    }

    tracing::info!(reminder_id = %reminder.id, "Telegram notification sent");
    Ok(())
}

/// Send a reminder notification via email.
async fn send_email_notification(
    state: &AppState,
    reminder: &Reminder,
    title: &str,
    body: Option<&str>,
) -> Result<(), String> {
    let smtp_host = &state.config.smtp_host;
    if smtp_host.is_empty() {
        return Ok(()); // SMTP not configured, skip
    }

    // Get user's email
    let email: Option<String> = sqlx::query_scalar(
        "SELECT email FROM users WHERE id = $1"
    )
    .bind(reminder.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    let Some(email) = email.filter(|e| !e.is_empty()) else {
        return Ok(()); // No email on account
    };

    let body_text = body.unwrap_or("");
    let html_body = format!(
        "<div style=\"font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;\">\
         <h2 style=\"color: #fff; font-size: 18px;\">{}</h2>\
         <p style=\"color: #ccc; font-size: 15px; line-height: 1.6; white-space: pre-wrap;\">{}</p>\
         <hr style=\"border: none; border-top: 1px solid #333; margin: 24px 0;\">\
         <p style=\"color: #666; font-size: 12px;\">Мира — AI-ассистент · <a href=\"https://vmira.ai\" style=\"color: #888;\">vmira.ai</a></p>\
         </div>",
        title, body_text
    );

    use lettre::{
        message::{header::ContentType, Mailbox},
        transport::smtp::authentication::Credentials,
        AsyncSmtpTransport, AsyncTransport, Message as EmailMessage, Tokio1Executor,
    };

    let from: Mailbox = state.config.smtp_from.parse()
        .map_err(|e| format!("Invalid SMTP_FROM: {e}"))?;
    let to: Mailbox = email.parse()
        .map_err(|e| format!("Invalid user email: {e}"))?;

    let email_msg = EmailMessage::builder()
        .from(from)
        .to(to)
        .subject(format!("🔔 {}", title))
        .header(ContentType::TEXT_HTML)
        .body(html_body)
        .map_err(|e| format!("Email build error: {e}"))?;

    let creds = Credentials::new(
        state.config.smtp_user.clone(),
        state.config.smtp_password.clone(),
    );

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(smtp_host)
        .map_err(|e| format!("SMTP relay error: {e}"))?
        .port(state.config.smtp_port)
        .credentials(creds)
        .build();

    mailer.send(email_msg).await
        .map_err(|e| format!("SMTP send error: {e}"))?;

    tracing::info!(reminder_id = %reminder.id, "Email notification sent");
    Ok(())
}

// ── Daily Briefing Delivery ─────────────────────────────────────────────

async fn process_due_briefings(state: &AppState) -> Result<(), String> {
    let now = Utc::now();
    let today = now.date_naive();

    // Find users who have briefing enabled, it's past their briefing_time today,
    // and we haven't sent a briefing for today yet
    #[derive(sqlx::FromRow)]
    struct BriefingUser {
        user_id: Uuid,
        timezone: String,
    }

    let users = sqlx::query_as::<_, BriefingUser>(
        "SELECT ns.user_id, ns.timezone FROM notification_settings ns
         WHERE ns.briefing_enabled = true
           AND (ns.briefing_last_sent IS NULL OR ns.briefing_last_sent < $1)
         LIMIT 50"
    )
    .bind(today)
    .fetch_all(&state.db)
    .await
    .map_err(|e| format!("Briefing query: {e}"))?;

    if users.is_empty() {
        return Ok(());
    }

    for bu in &users {
        // Check if current time in user's timezone is past briefing_time
        let offset_hours: i64 = match bu.timezone.as_str() {
            "Europe/Kaliningrad" => 2, "Europe/Moscow" => 3, "Europe/Samara" => 4,
            "Asia/Yekaterinburg" => 5, "Asia/Omsk" => 6, "Asia/Novosibirsk" | "Asia/Krasnoyarsk" => 7,
            "Asia/Irkutsk" => 8, "Asia/Yakutsk" => 9, "Asia/Vladivostok" => 10,
            "Asia/Magadan" => 11, "Asia/Kamchatka" => 12, _ => 3,
        };
        let user_now = now + chrono::Duration::hours(offset_hours);
        let user_time = user_now.time();

        let briefing_time: Option<(chrono::NaiveTime,)> = sqlx::query_as(
            "SELECT briefing_time FROM notification_settings WHERE user_id = $1"
        ).bind(bu.user_id).fetch_optional(&state.db).await.unwrap_or(None);

        let target_time = briefing_time.map(|(t,)| t).unwrap_or(chrono::NaiveTime::from_hms_opt(8, 0, 0).unwrap());
        if user_time < target_time {
            continue;
        }

        // Send briefing via Telegram
        if let Err(e) = send_telegram_briefing(state, bu.user_id).await {
            tracing::warn!(user_id = %bu.user_id, error = %e, "Briefing delivery failed");
            continue;
        }

        // Mark as sent
        let _ = sqlx::query(
            "UPDATE notification_settings SET briefing_last_sent = $1 WHERE user_id = $2"
        ).bind(today).bind(bu.user_id).execute(&state.db).await;
    }

    Ok(())
}

async fn send_telegram_briefing(state: &AppState, user_id: Uuid) -> Result<(), String> {
    use crate::services::telegram::html_escape;

    let link = sqlx::query_as::<_, TelegramLink>(
        "SELECT * FROM telegram_links WHERE user_id = $1 AND is_active = true"
    ).bind(user_id).fetch_optional(&state.db).await
    .map_err(|e| format!("TG link query: {e}"))?
    .ok_or("No Telegram link")?;

    let bot_token = &state.config.telegram_bot_token;
    if bot_token.is_empty() { return Err("No bot token".into()); }
    let bot = TelegramBot::new(bot_token);

    let now = Utc::now();
    let today_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
    let today_end = now.date_naive().and_hms_opt(23, 59, 59).unwrap().and_utc();

    // Reminders
    let reminders: Vec<(String, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT title, remind_at FROM reminders
         WHERE user_id = $1 AND status = 'pending' AND remind_at >= $2 AND remind_at <= $3
         ORDER BY remind_at LIMIT 10"
    ).bind(user_id).bind(today_start).bind(today_end)
    .fetch_all(&state.db).await.unwrap_or_default();

    // Events
    let events: Vec<(String, chrono::DateTime<Utc>, Option<String>)> = sqlx::query_as(
        "SELECT title, start_at, location FROM calendar_events
         WHERE user_id = $1 AND start_at >= $2 AND start_at <= $3
         ORDER BY start_at LIMIT 10"
    ).bind(user_id).bind(today_start).bind(today_end)
    .fetch_all(&state.db).await.unwrap_or_default();

    // Weather
    let city: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM user_memory WHERE user_id = $1 AND key IN ('city', 'location') LIMIT 1"
    ).bind(user_id).fetch_optional(&state.db).await.unwrap_or(None);

    let mut msg = String::from("<b>Mira</b>\n\n");

    // Weather section
    if let Some((city_name,)) = city {
        if let Ok(w) = crate::services::weather::get_weather(&city_name).await {
            msg.push_str(&format!(
                "{} <b>{}°C</b>, {}\n{}\n\n",
                w.icon, w.temperature.round(), html_escape(&w.description), html_escape(&w.city)
            ));
        }
    }

    // Schedule section
    if !reminders.is_empty() || !events.is_empty() {
        for (title, at) in &reminders {
            msg.push_str(&format!("  {} <b>{}</b>\n", at.format("%H:%M"), html_escape(title)));
        }
        for (title, at, loc) in &events {
            let loc_str = loc.as_deref().map(|l| format!(" — {}", html_escape(l))).unwrap_or_default();
            msg.push_str(&format!("  {} <b>{}</b>{}\n", at.format("%H:%M"), html_escape(title), loc_str));
        }
    } else {
        msg.push_str("No events today\n");
    }

    bot.send_message(link.chat_id, &msg, None).await
        .map_err(|e| format!("TG send: {e}"))?;

    tracing::info!(user_id = %user_id, "Daily briefing sent to Telegram");
    Ok(())
}
