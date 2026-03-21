import hashlib
import secrets
import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def generate_api_key() -> str:
    return f"sk-mira-{secrets.token_urlsafe(32)}"


def hash_api_key(key: str) -> str:
    """Hash the API key for storage. We store the hash, not the key itself."""
    return hashlib.sha256(key.encode()).hexdigest()


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Store SHA-256 hash of the key, not the key itself
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    # First 8 chars for display: "sk-mira-Ab3x..."
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)

    # Permissions & limits
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    requests_today: Mapped[int] = mapped_column(Integer, default=0)
    total_requests: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)

    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="api_keys")
