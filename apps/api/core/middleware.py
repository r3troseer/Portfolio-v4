"""Minimal request correlation middleware (no request/response body logging)."""

from __future__ import annotations

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse

from core.telemetry import CORRELATION_HEADER, bind_request_correlation, get_correlation_id


class RequestCorrelationMiddleware:
    """Bind a server-generated opaque correlation id and expose it on responses.

    Client-supplied correlation headers are ignored. Does not log requests,
    responses, headers, or exception details.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        bind_request_correlation(request)
        response = self.get_response(request)
        response[CORRELATION_HEADER] = get_correlation_id(request)
        return response
