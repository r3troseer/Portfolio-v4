"""Grounded-answer orchestration.

Flow (fail-closed at each step):

  parse request -> load corpus -> retrieve candidates -> deterministic rerank
    -> no evidence: return insufficient_evidence WITHOUT calling a provider
    -> build prompt from SELECTED evidence only -> provider.generate
    -> validate model JSON vs selected ids (citing an unselected candidate
       fails closed) -> hydrate citations -> assemble response with the ledger

The provider is injectable so tests never call a real model.
"""

from typing import Any

from core.layer1.answering.limits import reserve_answer_call
from core.layer1.answering.prompts import SYSTEM_PROMPT, build_user_prompt
from core.layer1.answering.providers import AnswerProvider, get_provider
from core.layer1.answering.schemas import (
    INSUFFICIENT_MESSAGE,
    REASON_NO_EVIDENCE,
    REASON_OUT_OF_SCOPE,
    REFUSED_MESSAGE,
    STATUS_ANSWERED,
    STATUS_INSUFFICIENT,
    STATUS_REFUSED,
    validate_model_output,
)
from core.layer1.presentation import (
    build_retrieval_ledger,
    citation_dict,
    match_dict,
    resolve_citation_ref,
)
from core.layer1.reranking import RERANK_MODE, retrieve_and_rerank
from core.layer1.retrieval import get_corpus, parse_retrieval_request


def _insufficient(
    evidence: list[dict[str, object]],
    ledger: dict[str, object],
    meta_base: dict[str, object],
) -> dict[str, object]:
    return {
        "status": STATUS_INSUFFICIENT,
        "answer": INSUFFICIENT_MESSAGE,
        "citations": [],
        "evidence": evidence,
        "ledger": ledger,
        "meta": {**meta_base, "reason": REASON_NO_EVIDENCE},
    }


def generate_answer(
    data: Any,
    *,
    provider: AnswerProvider | None = None,
    client_id: str | None = None,
) -> dict[str, object]:
    """Produce a grounded answer payload for a request body.

    Raises (mapped to HTTP by the view):
    - RetrievalValidationError (400) - invalid request;
    - IndexUnavailableError (503) - no trustworthy corpus;
    - ProviderUnavailableError / ProviderError (503) - provider unusable/failed;
    - AnswerOutputError (502) - model output malformed or cites unknown evidence.
    """
    query = parse_retrieval_request(data)
    corpus = get_corpus()
    result = retrieve_and_rerank(corpus, query)
    selected = result.selected

    evidence = [match_dict(c.record, c.rerank_score) for c in selected]
    ledger = build_retrieval_ledger(result)
    meta_base: dict[str, object] = {
        "retrieval_count": len(selected),
        "initial_count": len(result.candidates),
        "selected_count": len(selected),
        "reranker": RERANK_MODE,
        "index_source": corpus.source,
    }

    # No evidence: refuse to guess and never spend a provider call.
    if not selected:
        return _insufficient(evidence, ledger, meta_base)

    if client_id is not None:
        reserve_answer_call(client_id)

    provider = provider or get_provider()
    # The provider sees only the selected reranked evidence, never the wider
    # candidate pool - citing an unselected candidate fails closed below.
    user_prompt = build_user_prompt(query.query, selected, query.role_lens)
    raw = provider.generate(system=SYSTEM_PROMPT, user=user_prompt)

    selected_ids = tuple(c.record.id for c in selected)
    output = validate_model_output(raw, selected_ids)

    if output.status == STATUS_ANSWERED:
        records_by_id = {c.record.id: c.record for c in selected}
        scores_by_id = {c.record.id: c.rerank_score for c in selected}
        refs_by_id = {
            c.record.id: resolve_citation_ref(c.record)
            for c in selected
        }
        citations = [
            citation_dict(
                records_by_id[cid],
                ref=refs_by_id[cid],
                score=scores_by_id[cid],
            )
            for cid in output.citation_ids
        ]
        return {
            "status": STATUS_ANSWERED,
            "answer": output.answer,
            "citations": citations,
            "evidence": evidence,
            "ledger": ledger,
            "meta": {
                **meta_base,
                "model": provider.model_name,
                "provider": provider.provider_name,
            },
        }

    if output.status == STATUS_REFUSED:
        # Out of scope: drop the retrieved evidence AND the ledger, and use
        # the server message - a refusal serves no retrieval artifacts.
        return {
            "status": STATUS_REFUSED,
            "answer": REFUSED_MESSAGE,
            "citations": [],
            "evidence": [],
            "meta": {**meta_base, "reason": REASON_OUT_OF_SCOPE},
        }

    return _insufficient(evidence, ledger, meta_base)
