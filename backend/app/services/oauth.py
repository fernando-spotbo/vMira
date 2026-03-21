"""OAuth providers — VK ID, Yandex ID, Google.
Includes state parameter generation and validation for CSRF protection.
"""

import secrets

import httpx

from app.config import get_settings
from app.middleware.rate_limit import get_redis

settings = get_settings()

# Whitelisted redirect URIs (prevent open redirect)
ALLOWED_REDIRECT_URIS: set[str] = set()  # Populated from settings at startup


def _get_allowed_redirects() -> set[str]:
    """Build allowed redirect URIs from configured origins."""
    uris = set()
    for origin in settings.allowed_origins:
        uris.add(f"{origin}/auth/callback/vk")
        uris.add(f"{origin}/auth/callback/yandex")
        uris.add(f"{origin}/auth/callback/google")
    return uris


class OAuthUser:
    def __init__(self, provider_id: str, email: str | None, name: str, avatar: str | None):
        self.provider_id = provider_id
        self.email = email
        self.name = name[:100] if name else "User"  # Enforce max length
        self.avatar = avatar[:512] if avatar else None  # Enforce max length


async def generate_oauth_state() -> str:
    """Generate and store a CSRF state token for OAuth flows.
    Stored in Redis with 10-minute TTL.
    """
    state = secrets.token_urlsafe(32)
    redis = await get_redis()
    await redis.set(f"oauth:state:{state}", "1", ex=600)
    return state


async def validate_oauth_state(state: str) -> bool:
    """Validate and consume an OAuth state token. Returns True if valid."""
    if not state:
        return False
    redis = await get_redis()
    result = await redis.getdel(f"oauth:state:{state}")
    return result is not None


def validate_redirect_uri(redirect_uri: str) -> bool:
    """Check if redirect_uri is in the whitelist."""
    allowed = _get_allowed_redirects()
    return redirect_uri in allowed


async def verify_vk_code(code: str, redirect_uri: str) -> OAuthUser:
    """Exchange VK authorization code for user info."""
    if not settings.vk_client_id or not settings.vk_client_secret:
        raise ValueError("VK OAuth not configured")

    if not validate_redirect_uri(redirect_uri):
        raise ValueError("Invalid redirect URI")

    async with httpx.AsyncClient(timeout=15.0) as client:
        token_resp = await client.get(
            "https://oauth.vk.com/access_token",
            params={
                "client_id": settings.vk_client_id,
                "client_secret": settings.vk_client_secret,
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
        token_data = token_resp.json()

        if "error" in token_data:
            raise ValueError(f"VK auth failed: {token_data.get('error_description', 'unknown')}")

        access_token = token_data["access_token"]
        vk_user_id = str(token_data["user_id"])
        email = token_data.get("email")

        profile_resp = await client.get(
            "https://api.vk.com/method/users.get",
            params={
                "access_token": access_token,
                "fields": "photo_200,first_name,last_name",
                "v": "5.199",
            },
        )
        profile_data = profile_resp.json()

        if "error" in profile_data:
            raise ValueError("VK profile fetch failed")

        user_info = profile_data["response"][0]
        name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip() or "User"
        avatar = user_info.get("photo_200")

    return OAuthUser(provider_id=vk_user_id, email=email, name=name, avatar=avatar)


async def verify_yandex_code(code: str) -> OAuthUser:
    """Exchange Yandex authorization code for user info."""
    if not settings.yandex_client_id or not settings.yandex_client_secret:
        raise ValueError("Yandex OAuth not configured")

    async with httpx.AsyncClient(timeout=15.0) as client:
        token_resp = await client.post(
            "https://oauth.yandex.ru/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.yandex_client_id,
                "client_secret": settings.yandex_client_secret,
            },
        )
        token_data = token_resp.json()

        if "error" in token_data:
            raise ValueError(f"Yandex auth failed: {token_data.get('error_description', 'unknown')}")

        access_token = token_data["access_token"]

        info_resp = await client.get(
            "https://login.yandex.ru/info",
            params={"format": "json"},
            headers={"Authorization": f"OAuth {access_token}"},
        )
        info = info_resp.json()

        yandex_id = str(info["id"])
        email = info.get("default_email")
        name = info.get("display_name") or info.get("real_name") or "User"
        avatar_id = info.get("default_avatar_id")
        avatar = f"https://avatars.yandex.net/get-yapic/{avatar_id}/islands-200" if avatar_id else None

    return OAuthUser(provider_id=yandex_id, email=email, name=name, avatar=avatar)
