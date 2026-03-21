"""Request ID middleware for distributed tracing.
Adds X-Request-ID to every request/response for correlation across logs.
"""

import uuid

from fastapi import Request
from starlette.types import ASGIApp, Receive, Scope, Send


class RequestIdMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Always generate server-side (never trust client-provided IDs)
        request_id = str(uuid.uuid4())

        # Store in scope state for access in route handlers
        scope.setdefault("state", {})
        scope["state"]["request_id"] = request_id

        # Inject into response headers
        async def send_with_request_id(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_request_id)
