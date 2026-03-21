import time

from fastapi import HTTPException, status
from redis.asyncio import Redis

from app.config import get_settings

settings = get_settings()

_redis: Redis | None = None


async def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def close_redis():
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int,
) -> tuple[bool, int]:
    """Sliding window rate limiter using Redis sorted sets."""
    redis = await get_redis()
    now = time.time()
    window_start = now - window_seconds

    pipe = redis.pipeline(transaction=True)
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds)
    results = await pipe.execute()

    request_count = results[2]
    remaining = max(0, max_requests - request_count)

    return request_count <= max_requests, remaining


async def rate_limit_user(user_id: str):
    """Rate limit per authenticated user."""
    key = f"rl:user:{user_id}"
    allowed, remaining = await check_rate_limit(
        key, settings.rate_limit_requests, settings.rate_limit_window_seconds
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait before making more requests.",
            headers={"Retry-After": str(settings.rate_limit_window_seconds)},
        )


async def rate_limit_login(identifier: str):
    """Rate limit login/register attempts per IP or email."""
    key = f"rl:login:{identifier}"
    allowed, remaining = await check_rate_limit(key, settings.rate_limit_login_attempts, 900)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later.",
            headers={"Retry-After": "900"},
        )


async def rate_limit_api_key_auth(ip: str):
    """Rate limit failed API key authentication attempts per IP.
    Prevents brute-force key guessing.
    """
    key = f"rl:apikey:{ip}"
    allowed, remaining = await check_rate_limit(key, 10, 60)  # 10 failures per minute
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication failures.",
            headers={"Retry-After": "60"},
        )
