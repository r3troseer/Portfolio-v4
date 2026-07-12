from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.request import Request
from rest_framework.response import Response

from core.layer1.answering.providers import ProviderError, ProviderUnavailableError
from core.layer1.answering.limits import AnswerLimitExceeded
from core.layer1.answering.schemas import AnswerOutputError
from core.layer1.answering.service import generate_answer
from core.layer1.presentation import build_retrieval_ledger, match_dict
from core.layer1.reranking import RERANK_MODE, retrieve_and_rerank
from core.layer1.retrieval import (
    IndexUnavailableError,
    RetrievalValidationError,
    get_corpus,
    parse_retrieval_request,
)
from core.throttling import AnswerRateThrottle, client_ident


@api_view(["GET"])
@throttle_classes([])  # health checks are exempt from the global throttle
def health(request: Request) -> Response:
    """Liveness probe. Served at both /health/ and /api/health/."""
    return Response({"status": "ok", "service": "portfolio-api"})


@api_view(["POST"])  # global AnonRateThrottle remains the looser retrieval bucket
def retrieve_evidence(request: Request) -> Response:
    """Layer 1 retrieval: lexical candidates, deterministic rerank, selection.

    No generated answer - just ranked, publicly-indexable evidence records
    plus the retrieve-to-rerank ledger explaining how they were ordered.
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

    result = retrieve_and_rerank(corpus, query)
    return Response(
        {
            "matches": [
                match_dict(c.record, c.rerank_score) for c in result.selected
            ],
            "ledger": build_retrieval_ledger(result),
            "meta": {
                "total_records": len(corpus.entries),
                "top_k": query.top_k,
                "role_lens": query.role_lens,
                "index_source": corpus.source,
                "initial_count": len(result.candidates),
                "selected_count": len(result.selected),
                "reranker": RERANK_MODE,
            },
        }
    )


@api_view(["POST"])
@throttle_classes([AnswerRateThrottle])
def answer(request: Request) -> Response:
    """Layer 1 grounded answer: retrieve public evidence, call a server-side model,
    validate its JSON output against the retrieved evidence, and return a cited
    answer. ``/api/retrieve/`` remains the raw evidence ledger; this endpoint
    grounds an answer on top of it. Model keys/config are server-side only.
    """
    if not settings.ANSWER_ENDPOINT_ENABLED:
        return Response(
            {"error": "answer service unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        payload = generate_answer(request.data, client_id=client_ident(request))
    except RetrievalValidationError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except AnswerLimitExceeded as exc:
        return Response({"error": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
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
