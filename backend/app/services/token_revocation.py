"""Token revocation list — Redis-backed.
When a security event occurs (expired refresh reuse, password reset, session revoke),
the user's access tokens are invalidated by adding the user_id to a revocation set.

Access tokens are short-lived (15 min), so revocation entries auto-expire after 15 min.
"""

from app.config import get_settings
from app.middleware.rate_limit import get_redis

settings = get_settings()
REVOCATION_TTL = settings.access_token_expire_minutes * 60  # Match access token lifetime


async def revoke_user_tokens(user_id: str):
    """Mark all access tokens for a user as revoked.
    They'll be rejected by the auth middleware until they naturally expire.
    """
    redis = await get_redis()
    await redis.set(f"revoked:{user_id}", "1", ex=REVOCATION_TTL)


async def is_user_revoked(user_id: str) -> bool:
    """Check if a user's tokens have been revoked."""
    redis = await get_redis()
    return await redis.exists(f"revoked:{user_id}") > 0
