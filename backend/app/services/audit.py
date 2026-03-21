"""Audit logging — tracks security-relevant actions."""

import logging
from datetime import datetime, timezone

logger = logging.getLogger("mira.audit")


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
        "AUTH | action=%s user_id=%s email=%s ip=%s success=%s detail=%s ua=%s",
        action,
        user_id or "-",
        email or "-",
        ip or "-",
        success,
        detail or "-",
        (user_agent or "-")[:100],
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
        "API | action=%s user_id=%s resource=%s resource_id=%s ip=%s detail=%s",
        action,
        user_id,
        resource or "-",
        resource_id or "-",
        ip or "-",
        detail or "-",
    )


def log_security_event(
    event: str,
    ip: str | None = None,
    detail: str | None = None,
):
    """Log security events (rate limit hit, suspicious activity, invalid tokens)."""
    logger.warning(
        "SECURITY | event=%s ip=%s detail=%s time=%s",
        event,
        ip or "-",
        detail or "-",
        datetime.now(timezone.utc).isoformat(),
    )
