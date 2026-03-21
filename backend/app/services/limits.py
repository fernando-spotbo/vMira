"""Daily message limit enforcement per user plan."""

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

PLAN_LIMITS = {
    "free": 20,
    "pro": 500,
    "max": -1,  # Unlimited
    "enterprise": -1,
}


async def check_and_increment(user: User, db: AsyncSession) -> tuple[bool, int]:
    """Atomically check daily limit and increment usage.
    Uses SELECT FOR UPDATE to prevent race conditions.
    Returns (allowed, remaining).
    """
    limit = PLAN_LIMITS.get(user.plan, 20)

    # Unlimited plans
    if limit == -1:
        return True, -1

    now = datetime.now(timezone.utc)

    # Lock the row to prevent concurrent updates
    result = await db.execute(
        select(User).where(User.id == user.id).with_for_update()
    )
    locked_user = result.scalar_one()

    # Reset counter if new day
    if locked_user.daily_reset_at.date() < now.date():
        locked_user.daily_messages_used = 0
        locked_user.daily_reset_at = now

    # Check limit
    if locked_user.daily_messages_used >= limit:
        await db.commit()  # Release the lock
        return False, 0

    # Increment atomically
    locked_user.daily_messages_used += 1
    await db.commit()

    remaining = max(0, limit - locked_user.daily_messages_used)
    return True, remaining
