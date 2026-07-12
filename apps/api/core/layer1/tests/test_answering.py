"""Layer 1 grounded-answer tests: validation, refusal, and HTTP status mapping.

Same conventions as the other layer1 tests (stdlib unittest / SimpleTestCase,
no DB). A FakeProvider is injected so a real model is never called; the one 503
"missing key" test drives the endpoint with config mocked empty. Run via
``uv run python manage.py test core``.
"""

import json
import unittest
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from core.layer1.answering.limits import (
    AnswerLimitExceeded,
    reset_answer_usage_for_tests,
)
from core.layer1.answering.providers.fake import FakeProvider
from core.layer1.answering.schemas import (
    ANSWER_MAX_LENGTH,
    HEADLINE_TITLE_MAX,
    INSUFFICIENT_MESSAGE,
    REFUSED_MESSAGE,
    AnswerOutputError,
    normalize_answer_prose,
    parse_headline,
    parse_prose_markup,
    truncate_answer_prose,
    validate_model_output,
)
from core.layer1.answering.service import generate_answer
from core.layer1.presentation import citation_display_ref, resolve_citation_ref
from core.layer1.records import SOURCE_MARKDOWN, SOURCE_PROJECT, EvidenceRecord
from core.layer1.reranking import RERANK_MODE, retrieve_and_rerank
from core.layer1.retrieval import (
    RetrievalQuery,
    RetrievalValidationError,
    get_corpus,
)
from core.throttling import AnswerRateThrottle, client_ident

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


class RecordingFakeProvider(FakeProvider):
    """FakeProvider that also captures the user prompt it was given."""

    def __init__(self, response: str, model_name: str = "fake-model") -> None:
        super().__init__(response, model_name)
        self.last_user: str = ""

    def generate(self, *, system: str, user: str) -> str:
        self.last_user = user
        return super().generate(system=system, user=user)


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
        long = f"[[project:a]] {'word ' * 400}"
        out = validate_model_output(
            _fake_json("answered", long, ["project:a"]),
            self.IDS,
        )
        self.assertLessEqual(len(out.answer), ANSWER_MAX_LENGTH)
        self.assertIn("[[project:a]]", out.answer)

    def test_plain_text_tail_truncates_at_whitespace(self) -> None:
        answer = f"Grounded [[project:a]]. {'word ' * 400}"
        out = validate_model_output(
            _fake_json("answered", answer, ["project:a"]), self.IDS
        )
        self.assertLessEqual(len(out.answer), ANSWER_MAX_LENGTH)
        self.assertFalse(out.answer.endswith(" "))
        self.assertEqual(out.citation_ids, ("project:a",))

    def test_boundary_inside_citation_marker_drops_marker_whole(self) -> None:
        base = "Grounded [[project:a]]. "
        prefix = base + ("x " * ((ANSWER_MAX_LENGTH - 5 - len(base)) // 2))
        prefix += "x" * (ANSWER_MAX_LENGTH - 5 - len(prefix))
        answer = prefix + "[[project:b]] trailing words"
        marker_start = answer.find("[[project:b]]")
        self.assertLess(marker_start, ANSWER_MAX_LENGTH)
        self.assertGreater(
            marker_start + len("[[project:b]]"), ANSWER_MAX_LENGTH
        )

        out = validate_model_output(
            _fake_json("answered", answer, ["project:a", "project:b"]), self.IDS
        )
        self.assertIn("[[project:a]]", out.answer)
        self.assertNotIn("[[project:b", out.answer)
        self.assertEqual(out.citation_ids, ("project:a",))

    def test_boundary_inside_highlight_drops_highlight_whole(self) -> None:
        base = "Grounded [[project:a]]. "
        prefix = base + ("x " * ((ANSWER_MAX_LENGTH - 5 - len(base)) // 2))
        prefix += "x" * (ANSWER_MAX_LENGTH - 5 - len(prefix))
        answer = prefix + "==highlighted evidence== trailing words"
        marker_start = answer.find("==highlighted")
        self.assertLess(marker_start, ANSWER_MAX_LENGTH)
        self.assertGreater(
            marker_start + len("==highlighted evidence=="), ANSWER_MAX_LENGTH
        )

        out = validate_model_output(
            _fake_json("answered", answer, ["project:a"]), self.IDS
        )
        self.assertNotIn("==highlighted", out.answer)
        self.assertEqual(out.citation_ids, ("project:a",))

    def test_truncation_that_drops_every_citation_fails_closed(self) -> None:
        answer = ("word " * 300) + "[[project:a]]"
        with self.assertRaises(AnswerOutputError):
            validate_model_output(
                _fake_json("answered", answer, ["project:a"]), self.IDS
            )

    def test_citation_ids_are_recomputed_after_truncation(self) -> None:
        answer = (
            "Grounded [[project:a]]. "
            + ("word " * 300)
            + "Later [[project:b]]."
        )
        out = validate_model_output(
            _fake_json("answered", answer, ["project:a", "project:b"]), self.IDS
        )
        self.assertEqual(out.citation_ids, ("project:a",))


class TruncateAnswerProseTests(unittest.TestCase):
    def test_no_safe_boundary_fails_closed(self) -> None:
        with self.assertRaises(AnswerOutputError):
            truncate_answer_prose("x" * (ANSWER_MAX_LENGTH + 1))


class ParseHeadlineTests(unittest.TestCase):
    IDS = ("project:a",)

    def _answered(self, headline: object) -> str:
        return json.dumps(
            {
                "status": "answered",
                "answer": _marked_answer("project:a"),
                "citation_ids": ["project:a"],
                "headline": headline,
            }
        )

    def test_valid_headline_is_served(self) -> None:
        out = validate_model_output(
            self._answered({"title": "Lead statement", "sub": "Supporting line"}),
            self.IDS,
        )
        self.assertEqual(out.headline_title, "Lead statement")
        self.assertEqual(out.headline_sub, "Supporting line")

    def test_missing_headline_yields_empty_strings(self) -> None:
        out = validate_model_output(
            _fake_json("answered", _marked_answer("project:a"), ["project:a"]),
            self.IDS,
        )
        self.assertEqual(out.headline_title, "")
        self.assertEqual(out.headline_sub, "")

    def test_malformed_headline_is_dropped_not_fatal(self) -> None:
        for bad in ("just a string", ["list"], {"sub": "no title"}, {"title": "  "}):
            out = validate_model_output(self._answered(bad), self.IDS)
            self.assertEqual(out.headline_title, "", msg=repr(bad))

    def test_headline_with_prose_markup_is_dropped(self) -> None:
        for bad in (
            {"title": "Cites [[project:a]] inline", "sub": "ok"},
            {"title": "ok", "sub": "has ==highlight== span"},
        ):
            out = validate_model_output(self._answered(bad), self.IDS)
            self.assertEqual(out.headline_title, "", msg=repr(bad))

    def test_overlong_title_is_clipped_at_whitespace(self) -> None:
        long_title = "word " * 60
        title, _ = parse_headline({"headline": {"title": long_title, "sub": ""}})
        self.assertLessEqual(len(title), HEADLINE_TITLE_MAX)
        self.assertFalse(title.endswith(" "))
        self.assertTrue(title)

    def test_non_answered_status_ignores_headline(self) -> None:
        raw = json.dumps(
            {
                "status": "refused",
                "answer": "ignored",
                "citation_ids": [],
                "headline": {"title": "Should not survive", "sub": ""},
            }
        )
        out = validate_model_output(raw, self.IDS)
        self.assertEqual(out.headline_title, "")


class GenerateAnswerServiceTests(SimpleTestCase):
    """Service-level flow with an injected FakeProvider (no model calls)."""

    def setUp(self) -> None:
        get_corpus.cache_clear()
        reset_answer_usage_for_tests()

    def _first_matching_id(self) -> str:
        result = retrieve_and_rerank(
            get_corpus(), RetrievalQuery(query=MATCHING_QUERY)
        )
        self.assertGreater(len(result.selected), 0)
        return result.selected[0].record.id

    def test_no_evidence_returns_insufficient_without_calling_provider(self) -> None:
        provider = FakeProvider(_fake_json("answered", "should not run", []))
        result = generate_answer({"query": NO_MATCH_QUERY}, provider=provider)
        self.assertEqual(result["status"], "insufficient_evidence")
        self.assertEqual(result["answer"], INSUFFICIENT_MESSAGE)
        self.assertEqual(result["citations"], [])
        self.assertEqual(result["meta"]["reason"], "no_supporting_evidence")
        self.assertEqual(result["ledger"]["initial"], [])
        self.assertEqual(result["ledger"]["selected"], [])
        self.assertEqual(provider.calls, 0)

    def test_citation_of_unselected_candidate_fails_closed(self) -> None:
        # With top_k=1 the pool still holds more candidates than the single
        # selected row; citing one of the unselected initial candidates must
        # fail closed even though it was genuinely retrieved.
        result = retrieve_and_rerank(
            get_corpus(), RetrievalQuery(query=MATCHING_QUERY, top_k=1)
        )
        self.assertGreater(len(result.ranked), 1)
        unselected = result.ranked[1]
        self.assertFalse(unselected.selected)

        provider = FakeProvider(
            _fake_json(
                "answered",
                _marked_answer(unselected.record.id),
                [unselected.record.id],
            )
        )
        with self.assertRaises(AnswerOutputError):
            generate_answer(
                {"query": MATCHING_QUERY, "top_k": 1}, provider=provider
            )
        self.assertEqual(provider.calls, 1)

    def test_provider_prompt_contains_only_selected_evidence(self) -> None:
        result = retrieve_and_rerank(
            get_corpus(), RetrievalQuery(query=MATCHING_QUERY, top_k=1)
        )
        self.assertGreater(len(result.ranked), 1)
        selected_id = result.selected[0].record.id
        unselected_ids = [c.record.id for c in result.ranked[1:]]

        provider = RecordingFakeProvider(
            _fake_json("answered", _marked_answer(selected_id), [selected_id])
        )
        generate_answer({"query": MATCHING_QUERY, "top_k": 1}, provider=provider)
        self.assertIn(f"id: {selected_id}", provider.last_user)
        for unselected_id in unselected_ids:
            self.assertNotIn(f"id: {unselected_id}", provider.last_user)

    def test_answered_payload_includes_headline_when_model_provides_one(self) -> None:
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
        self.assertEqual(
            result["headline"], {"title": "Lead statement", "sub": "Supporting line"}
        )

    def test_answered_payload_headline_is_none_when_absent(self) -> None:
        evidence_id = self._first_matching_id()
        provider = FakeProvider(
            _fake_json("answered", _marked_answer(evidence_id), [evidence_id])
        )
        result = generate_answer({"query": MATCHING_QUERY}, provider=provider)
        self.assertIsNone(result["headline"])

    def test_answer_payload_includes_ledger_and_meta_counts(self) -> None:
        evidence_id = self._first_matching_id()
        provider = FakeProvider(
            _fake_json("answered", _marked_answer(evidence_id), [evidence_id])
        )
        result = generate_answer({"query": MATCHING_QUERY}, provider=provider)
        ledger = result["ledger"]
        self.assertEqual(ledger["mode"], RERANK_MODE)
        self.assertEqual(
            [e["evidence_id"] for e in ledger["selected"]],
            [e["id"] for e in result["evidence"]],
        )
        self.assertEqual(result["meta"]["reranker"], RERANK_MODE)
        self.assertEqual(
            result["meta"]["selected_count"], len(result["evidence"])
        )
        self.assertGreaterEqual(
            result["meta"]["initial_count"], result["meta"]["selected_count"]
        )
        # Back-compat: retrieval_count still reflects the served evidence.
        self.assertEqual(
            result["meta"]["retrieval_count"], len(result["evidence"])
        )

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
        # A refusal serves no retrieval artifacts - the ledger is omitted too.
        self.assertNotIn("ledger", result)
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

    @override_settings(
        ANSWER_DAILY_SOFT_LIMIT=1,
        ANSWER_PER_CLIENT_DAILY_LIMIT=0,
    )
    def test_global_daily_limit_stops_second_provider_attempt(self) -> None:
        evidence_id = self._first_matching_id()
        provider = FakeProvider(
            _fake_json("answered", _marked_answer(evidence_id), [evidence_id])
        )
        generate_answer(
            {"query": MATCHING_QUERY}, provider=provider, client_id="client-a"
        )
        with self.assertRaises(AnswerLimitExceeded):
            generate_answer(
                {"query": MATCHING_QUERY}, provider=provider, client_id="client-b"
            )
        self.assertEqual(provider.calls, 1)

    @override_settings(
        ANSWER_DAILY_SOFT_LIMIT=0,
        ANSWER_PER_CLIENT_DAILY_LIMIT=1,
    )
    def test_per_client_daily_limit_isolated_by_identity(self) -> None:
        evidence_id = self._first_matching_id()
        provider = FakeProvider(
            _fake_json("answered", _marked_answer(evidence_id), [evidence_id])
        )
        generate_answer(
            {"query": MATCHING_QUERY}, provider=provider, client_id="client-a"
        )
        with self.assertRaises(AnswerLimitExceeded):
            generate_answer(
                {"query": MATCHING_QUERY}, provider=provider, client_id="client-a"
            )
        generate_answer(
            {"query": MATCHING_QUERY}, provider=provider, client_id="client-b"
        )
        self.assertEqual(provider.calls, 2)

    @override_settings(
        ANSWER_DAILY_SOFT_LIMIT=1,
        ANSWER_PER_CLIENT_DAILY_LIMIT=0,
    )
    def test_no_evidence_does_not_consume_daily_limit(self) -> None:
        provider = FakeProvider("not used")
        result = generate_answer(
            {"query": NO_MATCH_QUERY}, provider=provider, client_id="client-a"
        )
        self.assertEqual(result["status"], "insufficient_evidence")

        evidence_id = self._first_matching_id()
        provider = FakeProvider(
            _fake_json("answered", _marked_answer(evidence_id), [evidence_id])
        )
        generate_answer(
            {"query": MATCHING_QUERY}, provider=provider, client_id="client-a"
        )
        self.assertEqual(provider.calls, 1)


class AnswerEndpointTests(SimpleTestCase):
    """POST /api/answer/ HTTP status mapping."""

    def setUp(self) -> None:
        get_corpus.cache_clear()
        reset_answer_usage_for_tests()
        cache.clear()

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

    @override_settings(ANSWER_ENDPOINT_ENABLED=False)
    def test_disabled_endpoint_returns_503_without_provider_call(self) -> None:
        provider = FakeProvider("not used")
        with mock.patch(
            "core.layer1.answering.service.get_provider", return_value=provider
        ):
            response = self._post({"query": MATCHING_QUERY})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"error": "answer service unavailable"})
        self.assertEqual(provider.calls, 0)

    @override_settings(
        ANSWER_DAILY_SOFT_LIMIT=1,
        ANSWER_PER_CLIENT_DAILY_LIMIT=0,
    )
    def test_daily_limit_maps_to_429(self) -> None:
        result = retrieve_and_rerank(
            get_corpus(), RetrievalQuery(query=MATCHING_QUERY)
        )
        evidence_id = result.selected[0].record.id
        provider = FakeProvider(
            _fake_json("answered", _marked_answer(evidence_id), [evidence_id])
        )
        with mock.patch(
            "core.layer1.answering.service.get_provider", return_value=provider
        ):
            self.assertEqual(self._post({"query": MATCHING_QUERY}).status_code, 200)
            response = self._post({"query": MATCHING_QUERY})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(provider.calls, 1)

    def test_answered_path_returns_200(self) -> None:
        result = retrieve_and_rerank(
            get_corpus(), RetrievalQuery(query=MATCHING_QUERY)
        )
        evidence_id = result.selected[0].record.id
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


class RetrieveLedgerContractTests(SimpleTestCase):
    """Guard: /api/retrieve/ stays an answer-free evidence ledger - now with
    the retrieve-to-rerank ledger object alongside the served matches."""

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
        ledger = body["ledger"]
        self.assertEqual(ledger["mode"], RERANK_MODE)
        for section in ("initial", "reranked", "selected"):
            self.assertIn(section, ledger)
        self.assertEqual(
            [m["id"] for m in body["matches"]],
            [e["evidence_id"] for e in ledger["selected"]],
        )
        for key in ("initial_count", "selected_count", "reranker"):
            self.assertIn(key, body["meta"])


class AnswerThrottleTests(SimpleTestCase):
    def setUp(self) -> None:
        cache.clear()

    @override_settings(
        REST_FRAMEWORK={
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "answer": "1/min",
            },
        }
    )
    def test_answer_throttle_uses_independent_scope(self) -> None:
        factory = APIRequestFactory()
        first = Request(factory.post("/api/answer/", REMOTE_ADDR="203.0.113.8"))
        second = Request(factory.post("/api/answer/", REMOTE_ADDR="203.0.113.8"))

        first_throttle = AnswerRateThrottle()
        first_throttle.rate = "1/min"
        first_throttle.num_requests, first_throttle.duration = (
            first_throttle.parse_rate(first_throttle.rate)
        )
        second_throttle = AnswerRateThrottle()
        second_throttle.rate = "1/min"
        second_throttle.num_requests, second_throttle.duration = (
            second_throttle.parse_rate(second_throttle.rate)
        )
        self.assertTrue(first_throttle.allow_request(first, object()))
        self.assertFalse(second_throttle.allow_request(second, object()))

        response = self.client.post(
            "/api/retrieve/",
            data=json.dumps({"query": MATCHING_QUERY}),
            content_type="application/json",
            REMOTE_ADDR="203.0.113.8",
        )
        self.assertEqual(response.status_code, 200)

    @override_settings(
        REST_FRAMEWORK={
            **settings.REST_FRAMEWORK,
            "NUM_PROXIES": 1,
        }
    )
    def test_client_identity_uses_configured_proxy_chain(self) -> None:
        raw_request = APIRequestFactory().post(
            "/api/answer/",
            HTTP_X_FORWARDED_FOR="198.51.100.7",
            REMOTE_ADDR="10.0.0.5",
        )
        self.assertEqual(client_ident(Request(raw_request)), "198.51.100.7")


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
        self.assertEqual(resolve_citation_ref(record), "ai-nlp")

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

    def test_profile_silos_use_semantic_labels(self) -> None:
        expected = {
            "profile": "profile",
            "skills": "skills",
            "experience": "exp",
            "education": "edu",
            "links": "links",
        }
        for source_id, ref in expected.items():
            record = self._record(
                record_id=f"profile:{source_id}",
                source_type="profile",
                source_id=source_id,
            )
            self.assertEqual(resolve_citation_ref(record), ref)

    def test_about_uses_about_label(self) -> None:
        record = self._record(
            record_id="markdown:about",
            source_type=SOURCE_MARKDOWN,
            source_id="about",
        )
        self.assertEqual(resolve_citation_ref(record), "about")

    def test_other_markdown_uses_final_slug(self) -> None:
        record = self._record(
            record_id="markdown:notes/backend-depth",
            source_type=SOURCE_MARKDOWN,
            source_id="notes/backend-depth",
        )
        self.assertEqual(resolve_citation_ref(record), "backend-depth")

    def test_unknown_source_uses_src_not_retrieval_rank(self) -> None:
        record = self._record(
            record_id="other:item",
            source_type="other",
            source_id="item",
        )
        self.assertEqual(resolve_citation_ref(record), "src")
        self.assertNotEqual(resolve_citation_ref(record), "03")


if __name__ == "__main__":
    unittest.main()
