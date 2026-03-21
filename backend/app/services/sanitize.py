"""Input sanitization and prompt injection detection."""

import re

# Known prompt injection patterns — flag, don't silently alter
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"ignore\s+(all\s+)?above\s+instructions",
    r"disregard\s+(all\s+)?previous",
    r"forget\s+(all\s+)?previous",
    r"you\s+are\s+now\s+(?:a|an)\s+",
    r"new\s+instructions?\s*:",
    r"system\s*:\s*",
    r"<\|.*?\|>",  # Special token patterns
    r"\[INST\]",
    r"\[/INST\]",
    r"<<SYS>>",
    r"<</SYS>>",
]

_compiled_patterns = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


def detect_injection(content: str) -> bool:
    """Check if content contains known prompt injection patterns.
    Returns True if suspicious patterns detected.
    """
    for pattern in _compiled_patterns:
        if pattern.search(content):
            return True
    return False


def sanitize_input(content: str) -> str:
    """Basic input sanitization. Does NOT modify the content for injection
    (that's handled at the architecture level with privilege separation).
    Only strips control characters and null bytes.
    """
    # Remove null bytes
    content = content.replace("\x00", "")
    # Remove other control characters except newline, tab, carriage return
    content = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]", "", content)
    return content


def sanitize_output(content: str) -> str:
    """Sanitize AI model output before sending to the client.
    Prevents stored XSS if content is rendered as HTML anywhere.
    """
    # Strip any HTML script tags (defense in depth — frontend should also escape)
    content = re.sub(r"<script\b[^>]*>.*?</script>", "", content, flags=re.IGNORECASE | re.DOTALL)
    # Strip event handlers
    content = re.sub(r"\bon\w+\s*=", "", content, flags=re.IGNORECASE)
    return content
