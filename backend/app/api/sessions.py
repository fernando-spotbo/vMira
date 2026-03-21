"""Active session management — users can view and revoke their sessions."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.session import RefreshToken
from app.models.user import User
from app.services.audit import log_auth_event
from app.utils.security import hash_token

router = APIRouter()


class SessionResponse(BaseModel):
    id: str
    user_agent: str | None
    ip_address: str | None
    created_at: str
    expires_at: str
    is_current: bool


@router.get("/", response_model=list[SessionResponse])
async def list_sessions(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active sessions for the current user."""
    result = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.user_agent != "password-reset")
        .order_by(RefreshToken.created_at.desc())
    )
    sessions = result.scalars().all()

    # Identify current session by cookie
    current_token = request.cookies.get("refresh_token")
    current_hash = hash_token(current_token) if current_token else None

    return [
        SessionResponse(
            id=str(s.id),
            user_agent=s.user_agent,
            ip_address=s.ip_address,
            created_at=s.created_at.isoformat(),
            expires_at=s.expires_at.isoformat(),
            is_current=s.token_hash == current_hash if current_hash else False,
        )
        for s in sessions
    ]


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a specific session."""
    import uuid
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session ID")

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.id == sid, RefreshToken.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    await db.execute(delete(RefreshToken).where(RefreshToken.id == sid))
    await db.commit()

    log_auth_event("session_revoked", user_id=str(user.id), detail=f"session={session_id}")


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_all_sessions(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all sessions except current."""
    current_token = request.cookies.get("refresh_token")
    current_hash = hash_token(current_token) if current_token else None

    if current_hash:
        await db.execute(
            delete(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.token_hash != current_hash,
            )
        )
    else:
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))

    await db.commit()
    log_auth_event("all_sessions_revoked", user_id=str(user.id))
