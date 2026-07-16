"""Answer-provider abstraction.

A minimal seam so a second model provider (OpenAI/Anthropic) can be added later
without touching the answer service. Providers only turn a system + user prompt
into raw model text; all validation and grounding live in the service/schemas.
"""

from abc import ABC, abstractmethod


class ProviderUnavailableError(RuntimeError):
    """The provider is not configured or usable (e.g. missing API key).

    Mapped to HTTP 503 - the service cannot be reached, not the model's fault.
    """


class ProviderError(RuntimeError):
    """The provider call failed at runtime (transport/SDK error, empty result).

    Mapped to HTTP 503.
    """


class ProviderTimeoutError(ProviderError):
    """The provider call timed out.

    Mapped to HTTP 503 with a distinct operational outcome from other
    provider execution failures. Public response body stays unchanged.
    """


class AnswerProvider(ABC):
    """Turns a system + user prompt into raw model output text.

    Implementations expose ``provider_name`` and ``model_name`` for response
    metadata (never model config to clients).
    """

    provider_name: str
    model_name: str

    @abstractmethod
    def generate(self, *, system: str, user: str) -> str:
        """Return raw model text (expected to be strict JSON). May raise
        ``ProviderError`` on a runtime failure."""
        raise NotImplementedError
