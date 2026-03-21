from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.api_keys import router as api_keys_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.completions import router as completions_router
from app.api.sessions import router as sessions_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(api_keys_router, prefix="/api-keys", tags=["api-keys"])
api_router.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])

# OpenAI-compatible endpoint
api_router.include_router(completions_router, tags=["completions"])
