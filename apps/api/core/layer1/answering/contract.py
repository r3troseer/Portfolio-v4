"""Served-answer response contract: shared JSON Schema + companion invariant.

Loads ``packages/contracts/answer-response.schema.json`` (never duplicated here).
This validates the **HTTP-served** payload shape, not raw model output
(``schemas.validate_model_output``) and not semantic entailment.

Enforcement boundary for the API producer is the contract test suite
(``test_answer_contract.py``), which validates fixture agreement and every
current ``generate_answer`` status payload through ``validate_served_answer``.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_CONTRACTS_DIR = (
    Path(__file__).resolve().parents[5] / "packages" / "contracts"
)
_SCHEMA_PATH = _CONTRACTS_DIR / "answer-response.schema.json"


class AnswerContractError(ValueError):
    """Raised when a served answer payload fails the shared contract.

    Messages are internal-only: do not surface schema paths, validator detail,
    or raw payloads to public HTTP responses or user-facing logs.
    """


@lru_cache(maxsize=1)
def _validator() -> Draft202012Validator:
    schema = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def contracts_dir() -> Path:
    """Absolute path to ``packages/contracts``."""
    return _CONTRACTS_DIR


def citation_evidence_ids_subset(payload: Any) -> bool:
    """Companion invariant: every citation.evidence_id is in evidence[].id."""
    if not isinstance(payload, dict):
        return False
    citations = payload.get("citations")
    evidence = payload.get("evidence")
    if not isinstance(citations, list) or not isinstance(evidence, list):
        return False
    ids = {
        row.get("id")
        for row in evidence
        if isinstance(row, dict) and isinstance(row.get("id"), str)
    }
    for citation in citations:
        if not isinstance(citation, dict):
            return False
        evidence_id = citation.get("evidence_id")
        if not isinstance(evidence_id, str) or evidence_id not in ids:
            return False
    return True


def validate_served_answer(payload: Any) -> None:
    """Validate a served answer payload against the shared contract.

    Returns None on success. Raises ``AnswerContractError`` on failure without
    embedding schema paths or the raw payload in the exception message.
    """
    try:
        _validator().validate(payload)
    except Exception as exc:
        raise AnswerContractError("served answer failed schema validation") from exc
    if not citation_evidence_ids_subset(payload):
        raise AnswerContractError(
            "served answer failed citation/evidence invariant"
        )
