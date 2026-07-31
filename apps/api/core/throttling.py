"""Request throttles and proxy-aware client identity helpers."""

from rest_framework.request import Request
from rest_framework.throttling import BaseThrottle, SimpleRateThrottle

from core.telemetry import (
    ENDPOINT_ANSWER,
    OUTCOME_ANSWER_THROTTLED,
    record_request_outcome,
)


def client_ident(request: Request) -> str:
    """Return DRF's client identity using the configured trusted proxy count."""
    return BaseThrottle().get_ident(request)


class AnswerRateThrottle(SimpleRateThrottle):
    """Independent paid-answer throttle; retrieval keeps the looser anon bucket."""

    scope = "answer"

    def get_cache_key(self, request: Request, view: object) -> str:
        ident = client_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}

    def allow_request(self, request: Request, view: object) -> bool:
        allowed = super().allow_request(request, view)
        if not allowed:
            # Emit before DRF builds the standard 429 body; never log request data.
            record_request_outcome(
                request,
                outcome=OUTCOME_ANSWER_THROTTLED,
                endpoint=ENDPOINT_ANSWER,
                status_code=429,
            )
        return allowed
