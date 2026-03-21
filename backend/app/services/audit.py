"""Audit logging — tracks security-relevant actions.

PII (email, IP) is hashed in logs for 152-FZ compliance.
"""

import hashlib
import logging
from datetime import datetime, timezone

logger = logging.getLogger("mira.audit")


def _hash_pii(value: str | None) -> str:
    """Hash PII for audit logs — preserves traceability without storing plaintext."""
    if not value or value == "-":
        return "-"
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def log_auth_event(
    action: str,
    user_id: str | None = None,
    email: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    success: bool = True,
    detail: str | None = None,
):
    """Log authentication events (login, register, logout, refresh, failed attempts)."""
    logger.info(
        "AUTH | action=%s user_id=%s email_h=%s ip_h=%s success=%s detail=%s",
        action,
        user_id or "-",
        _hash_pii(email),
        _hash_pii(ip),
        success,
        detail or "-",
    )


def log_api_event(
    action: str,
    user_id: str,
    resource: str | None = None,
    resource_id: str | None = None,
    ip: str | None = None,
    detail: str | None = None,
):
    """Log API actions (create, delete, update on resources)."""
    logger.info(
        "API | action=%s user_id=%s resource=%s resource_id=%s ip_h=%s detail=%s",
        action,
        user_id,
        resource or "-",
        resource_id or "-",
        _hash_pii(ip),
        detail or "-",
    )


def log_security_event(
    event: str,
    ip: str | None = None,
    detail: str | None = None,
):
    """Log security events (rate limit hit, suspicious activity, invalid tokens)."""
    logger.warning(
        "SECURITY | event=%s ip_h=%s detail=%s time=%s",
        event,
        _hash_pii(ip),
        detail or "-",
        datetime.now(timezone.utc).isoformat(),
    )
