"""Layer 1 retrieval service: deterministic lexical retrieval over the evidence index.

First runtime consumer of the evidence index. Deliberately model-free: scoring
is integer token overlap (no embeddings, no LLM), so results are reproducible
and auditable. Safety is structural - the corpus can only contain what the
fail-closed builder emitted, and corpus loading itself fails closed:

- content root present (dev/CI/monorepo): build in-process; refuse the whole
  corpus if the build reports any governance error;
- otherwise read the shipped ``var/evidence_index.json`` artifact (deployed
  environments), refusing it wholesale if any record is not publicly indexable
  (tamper/corruption guard);
- neither available: raise IndexUnavailableError - the endpoint serves nothing.

The corpus is cached for the process lifetime (content edits in dev need a
server restart). Request/response shapes here are API-local, like records.py.
"""

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from core.layer1.builder import DEFAULT_ARTIFACT_PATH, DEFAULT_CONTENT_ROOT, build_index
from core.layer1.records import INDEXABLE, SENSITIVITY, EvidenceRecord

# Request validation limits (Layer S message-length limits for this endpoint).
QUERY_MAX_LENGTH = 500
ROLE_LENS_MAX_LENGTH = 50
TOP_K_DEFAULT = 5
TOP_K_MAX = 20

# Integer score weights per matching unique query token.
_WEIGHT_TEXT = 1
_WEIGHT_TAG = 2
_WEIGHT_TITLE = 3
_ROLE_LENS_BOOST = 2

# Static, reviewed low-signal words. This intentionally stays conservative:
# portfolio/domain terms such as backend, API, AI, evidence, cloud, and data
# remain searchable even when they are frequent in the public corpus.
_STOPWORDS = frozenset(
    {
        "a",
        "about",
        "after",
        "again",
        "all",
        "am",
        "an",
        "and",
        "any",
        "are",
        "as",
        "at",
        "be",
        "because",
        "been",
        "before",
        "being",
        "between",
        "both",
        "but",
        "by",
        "can",
        "could",
        "did",
        "do",
        "does",
        "doing",
        "for",
        "from",
        "had",
        "has",
        "have",
        "he",
        "her",
        "here",
        "hers",
        "him",
        "his",
        "how",
        "i",
        "if",
        "in",
        "into",
        "is",
        "it",
        "its",
        "just",
        "me",
        "more",
        "most",
        "my",
        "no",
        "nor",
        "not",
        "now",
        "of",
        "on",
        "once",
        "only",
        "or",
        "other",
        "our",
        "out",
        "over",
        "please",
        "same",
        "she",
        "should",
        "show",
        "so",
        "some",
        "such",
        "tell",
        "than",
        "that",
        "the",
        "their",
        "them",
        "then",
        "there",
        "these",
        "they",
        "this",
        "those",
        "through",
        "to",
        "too",
        "under",
        "up",
        "us",
        "very",
        "was",
        "we",
        "were",
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "will",
        "with",
        "would",
        "you",
        "your",
    }
)


class RetrievalValidationError(ValueError):
    """Raised when a retrieval request fails validation."""


class IndexUnavailableError(RuntimeError):
    """Raised when no trustworthy evidence corpus can be loaded (fail-closed)."""


@dataclass(frozen=True)
class RetrievalQuery:
    """A validated retrieval request."""

    query: str
    role_lens: str | None = None
    top_k: int = TOP_K_DEFAULT


@dataclass(frozen=True)
class CorpusEntry:
    """An evidence record plus its precomputed lowercase token sets."""

    record: EvidenceRecord
    text_tokens: frozenset[str]
    title_tokens: frozenset[str]
    tag_tokens: frozenset[str]
    lenses: frozenset[str]


@dataclass(frozen=True)
class Corpus:
    """The loaded, searchable evidence index."""

    entries: tuple[CorpusEntry, ...]
    source: str  # "built" | "artifact"


@dataclass(frozen=True)
class ScoredMatch:
    """One retrieval hit: the record and its deterministic lexical score."""

    record: EvidenceRecord
    score: int


def parse_retrieval_request(data: Any) -> RetrievalQuery:
    """Validate a request payload fail-closed; unknown extra keys are ignored."""
    if not isinstance(data, dict):
        raise RetrievalValidationError("request body must be a JSON object")

    query = data.get("query")
    if not isinstance(query, str) or not query.strip():
        raise RetrievalValidationError("query must be a non-empty string")
    query = query.strip()
    if len(query) > QUERY_MAX_LENGTH:
        raise RetrievalValidationError(
            f"query must be at most {QUERY_MAX_LENGTH} characters"
        )

    role_lens = data.get("role_lens")
    if role_lens is not None:
        if not isinstance(role_lens, str) or not role_lens.strip():
            raise RetrievalValidationError("role_lens must be a non-empty string")
        role_lens = role_lens.strip()
        if len(role_lens) > ROLE_LENS_MAX_LENGTH:
            raise RetrievalValidationError(
                f"role_lens must be at most {ROLE_LENS_MAX_LENGTH} characters"
            )

    top_k = data.get("top_k", TOP_K_DEFAULT)
    # bool is an int subclass; reject it explicitly.
    if isinstance(top_k, bool) or not isinstance(top_k, int):
        raise RetrievalValidationError("top_k must be an integer")
    if not 1 <= top_k <= TOP_K_MAX:
        raise RetrievalValidationError(f"top_k must be between 1 and {TOP_K_MAX}")

    return RetrievalQuery(query=query, role_lens=role_lens, top_k=top_k)


def _tokenize(text: str) -> tuple[str, ...]:
    return tuple(
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if token not in _STOPWORDS
    )


def _make_entry(record: EvidenceRecord) -> CorpusEntry:
    return CorpusEntry(
        record=record,
        text_tokens=frozenset(_tokenize(record.text)),
        title_tokens=frozenset(_tokenize(record.title)),
        tag_tokens=frozenset(t for tag in record.tags for t in _tokenize(tag)),
        lenses=frozenset(lens.lower() for lens in record.role_lenses),
    )


def retrieve(corpus: Corpus, query: RetrievalQuery) -> tuple[ScoredMatch, ...]:
    """Score the corpus against a validated query; deterministic, model-free.

    Per unique query token: +1 for a text match, +3 title, +2 tag. Records
    with a positive score and the requested role lens get a +2 boost (soft -
    lens-less records still rank). Zero-score records never match. Ties break
    on record id so ordering is stable.
    """
    tokens = set(_tokenize(query.query))
    lens = query.role_lens.lower() if query.role_lens else None

    scored: list[ScoredMatch] = []
    for entry in corpus.entries:
        score = 0
        for token in tokens:
            if token in entry.text_tokens:
                score += _WEIGHT_TEXT
            if token in entry.title_tokens:
                score += _WEIGHT_TITLE
            if token in entry.tag_tokens:
                score += _WEIGHT_TAG
        if score > 0 and lens is not None and lens in entry.lenses:
            score += _ROLE_LENS_BOOST
        if score > 0:
            scored.append(ScoredMatch(record=entry.record, score=score))

    scored.sort(key=lambda m: (-m.score, m.record.id))
    return tuple(scored[: query.top_k])


# --- Corpus loading (fail-closed) --------------------------------------------


def _record_from_dict(data: dict[str, Any]) -> EvidenceRecord:
    return EvidenceRecord(
        id=str(data["id"]),
        source_type=str(data["source_type"]),
        source_id=str(data["source_id"]),
        title=str(data["title"]),
        text=str(data["text"]),
        visibility=str(data["visibility"]),
        sensitivity=str(data["sensitivity"]),
        role_lenses=tuple(str(v) for v in data.get("role_lenses", [])),
        tags=tuple(str(v) for v in data.get("tags", [])),
        project_id=data.get("project_id"),
        source_path=str(data.get("source_path", "")),
    )


def _load_corpus(
    content_root: Path = DEFAULT_CONTENT_ROOT,
    artifact_path: Path = DEFAULT_ARTIFACT_PATH,
) -> Corpus:
    """Load the corpus build-first with artifact fallback; fail closed otherwise."""
    if content_root.is_dir():
        result = build_index(content_root)
        if result.errors:
            # Never serve a corpus whose build reported governance errors.
            raise IndexUnavailableError(
                f"evidence index build has {len(result.errors)} governance error(s)"
            )
        records: tuple[EvidenceRecord, ...] = result.records
        source = "built"
    elif artifact_path.is_file():
        try:
            payload = json.loads(artifact_path.read_text(encoding="utf-8"))
            records = tuple(
                _record_from_dict(item) for item in payload["records"]
            )
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            raise IndexUnavailableError(
                f"evidence index artifact is unreadable ({exc.__class__.__name__})"
            ) from exc
        source = "artifact"
    else:
        raise IndexUnavailableError("no evidence index source available")

    # Defense in depth: whatever the source, refuse the whole corpus if any
    # record is not publicly indexable or carries out-of-vocabulary
    # sensitivity (tampered/corrupted/stale artifact).
    for record in records:
        if record.visibility not in INDEXABLE:
            raise IndexUnavailableError(
                f"corpus contains a non-indexable record ({record.id})"
            )
        if record.sensitivity not in SENSITIVITY:
            raise IndexUnavailableError(
                f"corpus contains a record with invalid sensitivity ({record.id})"
            )

    return Corpus(entries=tuple(_make_entry(r) for r in records), source=source)


@lru_cache(maxsize=1)
def get_corpus() -> Corpus:
    """Process-lifetime cached corpus (tests: ``get_corpus.cache_clear()``)."""
    return _load_corpus()
