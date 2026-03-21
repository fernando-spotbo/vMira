"""Data retention management — Yarovaya Law + 152-FZ compliance.

Yarovaya Law:
  - Message content: 6 months minimum retention
  - Metadata (sender, time, etc.): 1 year minimum retention

152-FZ:
  - Data should not be retained longer than necessary
  - Must delete when purpose is fulfilled or consent withdrawn

Policy: Retain messages 6 months, metadata 1 year, then purge.
Runs as a scheduled task (daily via Celery or cron).
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.session import RefreshToken

logger = logging.getLogger("mira.retention")

MESSAGE_RETENTION_DAYS = 180  # 6 months (Yarovaya minimum)
METADATA_RETENTION_DAYS = 365  # 1 year (Yarovaya minimum)
ARCHIVED_PURGE_DAYS = 30  # Purge archived conversations after 30 days
SESSION_RETENTION_DAYS = 90  # Purge expired sessions after 90 days
BATCH_SIZE = 5000  # Process in batches to avoid long locks


async def run_retention_cleanup():
    """Scheduled task: enforce data retention policies."""
    now = datetime.now(timezone.utc)

    # 1. Purge message CONTENT older than 6 months (keep metadata row) — batched
    content_cutoff = now - timedelta(days=MESSAGE_RETENTION_DAYS)
    total_content = 0
    while True:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                update(Message)
                .where(Message.created_at < content_cutoff, Message.content != "[deleted]")
                .values(content="[deleted]", steps=None)
                .execution_options(synchronize_session=False)
            )
            await db.commit()
            if result.rowcount == 0:
                break
            total_content += result.rowcount
            if result.rowcount < BATCH_SIZE:
                break
    if total_content > 0:
        logger.info("Retention: cleared content from %d messages older than %d days",
                     total_content, MESSAGE_RETENTION_DAYS)

    # 2. Delete message ROWS older than 1 year (metadata gone) — batched
    metadata_cutoff = now - timedelta(days=METADATA_RETENTION_DAYS)
    total_deleted = 0
    while True:
        async with AsyncSessionLocal() as db:
            # Get batch of IDs to delete
            result = await db.execute(
                select(Message.id)
                .where(Message.created_at < metadata_cutoff)
                .limit(BATCH_SIZE)
            )
            ids = [row[0] for row in result.all()]
            if not ids:
                break
            await db.execute(delete(Message).where(Message.id.in_(ids)))
            await db.commit()
            total_deleted += len(ids)
    if total_deleted > 0:
        logger.info("Retention: deleted %d message rows older than %d days",
                     total_deleted, METADATA_RETENTION_DAYS)

    # 3. Delete empty conversations (all messages purged)
    async with AsyncSessionLocal() as db:
        empty_convs = await db.execute(
            select(Conversation.id)
            .outerjoin(Message)
            .group_by(Conversation.id)
            .having(select(Message.id).where(Message.conversation_id == Conversation.id).correlate(Conversation).exists().is_(False))
        )
        empty_ids = [row[0] for row in empty_convs.all()]
        if empty_ids:
            await db.execute(delete(Conversation).where(Conversation.id.in_(empty_ids)))
            await db.commit()
            logger.info("Retention: deleted %d empty conversations", len(empty_ids))

    # 4. Purge archived conversations after grace period
    async with AsyncSessionLocal() as db:
        archive_cutoff = now - timedelta(days=ARCHIVED_PURGE_DAYS)
        result = await db.execute(
            delete(Conversation).where(
                Conversation.archived.is_(True),
                Conversation.updated_at < archive_cutoff,
            )
        )
        if result.rowcount > 0:
            await db.commit()
            logger.info("Retention: purged %d archived conversations", result.rowcount)

    # 5. Purge expired refresh tokens / sessions (152-FZ: IP data retention)
    async with AsyncSessionLocal() as db:
        session_cutoff = now - timedelta(days=SESSION_RETENTION_DAYS)
        result = await db.execute(
            delete(RefreshToken).where(RefreshToken.expires_at < session_cutoff)
        )
        if result.rowcount > 0:
            await db.commit()
            logger.info("Retention: purged %d expired sessions", result.rowcount)

    logger.info("Retention cleanup completed")
