"""Soft, process-local daily budgets for paid answer-provider calls."""

from datetime import date, datetime, timezone
from threading import Lock

from django.conf import settings


class AnswerLimitExceeded(RuntimeError):
    """Raised before a provider call when a soft daily budget is exhausted."""


_lock = Lock()
_usage_day: date | None = None
_global_count = 0
_client_counts: dict[str, int] = {}


def _utc_day() -> date:
    return datetime.now(timezone.utc).date()


def _reset_if_new_day(today: date) -> None:
    global _usage_day, _global_count
    if _usage_day == today:
        return
    _usage_day = today
    _global_count = 0
    _client_counts.clear()


def reserve_answer_call(client_id: str) -> None:
    """Reserve one attempted provider call or reject it before any spend."""
    global _global_count

    global_limit = settings.ANSWER_DAILY_SOFT_LIMIT
    client_limit = settings.ANSWER_PER_CLIENT_DAILY_LIMIT
    if global_limit <= 0 and client_limit <= 0:
        return

    with _lock:
        _reset_if_new_day(_utc_day())
        client_count = _client_counts.get(client_id, 0)

        if global_limit > 0 and _global_count >= global_limit:
            raise AnswerLimitExceeded("daily answer limit reached")
        if client_limit > 0 and client_count >= client_limit:
            raise AnswerLimitExceeded("client daily answer limit reached")

        _global_count += 1
        _client_counts[client_id] = client_count + 1


def reset_answer_usage_for_tests() -> None:
    """Clear process-local counters so tests remain isolated."""
    global _usage_day, _global_count
    with _lock:
        _usage_day = None
        _global_count = 0
        _client_counts.clear()
