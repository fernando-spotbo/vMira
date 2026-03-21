import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.rate_limit import rate_limit_user
from app.models.api_key import ApiKey, generate_api_key, hash_api_key
from app.models.user import User

router = APIRouter()


class CreateKeyRequest(BaseModel):
    name: str


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    is_active: bool
    total_requests: int
    total_tokens: int
    last_used_at: str | None
    created_at: str


class ApiKeyCreatedResponse(ApiKeyResponse):
    key: str  # Full key — shown only once


@router.get("/", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == user.id, ApiKey.is_active.is_(True))
        .order_by(ApiKey.created_at.desc())
    )
    return [
        ApiKeyResponse(
            id=str(k.id), name=k.name, key_prefix=k.key_prefix, is_active=k.is_active,
            total_requests=k.total_requests, total_tokens=k.total_tokens,
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            created_at=k.created_at.isoformat(),
        )
        for k in result.scalars().all()
    ]


@router.post("/", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: CreateKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit_user(str(user.id))
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.is_active.is_(True))
    )
    if len(result.scalars().all()) >= 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 10 active API keys")

    raw_key = generate_api_key()
    key = ApiKey(
        user_id=user.id,
        name=body.name,
        key_hash=hash_api_key(raw_key),
        key_prefix=raw_key[:16],
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)

    return ApiKeyCreatedResponse(
        id=str(key.id), name=key.name, key_prefix=key.key_prefix, is_active=key.is_active,
        total_requests=key.total_requests, total_tokens=key.total_tokens,
        last_used_at=None, created_at=key.created_at.isoformat(),
        key=raw_key,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    # Soft delete — revoke, don't destroy (keeps audit trail)
    key.is_active = False
    await db.commit()
