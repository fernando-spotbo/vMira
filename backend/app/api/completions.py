"""OpenAI-compatible /v1/chat/completions endpoint for the developer API."""

import json
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_user_from_api_key
from app.middleware.rate_limit import rate_limit_user
from app.models.user import User
from app.services.audit import log_api_event
from app.services.moderation import moderate_input, moderate_output, BLOCK_MESSAGES
from app.services.sanitize import sanitize_input, sanitize_output
from app.schemas.chat import (
    ChatCompletionChoice,
    ChatCompletionMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionUsage,
)
from app.services.ai_proxy import stream_ai_response

router = APIRouter()


@router.post("/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    user: User = Depends(get_user_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit_user(str(user.id))

    log_api_event("chat_completion", str(user.id), "api", detail=f"model={body.model} stream={body.stream}")

    # Moderate + sanitize the last user message
    last_user_msg = next((m for m in reversed(body.messages) if m.role == "user"), None)
    if last_user_msg:
        mod_result = moderate_input(last_user_msg.content)
        if mod_result.blocked:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "content_blocked", "category": mod_result.category},
            )

    history = [{"role": m.role, "content": sanitize_input(m.content)} for m in body.messages]

    if body.stream:
        async def event_stream():
            request_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
            async for chunk in stream_ai_response(
                history, model=body.model, temperature=body.temperature, max_tokens=body.max_tokens
            ):
                data = {
                    "id": request_id,
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": body.model,
                    "choices": [{"index": 0, "delta": {"content": chunk}, "finish_reason": None}],
                }
                yield f"data: {json.dumps(data)}\n\n"

            # Final chunk
            final = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": body.model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            yield f"data: {json.dumps(final)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    # Non-streaming: collect full response
    full_content = ""
    async for chunk in stream_ai_response(
        history, model=body.model, temperature=body.temperature, max_tokens=body.max_tokens
    ):
        full_content += chunk

    # Moderate + sanitize output
    output_mod = moderate_output(full_content)
    if output_mod.blocked:
        full_content = "I cannot provide that response."
    full_content = sanitize_output(full_content)

    return ChatCompletionResponse(
        id=f"chatcmpl-{uuid.uuid4().hex[:24]}",
        created=int(time.time()),
        model=body.model,
        choices=[
            ChatCompletionChoice(
                index=0,
                message=ChatCompletionMessage(role="assistant", content=full_content),
                finish_reason="stop",
            )
        ],
        usage=ChatCompletionUsage(
            prompt_tokens=sum(len(m.content.split()) for m in body.messages),
            completion_tokens=len(full_content.split()),
            total_tokens=sum(len(m.content.split()) for m in body.messages) + len(full_content.split()),
        ),
    )
