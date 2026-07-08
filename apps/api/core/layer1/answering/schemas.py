"""Answer contract: statuses, server-authored messages, and model-output validation.

Deliberately API-local, like ``core/layer1/records.py`` - extracted to
``packages/contracts`` only once a second consumer needs these shapes.

The model is never trusted. ``validate_model_output`` fails closed: malformed
JSON, an unsupported status, or a citation id that was not retrieved raises
``AnswerOutputError`` (mapped to HTTP 502 by the view). For ``refused`` and
``insufficient_evidence`` the model's prose is discarded entirely - the service
substitutes a fixed, server-authored message.
"""

import json
import re
from dataclasses import dataclass
from typing import Any

STATUS_ANSWERED = "answered"
STATUS_INSUFFICIENT = "insufficient_evidence"
STATUS_REFUSED = "refused"
ANSWER_STATUSES: frozenset[str] = frozenset(
    {STATUS_ANSWERED, STATUS_INSUFFICIENT, STATUS_REFUSED}
)

# Output budget: cap the served answer length (Layer S output-budget foundation).
ANSWER_MAX_LENGTH = 1200

# Handoff prose mini-markup (page gen-prose): ==highlight== and [[evidence_id]].
PROSE_CITE_RE = re.compile(r"\[\[\s*([^\]]+?)\s*\]\]", re.IGNORECASE)
PROSE_HIGHLIGHT_RE = re.compile(r"==([^=]+)==")
MAX_HIGHLIGHTS = 3
_EVIDENCE_ID_PREFIX_RE = re.compile(r"^evidence_id:\s*", re.IGNORECASE)

# Fixed, server-authored user-facing messages. The model only selects the
# status/citations for these two states; its free text is never shown.
REFUSED_MESSAGE = (
    "I can only answer questions about Pius's public portfolio work, skills, "
    "projects, education, and professional experience."
)
INSUFFICIENT_MESSAGE = (
    "I do not have enough public portfolio evidence to answer that confidently."
)

# meta.reason values for the non-answered states.
REASON_OUT_OF_SCOPE = "out_of_scope"
REASON_NO_EVIDENCE = "no_supporting_evidence"


class AnswerOutputError(ValueError):
    """Raised when model output is malformed/unsupported or cites unknown evidence.

    Mapped to HTTP 502 - the model produced something we will not serve.
    """


@dataclass(frozen=True)
class ModelOutput:
    """A validated model result. ``answer`` is meaningful only for ``answered``;
    ``citation_ids`` is a de-duplicated subset of the retrieved evidence ids."""

    status: str
    answer: str
    citation_ids: tuple[str, ...]


def _normalize_citation_token(raw: str) -> str:
    """Strip a mistaken ``evidence_id:`` prefix models copy from block labels."""
    return _EVIDENCE_ID_PREFIX_RE.sub("", raw.strip())


def normalize_answer_prose(answer: str) -> str:
    """Rewrite [[...]] blocks: split comma-separated ids and drop label prefixes."""
    def repl(match: re.Match[str]) -> str:
        tokens = [
            _normalize_citation_token(part)
            for part in match.group(1).split(",")
            if part.strip()
        ]
        return "".join(f"[[{token}]]" for token in tokens)

    return PROSE_CITE_RE.sub(repl, answer)


def normalize_citation_ids(citation_ids: list[str]) -> list[str]:
    return [_normalize_citation_token(cid) for cid in citation_ids]


def parse_prose_markup(answer: str) -> tuple[int, tuple[str, ...]]:
    """Return highlight count and de-duplicated evidence ids from [[...]] markers."""
    cited_ids: list[str] = []
    seen: set[str] = set()
    for match in PROSE_CITE_RE.finditer(answer):
        for part in match.group(1).split(","):
            evidence_id = _normalize_citation_token(part)
            if not evidence_id or evidence_id in seen:
                continue
            seen.add(evidence_id)
            cited_ids.append(evidence_id)
    highlight_count = len(PROSE_HIGHLIGHT_RE.findall(answer))
    return highlight_count, tuple(cited_ids)


def validate_model_output(
    raw_text: Any, retrieved_ids: tuple[str, ...]
) -> ModelOutput:
    """Parse and validate raw model output fail-closed against retrieved ids."""
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise AnswerOutputError("model output is empty")

    try:
        data = json.loads(raw_text)
    except (json.JSONDecodeError, ValueError) as exc:
        raise AnswerOutputError("model output is not valid JSON") from exc

    if not isinstance(data, dict):
        raise AnswerOutputError("model output must be a JSON object")

    status = data.get("status")
    if status not in ANSWER_STATUSES:
        raise AnswerOutputError(f"unsupported answer status: {status!r}")

    answer_raw = data.get("answer", "")
    if not isinstance(answer_raw, str):
        raise AnswerOutputError("answer must be a string")
    answer = answer_raw.strip()

    citation_ids_raw = data.get("citation_ids", [])
    if not isinstance(citation_ids_raw, list) or not all(
        isinstance(c, str) for c in citation_ids_raw
    ):
        raise AnswerOutputError("citation_ids must be a list of strings")

    # refused / insufficient_evidence never invent citations, and their prose is
    # replaced with a server message downstream - drop both here.
    if status != STATUS_ANSWERED:
        return ModelOutput(status=status, answer="", citation_ids=())

    if not answer:
        raise AnswerOutputError("an answered result requires a non-empty answer")

    answer = normalize_answer_prose(answer)[:ANSWER_MAX_LENGTH]
    citation_ids_raw = normalize_citation_ids(citation_ids_raw)

    highlight_count, cited_in_prose = parse_prose_markup(answer)
    if highlight_count > MAX_HIGHLIGHTS:
        raise AnswerOutputError(
            f"answer has too many ==highlight== spans ({highlight_count})"
        )
    if not cited_in_prose:
        raise AnswerOutputError(
            "an answered result requires at least one [[evidence_id]] marker"
        )

    allowed = set(retrieved_ids)
    for evidence_id in cited_in_prose:
        if evidence_id not in allowed:
            raise AnswerOutputError(
                f"prose marker cites evidence that was not retrieved: {evidence_id}"
            )

    seen: list[str] = []
    for cid in citation_ids_raw:
        if cid not in allowed:
            raise AnswerOutputError(f"citation id was not retrieved: {cid}")
        if cid not in seen:
            seen.append(cid)

    prose_set = set(cited_in_prose)
    citation_set = set(seen)
    if prose_set != citation_set:
        orphan_citations = citation_set - prose_set
        orphan_markers = prose_set - citation_set
        if orphan_citations:
            raise AnswerOutputError(
                "citation_ids contains ids not referenced in answer prose markers"
            )
        if orphan_markers:
            raise AnswerOutputError(
                "answer prose markers reference ids missing from citation_ids"
            )

    return ModelOutput(status=status, answer=answer, citation_ids=tuple(seen))
