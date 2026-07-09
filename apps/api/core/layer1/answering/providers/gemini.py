"""Gemini answer provider (server-side only).

Reads its API key and model from the environment - never from the client. Forces
strict JSON output via ``response_mime_type`` and uses temperature 0 for stable,
grounded answers. Any transport/SDK failure is wrapped as ``ProviderError``.
"""

from config.env import config
from google import genai
from google.genai import types

from .base import AnswerProvider, ProviderError, ProviderUnavailableError

DEFAULT_MODEL = "gemini-3.1-flash-lite"
DEFAULT_TIMEOUT_SECONDS = 20


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
            raise ProviderError(
                f"gemini request failed ({exc.__class__.__name__})"
            ) from exc

        text = response.text
        if not text or not text.strip():
            raise ProviderError("gemini returned an empty response")
        return text
