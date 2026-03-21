"""CSRF protection via custom header requirement.

OWASP-recommended approach for SPAs: require a custom header (X-Requested-With)
on all state-changing requests. Cross-origin attackers cannot set custom headers
without CORS preflight approval, which our strict CORS policy denies.

This works in conjunction with:
  - SameSite=Lax cookies (Layer 1)
  - Strict CORS allow_origins (Layer 3)
"""

from fastapi import HTTPException, Request, status

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def verify_csrf_header(request: Request):
    """Verify X-Requested-With header on state-changing requests."""
    if request.method in SAFE_METHODS:
        return

    # Only check on cookie-authenticated routes (not API key routes)
    if request.cookies.get("refresh_token") or request.cookies.get("access_token"):
        csrf_header = request.headers.get("X-Requested-With")
        if csrf_header != "XMLHttpRequest":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing CSRF header",
            )
