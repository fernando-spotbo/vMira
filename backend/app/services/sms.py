"""SMS verification for phone authentication.
Uses Redis for OTP storage with TTL.

In production, integrate with a Russian SMS gateway:
- SMS.ru
- SMSC.ru
- Devino Telecom
"""

import logging
import secrets

from app.middleware.rate_limit import get_redis

logger = logging.getLogger("mira.sms")

OTP_LENGTH = 6
OTP_TTL_SECONDS = 300  # 5 minutes
MAX_VERIFY_ATTEMPTS = 3


def generate_otp() -> str:
    """Generate a 6-digit numeric OTP."""
    return "".join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])


async def send_sms_code(phone: str) -> bool:
    """Send SMS verification code.
    Returns True if sent successfully.
    """
    redis = await get_redis()

    # Check if there's already a pending code (prevent spam)
    cooldown_key = f"sms:cooldown:{phone}"
    if await redis.exists(cooldown_key):
        return False  # Must wait before requesting another code

    code = generate_otp()

    # Store OTP in Redis with TTL
    otp_key = f"sms:otp:{phone}"
    attempts_key = f"sms:attempts:{phone}"

    await redis.set(otp_key, code, ex=OTP_TTL_SECONDS)
    await redis.set(attempts_key, "0", ex=OTP_TTL_SECONDS)
    await redis.set(cooldown_key, "1", ex=60)  # 60-second cooldown between sends

    # TODO: Send SMS via Russian SMS gateway
    # In production: call SMS.ru / SMSC.ru / Devino API here
    # For development, log the code
    logger.info("SMS OTP for %s: %s", phone, code)

    return True


async def verify_sms_code(phone: str, code: str) -> bool:
    """Verify SMS code. Returns True if valid.
    Limits to MAX_VERIFY_ATTEMPTS to prevent brute force.
    """
    redis = await get_redis()

    otp_key = f"sms:otp:{phone}"
    attempts_key = f"sms:attempts:{phone}"

    # Check attempt count
    attempts = await redis.get(attempts_key)
    if attempts and int(attempts) >= MAX_VERIFY_ATTEMPTS:
        # Too many attempts — delete the code
        await redis.delete(otp_key, attempts_key)
        return False

    # Increment attempts
    await redis.incr(attempts_key)

    # Get stored code
    stored = await redis.get(otp_key)
    if not stored or stored != code:
        return False

    # Valid — clean up
    await redis.delete(otp_key, attempts_key, f"sms:cooldown:{phone}")
    return True
