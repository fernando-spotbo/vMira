# Mira Assistant Platform — Implementation Plan

## Overview

Transform Mira from a reactive chat app into a proactive AI assistant that reaches users outside the app via reminders, Telegram, scheduled content, calendar integration, and agentic actions.

---

## Phase 1: Reminders & In-App Notifications

**Goal:** Users can say "remind me X at Y" in chat, Mira creates a reminder, and it fires at the right time with in-app notifications.

### 1.1 Database Migration (`006_notifications.sql`)

**Tables:**

```sql
-- Reminders (source of truth for all scheduled items)
CREATE TABLE reminders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL DEFAULT 'reminder',  -- 'reminder' | 'scheduled_content'
    title           TEXT NOT NULL,
    body            TEXT,
    prompt          TEXT,              -- AI prompt for scheduled_content type
    source_message  TEXT,              -- original user message that triggered creation
    remind_at       TIMESTAMPTZ NOT NULL,
    user_timezone   TEXT NOT NULL DEFAULT 'Europe/Moscow',
    rrule           TEXT,              -- RFC 5545 recurrence rule, NULL = one-shot
    recurrence_end  TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'fired', 'cancelled', 'snoozed')),
    channels        TEXT[] NOT NULL DEFAULT '{in_app}',
    fired_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    retry_count     INT NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE
);

CREATE INDEX idx_reminders_pending_due
    ON reminders (remind_at) WHERE status = 'pending';
CREATE INDEX idx_reminders_user_status
    ON reminders (user_id, status, remind_at);

-- In-app notifications (bell icon feed)
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_id     UUID REFERENCES reminders(id) ON DELETE SET NULL,
    type            TEXT NOT NULL DEFAULT 'reminder',  -- 'reminder' | 'system' | 'action'
    title           TEXT NOT NULL,
    body            TEXT,
    read            BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, created_at DESC) WHERE read = false;
CREATE INDEX idx_notifications_user_all
    ON notifications (user_id, created_at DESC);

-- Telegram account linking (Phase 2, but create table now)
CREATE TABLE telegram_links (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    chat_id         BIGINT NOT NULL UNIQUE,
    username        TEXT,
    timezone        TEXT NOT NULL DEFAULT 'Europe/Moscow',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User notification preferences
CREATE TABLE notification_settings (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_enabled   BOOLEAN NOT NULL DEFAULT false,
    telegram_enabled BOOLEAN NOT NULL DEFAULT false,
    timezone        TEXT NOT NULL DEFAULT 'Europe/Moscow',
    quiet_start     TIME DEFAULT '23:00',
    quiet_end       TIME DEFAULT '07:00',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.2 Rust Backend — New Route Module (`routes/notifications.rs`)

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/notifications` | Yes | List notifications (query: `?unread=true&limit=20`) |
| POST | `/api/v1/notifications/:id/read` | Yes | Mark single notification as read |
| POST | `/api/v1/notifications/read-all` | Yes | Mark all as read |
| GET | `/api/v1/reminders` | Yes | List user's reminders (query: `?status=pending`) |
| POST | `/api/v1/reminders` | Yes | Create reminder (also called by AI tool) |
| PUT | `/api/v1/reminders/:id` | Yes | Update reminder (title, remind_at, rrule, channels) |
| DELETE | `/api/v1/reminders/:id` | Yes | Cancel reminder (sets status=cancelled) |
| POST | `/api/v1/reminders/:id/snooze` | Yes | Snooze (body: `{ "duration_minutes": 5 }`) |
| GET | `/api/v1/notification-settings` | Yes | Get user's notification preferences |
| PUT | `/api/v1/notification-settings` | Yes | Update preferences |

**Request/Response schemas:**

```rust
// POST /reminders
struct CreateReminderRequest {
    title: String,           // max 200 chars
    body: Option<String>,    // max 2000 chars
    remind_at: String,       // ISO 8601 datetime
    timezone: Option<String>, // IANA timezone, defaults to user setting
    rrule: Option<String>,   // RFC 5545 recurrence rule
    channels: Option<Vec<String>>, // defaults to ["in_app"]
}

// Response for reminder endpoints
struct ReminderResponse {
    id: Uuid,
    title: String,
    body: Option<String>,
    remind_at: String,       // ISO 8601 UTC
    user_timezone: String,
    rrule: Option<String>,
    status: String,
    channels: Vec<String>,
    created_at: String,
    updated_at: String,
}

// GET /notifications response item
struct NotificationResponse {
    id: Uuid,
    type_: String,
    title: String,
    body: Option<String>,
    read: bool,
    reminder_id: Option<Uuid>,
    created_at: String,
}

// GET /notifications response wrapper
struct NotificationsListResponse {
    notifications: Vec<NotificationResponse>,
    unread_count: i64,
}
```

### 1.3 Rust Backend — AI Tool Integration (`services/ai_proxy.rs`)

**Add `create_reminder` tool alongside `web_search`:**

```rust
fn reminder_tool() -> serde_json::Value {
    json!({
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": "Create a reminder or scheduled notification for the user. \
                Use when the user says: remind me, напомни, напомни мне, не забудь, \
                don't forget, don't let me forget, set a reminder, поставь напоминание, \
                through time expressions like 'через 5 минут', 'завтра в 10', 'every Monday'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short summary of what to remind about (max 200 chars)"
                    },
                    "remind_at": {
                        "type": "string",
                        "description": "ISO 8601 datetime for when to send the reminder, \
                            resolved relative to the current time provided in the system prompt. \
                            Must be in the user's timezone."
                    },
                    "recurrence": {
                        "type": ["string", "null"],
                        "description": "RFC 5545 RRULE string if recurring (e.g. 'FREQ=WEEKLY;BYDAY=MO'), \
                            null if one-time"
                    }
                },
                "required": ["title", "remind_at"]
            }
        }
    })
}
```

**System prompt injection (add to the messages array before sending to model):**

```
Current datetime: 2026-03-24T14:30:00+03:00
User timezone: Europe/Moscow
When the user asks for a reminder, resolve ALL relative times to absolute ISO 8601 datetimes in the user's timezone.
Examples: "через 5 минут" → add 5 minutes to current time. "завтра в 10" → next day at 10:00.
"каждый понедельник в 9" → next Monday 09:00 with recurrence FREQ=WEEKLY;BYDAY=MO.
```

**Tool execution flow:**

1. Model returns `tool_calls` with `create_reminder` function call
2. Backend parses the arguments (title, remind_at, recurrence)
3. Backend converts `remind_at` from user timezone to UTC
4. Backend inserts into `reminders` table
5. Backend constructs a tool result message with the created reminder details
6. Backend sends tool result back to model for the final response
7. Model generates a natural confirmation message
8. Frontend receives the confirmation + a new SSE event `{ type: "reminder_created", data: { id, title, remind_at, rrule } }`

**Where tools are added (in `stream_ai_response` function):**

Currently at line ~332: `body["tools"] = json!([web_search_tool()]);`
Change to: `body["tools"] = json!([web_search_tool(), reminder_tool()]);`

Handle the `create_reminder` tool call in the tool-call processing loop (currently handles only web_search around line ~353).

### 1.4 Rust Backend — Background Scheduler

**New module: `services/scheduler.rs`**

A tokio task spawned in `main.rs` that polls for due reminders:

```rust
pub async fn run_reminder_scheduler(state: AppState) {
    let mut interval = tokio::time::interval(Duration::from_secs(30));
    loop {
        interval.tick().await;
        if let Err(e) = process_due_reminders(&state).await {
            tracing::error!(error = %e, "Reminder scheduler error");
        }
    }
}

async fn process_due_reminders(state: &AppState) -> Result<(), AppError> {
    // Fetch due reminders with row lock (prevents double-firing across restarts)
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

    for reminder in due {
        // Check quiet hours
        let settings = get_notification_settings(&state.db, reminder.user_id).await?;
        if is_quiet_hours(&settings) {
            // Reschedule to end of quiet hours
            reschedule_after_quiet_hours(&state.db, &reminder, &settings).await?;
            continue;
        }

        // 1. Always create in-app notification
        create_in_app_notification(&state.db, &reminder).await?;

        // 2. Telegram (Phase 2 — skip for now)
        // if reminder.channels.contains(&"telegram".to_string()) && settings.telegram_enabled {
        //     send_telegram_notification(&state, &reminder).await?;
        // }

        // 3. Email (Phase 6 — skip for now)
        // if reminder.channels.contains(&"email".to_string()) && settings.email_enabled {
        //     send_email_notification(&state, &reminder).await?;
        // }

        // 4. Handle recurrence
        if let Some(rrule) = &reminder.rrule {
            schedule_next_occurrence(&state.db, &reminder, rrule).await?;
        }
    }

    Ok(())
}
```

**Add to `main.rs` before server start:**

```rust
// Spawn background reminder scheduler
let scheduler_state = state.clone();
tokio::spawn(async move {
    services::scheduler::run_reminder_scheduler(scheduler_state).await;
});
```

**Quiet hours logic:**

```rust
fn is_quiet_hours(settings: &NotificationSettings) -> bool {
    let user_tz: Tz = settings.timezone.parse().unwrap_or(chrono_tz::Europe::Moscow);
    let now_local = Utc::now().with_timezone(&user_tz).time();

    if settings.quiet_start < settings.quiet_end {
        // e.g., 23:00 to 07:00 wraps around midnight
        // This case: quiet_start=09:00, quiet_end=17:00 (no wrap)
        now_local >= settings.quiet_start && now_local < settings.quiet_end
    } else {
        // Wrap around midnight: quiet_start=23:00, quiet_end=07:00
        now_local >= settings.quiet_start || now_local < settings.quiet_end
    }
}
```

**Recurrence handling (simplified for Phase 1 — basic patterns only):**

For MVP, support these patterns without a full RRULE parser:
- `FREQ=DAILY` → add 1 day
- `FREQ=WEEKLY;BYDAY=MO` → find next Monday
- `FREQ=WEEKLY;BYDAY=MO,WE,FR` → find next matching day
- `FREQ=MONTHLY` → add 1 month

Store the RRULE string for future full parser, but compute next occurrence with simple logic initially. A full RRULE parser crate (`rrule` or custom) can be added later.

```rust
async fn schedule_next_occurrence(db: &PgPool, reminder: &Reminder, rrule: &str) -> Result<()> {
    let next = compute_next_from_rrule(reminder.remind_at, rrule, &reminder.user_timezone)?;

    if let Some(next_at) = next {
        // Check if past recurrence_end
        if let Some(end) = reminder.recurrence_end {
            if next_at > end { return Ok(()); }
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
    }

    Ok(())
}
```

### 1.5 Cargo.toml — New Dependencies

```toml
# Timezone handling for reminders
chrono-tz = "0.10"
```

No other new dependencies needed. `chrono`, `sqlx`, `tokio`, `reqwest`, `serde_json` are already in the project.

### 1.6 Frontend — New SSE Event Types

Add to the existing SSE event handling in `ChatContext.tsx`:

```typescript
// New event from backend when AI creates a reminder
case "reminder_created":
  // data: { id, title, remind_at, rrule, status }
  // Used to render the reminder card inline in the chat
  break;
```

### 1.7 Frontend — Reminder Card Component (`components/ReminderCard.tsx`)

A styled card that appears inline in the chat when a reminder is created:

```
Props:
  - id: string
  - title: string
  - remindAt: string (ISO 8601)
  - rrule: string | null
  - status: 'pending' | 'fired' | 'cancelled'
  - onEdit: () => void
  - onDelete: () => void

Visual:
  - Distinct from regular messages: bg-white/[0.04] border border-white/[0.08] rounded-2xl
  - Clock icon (lucide: Clock) + title in bold
  - Schedule in human-readable format below title
  - Status badge: green dot = active, gray = cancelled, check = fired
  - Two buttons: [Изменить] [Удалить] — text buttons, white/40 color
  - Max width same as message bubbles
```

### 1.8 Frontend — Notification Bell + Drawer

**Bell icon (in Sidebar header or TopBar):**
- `Bell` icon from lucide-react
- Badge: small red/white circle with unread count (hidden if 0)
- Click toggles the notification drawer

**NotificationDrawer component (`components/NotificationDrawer.tsx`):**

```
Props:
  - isOpen: boolean
  - onClose: () => void

Sections:
  - Header: "Уведомления" + unread count + [Mark all read] button + close X
  - Tabs: "Все" | "Непрочитанные"
  - List of NotificationItem cards:
    - Bell icon + title (bold if unread)
    - Body text (truncated to 2 lines)
    - Relative timestamp ("5 мин назад", "вчера")
    - Click: marks as read, scrolls to related chat if applicable
  - Empty state: "Нет уведомлений" with bell illustration
  - Footer: link to Settings → Notifications

Behavior:
  - Slides in from right side, 360px wide
  - Semi-transparent backdrop on mobile (full-screen sheet)
  - Polls GET /notifications?unread=true every 30 seconds
  - Badge count updates from poll response (unread_count field)
```

### 1.9 Frontend — Settings → Notifications Tab Wiring

Replace the current placeholder `NotificationsTab` in `SettingsModal.tsx`:

```
- Timezone selector: dropdown with Russian timezone options
  [Москва (UTC+3)] [Екатеринбург (UTC+5)] [Новосибирск (UTC+7)]
  [Красноярск (UTC+8)] [Иркутск (UTC+8)] [Якутск (UTC+9)]
  [Владивосток (UTC+10)] [Магадан (UTC+11)] [Камчатка (UTC+12)]

- Email notifications: toggle (wired to PUT /notification-settings)
- Sound: toggle (local state, stored in localStorage)
- Quiet hours: two time pickers (start, end)
- Telegram: "Подключить Telegram" button (Phase 2 — show as coming soon)

All toggles call PUT /notification-settings on change.
Load current settings from GET /notification-settings on tab mount.
```

### 1.10 Frontend — Reminders Drawer (`components/RemindersDrawer.tsx`)

Accessible from:
- Sidebar menu item "Напоминания" (with active count badge)
- Or from notification drawer "View all reminders" link

```
Sections:
  - Header: "Напоминания" + active count + close X
  - Filter: "Активные" | "Выполненные" | "Все"
  - List of ReminderItem cards:
    - Title (bold)
    - Schedule: human-readable ("Завтра в 10:00" or "Каждый пн в 9:00")
    - Status dot: green (pending), gray (cancelled), check (fired)
    - Hover actions: pencil (edit), three-dot menu (pause, delete)
  - Quick create: [+ Новое напоминание] button → opens inline form
  - Empty state: "Нет напоминаний. Попросите Миру создать одно!"

Edit inline:
  - Click pencil → title becomes editable input, schedule shows date/time pickers
  - Save → PUT /reminders/:id
  - Cancel → revert to display mode
```

### 1.11 Frontend — API Client Extensions (`lib/api-client.ts`)

```typescript
// Notifications
export async function getNotifications(unread?: boolean, limit?: number);
export async function markNotificationRead(id: string);
export async function markAllNotificationsRead();

// Reminders
export async function getReminders(status?: string);
export async function createReminder(data: CreateReminderRequest);
export async function updateReminder(id: string, data: UpdateReminderRequest);
export async function deleteReminder(id: string);
export async function snoozeReminder(id: string, durationMinutes: number);

// Notification Settings
export async function getNotificationSettings();
export async function updateNotificationSettings(data: NotificationSettingsUpdate);
```

### 1.12 Proxy Route Updates

Add to allowed prefixes in `src/app/api/proxy/[...path]/route.ts`:
- `notifications/`
- `reminders/`
- `notification-settings/`

### 1.13 i18n Keys

Add to the translation system (`lib/i18n.ts`):

```
reminders.title = "Напоминания" / "Reminders"
reminders.empty = "Нет напоминаний" / "No reminders"
reminders.emptyHint = "Попросите Миру создать одно!" / "Ask Mira to set one!"
reminders.active = "Активные" / "Active"
reminders.completed = "Выполненные" / "Completed"
reminders.all = "Все" / "All"
reminders.new = "Новое напоминание" / "New reminder"
reminders.edit = "Изменить" / "Edit"
reminders.delete = "Удалить" / "Delete"
reminders.snooze = "Отложить" / "Snooze"
reminders.created = "Сохранено" / "Saved"
reminders.cancelled = "Отменено" / "Cancelled"
reminders.fired = "Выполнено" / "Done"

notifications.title = "Уведомления" / "Notifications"
notifications.empty = "Нет уведомлений" / "No notifications"
notifications.markAllRead = "Прочитать все" / "Mark all read"
notifications.unread = "Непрочитанные" / "Unread"

settings.timezone = "Часовой пояс" / "Timezone"
settings.timezoneDesc = "Для корректного времени напоминаний" / "For correct reminder times"
settings.quietHours = "Тихие часы" / "Quiet hours"
settings.quietHoursDesc = "Не отправлять уведомления в это время" / "Don't send notifications during this time"
settings.telegramConnect = "Подключить Telegram" / "Connect Telegram"
settings.telegramComingSoon = "Скоро" / "Coming soon"
```

---

## Phase 2: Telegram Bot (One-Way → Two-Way)

> Detailed in main plan. Builds on Phase 1 scheduler + telegram_links table.
> Key: BotFather setup, webhook handler, deep link account linking, edit-in-place streaming, HTML formatting.

## Phase 3: Scheduled AI Content

> Extends Phase 1 reminders with type='scheduled_content' + prompt field.
> Scheduler generates AI content on delivery. Anti-fatigue guardrails.

## Phase 4: Action Card + Agentic Actions

> Reusable Action Card UI component. SSE action events. Confirmation flow.
> Actions: send email, send Telegram message, create calendar event.

## Phase 5: Calendar Integration

> Google Calendar OAuth (read → write). ICS feed. Yandex Calendar CalDAV.
> AI tools: read_calendar, create_calendar_event.

---

## Testing Checklist — Phase 1

### Backend Tests

- [ ] Migration runs cleanly on fresh DB
- [ ] POST /reminders creates with valid data, returns 201
- [ ] POST /reminders rejects missing title (422)
- [ ] POST /reminders rejects past remind_at (422)
- [ ] GET /reminders returns only current user's reminders
- [ ] PUT /reminders/:id updates title and remind_at
- [ ] DELETE /reminders/:id sets status=cancelled
- [ ] POST /reminders/:id/snooze updates remind_at by duration
- [ ] GET /notifications returns unread notifications
- [ ] POST /notifications/:id/read marks as read
- [ ] POST /notifications/read-all marks all as read
- [ ] GET /notification-settings returns defaults for new user
- [ ] PUT /notification-settings updates timezone and toggles
- [ ] Scheduler picks up due reminders within 30 seconds
- [ ] Scheduler creates in-app notification for each fired reminder
- [ ] Scheduler handles recurring reminders (creates next occurrence)
- [ ] Scheduler respects quiet hours (reschedules)
- [ ] Scheduler uses SKIP LOCKED (no double-firing on restart)
- [ ] AI tool call: "remind me in 5 minutes test" → reminder created
- [ ] AI tool call: "каждый понедельник в 9 напомни отчет" → recurring reminder created

### Frontend Tests

- [ ] Bell icon shows in header/sidebar
- [ ] Bell badge shows correct unread count
- [ ] Click bell opens notification drawer
- [ ] Notifications load and display correctly
- [ ] Click notification marks as read, badge decrements
- [ ] "Mark all read" clears all unread
- [ ] Reminder card appears inline in chat after AI creates one
- [ ] Reminder card shows correct title and schedule
- [ ] Edit button on reminder card opens edit mode
- [ ] Delete button removes reminder
- [ ] Reminders drawer opens from sidebar
- [ ] Reminders list shows active/completed filters
- [ ] Settings → Notifications saves timezone preference
- [ ] Settings → Notifications saves quiet hours
- [ ] Settings toggles persist after page reload
- [ ] Polling updates bell badge every 30 seconds
- [ ] Toast notification appears when reminder fires (if user is in app)

### End-to-End Tests

- [ ] Say "напомни через 2 минуты тест" → card appears → after 2 min: bell badge lights up + toast + notification in drawer
- [ ] Say "remind me every day at 9am to exercise" → recurring card → fires next day → new occurrence auto-created
- [ ] Create reminder, reload page → reminder still in drawer (persisted)
- [ ] Create reminder, change timezone in settings → reminder fires at correct local time
- [ ] Create reminder during quiet hours → delayed until quiet hours end
- [ ] Snooze a fired reminder → fires again after snooze duration
- [ ] Cancel a pending reminder → disappears from active list, appears in completed as cancelled
