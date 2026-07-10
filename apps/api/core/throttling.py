"""Request throttles and proxy-aware client identity helpers."""

from rest_framework.request import Request
from rest_framework.throttling import BaseThrottle, SimpleRateThrottle


def client_ident(request: Request) -> str:
    """Return DRF's client identity using the configured trusted proxy count."""
    return BaseThrottle().get_ident(request)


class AnswerRateThrottle(SimpleRateThrottle):
    """Independent paid-answer throttle; retrieval keeps the looser anon bucket."""

    scope = "answer"

    def get_cache_key(self, request: Request, view: object) -> str:
        ident = client_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
