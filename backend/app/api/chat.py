import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal, get_db
from app.middleware.auth import get_current_user
from app.middleware.rate_limit import rate_limit_user
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    ConversationWithMessages,
    MessageRequest,
    MessageResponse,
)
from app.services.ai_proxy import stream_ai_response
from app.services.audit import log_api_event, log_security_event
from app.services.limits import check_and_increment
from app.services.moderation import moderate_input, moderate_output, BLOCK_MESSAGES
from app.services.sanitize import sanitize_input, sanitize_output

router = APIRouter()


def _conv_response(c: Conversation) -> ConversationResponse:
    return ConversationResponse(
        id=str(c.id), title=c.title, model=c.model, starred=c.starred,
        archived=c.archived, created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


def _msg_response(m: Message) -> MessageResponse:
    return MessageResponse(
        id=str(m.id), role=m.role, content=m.content, steps=m.steps,
        input_tokens=m.input_tokens, output_tokens=m.output_tokens,
        model=m.model, created_at=m.created_at.isoformat(),
    )


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id, Conversation.archived.is_(False))
        .order_by(Conversation.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_conv_response(c) for c in result.scalars().all()]


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = Conversation(user_id=user.id, title=body.title, model=body.model)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return _conv_response(conv)


@router.get("/conversations/{conv_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conv_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conv_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return ConversationWithMessages(
        **_conv_response(conv).model_dump(),
        messages=[_msg_response(m) for m in conv.messages],
    )


@router.patch("/conversations/{conv_id}", response_model=ConversationResponse)
async def update_conversation(
    conv_id: uuid.UUID,
    body: ConversationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if body.title is not None:
        conv.title = body.title
    if body.starred is not None:
        conv.starred = body.starred
    if body.archived is not None:
        conv.archived = body.archived

    await db.commit()
    await db.refresh(conv)
    return _conv_response(conv)


@router.delete("/conversations/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conv_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    await db.execute(delete(Conversation).where(Conversation.id == conv_id))
    await db.commit()


@router.post("/conversations/{conv_id}/messages")
async def send_message(
    conv_id: uuid.UUID,
    body: MessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Rate limit
    await rate_limit_user(str(user.id))

    # Check concurrent SSE streams (prevent connection exhaustion DoS)
    from app.middleware.rate_limit import get_redis
    from app.config import get_settings
    _settings = get_settings()
    redis = await get_redis()
    stream_key = f"streams:{user.id}"
    active_streams = await redis.get(stream_key)
    if active_streams and int(active_streams) >= _settings.max_concurrent_streams_per_user:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many concurrent requests. Please wait for current responses to complete.",
        )

    # Daily message limit (atomic check + increment with row lock)
    allowed, remaining = await check_and_increment(user, db)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily message limit reached for {user.plan} plan. Upgrade for more messages.",
        )

    # Sanitize input (strip control chars, null bytes)
    content = sanitize_input(body.content)

    # Content moderation — Russian legal compliance (149-FZ)
    mod_result = moderate_input(content)
    if mod_result.blocked:
        log_security_event("content_blocked", detail=f"user={user.id} category={mod_result.category}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=BLOCK_MESSAGES.get(user.language, BLOCK_MESSAGES["ru"]),
        )
    if mod_result.category == "prompt_injection":
        log_security_event("prompt_injection_detected", detail=f"user={user.id} conv={conv_id}")

    # Verify ownership
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Save user message
    user_msg = Message(conversation_id=conv.id, role="user", content=content)
    db.add(user_msg)

    # Auto-title on first message
    msg_count = await db.execute(
        select(func.count()).select_from(Message).where(Message.conversation_id == conv.id)
    )
    if msg_count.scalar() == 0:
        conv.title = content[:80]

    await db.commit()

    log_api_event("send_message", str(user.id), "conversation", str(conv_id))

    # Build history (last 50 messages to control token usage)
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc())
        .limit(50)
    )
    messages = list(reversed(history_result.scalars().all()))
    history = [{"role": m.role, "content": m.content} for m in messages]

    # Track concurrent streams
    user_id_str = str(user.id)
    await redis.incr(stream_key)
    await redis.expire(stream_key, 300)  # Auto-cleanup after 5 min

    # Stream AI response — save in a separate session after streaming completes
    conversation_id = conv.id

    async def event_stream():
        full_content = ""
        try:
            async for chunk in stream_ai_response(history, model=body.model):
                full_content += chunk
                yield f"data: {chunk}\n\n"
        except Exception as e:
            log_security_event("ai_proxy_error", detail=str(e))
            yield f"data: [ERROR]\n\n"
        finally:
            yield "data: [DONE]\n\n"

            # Release stream counter
            try:
                _redis = await get_redis()
                await _redis.decr(stream_key)
            except Exception:
                pass

            # Moderate + save assistant message in a fresh session
            if full_content:
                output_mod = moderate_output(full_content)
                if output_mod.blocked:
                    full_content = BLOCK_MESSAGES.get("ru", BLOCK_MESSAGES["ru"])
                    log_security_event("output_blocked", detail=f"category={output_mod.category}")
                sanitized = sanitize_output(full_content)
                async with AsyncSessionLocal() as save_db:
                    asst_msg = Message(
                        conversation_id=conversation_id,
                        role="assistant",
                        content=sanitized,
                        model=body.model,
                    )
                    save_db.add(asst_msg)
                    result = await save_db.execute(
                        select(Conversation).where(Conversation.id == conversation_id)
                    )
                    save_conv = result.scalar_one_or_none()
                    if save_conv:
                        save_conv.updated_at = datetime.now(timezone.utc)
                    await save_db.commit()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
