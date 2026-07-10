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

# Optional page-lead headline (handoff gen-headline: lead statement + one
# supporting line). Length caps mirror the prototype's plain-text bounds.
HEADLINE_TITLE_MAX = 140
HEADLINE_SUB_MAX = 220

# Handoff prose mini-markup (page gen-prose): ==highlight== and [[evidence_id]].
PROSE_CITE_RE = re.compile(r"\[\[\s*([^\]]+?)\s*\]\]", re.IGNORECASE)
PROSE_HIGHLIGHT_RE = re.compile(r"==([^=]+)==")
_SAFE_BOUNDARY_RE = re.compile(r"(?<=[.!?])(?=\s|$)|\s+")
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
    ``citation_ids`` is a de-duplicated subset of the retrieved evidence ids.
    ``headline_title``/``headline_sub`` carry the optional page-lead headline
    (empty strings when absent or dropped by validation)."""

    status: str
    answer: str
    citation_ids: tuple[str, ...]
    headline_title: str = ""
    headline_sub: str = ""


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


def _protected_spans(answer: str) -> tuple[tuple[int, int], ...]:
    matches = (*PROSE_CITE_RE.finditer(answer), *PROSE_HIGHLIGHT_RE.finditer(answer))
    return tuple(sorted((match.start(), match.end()) for match in matches))


def _is_safe_boundary(index: int, spans: tuple[tuple[int, int], ...]) -> bool:
    return not any(start < index < end for start, end in spans)


def _clip_plain(text: str, max_length: int) -> str:
    """Cap plain headline text at a whitespace boundary (no protected spans)."""
    if len(text) <= max_length:
        return text
    clipped = text[:max_length].rsplit(None, 1)[0].rstrip()
    return clipped or text[:max_length].rstrip()


def parse_headline(data: dict[str, Any]) -> tuple[str, str]:
    """Extract the optional plain-text headline; drop it rather than fail.

    The headline is decorative page framing, not grounding - so unlike
    citations it fails soft by contract: a missing/malformed headline, or one
    carrying prose markup ([[...]] / ==...==), returns ("", "") and never
    blocks an otherwise valid grounded answer.
    """
    headline = data.get("headline")
    if not isinstance(headline, dict):
        return "", ""
    title_raw = headline.get("title")
    if not isinstance(title_raw, str) or not title_raw.strip():
        return "", ""
    sub_raw = headline.get("sub")
    sub = sub_raw.strip() if isinstance(sub_raw, str) else ""
    title = title_raw.strip()
    for value in (title, sub):
        if PROSE_CITE_RE.search(value) or PROSE_HIGHLIGHT_RE.search(value):
            return "", ""
    return _clip_plain(title, HEADLINE_TITLE_MAX), _clip_plain(sub, HEADLINE_SUB_MAX)


def truncate_answer_prose(answer: str, max_length: int = ANSWER_MAX_LENGTH) -> str:
    """Truncate at the latest whitespace/sentence boundary outside markup."""
    if len(answer) <= max_length:
        return answer

    spans = _protected_spans(answer)
    candidates = [
        match.start()
        for match in _SAFE_BOUNDARY_RE.finditer(answer, 0, max_length + 1)
        if match.start() > 0 and _is_safe_boundary(match.start(), spans)
    ]
    if not candidates:
        raise AnswerOutputError("answer cannot be truncated at a safe boundary")

    truncated = answer[: max(candidates)].rstrip()
    if not truncated:
        raise AnswerOutputError("answer cannot be truncated at a safe boundary")
    return truncated


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

    answer = normalize_answer_prose(answer)
    citation_ids_raw = normalize_citation_ids(citation_ids_raw)

    # Validate citation/highlight discipline against the complete model output.
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

    served_answer = truncate_answer_prose(answer)
    _, served_citation_ids = parse_prose_markup(served_answer)
    if not served_citation_ids:
        raise AnswerOutputError("truncation removed every citation marker")

    headline_title, headline_sub = parse_headline(data)
    return ModelOutput(
        status=status,
        answer=served_answer,
        citation_ids=served_citation_ids,
        headline_title=headline_title,
        headline_sub=headline_sub,
    )
