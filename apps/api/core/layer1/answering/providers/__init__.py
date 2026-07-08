"""Answer-provider registry.

``get_provider`` resolves the configured provider from ``ANSWER_PROVIDER``
(default ``gemini``). The concrete provider is imported lazily so unrelated code
paths (and tests using an injected provider) never import a model SDK.
"""

from config.env import config

from .base import AnswerProvider, ProviderError, ProviderUnavailableError

DEFAULT_PROVIDER = "gemini"

__all__ = [
    "AnswerProvider",
    "ProviderError",
    "ProviderUnavailableError",
    "get_provider",
]


def get_provider(name: str | None = None) -> AnswerProvider:
    """Return the configured answer provider; unknown -> ProviderUnavailableError."""
    resolved = (name or config("ANSWER_PROVIDER", default=DEFAULT_PROVIDER)).strip().lower()
    if resolved == "gemini":
        from .gemini import GeminiProvider

        return GeminiProvider()
    if resolved == "fake":
        from .fake import AutoFakeProvider

        return AutoFakeProvider()
    raise ProviderUnavailableError(f"unknown answer provider: {resolved}")
