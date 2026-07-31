"""Layer 1 deterministic reranking: the second stage of the retrieval pipeline.

Takes the lexical candidate pool from ``retrieval.retrieve_candidates`` and
re-orders it with a transparent, integer, model-free score (no embeddings, no
cross-encoder, no LLM - reproducible and auditable like the lexical stage).
Every reranked row exposes its component breakdown and human-readable reasons
so the API ledger can explain why a candidate moved.

Where lexical scoring rewards weight concentration (a single token hitting a
title is +3), the rerank score rewards breadth and phrasing: covering all the
query's terms and matching the user's actual phrase outrank a narrow
high-weight hit. The lexical component is carried but capped, so the rerank
order is deliberately not a monotone transform of the lexical order.
"""

from dataclasses import dataclass

from core.layer1.records import EvidenceRecord
from core.layer1.retrieval import (
    Candidate,
    Corpus,
    CorpusEntry,
    RetrievalQuery,
    _tokenize,
    candidate_pool_size,
    retrieve_candidates,
)

RERANK_MODE = "deterministic_rerank_v1"

# Integer rerank component weights.
LEXICAL_CAP = 8          # carried lexical score is capped to break monotonicity
COVERAGE_WEIGHT = 12     # matching every query term is worth 12 points
TITLE_HIT_BONUS = 4      # flat: any query token appears in the title
TAG_HIT_BONUS = 3        # flat: any query token appears in the tags
ROLE_LENS_BONUS = 2      # parity with retrieval's soft lens boost
PHRASE_EXACT_BONUS = 10  # full ordered query-token run in title or text
PHRASE_NEAR_BONUS = 5    # any adjacent query-token bigram in title or text


@dataclass(frozen=True)
class RankedCandidate:
    """A reranked candidate with its full, explainable score breakdown."""

    entry: CorpusEntry
    lexical_score: int
    initial_rank: int
    rerank_score: int
    rerank_rank: int
    delta: int  # initial_rank - rerank_rank; positive = promoted by rerank
    selected: bool
    components: dict[str, int]
    reasons: tuple[str, ...]

    @property
    def record(self) -> EvidenceRecord:
        return self.entry.record


@dataclass(frozen=True)
class RetrievalResult:
    """The full retrieve-to-rerank pipeline output for one query."""

    candidates: tuple[Candidate, ...]  # lexical (initial) order
    ranked: tuple[RankedCandidate, ...]  # rerank order, whole pool
    selected: tuple[RankedCandidate, ...]  # ranked[:top_k]
    retrieve_k: int  # requested candidate pool size
    top_k: int


def _query_terms(query: RetrievalQuery) -> tuple[str, ...]:
    """Ordered, de-duplicated non-stopword query tokens."""
    return tuple(dict.fromkeys(_tokenize(query.query)))


def _contains_run(haystack: tuple[str, ...], needle: tuple[str, ...]) -> bool:
    """True when ``needle`` appears as a contiguous run inside ``haystack``."""
    if not needle or len(needle) > len(haystack):
        return False
    span = len(needle)
    return any(
        haystack[i : i + span] == needle
        for i in range(len(haystack) - span + 1)
    )


def _phrase_component(entry: CorpusEntry, terms: tuple[str, ...]) -> int:
    """Exact = the whole term sequence appears contiguously; near = any bigram."""
    if len(terms) < 2:
        return 0
    if _contains_run(entry.title_token_seq, terms) or _contains_run(
        entry.text_token_seq, terms
    ):
        return PHRASE_EXACT_BONUS
    for i in range(len(terms) - 1):
        bigram = terms[i : i + 2]
        if _contains_run(entry.title_token_seq, bigram) or _contains_run(
            entry.text_token_seq, bigram
        ):
            return PHRASE_NEAR_BONUS
    return 0


def _matched_terms(entry: CorpusEntry, terms: tuple[str, ...]) -> int:
    """How many distinct query terms appear anywhere in the entry."""
    return sum(
        1
        for term in terms
        if term in entry.text_tokens
        or term in entry.title_tokens
        or term in entry.tag_tokens
    )


def _score_components(
    candidate: Candidate, terms: tuple[str, ...], lens: str | None
) -> dict[str, int]:
    """Integer component breakdown; the rerank score is exactly their sum."""
    entry = candidate.entry
    matched = _matched_terms(entry, terms)
    return {
        "lexical": min(candidate.lexical_score, LEXICAL_CAP),
        "coverage": (matched * COVERAGE_WEIGHT) // len(terms) if terms else 0,
        "title": TITLE_HIT_BONUS
        if any(t in entry.title_tokens for t in terms)
        else 0,
        "tags": TAG_HIT_BONUS
        if any(t in entry.tag_tokens for t in terms)
        else 0,
        "role_lens": ROLE_LENS_BONUS
        if lens is not None and lens in entry.lenses
        else 0,
        "phrase": _phrase_component(entry, terms),
    }


def _reasons(
    candidate: Candidate,
    components: dict[str, int],
    terms: tuple[str, ...],
    lens: str | None,
) -> tuple[str, ...]:
    """Human-readable, deterministic explanation of the component breakdown."""
    matched = _matched_terms(candidate.entry, terms)
    reasons: list[str] = []
    if matched > 0:
        reasons.append(f"matched {matched}/{len(terms)} query terms")
    if components["phrase"] == PHRASE_EXACT_BONUS:
        reasons.append("exact phrase match")
    elif components["phrase"] == PHRASE_NEAR_BONUS:
        reasons.append("near phrase match")
    if components["title"] > 0:
        reasons.append("query term in title")
    if components["tags"] > 0:
        reasons.append("query term in tags")
    if components["role_lens"] > 0 and lens is not None:
        reasons.append(f"role lens match: {lens}")
    if candidate.lexical_score > LEXICAL_CAP:
        reasons.append(f"lexical score capped at {LEXICAL_CAP}")
    return tuple(reasons)


def rerank_candidates(
    candidates: tuple[Candidate, ...],
    query: RetrievalQuery,
    top_k: int,
) -> tuple[RankedCandidate, ...]:
    """Deterministically rerank the lexical pool; first ``top_k`` are selected.

    Sort key: rerank score desc, then lexical score desc, then record id -
    fully deterministic for identical inputs.
    """
    terms = _query_terms(query)
    lens = query.role_lens.lower() if query.role_lens else None

    scored: list[tuple[dict[str, int], Candidate]] = [
        (_score_components(candidate, terms, lens), candidate)
        for candidate in candidates
    ]
    scored.sort(
        key=lambda pair: (
            -sum(pair[0].values()),
            -pair[1].lexical_score,
            pair[1].record.id,
        )
    )

    ranked: list[RankedCandidate] = []
    for rank, (components, candidate) in enumerate(scored, start=1):
        ranked.append(
            RankedCandidate(
                entry=candidate.entry,
                lexical_score=candidate.lexical_score,
                initial_rank=candidate.initial_rank,
                rerank_score=sum(components.values()),
                rerank_rank=rank,
                delta=candidate.initial_rank - rank,
                selected=rank <= top_k,
                components=components,
                reasons=_reasons(candidate, components, terms, lens),
            )
        )
    return tuple(ranked)


def select_evidence(
    ranked: tuple[RankedCandidate, ...],
) -> tuple[RankedCandidate, ...]:
    """The reranked rows chosen as final evidence (named stage for clarity)."""
    return tuple(c for c in ranked if c.selected)


def retrieve_and_rerank(corpus: Corpus, query: RetrievalQuery) -> RetrievalResult:
    """Run the full two-stage pipeline: lexical candidates -> rerank -> select."""
    candidates = retrieve_candidates(corpus, query)
    ranked = rerank_candidates(candidates, query, query.top_k)
    return RetrievalResult(
        candidates=candidates,
        ranked=ranked,
        selected=select_evidence(ranked),
        retrieve_k=candidate_pool_size(query.top_k),
        top_k=query.top_k,
    )
