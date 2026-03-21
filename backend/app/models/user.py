import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str | None] = mapped_column(
        String(320), unique=True, nullable=True, index=True
    )
    phone: Mapped[str | None] = mapped_column(
        String(20), unique=True, nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(
        String(256), nullable=True
    )

    # OAuth provider IDs
    vk_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)
    yandex_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)
    google_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)

    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Preferences
    language: Mapped[str] = mapped_column(String(5), nullable=False, default="ru")  # ru, en

    # Plan & limits
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    daily_messages_used: Mapped[int] = mapped_column(default=0)
    daily_reset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Security
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_login_attempts: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # 152-FZ consent (separate from ToS)
    consent_personal_data: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_personal_data_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_marketing: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_marketing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
