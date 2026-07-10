"""Grounded-answer orchestration.

Flow (fail-closed at each step):

  parse request -> load corpus -> retrieve evidence
    -> no evidence: return insufficient_evidence WITHOUT calling a provider
    -> build prompt -> provider.generate -> validate model JSON vs retrieved ids
    -> hydrate citations from the matched records -> assemble response

Retrieval is consumed exactly as-is (no algorithm change here). The provider is
injectable so tests never call a real model.
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
from core.layer1.presentation import citation_dict, match_dict, resolve_citation_ref
from core.layer1.retrieval import (
    ScoredMatch,
    get_corpus,
    parse_retrieval_request,
    retrieve,
)


def _insufficient(
    evidence: list[dict[str, object]], meta_base: dict[str, object]
) -> dict[str, object]:
    return {
        "status": STATUS_INSUFFICIENT,
        "answer": INSUFFICIENT_MESSAGE,
        "citations": [],
        "evidence": evidence,
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
    matches: tuple[ScoredMatch, ...] = retrieve(corpus, query)

    evidence = [match_dict(m.record, m.score) for m in matches]
    meta_base: dict[str, object] = {
        "retrieval_count": len(matches),
        "index_source": corpus.source,
    }

    # No evidence: refuse to guess and never spend a provider call.
    if not matches:
        return _insufficient(evidence, meta_base)

    if client_id is not None:
        reserve_answer_call(client_id)

    provider = provider or get_provider()
    user_prompt = build_user_prompt(query.query, matches, query.role_lens)
    raw = provider.generate(system=SYSTEM_PROMPT, user=user_prompt)

    retrieved_ids = tuple(m.record.id for m in matches)
    output = validate_model_output(raw, retrieved_ids)

    if output.status == STATUS_ANSWERED:
        records_by_id = {m.record.id: m.record for m in matches}
        scores_by_id = {m.record.id: m.score for m in matches}
        refs_by_id = {
            m.record.id: resolve_citation_ref(m.record)
            for m in matches
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
            "meta": {
                **meta_base,
                "model": provider.model_name,
                "provider": provider.provider_name,
            },
        }

    if output.status == STATUS_REFUSED:
        # Out of scope: drop the retrieved evidence and use the server message.
        return {
            "status": STATUS_REFUSED,
            "answer": REFUSED_MESSAGE,
            "citations": [],
            "evidence": [],
            "meta": {**meta_base, "reason": REASON_OUT_OF_SCOPE},
        }

    return _insufficient(evidence, meta_base)
