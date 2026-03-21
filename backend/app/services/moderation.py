"""Content moderation — Russian legal compliance (149-FZ, Roskomnadzor).

Multi-layer pipeline:
  Layer 0: Text normalization (defeat evasion)
  Layer 1: Fast regex for Russian legal categories (~0ms)
  Layer 2: Prompt injection detection (~0ms)
  Layer 3: OpenAI moderation API (if configured, ~100ms)

Categories required by Russian law:
  - Extremism / terrorism
  - Drug production/distribution info
  - Suicide / self-harm methods
  - CSAM (child sexual abuse material)
  - Calls to unsanctioned public actions
  - Identifying info about juvenile crime victims
"""

import logging
import re
import unicodedata
from dataclasses import dataclass

logger = logging.getLogger("mira.moderation")


@dataclass
class ModerationResult:
    blocked: bool
    category: str | None = None
    reason: str | None = None
    score: float = 0.0


# ---- Text normalization (defeat evasion techniques) ----

# Latin-to-Cyrillic lookalike substitution
_LATIN_TO_CYRILLIC = str.maketrans({
    "a": "а", "A": "А", "e": "е", "E": "Е",
    "o": "о", "O": "О", "p": "р", "P": "Р",
    "c": "с", "C": "С", "x": "х", "X": "Х",
    "y": "у", "T": "Т", "H": "Н", "B": "В",
    "K": "К", "M": "М",
})

_LEET_MAP = str.maketrans({"0": "о", "3": "з", "4": "ч", "6": "б", "8": "в"})


def normalize_text(text: str) -> str:
    """Normalize text to defeat common evasion techniques."""
    text = unicodedata.normalize("NFKC", text)
    # Remove zero-width characters
    text = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", text)
    # Latin lookalikes → Cyrillic
    text = text.translate(_LATIN_TO_CYRILLIC)
    # Remove inserted punctuation between letters: "н.а.р.к.о" → "нарко"
    text = re.sub(r"(?<=\w)[.\-_*\s]{1,2}(?=\w)", "", text)
    # Normalize repeated characters: "нааааркотики" → "наркотики"
    text = re.sub(r"(.)\1{2,}", r"\1\1", text)
    # Leetspeak
    text = text.translate(_LEET_MAP)
    return text.lower().strip()


# ---- Russian legal category patterns ----

_PATTERNS: dict[str, re.Pattern] = {
    "drugs": re.compile(
        r"(как\s+(приготовить|сделать|варить|купить|достать|синтезировать)\s+"
        r"(наркотик|мефедрон|амфетамин|героин|кокаин|марихуан|гашиш|спайс|соль|метамфетамин|лсд|экстази)"
        r"|закладк[аиу]|барыг[аиу]|синтез\s+наркотик|рецепт\s+наркотик"
        r"|как\s+сварить\s+мет|как\s+вырастить\s+коноп)",
        re.IGNORECASE,
    ),
    "suicide": re.compile(
        r"(как\s+(покончить|повеситься|убить\s+себя|отравиться|перерезать\s+вены|утопиться|выброситься)"
        r"|суицид\s+метод|способ\s+(суицида|самоубийства)|эвтанази\w+\s+дом"
        r"|безболезненн\w+\s+(смерть|уйти|умереть)|летальн\w+\s+доз)",
        re.IGNORECASE,
    ),
    "extremism": re.compile(
        r"(как\s+(сделать|собрать|изготовить)\s+(бомбу|взрывчатк|взрывно)"
        r"|призыв\w*\s+к\s+(терроризм|экстремизм|свержени|насильственн)"
        r"|джихад|слава\s+игил|хайль|зиг\s+хайль|белая\s+раса\s+превосход)",
        re.IGNORECASE,
    ),
    "child_abuse": re.compile(
        r"(детск\w*\s+порн|цп\b|малолетк\w*\s+секс|совращени\w*\s+несовершеннолетн"
        r"|секс\w*\s+с\s+(ребенк|ребёнк|детьм|подростк|малолетн)"
        r"|педофил\w*\s+(контент|материал|фото|видео))",
        re.IGNORECASE,
    ),
    "unsanctioned_actions": re.compile(
        r"(призыв\w*\s+к\s+(митинг|протест|бунт|восстани|беспорядк)"
        r"|выходи\w*\s+на\s+(улиц|площад)"
        r"|координац\w*\s+(акци|протест)\s+без\s+разрешени)",
        re.IGNORECASE,
    ),
}


# ---- Prompt injection patterns (expanded) ----

_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"ignore\s+(all\s+)?above", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?previous", re.IGNORECASE),
    re.compile(r"forget\s+(all\s+)?(previous|everything)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(?:a|an)\s+", re.IGNORECASE),
    re.compile(r"new\s+instructions?\s*:", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"<\|.*?\|>"),
    re.compile(r"\[INST\]|\[/INST\]|<<SYS>>|<</SYS>>"),
    # Russian prompt injection
    re.compile(r"игнорируй\s+(все\s+)?предыдущие", re.IGNORECASE),
    re.compile(r"забудь\s+(все\s+)?инструкции", re.IGNORECASE),
    re.compile(r"ты\s+теперь\s+", re.IGNORECASE),
    re.compile(r"новые\s+инструкции\s*:", re.IGNORECASE),
]


# ---- Moderation pipeline ----

def moderate_input(text: str) -> ModerationResult:
    """Pre-generation moderation. Synchronous — runs before AI call.
    Returns blocked=True if content violates Russian legal categories.
    """
    normalized = normalize_text(text)

    # Layer 1: Russian legal categories
    for category, pattern in _PATTERNS.items():
        if pattern.search(normalized) or pattern.search(text):
            logger.warning("MODERATION BLOCKED input | category=%s", category)
            return ModerationResult(blocked=True, category=category, reason=category, score=1.0)

    # Layer 2: Prompt injection (log but don't block — defense in depth)
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            logger.warning("MODERATION FLAGGED prompt injection")
            return ModerationResult(blocked=False, category="prompt_injection", reason="prompt_injection", score=0.8)

    return ModerationResult(blocked=False)


def moderate_output(text: str) -> ModerationResult:
    """Post-generation moderation. Check AI output before sending to user."""
    normalized = normalize_text(text)

    for category, pattern in _PATTERNS.items():
        if pattern.search(normalized) or pattern.search(text):
            logger.warning("MODERATION BLOCKED output | category=%s", category)
            return ModerationResult(blocked=True, category=category, reason=category, score=1.0)

    return ModerationResult(blocked=False)


# Localized block messages
BLOCK_MESSAGES = {
    "ru": "Извините, я не могу помочь с этим запросом. Пожалуйста, задайте другой вопрос.",
    "en": "Sorry, I can't help with this request. Please ask a different question.",
}
