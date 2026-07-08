"""Layer 1 grounded-answer tests: validation, refusal, and HTTP status mapping.

Same conventions as the other layer1 tests (stdlib unittest / SimpleTestCase,
no DB). A FakeProvider is injected so a real model is never called; the one 503
"missing key" test drives the endpoint with config mocked empty. Run via
``uv run python manage.py test core``.
"""

import json
import unittest
from unittest import mock

from django.test import SimpleTestCase

from core.layer1.answering.providers.fake import FakeProvider
from core.layer1.answering.schemas import (
    ANSWER_MAX_LENGTH,
    INSUFFICIENT_MESSAGE,
    REFUSED_MESSAGE,
    AnswerOutputError,
    normalize_answer_prose,
    parse_prose_markup,
    validate_model_output,
)
from core.layer1.answering.service import generate_answer
from core.layer1.presentation import citation_display_ref, resolve_citation_ref
from core.layer1.records import SOURCE_MARKDOWN, SOURCE_PROJECT, EvidenceRecord
from core.layer1.retrieval import (
    RetrievalQuery,
    RetrievalValidationError,
    get_corpus,
    retrieve,
)

# A query that matches real Layer 0 content (same as the retrieval endpoint test).
MATCHING_QUERY = "multi-agent fintech loan reallocation"
# A query that matches nothing, for the no-evidence path.
NO_MATCH_QUERY = "zzqqxxyyzz"


def _marked_answer(evidence_id: str, prose: str = "Pius built X.") -> str:
    return f"{prose} [[{evidence_id}]]"


def _fake_json(status: str, answer: str, citation_ids: list[str]) -> str:
    return json.dumps(
        {"status": status, "answer": answer, "citation_ids": citation_ids}
    )


class ParseProseMarkupTests(unittest.TestCase):
    def test_extracts_cite_ids_and_highlights(self) -> None:
        count, ids = parse_prose_markup(
            "Built ==multi-agent== flows [[project:foo]] and [[project:bar]]."
        )
        self.assertEqual(count, 1)
        self.assertEqual(ids, ("project:foo", "project:bar"))

    def test_extracts_ids_with_slashes(self) -> None:
        _, ids = parse_prose_markup("See [[markdown:role-lenses/ai-nlp]].")
        self.assertEqual(ids, ("markdown:role-lenses/ai-nlp",))


class NormalizeAnswerProseTests(unittest.TestCase):
    def test_strips_evidence_id_prefix_from_markers(self) -> None:
        raw = "Claim [[evidence_id:project:a]]."
        self.assertEqual(normalize_answer_prose(raw), "Claim [[project:a]].")

    def test_splits_comma_separated_markers(self) -> None:
        raw = "Claim [[evidence_id:project:a, evidence_id:project:b]]."
        self.assertEqual(
            normalize_answer_prose(raw),
            "Claim [[project:a]][[project:b]].",
        )


class ValidateModelOutputTests(unittest.TestCase):
    IDS = ("project:a", "project:b")

    def test_answered_with_known_citation_passes(self) -> None:
        out = validate_model_output(
            _fake_json("answered", _marked_answer("project:a"), ["project:a"]),
            self.IDS,
        )
        self.assertEqual(out.status, "answered")
        self.assertEqual(out.citation_ids, ("project:a",))

    def test_answered_normalizes_prefixed_gemini_citations(self) -> None:
        raw = _fake_json(
            "answered",
            "Claim [[evidence_id:project:a]].",
            ["evidence_id:project:a"],
        )
        out = validate_model_output(raw, self.IDS)
        self.assertEqual(out.citation_ids, ("project:a",))
        self.assertIn("[[project:a]]", out.answer)

    def test_answered_normalizes_combined_markers(self) -> None:
        raw = _fake_json(
            "answered",
            "Claim [[evidence_id:project:a, project:b]].",
            ["evidence_id:project:a", "project:b"],
        )
        out = validate_model_output(raw, self.IDS)
        self.assertEqual(out.citation_ids, ("project:a", "project:b"))
        self.assertIn("[[project:a]]", out.answer)
        self.assertIn("[[project:b]]", out.answer)

    def test_answered_dedupes_citation_ids(self) -> None:
        out = validate_model_output(
            _fake_json(
                "answered",
                "x [[project:a]] y [[project:b]]",
                ["project:a", "project:a", "project:b"],
            ),
            self.IDS,
        )
        self.assertEqual(out.citation_ids, ("project:a", "project:b"))

    def test_answered_with_unknown_citation_fails_closed(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output(
                _fake_json("answered", _marked_answer("project:ghost"), ["project:ghost"]),
                self.IDS,
            )

    def test_answered_without_prose_marker_fails(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output(_fake_json("answered", "plain prose", ["project:a"]), self.IDS)

    def test_answered_without_citation_ids_fails(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output(
                _fake_json("answered", _marked_answer("project:a"), []), self.IDS
            )

    def test_orphan_citation_id_fails(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output(
                _fake_json(
                    "answered",
                    _marked_answer("project:a"),
                    ["project:a", "project:b"],
                ),
                self.IDS,
            )

    def test_unknown_marker_in_prose_fails(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output(
                _fake_json(
                    "answered",
                    _marked_answer("project:ghost"),
                    ["project:ghost"],
                ),
                self.IDS,
            )

    def test_too_many_highlights_fails(self) -> None:
        answer = "==a== ==b== ==c== ==d== [[project:a]]"
        with self.assertRaises(AnswerOutputError):
            validate_model_output(
                _fake_json("answered", answer, ["project:a"]), self.IDS
            )

    def test_answered_with_empty_answer_fails(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output(
                _fake_json("answered", "   ", ["project:a"]), self.IDS
            )

    def test_malformed_json_fails(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output("not json at all", self.IDS)

    def test_unsupported_status_fails(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output(_fake_json("hallucinated", "x", []), self.IDS)

    def test_empty_output_fails(self) -> None:
        with self.assertRaises(AnswerOutputError):
            validate_model_output("", self.IDS)

    def test_refused_drops_citations_and_prose(self) -> None:
        out = validate_model_output(
            _fake_json("refused", "some model prose", ["project:a"]), self.IDS
        )
        self.assertEqual(out.status, "refused")
        self.assertEqual(out.citation_ids, ())
        self.assertEqual(out.answer, "")

    def test_insufficient_drops_citations_and_prose(self) -> None:
        out = validate_model_output(
            _fake_json("insufficient_evidence", "prose", ["project:a"]), self.IDS
        )
        self.assertEqual(out.status, "insufficient_evidence")
        self.assertEqual(out.citation_ids, ())

    def test_answer_is_length_capped(self) -> None:
        long = f"[[project:a]] {'x' * (ANSWER_MAX_LENGTH + 500)}"
        out = validate_model_output(
            _fake_json("answered", long, ["project:a"]),
            self.IDS,
        )
        self.assertEqual(len(out.answer), ANSWER_MAX_LENGTH)
        self.assertIn("[[project:a]]", out.answer)


class GenerateAnswerServiceTests(SimpleTestCase):
    """Service-level flow with an injected FakeProvider (no model calls)."""

    def setUp(self) -> None:
        get_corpus.cache_clear()

    def _first_matching_id(self) -> str:
        matches = retrieve(get_corpus(), RetrievalQuery(query=MATCHING_QUERY))
        self.assertGreater(len(matches), 0)
        return matches[0].record.id

    def test_no_evidence_returns_insufficient_without_calling_provider(self) -> None:
        provider = FakeProvider(_fake_json("answered", "should not run", []))
        result = generate_answer({"query": NO_MATCH_QUERY}, provider=provider)
        self.assertEqual(result["status"], "insufficient_evidence")
        self.assertEqual(result["answer"], INSUFFICIENT_MESSAGE)
        self.assertEqual(result["citations"], [])
        self.assertEqual(result["meta"]["reason"], "no_supporting_evidence")
        self.assertEqual(provider.calls, 0)

    def test_valid_output_returns_answered_with_hydrated_citations(self) -> None:
        evidence_id = self._first_matching_id()
        provider = FakeProvider(
            _fake_json(
                "answered",
                f"Pius built ==X== [[{evidence_id}]].",
                [evidence_id],
            ),
            model_name="fake-model",
        )
        result = generate_answer({"query": MATCHING_QUERY}, provider=provider)
        self.assertEqual(result["status"], "answered")
        self.assertIn(f"[[{evidence_id}]]", result["answer"])
        self.assertEqual(len(result["citations"]), 1)
        citation = result["citations"][0]
        self.assertEqual(citation["evidence_id"], evidence_id)
        self.assertEqual(citation["ref"], "01")
        self.assertIn("title", citation)
        self.assertIn("snippet", citation)
        self.assertIn("score", citation)
        self.assertGreater(len(result["evidence"]), 0)
        self.assertEqual(result["meta"]["provider"], "fake")
        self.assertEqual(result["meta"]["model"], "fake-model")
        self.assertEqual(provider.calls, 1)

    def test_unknown_citation_id_fails_closed(self) -> None:
        provider = FakeProvider(
            _fake_json(
                "answered",
                _marked_answer("project:does-not-exist"),
                ["project:does-not-exist"],
            )
        )
        with self.assertRaises(AnswerOutputError):
            generate_answer({"query": MATCHING_QUERY}, provider=provider)

    def test_malformed_provider_json_fails_closed(self) -> None:
        provider = FakeProvider("this is not json")
        with self.assertRaises(AnswerOutputError):
            generate_answer({"query": MATCHING_QUERY}, provider=provider)

    def test_refused_output_returns_server_message(self) -> None:
        provider = FakeProvider(_fake_json("refused", "model prose ignored", []))
        result = generate_answer({"query": MATCHING_QUERY}, provider=provider)
        self.assertEqual(result["status"], "refused")
        self.assertEqual(result["answer"], REFUSED_MESSAGE)
        self.assertEqual(result["citations"], [])
        self.assertEqual(result["evidence"], [])
        self.assertEqual(result["meta"]["reason"], "out_of_scope")

    def test_insufficient_output_returns_server_message(self) -> None:
        provider = FakeProvider(
            _fake_json("insufficient_evidence", "model prose ignored", [])
        )
        result = generate_answer({"query": MATCHING_QUERY}, provider=provider)
        self.assertEqual(result["status"], "insufficient_evidence")
        self.assertEqual(result["answer"], INSUFFICIENT_MESSAGE)
        self.assertEqual(result["meta"]["reason"], "no_supporting_evidence")

    def test_invalid_request_raises_validation_error(self) -> None:
        provider = FakeProvider(_fake_json("answered", "x", []))
        with self.assertRaises(RetrievalValidationError):
            generate_answer({"query": "   "}, provider=provider)


class AnswerEndpointTests(SimpleTestCase):
    """POST /api/answer/ HTTP status mapping."""

    def setUp(self) -> None:
        get_corpus.cache_clear()

    def _post(self, payload: object):
        return self.client.post(
            "/api/answer/", data=json.dumps(payload), content_type="application/json"
        )

    def test_invalid_request_returns_400(self) -> None:
        response = self._post({"query": "   "})
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_missing_gemini_key_returns_503(self) -> None:
        with mock.patch(
            "core.layer1.answering.providers.gemini.config",
            side_effect=lambda key, default="": default,
        ):
            response = self._post({"query": MATCHING_QUERY})
        self.assertEqual(response.status_code, 503)

    def test_answered_path_returns_200(self) -> None:
        matches = retrieve(get_corpus(), RetrievalQuery(query=MATCHING_QUERY))
        evidence_id = matches[0].record.id
        provider = FakeProvider(
            _fake_json(
                "answered",
                f"Grounded [[{evidence_id}]].",
                [evidence_id],
            )
        )
        with mock.patch(
            "core.layer1.answering.service.get_provider", return_value=provider
        ):
            response = self._post({"query": MATCHING_QUERY})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "answered")
        self.assertEqual(body["citations"][0]["evidence_id"], evidence_id)
        self.assertEqual(body["citations"][0]["ref"], "01")

    def test_malformed_model_output_returns_502(self) -> None:
        provider = FakeProvider("not json")
        with mock.patch(
            "core.layer1.answering.service.get_provider", return_value=provider
        ):
            response = self._post({"query": MATCHING_QUERY})
        self.assertEqual(response.status_code, 502)

    def test_get_is_not_allowed(self) -> None:
        self.assertEqual(self.client.get("/api/answer/").status_code, 405)


class RetrieveStillUnchangedTests(SimpleTestCase):
    """Guard: /api/retrieve/ stays a raw evidence ledger (no answer/citations)."""

    def setUp(self) -> None:
        get_corpus.cache_clear()

    def test_retrieve_returns_ledger_shape(self) -> None:
        response = self.client.post(
            "/api/retrieve/",
            data=json.dumps({"query": MATCHING_QUERY}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("matches", body)
        self.assertNotIn("answer", body)
        self.assertNotIn("citations", body)


class CitationDisplayRefTests(unittest.TestCase):
    def _record(
        self,
        *,
        record_id: str,
        source_type: str,
        source_id: str,
        project_id: str | None = None,
    ) -> EvidenceRecord:
        return EvidenceRecord(
            id=record_id,
            source_type=source_type,
            source_id=source_id,
            title="Title",
            text="Body",
            visibility="public",
            sensitivity="safe",
            project_id=project_id,
        )

    def test_role_lens_uses_slug_label(self) -> None:
        record = self._record(
            record_id="markdown:role-lenses/ai-nlp",
            source_type=SOURCE_MARKDOWN,
            source_id="role-lenses/ai-nlp",
        )
        self.assertEqual(citation_display_ref(record), "ai-nlp")
        self.assertEqual(resolve_citation_ref(record, fallback_index=3), "ai-nlp")

    def test_experience_uses_exp_label(self) -> None:
        record = self._record(
            record_id="profile:experience",
            source_type="profile",
            source_id="experience",
        )
        self.assertEqual(citation_display_ref(record), "exp")

    def test_project_uses_registry_order(self) -> None:
        record = self._record(
            record_id="project:gfa-exchange",
            source_type=SOURCE_PROJECT,
            source_id="gfa-exchange",
            project_id="gfa-exchange",
        )
        self.assertEqual(citation_display_ref(record), "01")


if __name__ == "__main__":
    unittest.main()
