"""HMAC request signing verification with nonce-based replay protection."""

import hashlib
import hmac
import time

from fastapi import HTTPException, Request, status

from app.config import get_settings
from app.services.audit import log_security_event

settings = get_settings()

MAX_TIMESTAMP_DRIFT_SECONDS = 300
GENERIC_ERROR = "Forbidden"  # Same message for all failures — no information leakage


async def verify_hmac_signature(request: Request):
    """Verify HMAC-SHA256 signature on incoming requests from Vercel."""
    if settings.debug:
        return

    timestamp = request.headers.get("X-Request-Timestamp")
    nonce = request.headers.get("X-Request-Nonce")
    signature = request.headers.get("X-Request-Signature")
    client_ip = request.client.host if request.client else None

    if not all([timestamp, nonce, signature]):
        log_security_event("hmac_missing", ip=client_ip)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GENERIC_ERROR)

    try:
        ts = int(timestamp)
    except ValueError:
        log_security_event("hmac_bad_timestamp", ip=client_ip)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GENERIC_ERROR)

    now = int(time.time())
    if abs(now - ts) > MAX_TIMESTAMP_DRIFT_SECONDS:
        log_security_event("hmac_expired", ip=client_ip, detail=f"drift={abs(now - ts)}s")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GENERIC_ERROR)

    # Nonce replay protection
    from app.middleware.rate_limit import get_redis
    redis = await get_redis()
    nonce_key = f"hmac:nonce:{nonce}"
    was_new = await redis.set(nonce_key, "1", nx=True, ex=MAX_TIMESTAMP_DRIFT_SECONDS)
    if not was_new:
        log_security_event("hmac_replay", ip=client_ip)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GENERIC_ERROR)

    # Verify signature
    body = await request.body()
    method = request.method.upper()
    path = request.url.path

    payload = f"{method}\n{path}\n{timestamp}\n{nonce}\n{body.decode('utf-8', errors='replace')}"
    expected = hmac.new(
        settings.hmac_secret.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        log_security_event("hmac_invalid", ip=client_ip)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GENERIC_ERROR)
