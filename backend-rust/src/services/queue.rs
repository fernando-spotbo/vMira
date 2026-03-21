//! GPU-aware request queue using Redis semaphore pattern.
//!
//! Manages concurrency for AI generation requests — at most `gpu_max_concurrent`
//! requests can run simultaneously.  Excess requests are queued in a Redis sorted
//! set ordered by arrival time.

use std::time::Duration;

use serde::Serialize;
use tokio_util::sync::CancellationToken;

use crate::config::Config;
use crate::error::AppError;

// ── Queue stats ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct QueueStats {
    pub active_requests: i32,
    pub max_concurrent: i32,
    pub queue_length: i32,
    pub estimated_wait_seconds: i32,
}

// ── Slot guard ────────────────────────────────────────────────────────────

/// RAII guard that releases a GPU slot when dropped.
pub struct SlotGuard {
    redis: redis::Client,
    request_id: String,
    acquired: bool,
}

impl SlotGuard {
    fn new(redis: redis::Client, request_id: String) -> Self {
        Self {
            redis,
            request_id,
            acquired: true,
        }
    }

    /// Mark the slot as manually released (prevents double-release in Drop).
    pub fn disarm(&mut self) {
        self.acquired = false;
    }
}

impl Drop for SlotGuard {
    fn drop(&mut self) {
        if self.acquired {
            let redis = self.redis.clone();
            let request_id = self.request_id.clone();
            tokio::spawn(async move {
                if let Err(e) = release_slot_inner(&redis).await {
                    tracing::error!(
                        error = %e,
                        request_id = %request_id,
                        "failed to release GPU slot on drop"
                    );
                }
            });
        }
    }
}

// ── Internal helpers ──────────────────────────────────────────────────────

const GPU_ACTIVE_KEY: &str = "gpu:active";
const GPU_QUEUE_KEY: &str = "gpu:queue";

/// Atomically try to acquire a GPU slot.
///
/// Uses a Lua script that increments `gpu:active` only if the current count
/// is below `max_concurrent`.  Returns `1` if the slot was acquired, `0` otherwise.
async fn try_acquire_inner(redis: &redis::Client, max_concurrent: i32) -> Result<bool, AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;

    let script = redis::Script::new(
        r#"
        local current = tonumber(redis.call('GET', KEYS[1]) or '0')
        if current < tonumber(ARGV[1]) then
            redis.call('INCR', KEYS[1])
            redis.call('EXPIRE', KEYS[1], 600)
            return 1
        end
        return 0
        "#,
    );

    let acquired: i32 = script
        .key(GPU_ACTIVE_KEY)
        .arg(max_concurrent)
        .invoke_async(&mut conn)
        .await?;

    Ok(acquired == 1)
}

/// Release a GPU slot (decrement active count, clamped to 0).
async fn release_slot_inner(redis: &redis::Client) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;

    let script = redis::Script::new(
        r#"
        local val = tonumber(redis.call('GET', KEYS[1]) or '0')
        if val > 0 then
            redis.call('DECR', KEYS[1])
        end
        return 0
        "#,
    );

    let _: i32 = script.key(GPU_ACTIVE_KEY).invoke_async(&mut conn).await?;

    Ok(())
}

// ── Public API ────────────────────────────────────────────────────────────

/// Try to acquire a GPU slot immediately.
///
/// Returns `Some(SlotGuard)` if a slot was available, `None` if the queue is full.
pub async fn try_acquire_slot(
    redis: &redis::Client,
    request_id: &str,
    config: &Config,
) -> Result<Option<SlotGuard>, AppError> {
    if try_acquire_inner(redis, config.gpu_max_concurrent).await? {
        Ok(Some(SlotGuard::new(redis.clone(), request_id.to_string())))
    } else {
        Ok(None)
    }
}

/// Add a request to the wait queue.  Returns the queue position (1-based).
pub async fn enqueue_request(
    redis: &redis::Client,
    request_id: &str,
    _user_id: &str,
) -> Result<i32, AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;

    let score = chrono::Utc::now().timestamp_millis() as f64;

    let _: () = redis::cmd("ZADD")
        .arg(GPU_QUEUE_KEY)
        .arg(score)
        .arg(request_id)
        .query_async(&mut conn)
        .await?;

    // Set expiry on the queue key to avoid leaking memory
    let _: () = redis::cmd("EXPIRE")
        .arg(GPU_QUEUE_KEY)
        .arg(3600)
        .query_async(&mut conn)
        .await?;

    let rank: Option<i64> = redis::cmd("ZRANK")
        .arg(GPU_QUEUE_KEY)
        .arg(request_id)
        .query_async(&mut conn)
        .await?;

    Ok(rank.map(|r| r as i32 + 1).unwrap_or(1))
}

/// Remove a request from the wait queue.
pub async fn dequeue_request(redis: &redis::Client, request_id: &str) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;

    let _: () = redis::cmd("ZREM")
        .arg(GPU_QUEUE_KEY)
        .arg(request_id)
        .query_async(&mut conn)
        .await?;

    Ok(())
}

/// Get the current queue position for a request (1-based), or 0 if not in queue.
pub async fn get_queue_position(
    redis: &redis::Client,
    request_id: &str,
) -> Result<i32, AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;

    let rank: Option<i64> = redis::cmd("ZRANK")
        .arg(GPU_QUEUE_KEY)
        .arg(request_id)
        .query_async(&mut conn)
        .await?;

    Ok(rank.map(|r| r as i32 + 1).unwrap_or(0))
}

/// Release a GPU slot explicitly (non-RAII path).
pub async fn release_slot(redis: &redis::Client) -> Result<(), AppError> {
    release_slot_inner(redis).await
}

/// Get current queue stats.
pub async fn get_queue_stats(redis: &redis::Client, config: &Config) -> Result<QueueStats, AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;

    let active: i32 = redis::cmd("GET")
        .arg(GPU_ACTIVE_KEY)
        .query_async::<Option<String>>(&mut conn)
        .await?
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let queue_length: i32 = redis::cmd("ZCARD")
        .arg(GPU_QUEUE_KEY)
        .query_async::<i64>(&mut conn)
        .await
        .map(|v| v as i32)
        .unwrap_or(0);

    // Rough estimate: ~5 seconds per active request
    let estimated_wait = if active >= config.gpu_max_concurrent {
        (queue_length + 1) * 5
    } else {
        0
    };

    Ok(QueueStats {
        active_requests: active,
        max_concurrent: config.gpu_max_concurrent,
        queue_length,
        estimated_wait_seconds: estimated_wait,
    })
}

/// Wait in queue until a GPU slot becomes available.
///
/// Polls every 500ms for slot availability.  When a slot opens, the request is
/// dequeued and a `SlotGuard` is returned.  If the `cancel_token` fires, the
/// request is removed from the queue and an error is returned.
///
/// The `on_position` callback is invoked each time the queue position changes
/// so the caller can stream position updates to the client.
pub async fn wait_for_slot<F>(
    redis: &redis::Client,
    request_id: &str,
    config: &Config,
    cancel_token: CancellationToken,
    mut on_position: F,
) -> Result<SlotGuard, AppError>
where
    F: FnMut(i32, i32) + Send,
{
    let mut last_position: i32 = 0;

    loop {
        // Check cancellation
        if cancel_token.is_cancelled() {
            let _ = dequeue_request(redis, request_id).await;
            return Err(AppError::BadRequest("Request cancelled".to_string()));
        }

        // Try to acquire a slot
        if let Some(guard) = try_acquire_slot(redis, request_id, config).await? {
            // Remove from queue since we got a slot
            let _ = dequeue_request(redis, request_id).await;
            return Ok(guard);
        }

        // Report current queue position
        let position = get_queue_position(redis, request_id).await?;
        let estimated_wait = position * 5;

        if position != last_position {
            on_position(position, estimated_wait);
            last_position = position;
        }

        // Wait before polling again
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(500)) => {}
            _ = cancel_token.cancelled() => {
                let _ = dequeue_request(redis, request_id).await;
                return Err(AppError::BadRequest("Request cancelled".to_string()));
            }
        }
    }
}
