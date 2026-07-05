from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.request import Request
from rest_framework.response import Response

from core.layer1.records import EvidenceRecord
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


def _match_dict(record: EvidenceRecord, score: int) -> dict[str, object]:
    """Same field set as builder.records_as_dicts, plus the retrieval score."""
    return {
        "id": record.id,
        "source_type": record.source_type,
        "source_id": record.source_id,
        "title": record.title,
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
