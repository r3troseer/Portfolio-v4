import re

from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.request import Request
from rest_framework.response import Response

from core.layer1.records import (
    SOURCE_MARKDOWN,
    SOURCE_PROFILE,
    SOURCE_PROJECT,
    EvidenceRecord,
)
from core.layer1.retrieval import (
    IndexUnavailableError,
    RetrievalValidationError,
    get_corpus,
    parse_retrieval_request,
    retrieve,
)


@api_view(["GET"])
@throttle_classes([])  # health checks are exempt from the global throttle
def health(request: Request) -> Response:
    """Liveness probe. Served at both /health/ and /api/health/."""
    return Response({"status": "ok", "service": "portfolio-api"})


SNIPPET_MAX_LENGTH = 180


def _plain_text(value: str) -> str:
    """Convert indexed context into a short display-safe source snippet."""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    text = re.sub(r"[`*_>#]", "", text)
    text = re.sub(r"(?m)^\s*[-+]\s+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _snippet(record: EvidenceRecord) -> str:
    text = _plain_text(record.text or record.title)
    if len(text) <= SNIPPET_MAX_LENGTH:
        return text
    return text[: SNIPPET_MAX_LENGTH - 3].rstrip() + "..."


def _entity_type(record: EvidenceRecord) -> str:
    if record.source_type == SOURCE_PROJECT:
        return "project"
    if record.source_type == SOURCE_PROFILE:
        return "profile"
    if (
        record.source_type == SOURCE_MARKDOWN
        and record.source_id.startswith("role-lenses/")
    ):
        return "role_lens"
    return "content"


def _entity_id(record: EvidenceRecord) -> str:
    return record.project_id or record.source_id


def _match_dict(record: EvidenceRecord, score: int) -> dict[str, object]:
    """Retrieval hit plus user-facing entity display fields."""
    return {
        "id": record.id,
        "source_type": record.source_type,
        "source_id": record.source_id,
        "entity_id": _entity_id(record),
        "entity_type": _entity_type(record),
        "title": record.title,
        "snippet": _snippet(record),
        "text": record.text,
        "visibility": record.visibility,
        "sensitivity": record.sensitivity,
        "role_lenses": list(record.role_lenses),
        "tags": list(record.tags),
        "project_id": record.project_id,
        "source_path": record.source_path,
        "score": score,
    }


@api_view(["POST"])  # global AnonRateThrottle applies (deliberately not exempted)
def retrieve_evidence(request: Request) -> Response:
    """Layer 1 retrieval: deterministic lexical search over the evidence index.

    No generated answer - just ranked, publicly-indexable evidence records.
    An empty ``matches`` list is the deterministic no-results response.
    """
    try:
        query = parse_retrieval_request(request.data)
    except RetrievalValidationError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        corpus = get_corpus()
    except IndexUnavailableError:
        # Fail-closed: no trustworthy corpus means nothing is served.
        return Response(
            {"error": "evidence index unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    matches = retrieve(corpus, query)
    return Response(
        {
            "matches": [_match_dict(m.record, m.score) for m in matches],
            "meta": {
                "total_records": len(corpus.entries),
                "top_k": query.top_k,
                "role_lens": query.role_lens,
                "index_source": corpus.source,
            },
        }
    )
