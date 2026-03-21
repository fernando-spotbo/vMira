import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.rate_limit import rate_limit_login
from app.models.session import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    PhoneSmsRequest,
    PhoneVerifyRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
    VkAuthRequest,
    YandexAuthRequest,
)
from app.services.audit import log_auth_event, log_security_event
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)

logger = logging.getLogger("mira.auth")
settings = get_settings()
router = APIRouter()


# ---- Helpers ----

def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        phone=_mask_phone(user.phone),
        avatar_url=user.avatar_url,
        plan=user.plan,
        language=user.language,
        created_at=user.created_at.isoformat(),
    )


def _mask_phone(phone: str | None) -> str | None:
    """Mask phone for API response: +7***4567"""
    if not phone or len(phone) < 8:
        return phone
    return phone[:2] + "***" + phone[-4:]


async def _issue_tokens(
    user: User, request: Request, response: Response, db: AsyncSession
) -> TokenResponse:
    """Create access + refresh tokens, set cookie, return response."""
    client_ip = request.client.host if request.client else "unknown"

    access_token = create_access_token(str(user.id))
    raw_refresh, refresh_hash, expires_at = create_refresh_token(str(user.id))

    rt = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        user_agent=request.headers.get("user-agent"),
        ip_address=client_ip,
        expires_at=expires_at,
    )
    db.add(rt)
    await db.commit()

    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 86400,
        path=f"{settings.api_prefix}/auth",
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


async def _find_or_create_oauth_user(
    db: AsyncSession,
    provider: str,
    provider_id: str,
    email: str | None,
    name: str,
    avatar: str | None,
    email_verified: bool = False,
) -> User:
    """Find existing user by provider ID or email, or create new one."""
    # 1. Try by provider ID
    provider_field = {"vk": User.vk_id, "yandex": User.yandex_id, "google": User.google_id}[provider]
    result = await db.execute(select(User).where(provider_field == provider_id))
    user = result.scalar_one_or_none()

    if user:
        if not user.avatar_url and avatar:
            user.avatar_url = avatar
        return user

    # 2. Try by email (link accounts) — only if provider verified the email
    if email and email_verified:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            setattr(user, f"{provider}_id", provider_id)
            if not user.avatar_url and avatar:
                user.avatar_url = avatar
            return user

    # 3. Create new — consent must be confirmed by the caller
    user = User(
        email=email if email_verified else None,
        name=name,
        avatar_url=avatar,
        is_verified=email_verified,
    )
    setattr(user, f"{provider}_id", provider_id)
    db.add(user)
    return user


# ---- Registration ----

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    await rate_limit_login(client_ip)

    # 152-FZ: Consent must be explicit and separate
    if not body.consent_personal_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Consent for personal data processing is required",
        )

    # Need at least email or phone
    if not body.email and not body.phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email or phone number required",
        )

    # Check uniqueness
    conditions = []
    if body.email:
        conditions.append(User.email == body.email)
    if body.phone:
        conditions.append(User.phone == body.phone)

    result = await db.execute(select(User).where(or_(*conditions)))
    if result.scalar_one_or_none():
        hash_password(body.password)  # Timing oracle prevention
        log_security_event("register_duplicate", ip=client_ip)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed. If this account exists, try logging in.",
        )

    user = User(
        name=body.name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        consent_personal_data=True,
        consent_personal_data_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    log_auth_event("register", user_id=str(user.id), email=body.email, ip=client_ip)
    return _user_response(user)


# ---- Login (email or phone + password) ----

@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    identifier = body.email or body.phone
    if not identifier:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email or phone required")

    await rate_limit_login(client_ip)
    await rate_limit_login(f"id:{identifier}")

    # Find by email or phone
    if body.email:
        result = await db.execute(select(User).where(User.email == body.email))
    else:
        result = await db.execute(select(User).where(User.phone == body.phone))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        hash_password("dummy-password-timing-burn")
        log_auth_event("login_failed", email=body.email, ip=client_ip, success=False, detail="unknown")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # ALWAYS verify password first (constant time) — then check locked status
    # This prevents timing oracle that reveals locked vs non-locked accounts
    password_valid = verify_password(body.password, user.password_hash)

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        log_auth_event("login_locked", user_id=str(user.id), ip=client_ip, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not password_valid:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            log_auth_event("account_locked", user_id=str(user.id), ip=client_ip, success=False)
        await db.commit()
        log_auth_event("login_failed", user_id=str(user.id), ip=client_ip, success=False,
                       detail=f"attempt={user.failed_login_attempts}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    log_auth_event("login", user_id=str(user.id), ip=client_ip, user_agent=request.headers.get("user-agent"))
    return await _issue_tokens(user, request, response, db)


# ---- Phone SMS auth ----

@router.post("/phone/send-code")
async def phone_send_code(body: PhoneSmsRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await rate_limit_login(client_ip)

    from app.services.sms import send_sms_code
    sent = await send_sms_code(body.phone)
    if not sent:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Please wait before requesting another code")

    log_auth_event("sms_sent", ip=client_ip, detail=body.phone)
    return {"detail": "Code sent"}


@router.post("/phone/verify", response_model=TokenResponse)
async def phone_verify(
    body: PhoneVerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    await rate_limit_login(client_ip)

    from app.services.sms import verify_sms_code
    valid = await verify_sms_code(body.phone, body.code)
    if not valid:
        log_auth_event("phone_verify_failed", ip=client_ip, detail=body.phone, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")

    # Find or create user by phone
    result = await db.execute(select(User).where(User.phone == body.phone))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            phone=body.phone,
            name="User",
            is_verified=True,
            consent_personal_data=True,
            consent_personal_data_at=datetime.now(timezone.utc),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        log_auth_event("register_phone", user_id=str(user.id), ip=client_ip, detail=body.phone)
    else:
        user.is_verified = True
        await db.commit()

    log_auth_event("phone_login", user_id=str(user.id), ip=client_ip)
    return await _issue_tokens(user, request, response, db)


# ---- VK ID OAuth ----

@router.get("/oauth/state")
async def get_oauth_state():
    """Generate a CSRF state token for OAuth flows."""
    from app.services.oauth import generate_oauth_state
    state = await generate_oauth_state()
    return {"state": state}


@router.post("/vk", response_model=TokenResponse)
async def vk_auth(
    body: VkAuthRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    from app.services.oauth import validate_oauth_state, verify_vk_code

    # Validate CSRF state
    if not await validate_oauth_state(body.state):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid OAuth state")

    try:
        oauth_user = await verify_vk_code(body.code, body.redirect_uri)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")

    user = await _find_or_create_oauth_user(
        db, "vk", oauth_user.provider_id, oauth_user.email, oauth_user.name, oauth_user.avatar,
        email_verified=bool(oauth_user.email),
    )
    if not user.consent_personal_data:
        user.consent_personal_data = True
        user.consent_personal_data_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    log_auth_event("vk_login", user_id=str(user.id), ip=request.client.host if request.client else None)
    return await _issue_tokens(user, request, response, db)


# ---- Yandex ID OAuth ----

@router.post("/yandex", response_model=TokenResponse)
async def yandex_auth(
    body: YandexAuthRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    from app.services.oauth import validate_oauth_state, verify_yandex_code

    if not await validate_oauth_state(body.state):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid OAuth state")

    try:
        oauth_user = await verify_yandex_code(body.code)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")

    user = await _find_or_create_oauth_user(
        db, "yandex", oauth_user.provider_id, oauth_user.email, oauth_user.name, oauth_user.avatar,
        email_verified=bool(oauth_user.email),
    )
    if not user.consent_personal_data:
        user.consent_personal_data = True
        user.consent_personal_data_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    log_auth_event("yandex_login", user_id=str(user.id), ip=request.client.host if request.client else None)
    return await _issue_tokens(user, request, response, db)


# ---- Google OAuth (optional/secondary) ----

@router.post("/google", response_model=TokenResponse)
async def google_auth(
    body: GoogleAuthRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google OAuth not configured")

    try:
        idinfo = id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await _find_or_create_oauth_user(
        db, "google", idinfo["sub"], idinfo.get("email"), idinfo.get("name", "User"), idinfo.get("picture"),
        email_verified=idinfo.get("email_verified", False),
    )
    if not user.consent_personal_data:
        user.consent_personal_data = True
        user.consent_personal_data_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    log_auth_event("google_login", user_id=str(user.id), ip=request.client.host if request.client else None)
    return await _issue_tokens(user, request, response, db)


# ---- Token refresh ----

@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token_hash = hash_token(raw_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = result.scalar_one_or_none()

    if not rt or rt.expires_at < datetime.now(timezone.utc):
        if rt:
            # Possible theft — revoke all sessions AND invalidate access tokens
            from app.services.token_revocation import revoke_user_tokens
            log_security_event("expired_refresh_reuse", detail=f"user={rt.user_id}")
            await revoke_user_tokens(str(rt.user_id))
            await db.execute(delete(RefreshToken).where(RefreshToken.user_id == rt.user_id))
            await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_id = rt.user_id
    await db.execute(delete(RefreshToken).where(RefreshToken.id == rt.id))

    new_access = create_access_token(str(user_id))
    raw_refresh, refresh_hash, expires_at = create_refresh_token(str(user_id))

    new_rt = RefreshToken(
        user_id=user_id,
        token_hash=refresh_hash,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=expires_at,
    )
    db.add(new_rt)
    await db.commit()

    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 86400,
        path=f"{settings.api_prefix}/auth",
    )

    return TokenResponse(access_token=new_access, expires_in=settings.access_token_expire_minutes * 60)


# ---- Logout ----

@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw_token = request.cookies.get("refresh_token")
    if raw_token:
        await db.execute(delete(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
        await db.commit()
    response.delete_cookie("refresh_token", path=f"{settings.api_prefix}/auth")
    return {"detail": "ok"}


# ---- Password reset ----

@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    await rate_limit_login(client_ip)

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user and user.password_hash:
        raw_token = generate_token()
        rt = RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            user_agent="password-reset",
            ip_address=client_ip,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(rt)
        await db.commit()
        if settings.debug:
            logger.info("RESET TOKEN for %s: %s...", body.email, raw_token[:8])
        log_auth_event("forgot_password", email=body.email, ip=client_ip)
    else:
        hash_password("timing-burn")

    return {"detail": "If an account exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    await rate_limit_login(client_ip)

    token_hash = hash_token(body.token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = result.scalar_one_or_none()

    if not rt or rt.expires_at < datetime.now(timezone.utc) or rt.user_agent != "password-reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.id == rt.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    user.password_hash = hash_password(body.password)
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.commit()

    # Invalidate all access tokens immediately
    from app.services.token_revocation import revoke_user_tokens
    await revoke_user_tokens(str(user.id))

    log_auth_event("password_reset", user_id=str(user.id), ip=client_ip)
    return {"detail": "Password reset successfully."}


# ---- User info ----

@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return _user_response(user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateUserRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user preferences (name, language)."""
    if body.name is not None:
        user.name = body.name
    if body.language is not None:
        user.language = body.language
    await db.commit()
    await db.refresh(user)
    return _user_response(user)


# ---- 152-FZ Data subject rights ----

@router.get("/me/data-export")
async def export_data(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
):
    """152-FZ: Right of access — export user data (paginated)."""
    from app.models.conversation import Conversation
    from app.models.message import Message
    from sqlalchemy.orm import selectinload
    from fastapi.responses import JSONResponse

    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    conversations = result.scalars().all()

    data = {
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "plan": user.plan,
            "created_at": user.created_at.isoformat(),
        },
        "conversations": [
            {
                "id": str(c.id),
                "title": c.title,
                "created_at": c.created_at.isoformat(),
                "messages": [
                    {"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
                    for m in c.messages
                ],
            }
            for c in conversations
        ],
        "pagination": {"limit": limit, "offset": offset},
    }
    return JSONResponse(
        content=data,
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


@router.delete("/me/data", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """152-FZ: Right of deletion — delete all user data and account."""
    from app.models.conversation import Conversation
    from app.models.api_key import ApiKey

    # Delete all user data (cascades handle messages)
    await db.execute(delete(Conversation).where(Conversation.user_id == user.id))
    await db.execute(delete(ApiKey).where(ApiKey.user_id == user.id))
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()

    log_auth_event("account_deleted", user_id=str(user.id))
