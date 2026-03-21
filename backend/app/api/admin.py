"""Admin API — protected by admin role check.
For internal use: user management, usage analytics, moderation.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.rate_limit import rate_limit_user
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.services.audit import log_api_event

router = APIRouter()


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Only users with is_admin=True can access admin endpoints."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return user


class AdminUserResponse(BaseModel):
    id: str
    name: str
    email: str | None
    phone: str | None
    plan: str
    language: str
    is_active: bool
    daily_messages_used: int
    created_at: str


class UsageStats(BaseModel):
    total_users: int
    active_users_today: int
    total_conversations: int
    total_messages: int
    messages_today: int
    users_by_plan: dict[str, int]


@router.get("/stats", response_model=UsageStats)
async def get_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit_user(str(admin.id))
    """Global usage statistics."""
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).date()

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    active_today = (await db.execute(
        select(func.count()).select_from(User).where(User.daily_messages_used > 0, func.date(User.daily_reset_at) == today)
    )).scalar()
    total_convs = (await db.execute(select(func.count()).select_from(Conversation))).scalar()
    total_msgs = (await db.execute(select(func.count()).select_from(Message))).scalar()
    msgs_today = (await db.execute(
        select(func.count()).select_from(Message).where(func.date(Message.created_at) == today)
    )).scalar()

    # Users by plan
    plan_counts = await db.execute(
        select(User.plan, func.count()).group_by(User.plan)
    )
    users_by_plan = {row[0]: row[1] for row in plan_counts.all()}

    return UsageStats(
        total_users=total_users or 0,
        active_users_today=active_today or 0,
        total_conversations=total_convs or 0,
        total_messages=total_msgs or 0,
        messages_today=msgs_today or 0,
        users_by_plan=users_by_plan,
    )


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    plan: str | None = None,
):
    """List users with optional plan filter."""
    q = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    if plan:
        q = q.where(User.plan == plan)

    result = await db.execute(q)
    return [
        AdminUserResponse(
            id=str(u.id), name=u.name, email=u.email, phone=u.phone,
            plan=u.plan, language=u.language, is_active=u.is_active,
            daily_messages_used=u.daily_messages_used, created_at=u.created_at.isoformat(),
        )
        for u in result.scalars().all()
    ]


@router.patch("/users/{user_id}/plan")
async def update_user_plan(
    user_id: uuid.UUID,
    plan: str = Query(..., pattern=r"^(free|pro|max|enterprise)$"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's plan."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    old_plan = target.plan
    target.plan = plan
    await db.commit()

    log_api_event("admin_plan_change", str(admin.id), "user", str(user_id),
                  detail=f"{old_plan}->{plan}")

    return {"detail": f"Plan updated to {plan}"}


@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a user account."""
    await db.execute(update(User).where(User.id == user_id).values(is_active=False))
    await db.commit()
    log_api_event("admin_deactivate", str(admin.id), "user", str(user_id))
    return {"detail": "User deactivated"}
