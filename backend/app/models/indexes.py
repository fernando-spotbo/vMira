"""Composite indexes for query performance.
These are created via Alembic migrations — this file documents them.
"""

from sqlalchemy import Index

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.api_key import ApiKey

# Conversation queries: user_id + not archived, ordered by updated_at
idx_conv_user_active = Index(
    "idx_conv_user_active",
    Conversation.user_id,
    Conversation.archived,
    Conversation.updated_at.desc(),
)

# Message queries: conversation_id ordered by created_at (for history loading)
idx_msg_conv_created = Index(
    "idx_msg_conv_created",
    Message.conversation_id,
    Message.created_at,
)

# Message retention: find old messages by created_at
idx_msg_created = Index(
    "idx_msg_created",
    Message.created_at,
)

# API key lookup by hash
idx_apikey_hash_active = Index(
    "idx_apikey_hash_active",
    ApiKey.key_hash,
    ApiKey.is_active,
)
