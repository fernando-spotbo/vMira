import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.config import get_settings
from app.database import engine
from app.logging_config import setup_logging
from app.middleware.rate_limit import close_redis

settings = get_settings()
setup_logging(settings.debug)
logger = logging.getLogger("mira")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if not settings.debug:
        if settings.secret_key == "CHANGE-ME-IN-PRODUCTION":
            raise RuntimeError("SECRET_KEY must be changed in production!")
        if settings.hmac_secret == "CHANGE-ME-IN-PRODUCTION":
            raise RuntimeError("HMAC_SECRET must be changed in production!")
        if "mira:mira@" in settings.database_url:
            raise RuntimeError("Default database credentials detected in production!")
    logger.info("Mira API starting up")
    yield
    # Shutdown
    await close_redis()
    await engine.dispose()
    logger.info("Mira API shut down")


app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

# Request ID tracking (outermost — runs first)
from app.middleware.request_id import RequestIdMiddleware
app.add_middleware(RequestIdMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-Signature", "X-Request-Timestamp", "X-Request-Nonce"],
    expose_headers=["X-RateLimit-Remaining", "Retry-After"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'none'"
    if not settings.debug:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def hmac_verification(request: Request, call_next):
    """Verify HMAC on frontend-facing routes (skip for API key routes and health).
    Note: We read the body for signing, then replace it so the route handler can read it too.
    """
    path = request.url.path
    skip_paths = ["/health", "/docs", "/redoc", "/openapi.json"]
    skip_prefixes = [f"{settings.api_prefix}/chat/completions"]

    if (
        request.method == "OPTIONS"
        or path in skip_paths
        or any(path.startswith(p) for p in skip_prefixes)
    ):
        return await call_next(request)

    if path.startswith(settings.api_prefix):
        from app.middleware.hmac_verify import verify_hmac_signature
        await verify_hmac_signature(request)

    return await call_next(request)


@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    """CSRF check on cookie-authenticated state-changing requests."""
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.url.path.startswith(settings.api_prefix):
        # Skip for API key routes (they don't use cookies)
        if not request.url.path.startswith(f"{settings.api_prefix}/chat/completions"):
            from app.middleware.csrf import verify_csrf_header
            await verify_csrf_header(request)
    return await call_next(request)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    if settings.debug:
        raise exc
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
async def health():
    """Health check — verifies DB and Redis connectivity."""
    checks = {"service": "mira-api", "db": "unknown", "redis": "unknown"}

    # Check PostgreSQL
    try:
        from sqlalchemy import text
        from app.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception:
        checks["db"] = "error"

    # Check Redis (read + write)
    try:
        from app.middleware.rate_limit import get_redis
        redis = await get_redis()
        await redis.set("_health", "1", ex=10)
        await redis.delete("_health")
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    healthy = checks["db"] == "ok" and checks["redis"] == "ok"
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={"status": "ok" if healthy else "degraded", **checks},
    )
