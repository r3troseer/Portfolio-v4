"""Privacy-safe structured operational events for answer and retrieve.

Emits one-line JSON log records with an allow-listed field set only. Callers
must pass fixed taxonomy outcomes and never interpolate exception text,
prompts, queries, answer prose, evidence, secrets, or request/provider payloads.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

logger = logging.getLogger("core.telemetry")

CORRELATION_HEADER = "X-Request-Id"
_REQUEST_ID_ATTR = "_api_correlation_id"
_START_ATTR = "_api_telemetry_start"
_EMITTED_ATTR = "_api_outcome_emitted"

ENDPOINT_ANSWER = "answer"
ENDPOINT_RETRIEVE = "retrieve"

OUTCOME_ANSWER_OK = "answer.ok"
OUTCOME_ANSWER_INVALID_REQUEST = "answer.invalid_request"
OUTCOME_ANSWER_THROTTLED = "answer.throttled"
OUTCOME_ANSWER_SOFT_LIMIT = "answer.soft_limit"
OUTCOME_ANSWER_PROVIDER_TIMEOUT = "answer.provider_timeout"
OUTCOME_ANSWER_PROVIDER_UNAVAILABLE = "answer.provider_unavailable"
OUTCOME_ANSWER_PROVIDER_CONTRACT = "answer.provider_contract"
OUTCOME_ANSWER_CORPUS_UNAVAILABLE = "answer.corpus_unavailable"
OUTCOME_ANSWER_DISABLED = "answer.disabled"
OUTCOME_RETRIEVE_OK = "retrieve.ok"
OUTCOME_RETRIEVE_INVALID_REQUEST = "retrieve.invalid_request"
OUTCOME_RETRIEVE_CORPUS_UNAVAILABLE = "retrieve.corpus_unavailable"

ALLOWED_ENDPOINTS: frozenset[str] = frozenset(
    {ENDPOINT_ANSWER, ENDPOINT_RETRIEVE}
)
ALLOWED_OUTCOMES: frozenset[str] = frozenset(
    {
        OUTCOME_ANSWER_OK,
        OUTCOME_ANSWER_INVALID_REQUEST,
        OUTCOME_ANSWER_THROTTLED,
        OUTCOME_ANSWER_SOFT_LIMIT,
        OUTCOME_ANSWER_PROVIDER_TIMEOUT,
        OUTCOME_ANSWER_PROVIDER_UNAVAILABLE,
        OUTCOME_ANSWER_PROVIDER_CONTRACT,
        OUTCOME_ANSWER_CORPUS_UNAVAILABLE,
        OUTCOME_ANSWER_DISABLED,
        OUTCOME_RETRIEVE_OK,
        OUTCOME_RETRIEVE_INVALID_REQUEST,
        OUTCOME_RETRIEVE_CORPUS_UNAVAILABLE,
    }
)

_SAFE_FIELD_NAMES: frozenset[str] = frozenset(
    {"outcome", "correlation_id", "endpoint", "status_code", "duration_ms"}
)


def new_correlation_id() -> str:
    """Return a server-generated opaque correlation identifier."""
    return uuid.uuid4().hex


def _is_safe_correlation_id(value: object) -> bool:
    return (
        isinstance(value, str)
        and 1 <= len(value) <= 64
        and value.isalnum()
    )


def bind_request_correlation(request: Any, correlation_id: str | None = None) -> str:
    """Attach a server-generated correlation id and start time to ``request``."""
    cid = correlation_id if _is_safe_correlation_id(correlation_id) else new_correlation_id()
    setattr(request, _REQUEST_ID_ATTR, cid)
    if getattr(request, _START_ATTR, None) is None:
        setattr(request, _START_ATTR, time.perf_counter())
    return cid


def get_correlation_id(request: Any) -> str:
    """Return the request correlation id, creating one if middleware did not run."""
    existing = getattr(request, _REQUEST_ID_ATTR, None)
    if _is_safe_correlation_id(existing):
        return existing
    return bind_request_correlation(request)


def elapsed_ms(request: Any) -> int:
    """Coarse request duration in milliseconds from bind time."""
    start = getattr(request, _START_ATTR, None)
    if not isinstance(start, (int, float)):
        return 0
    return max(0, int((time.perf_counter() - start) * 1000))


def _coerce_non_negative_int(value: object, *, default: int = 0) -> int:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    return max(0, number)


def emit_api_outcome(
    *,
    outcome: str,
    correlation_id: str,
    endpoint: str,
    status_code: int,
    duration_ms: int,
) -> None:
    """Emit one allow-listed operational event. Rejects unknown fields/outcomes."""
    if outcome not in ALLOWED_OUTCOMES:
        return
    if endpoint not in ALLOWED_ENDPOINTS:
        return
    if not _is_safe_correlation_id(correlation_id):
        correlation_id = new_correlation_id()

    payload = {
        "outcome": outcome,
        "correlation_id": correlation_id,
        "endpoint": endpoint,
        "status_code": _coerce_non_negative_int(status_code),
        "duration_ms": _coerce_non_negative_int(duration_ms),
    }
    if set(payload) != _SAFE_FIELD_NAMES:
        return
    logger.info("%s", json.dumps(payload, separators=(",", ":"), sort_keys=True))


def record_request_outcome(
    request: Any,
    *,
    outcome: str,
    endpoint: str,
    status_code: int,
) -> None:
    """Emit at most one terminal outcome event for ``request``."""
    if getattr(request, _EMITTED_ATTR, False):
        return
    emit_api_outcome(
        outcome=outcome,
        correlation_id=get_correlation_id(request),
        endpoint=endpoint,
        status_code=status_code,
        duration_ms=elapsed_ms(request),
    )
    setattr(request, _EMITTED_ATTR, True)
