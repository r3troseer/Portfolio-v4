"""Gemini answer provider (server-side only).

Reads its API key and model from the environment - never from the client. Forces
strict JSON output via ``response_mime_type`` and uses temperature 0 for stable,
grounded answers. Timeouts become ``ProviderTimeoutError``; other transport/SDK
failures become ``ProviderError``. Exception text is never interpolated into the
safe message (class name only).
"""

from config.env import config
from google import genai
from google.genai import types

from .base import (
    AnswerProvider,
    ProviderError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)

try:
    from httpx import TimeoutException as HttpxTimeoutException

    _TIMEOUT_TYPES: tuple[type[BaseException], ...] = (TimeoutError, HttpxTimeoutException)
except ImportError:  # pragma: no cover - httpx ships with google-genai
    _TIMEOUT_TYPES = (TimeoutError,)

DEFAULT_MODEL = "gemini-3.1-flash-lite"
DEFAULT_TIMEOUT_SECONDS = 20


def _is_timeout_exc(exc: BaseException) -> bool:
    """True when ``exc`` (or its cause/context) is a typed timeout failure."""
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        if isinstance(current, _TIMEOUT_TYPES):
            return True
        seen.add(id(current))
        current = current.__cause__ or current.__context__
    return False


def resolve_timeout_seconds(raw: str | None = None) -> int:
    """Parse ``GEMINI_TIMEOUT_SECONDS``; invalid / non-positive -> default."""
    if raw is None:
        raw = config("GEMINI_TIMEOUT_SECONDS", default=str(DEFAULT_TIMEOUT_SECONDS))
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT_SECONDS
    if value <= 0:
        return DEFAULT_TIMEOUT_SECONDS
    return value


class GeminiProvider(AnswerProvider):
    provider_name = "gemini"

    def __init__(self) -> None:
        api_key = config("GEMINI_API_KEY", default="")
        if not api_key:
            raise ProviderUnavailableError("GEMINI_API_KEY is not configured")
        self.model_name = config("GEMINI_MODEL", default=DEFAULT_MODEL)
        timeout_ms = resolve_timeout_seconds() * 1000
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=timeout_ms),
        )

    def generate(self, *, system: str, user: str) -> str:
        try:
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    temperature=0,
                ),
            )
        except Exception as exc:  # SDK raises a variety of transport/API errors
            # Class name only - never interpolate exception text or payloads.
            message = f"gemini request failed ({exc.__class__.__name__})"
            if _is_timeout_exc(exc):
                raise ProviderTimeoutError(message) from exc
            raise ProviderError(message) from exc

        text = response.text
        if not text or not text.strip():
            raise ProviderError("gemini returned an empty response")
        return text
