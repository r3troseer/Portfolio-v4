"""Layer 1 retrieval tests: scoring, validation, fail-closed loading, endpoint.

Same conventions as test_index_gating.py: stdlib unittest / SimpleTestCase (no
DB), runnable via ``uv run python manage.py test core``.
"""

import json
import tempfile
import unittest
from pathlib import Path

from django.test import SimpleTestCase

from core.layer1.builder import DEFAULT_CONTENT_ROOT, build_index, records_as_dicts
from core.layer1.records import INDEXABLE
from core.layer1.retrieval import (
    TOP_K_MAX,
    Corpus,
    IndexUnavailableError,
    RetrievalQuery,
    RetrievalValidationError,
    _load_corpus,
    _make_entry,
    get_corpus,
    parse_retrieval_request,
    retrieve,
)

FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures" / "content"
MISSING_ROOT = Path(__file__).resolve().parent / "does-not-exist"


def _fixture_corpus() -> Corpus:
    """Searchable corpus over the fixture tree's *emitted* (gated) records."""
    result = build_index(FIXTURE_ROOT)
    return Corpus(entries=tuple(_make_entry(r) for r in result.records), source="built")


class RetrieveScoringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.corpus = _fixture_corpus()

    def test_matching_query_returns_public_evidence(self) -> None:
        matches = retrieve(self.corpus, RetrievalQuery(query="curated public summary"))
        self.assertGreater(len(matches), 0)
        self.assertEqual(matches[0].record.id, "project:pub-project")

    def test_results_are_deterministic(self) -> None:
        query = RetrievalQuery(query="public summary fixture")
        self.assertEqual(retrieve(self.corpus, query), retrieve(self.corpus, query))

    def test_equal_scores_tie_break_on_record_id(self) -> None:
        matches = retrieve(self.corpus, RetrievalQuery(query="paragraph verbatim"))
        # "paragraph" hits profile:profile text; "verbatim" hits markdown:good
        # text - both score 1, so ordering must fall back to id.
        self.assertEqual(
            [m.record.id for m in matches], ["markdown:good", "profile:profile"]
        )
        self.assertEqual({m.score for m in matches}, {1})

    def test_title_match_outranks_text_only_match(self) -> None:
        matches = retrieve(self.corpus, RetrievalQuery(query="markdown"))
        by_id = {m.record.id: m.score for m in matches}
        # "markdown" is in markdown:good's title (+3) and only in no other
        # record's text; title weight must dominate any text-only hit.
        self.assertEqual(max(by_id, key=lambda k: by_id[k]), "markdown:good")

    def test_role_lens_boost_adds_two_to_matching_records(self) -> None:
        plain = retrieve(self.corpus, RetrievalQuery(query="curated"))
        boosted = retrieve(
            self.corpus, RetrievalQuery(query="curated", role_lens="backend")
        )
        self.assertEqual(plain[0].record.id, "project:pub-project")
        self.assertEqual(boosted[0].record.id, "project:pub-project")
        self.assertEqual(boosted[0].score, plain[0].score + 2)

    def test_role_lens_does_not_exclude_lensless_records(self) -> None:
        matches = retrieve(
            self.corpus, RetrievalQuery(query="public", role_lens="backend")
        )
        ids = [m.record.id for m in matches]
        self.assertIn("markdown:good", ids)  # carries no role lenses

    def test_zero_score_records_never_match(self) -> None:
        matches = retrieve(self.corpus, RetrievalQuery(query="zzqqxxyyzz"))
        self.assertEqual(matches, ())

    def test_top_k_caps_result_count(self) -> None:
        query = RetrievalQuery(query="fixture public summary", top_k=1)
        self.assertEqual(len(retrieve(self.corpus, query)), 1)


class ParseRetrievalRequestTests(unittest.TestCase):
    def test_valid_request_parses_with_defaults(self) -> None:
        parsed = parse_retrieval_request({"query": "  hello  "})
        self.assertEqual(parsed, RetrievalQuery(query="hello", role_lens=None, top_k=5))

    def test_invalid_payloads_are_rejected(self) -> None:
        bad_payloads = (
            "not a dict",
            {},
            {"query": ""},
            {"query": "   "},
            {"query": 42},
            {"query": "x" * 501},
            {"query": "ok", "top_k": 0},
            {"query": "ok", "top_k": -1},
            {"query": "ok", "top_k": TOP_K_MAX + 1},
            {"query": "ok", "top_k": True},
            {"query": "ok", "top_k": "3"},
            {"query": "ok", "role_lens": ""},
            {"query": "ok", "role_lens": 7},
            {"query": "ok", "role_lens": "x" * 51},
        )
        for payload in bad_payloads:
            with self.assertRaises(RetrievalValidationError, msg=repr(payload)):
                parse_retrieval_request(payload)

    def test_unknown_extra_keys_are_ignored(self) -> None:
        parsed = parse_retrieval_request({"query": "ok", "unexpected": "ignored"})
        self.assertEqual(parsed.query, "ok")


class LoadCorpusTests(unittest.TestCase):
    def test_governance_errors_refuse_the_whole_corpus(self) -> None:
        # The fixture tree deliberately contains governance errors, so a
        # runtime load of it must fail closed even though the builder can
        # still enumerate its valid records for offline inspection.
        with self.assertRaises(IndexUnavailableError):
            _load_corpus(content_root=FIXTURE_ROOT, artifact_path=MISSING_ROOT)

    def test_real_content_builds_a_served_corpus(self) -> None:
        corpus = _load_corpus(
            content_root=DEFAULT_CONTENT_ROOT, artifact_path=MISSING_ROOT
        )
        self.assertEqual(corpus.source, "built")
        self.assertGreater(len(corpus.entries), 0)

    def test_artifact_fallback_when_content_root_is_missing(self) -> None:
        result = build_index(DEFAULT_CONTENT_ROOT)
        with tempfile.TemporaryDirectory() as tmp:
            artifact = Path(tmp) / "evidence_index.json"
            artifact.write_text(
                json.dumps(records_as_dicts(result)), encoding="utf-8"
            )
            corpus = _load_corpus(content_root=MISSING_ROOT, artifact_path=artifact)
        self.assertEqual(corpus.source, "artifact")
        self.assertEqual(len(corpus.entries), len(result.records))
        self.assertEqual(
            [e.record for e in corpus.entries], list(result.records)
        )

    def test_tampered_artifact_is_refused_wholesale(self) -> None:
        payload = records_as_dicts(build_index(DEFAULT_CONTENT_ROOT))
        payload["records"][0]["visibility"] = "private"
        with tempfile.TemporaryDirectory() as tmp:
            artifact = Path(tmp) / "evidence_index.json"
            artifact.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(IndexUnavailableError):
                _load_corpus(content_root=MISSING_ROOT, artifact_path=artifact)

    def test_unreadable_artifact_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            artifact = Path(tmp) / "evidence_index.json"
            artifact.write_text("not json", encoding="utf-8")
            with self.assertRaises(IndexUnavailableError):
                _load_corpus(content_root=MISSING_ROOT, artifact_path=artifact)

    def test_no_source_at_all_fails_closed(self) -> None:
        with self.assertRaises(IndexUnavailableError):
            _load_corpus(content_root=MISSING_ROOT, artifact_path=MISSING_ROOT)


class RetrieveEndpointTests(SimpleTestCase):
    """POST /api/retrieve/ against the real content corpus."""

    def setUp(self) -> None:
        get_corpus.cache_clear()

    def _post(self, payload: object):
        return self.client.post(
            "/api/retrieve/", data=json.dumps(payload), content_type="application/json"
        )

    def test_valid_query_returns_only_public_evidence(self) -> None:
        response = self._post({"query": "multi-agent fintech loan reallocation"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertGreater(len(body["matches"]), 0)
        self.assertEqual(body["meta"]["index_source"], "built")
        for match in body["matches"]:
            self.assertIn(match["visibility"], INDEXABLE)
            self.assertNotIn("esg-greenwashing", match["id"])
            self.assertNotIn("esg-greenwashing", match["source_path"])
            self.assertNotIn("greenwashing", match["text"].lower())

    def test_empty_query_is_rejected(self) -> None:
        response = self._post({"query": "   "})
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_oversized_query_is_rejected(self) -> None:
        response = self._post({"query": "x" * 501})
        self.assertEqual(response.status_code, 400)

    def test_top_k_over_cap_is_rejected(self) -> None:
        response = self._post({"query": "python", "top_k": TOP_K_MAX + 1})
        self.assertEqual(response.status_code, 400)

    def test_no_results_response_is_deterministic(self) -> None:
        first = self._post({"query": "zzqqxxyyzz"})
        second = self._post({"query": "zzqqxxyyzz"})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["matches"], [])
        self.assertEqual(first.content, second.content)

    def test_get_is_not_allowed(self) -> None:
        self.assertEqual(self.client.get("/api/retrieve/").status_code, 405)


if __name__ == "__main__":
    unittest.main()
