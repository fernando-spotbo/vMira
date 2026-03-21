"""AI model proxy — streams responses from llama-server.

Handles:
- Connection errors with retry
- Streaming (SSE) and non-streaming modes
- Parsing <think>...</think> blocks from the model into reasoning steps
- System prompt injection for Mira identity
- SSRF protection via host whitelist
"""

import asyncio
import json
import logging
import re
from typing import AsyncGenerator
from urllib.parse import urlparse

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("mira.ai")

MAX_RETRIES = 2
INITIAL_BACKOFF = 0.5

# SSRF protection — validated on first use, not at import time
_url_validated = False

def _validate_model_url():
    global _url_validated
    if _url_validated:
        return
    parsed = urlparse(settings.ai_model_url)
    if parsed.hostname not in settings.ai_model_allowed_hosts:
        raise RuntimeError(
            f"AI model URL host '{parsed.hostname}' not in allowed hosts: {settings.ai_model_allowed_hosts}"
        )
    _url_validated = True

# Mira system prompt (Russian-first, strong identity)
MIRA_SYSTEM_PROMPT = "Ты Мира. Думай кратко."


def parse_thinking(content: str) -> tuple[str | None, str]:
    """Parse <think>...</think> blocks from model output.
    Returns (thinking_text, visible_text).
    Handles: complete blocks, incomplete blocks, multiple blocks.
    """
    # Remove complete <think>...</think> blocks
    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
    # Remove any leftover incomplete <think> tags (model cut off mid-think)
    cleaned = re.sub(r"<think>.*$", "", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"</think>", "", cleaned)
    # Extract thinking content for logging/storage
    think_match = re.search(r"<think>(.*?)</think>", content, re.DOTALL)
    thinking = think_match.group(1).strip() if think_match else None
    return thinking, cleaned.strip()


async def stream_ai_response(
    messages: list[dict],
    model: str = "mira",
    temperature: float = 0.7,
    max_tokens: int | None = None,
    system_prompt: str | None = None,
) -> AsyncGenerator[str, None]:
    """Stream response from the AI model via SSE."""
    _validate_model_url()
    final_messages = []
    final_messages.append({
        "role": "system",
        "content": system_prompt or MIRA_SYSTEM_PROMPT,
    })
    final_messages.extend(messages)

    payload: dict = {
        "model": model,
        "messages": final_messages,
        "temperature": temperature,
        "stream": False,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens
    else:
        payload["max_tokens"] = 4096

    headers = {"Content-Type": "application/json"}
    if settings.ai_model_api_key:
        headers["Authorization"] = f"Bearer {settings.ai_model_api_key}"

    last_error = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0)
            ) as client:
                response = await client.post(
                    f"{settings.ai_model_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
                if True:  # Maintain indentation level
                    if response.status_code == 429:
                        logger.warning("AI model rate limited (attempt %d)", attempt + 1)
                        if attempt < MAX_RETRIES:
                            await asyncio.sleep(INITIAL_BACKOFF * (2 ** attempt))
                            continue
                        yield "[Модель временно занята. Попробуйте позже.]"
                        return

                    if response.status_code != 200:
                        error_body = await response.aread()
                        logger.error("AI model error %d: %s", response.status_code, error_body[:200])
                        yield "[Ошибка при обращении к модели.]"
                        return

                    # Non-streaming: read full response, parse thinking, yield visible text
                    body = await response.aread()
                    try:
                        data = json.loads(body)
                        raw_content = data["choices"][0]["message"]["content"]
                        thinking, visible = parse_thinking(raw_content)
                        if visible:
                            yield visible
                        else:
                            yield raw_content
                    except (json.JSONDecodeError, KeyError, IndexError) as e:
                        logger.error("AI response parse error: %s body=%s", e, body[:200])
                        yield "[Ошибка разбора ответа.]"

                    return

        except httpx.ConnectError as e:
            last_error = e
            logger.error("AI CONNECT ERROR (attempt %d): %s", attempt + 1, str(e))
            if attempt < MAX_RETRIES:
                await asyncio.sleep(INITIAL_BACKOFF * (2 ** attempt))
                continue

        except httpx.ReadTimeout as e:
            logger.error("AI READ TIMEOUT: %s", str(e))
            yield "[Модель не успела ответить.]"
            return

        except Exception as e:
            logger.error("AI PROXY EXCEPTION [%s]: %s", type(e).__name__, str(e))
            import traceback
            traceback.print_exc()
            yield "[Непредвиденная ошибка.]"
            return

    logger.error("AI unreachable after %d attempts: %s", MAX_RETRIES + 1, str(last_error))
    yield "[Модель недоступна. Попробуйте позже.]"


async def generate_response(
    messages: list[dict],
    model: str = "mira",
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> tuple[str | None, str]:
    """Non-streaming response. Returns (thinking, visible_text)."""
    final_messages = [{"role": "system", "content": MIRA_SYSTEM_PROMPT}]
    final_messages.extend(messages)

    payload: dict = {
        "model": model,
        "messages": final_messages,
        "temperature": temperature,
        "max_tokens": max_tokens or 4096,
        "stream": False,
    }

    headers = {"Content-Type": "application/json"}
    if settings.ai_model_api_key:
        headers["Authorization"] = f"Bearer {settings.ai_model_api_key}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.ai_model_url}/chat/completions",
            json=payload,
            headers=headers,
        )

        if resp.status_code != 200:
            return None, "[Ошибка модели.]"

        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return parse_thinking(content)
