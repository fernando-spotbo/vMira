"""Email service — sends transactional emails.

In production, use a Russian-compatible SMTP provider:
- Unisender (Russian, good deliverability to Mail.ru/Yandex)
- Mailganer (Russian)
- Or self-hosted with SPF/DKIM/DMARC configured

For development, logs emails to console.
"""

import logging

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("mira.email")


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send a transactional email.
    Returns True if sent successfully.
    """
    if settings.debug:
        logger.info("EMAIL to=%s subject='%s'\n%s", to, subject, html_body[:500])
        return True

    # TODO: Replace with actual SMTP/API integration
    # Example for Unisender API:
    # async with httpx.AsyncClient() as client:
    #     resp = await client.post(
    #         "https://api.unisender.com/ru/api/sendEmail",
    #         data={
    #             "api_key": settings.email_api_key,
    #             "email": to,
    #             "sender_name": "Mira",
    #             "sender_email": "noreply@mira.ai",
    #             "subject": subject,
    #             "body": html_body,
    #         },
    #     )
    #     return resp.status_code == 200

    logger.warning("Email service not configured — email to %s not sent", to)
    return False


async def send_password_reset(to: str, reset_url: str, language: str = "ru"):
    """Send password reset email."""
    if language == "ru":
        subject = "Сброс пароля — Мира"
        body = f"""
        <h2>Сброс пароля</h2>
        <p>Вы запросили сброс пароля для вашего аккаунта Мира.</p>
        <p><a href="{reset_url}" style="padding:12px 24px;background:#fff;color:#161616;text-decoration:none;border-radius:8px;font-weight:600;">Сбросить пароль</a></p>
        <p>Ссылка действительна 1 час. Если вы не запрашивали сброс, проигнорируйте это письмо.</p>
        """
    else:
        subject = "Password Reset — Mira"
        body = f"""
        <h2>Reset your password</h2>
        <p>You requested a password reset for your Mira account.</p>
        <p><a href="{reset_url}" style="padding:12px 24px;background:#fff;color:#161616;text-decoration:none;border-radius:8px;font-weight:600;">Reset password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        """

    return await send_email(to, subject, body)


async def send_verification(to: str, verify_url: str, language: str = "ru"):
    """Send email verification."""
    if language == "ru":
        subject = "Подтверждение email — Мира"
        body = f"""
        <h2>Подтвердите вашу почту</h2>
        <p>Нажмите на кнопку ниже, чтобы подтвердить вашу электронную почту.</p>
        <p><a href="{verify_url}" style="padding:12px 24px;background:#fff;color:#161616;text-decoration:none;border-radius:8px;font-weight:600;">Подтвердить</a></p>
        """
    else:
        subject = "Email Verification — Mira"
        body = f"""
        <h2>Verify your email</h2>
        <p>Click the button below to verify your email address.</p>
        <p><a href="{verify_url}" style="padding:12px 24px;background:#fff;color:#161616;text-decoration:none;border-radius:8px;font-weight:600;">Verify email</a></p>
        """

    return await send_email(to, subject, body)
