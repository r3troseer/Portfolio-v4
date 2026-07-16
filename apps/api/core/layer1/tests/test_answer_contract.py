"""Shared served-answer contract: fixture agreement + producer boundary.

Loads the committed schema/fixtures from ``packages/contracts``. Validates every
current ``generate_answer`` status payload at this single test/producer boundary
(do not scatter deep validation through internal helpers).
"""

from __future__ import annotations

import json
import unittest

from django.test import SimpleTestCase

from core.layer1.answering.contract import (
    AnswerContractError,
    citation_evidence_ids_subset,
    contracts_dir,
    validate_served_answer,
)
from core.layer1.answering.providers.fake import FakeProvider
from core.layer1.answering.schemas import INSUFFICIENT_MESSAGE, REFUSED_MESSAGE
from core.layer1.answering.service import generate_answer
from core.layer1.retrieval import RetrievalQuery, get_corpus
from core.layer1.reranking import retrieve_and_rerank

MATCHING_QUERY = "multi-agent fintech loan reallocation"
NO_MATCH_QUERY = "zzqqxxyyzz"


def _marked_answer(evidence_id: str) -> str:
    return f"Pius built X. [[{evidence_id}]]"


def _fake_json(status: str, answer: str, citation_ids: list[str]) -> str:
    return json.dumps(
        {"status": status, "answer": answer, "citation_ids": citation_ids}
    )


def _load_manifest() -> dict[str, list[str]]:
    return json.loads(
        (contracts_dir() / "fixtures" / "manifest.json").read_text(encoding="utf-8")
    )


def _load_fixture(rel: str) -> object:
    path = contracts_dir() / "fixtures" / rel
    return json.loads(path.read_text(encoding="utf-8"))


class SharedFixtureCorpusTests(unittest.TestCase):
    """Web and API must agree on every declared pass/fail fixture."""

    def test_valid_fixtures_pass(self) -> None:
        for rel in _load_manifest()["valid"]:
            with self.subTest(fixture=rel):
                validate_served_answer(_load_fixture(rel))

    def test_invalid_fixtures_fail(self) -> None:
        for rel in _load_manifest()["invalid"]:
            with self.subTest(fixture=rel):
                with self.assertRaises(AnswerContractError):
                    validate_served_answer(_load_fixture(rel))

    def test_citation_subset_rejects_mismatch(self) -> None:
        payload = _load_fixture("invalid/citation-evidence-mismatch.json")
        # Schema may still accept structure; companion invariant must fail.
        self.assertFalse(citation_evidence_ids_subset(payload))


class GenerateAnswerProducerBoundaryTests(SimpleTestCase):
    """Single producer boundary: every current status validates against schema."""

    def setUp(self) -> None:
        get_corpus.cache_clear()

    def _first_matching_id(self) -> str:
        result = retrieve_and_rerank(
            get_corpus(), RetrievalQuery(query=MATCHING_QUERY)
        )
        self.assertGreater(len(result.selected), 0)
        return result.selected[0].record.id

    def test_answered_with_headline_validates(self) -> None:
        evidence_id = self._first_matching_id()
        raw = json.dumps(
            {
                "status": "answered",
                "answer": _marked_answer(evidence_id),
                "citation_ids": [evidence_id],
                "headline": {"title": "Lead statement", "sub": "Supporting line"},
            }
        )
        result = generate_answer({"query": MATCHING_QUERY}, provider=FakeProvider(raw))
        validate_served_answer(result)

    def test_answered_without_headline_validates(self) -> None:
        evidence_id = self._first_matching_id()
        provider = FakeProvider(
            _fake_json("answered", _marked_answer(evidence_id), [evidence_id])
        )
        result = generate_answer({"query": MATCHING_QUERY}, provider=provider)
        self.assertIsNone(result["headline"])
        validate_served_answer(result)

    def test_insufficient_evidence_validates(self) -> None:
        result = generate_answer(
            {"query": NO_MATCH_QUERY},
            provider=FakeProvider(_fake_json("answered", "unused", [])),
        )
        self.assertEqual(result["status"], "insufficient_evidence")
        self.assertEqual(result["answer"], INSUFFICIENT_MESSAGE)
        validate_served_answer(result)

    def test_insufficient_evidence_with_selected_evidence_validates(self) -> None:
        provider = FakeProvider(
            _fake_json("insufficient_evidence", "model prose ignored", [])
        )
        result = generate_answer({"query": MATCHING_QUERY}, provider=provider)
        self.assertEqual(result["status"], "insufficient_evidence")
        self.assertGreater(len(result["evidence"]), 0)
        validate_served_answer(result)

    def test_refused_validates(self) -> None:
        provider = FakeProvider(_fake_json("refused", "model prose ignored", []))
        result = generate_answer({"query": MATCHING_QUERY}, provider=provider)
        self.assertEqual(result["status"], "refused")
        self.assertEqual(result["answer"], REFUSED_MESSAGE)
        validate_served_answer(result)


if __name__ == "__main__":
    unittest.main()
