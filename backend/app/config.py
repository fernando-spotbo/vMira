from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Mira API"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://mira:mira@localhost:5432/mira"
    db_pool_size: int = 20
    db_max_overflow: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    algorithm: str = "HS256"

    # Rate limiting
    rate_limit_requests: int = 60  # per minute for authenticated users
    rate_limit_login_attempts: int = 5  # per 15 minutes
    rate_limit_window_seconds: int = 60
    max_concurrent_streams_per_user: int = 3  # prevent SSE connection exhaustion

    # AI Proxy (validated at startup — only whitelisted domains)
    ai_model_url: str = "http://localhost:8080/v1"
    ai_model_api_key: str = ""
    ai_model_allowed_hosts: list[str] = ["localhost", "127.0.0.1", "74.48.78.46"]

    # CORS
    allowed_origins: list[str] = ["http://localhost:3000"]

    # OAuth providers (Russian-first)
    vk_client_id: str = ""
    vk_client_secret: str = ""
    yandex_client_id: str = ""
    yandex_client_secret: str = ""
    google_client_id: str = ""  # Optional — secondary

    # HMAC for Vercel <-> Backend request signing
    hmac_secret: str = "CHANGE-ME-IN-PRODUCTION"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
