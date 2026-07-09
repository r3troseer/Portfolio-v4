from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.request import Request
from rest_framework.response import Response

from core.layer1.answering.providers import ProviderError, ProviderUnavailableError
from core.layer1.answering.schemas import AnswerOutputError
from core.layer1.answering.service import generate_answer
from core.layer1.presentation import match_dict as _match_dict
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


@api_view(["POST"])  # global AnonRateThrottle applies (deliberately not exempted)
def answer(request: Request) -> Response:
    """Layer 1 grounded answer: retrieve public evidence, call a server-side model,
    validate its JSON output against the retrieved evidence, and return a cited
    answer. ``/api/retrieve/`` remains the raw evidence ledger; this endpoint
    grounds an answer on top of it. Model keys/config are server-side only.
    """
    try:
        payload = generate_answer(request.data)
    except RetrievalValidationError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except (IndexUnavailableError, ProviderUnavailableError, ProviderError):
        # Fail-closed: no trustworthy corpus or no usable answer provider.
        return Response(
            {"error": "answer service unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except AnswerOutputError:
        # The model produced malformed/unsupported output or cited unknown
        # evidence - never serve the unsupported answer.
        return Response(
            {"error": "answer could not be produced"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(payload)
