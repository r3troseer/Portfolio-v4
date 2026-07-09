"""Answer-provider registry.

``get_provider`` resolves the configured provider from ``ANSWER_PROVIDER``
(default ``gemini``). The concrete provider is imported lazily so unrelated code
paths (and tests using an injected provider) never import a model SDK.

``fake`` is DEBUG-only: production (``DJANGO_DEBUG`` false) rejects registry
selection of fake with ``ProviderUnavailableError``. Tests may still inject
``FakeProvider`` / ``AutoFakeProvider`` directly into ``generate_answer``.
"""

from django.conf import settings

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
        if not settings.DEBUG:
            raise ProviderUnavailableError(
                "fake answer provider is only available when DJANGO_DEBUG=true"
            )
        from .fake import AutoFakeProvider

        return AutoFakeProvider()
    raise ProviderUnavailableError(f"unknown answer provider: {resolved}")
