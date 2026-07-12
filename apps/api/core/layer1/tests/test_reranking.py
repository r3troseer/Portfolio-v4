"""Layer 1 reranking tests: deterministic component scoring, pool, ledger.

Movement scenarios use small synthetic corpora built inline (like
RetrieveResponseContractTests) so they stay precise and fixture-independent.
Same conventions as the other layer1 tests: stdlib unittest, no DB.
"""

import unittest

from core.layer1.presentation import build_retrieval_ledger
from core.layer1.records import EvidenceRecord
from core.layer1.reranking import (
    LEXICAL_CAP,
    PHRASE_EXACT_BONUS,
    PHRASE_NEAR_BONUS,
    RERANK_MODE,
    rerank_candidates,
    retrieve_and_rerank,
)
from core.layer1.retrieval import (
    CANDIDATE_POOL_MAX,
    Corpus,
    RetrievalQuery,
    _make_entry,
    candidate_pool_size,
    retrieve_candidates,
)


def _record(
    record_id: str,
    *,
    title: str = "",
    text: str = "",
    tags: tuple[str, ...] = (),
    role_lenses: tuple[str, ...] = (),
) -> EvidenceRecord:
    return EvidenceRecord(
        id=record_id,
        source_type="project",
        source_id=record_id.removeprefix("project:"),
        title=title or record_id,
        text=text,
        visibility="public",
        sensitivity="safe",
        role_lenses=role_lenses,
        tags=tags,
        project_id=record_id.removeprefix("project:"),
        source_path=f"projects/{record_id.removeprefix('project:')}.json",
    )


def _corpus(*records: EvidenceRecord) -> Corpus:
    return Corpus(entries=tuple(_make_entry(r) for r in records), source="built")


class RerankScoringTests(unittest.TestCase):
    def test_rerank_is_deterministic(self) -> None:
        corpus = _corpus(
            _record("project:a", title="Django API", text="rest services"),
            _record("project:b", title="Data platform", text="django rest api design"),
        )
        query = RetrievalQuery(query="django rest api")
        first = retrieve_and_rerank(corpus, query)
        second = retrieve_and_rerank(corpus, query)
        self.assertEqual(first, second)

    def test_full_coverage_outranks_concentrated_lexical_score(self) -> None:
        # "concentrated" hits one query token in title+tag+text (lexical 6);
        # "broad" matches all three tokens in text only (lexical 3). Coverage
        # must promote the broad record above the concentrated one.
        concentrated = _record(
            "project:concentrated",
            title="Pipelines dashboard",
            text="pipelines monitoring",
            tags=("pipelines",),
        )
        broad = _record(
            "project:broad",
            title="Platform work",
            text="reliable pipelines deployment automation notes",
        )
        corpus = _corpus(concentrated, broad)
        query = RetrievalQuery(query="pipelines deployment automation")

        candidates = retrieve_candidates(corpus, query)
        self.assertEqual(candidates[0].record.id, "project:concentrated")

        ranked = rerank_candidates(candidates, query, top_k=2)
        self.assertEqual(ranked[0].record.id, "project:broad")
        self.assertGreater(ranked[0].delta, 0)  # promoted
        self.assertLess(ranked[1].delta, 0)  # demoted

    def test_exact_phrase_match_promotes_candidate(self) -> None:
        phrased = _record(
            "project:phrased", text="built a loan reallocation engine end to end"
        )
        scattered = _record(
            "project:scattered",
            title="Loan tools",
            text="reallocation logic plus loan scoring",
            tags=("loan",),
        )
        corpus = _corpus(phrased, scattered)
        query = RetrievalQuery(query="loan reallocation engine")

        result = retrieve_and_rerank(corpus, query)
        by_id = {c.record.id: c for c in result.ranked}
        self.assertEqual(
            by_id["project:phrased"].components["phrase"], PHRASE_EXACT_BONUS
        )
        self.assertEqual(result.ranked[0].record.id, "project:phrased")
        self.assertIn("exact phrase match", by_id["project:phrased"].reasons)

    def test_near_phrase_bigram_scores_lower_than_exact(self) -> None:
        near = _record("project:near", text="loan reallocation and a separate engine")
        corpus = _corpus(near)
        query = RetrievalQuery(query="loan reallocation engine")

        result = retrieve_and_rerank(corpus, query)
        self.assertEqual(result.ranked[0].components["phrase"], PHRASE_NEAR_BONUS)
        self.assertIn("near phrase match", result.ranked[0].reasons)

    def test_single_token_query_has_no_phrase_component(self) -> None:
        corpus = _corpus(_record("project:a", text="django django django"))
        result = retrieve_and_rerank(corpus, RetrievalQuery(query="django"))
        self.assertEqual(result.ranked[0].components["phrase"], 0)

    def test_lexical_component_is_capped(self) -> None:
        # Many query tokens hitting title+tag+text push the raw lexical score
        # far above the cap; the lexical component must not exceed it.
        stuffed = _record(
            "project:stuffed",
            title="alpha beta gamma delta",
            text="alpha beta gamma delta epsilon",
            tags=("alpha", "beta", "gamma"),
        )
        corpus = _corpus(stuffed)
        query = RetrievalQuery(query="alpha beta gamma delta epsilon")

        result = retrieve_and_rerank(corpus, query)
        row = result.ranked[0]
        self.assertGreater(row.lexical_score, LEXICAL_CAP)
        self.assertEqual(row.components["lexical"], LEXICAL_CAP)
        self.assertIn(f"lexical score capped at {LEXICAL_CAP}", row.reasons)

    def test_components_sum_to_rerank_score(self) -> None:
        corpus = _corpus(
            _record("project:a", title="Django API", text="rest services django"),
            _record("project:b", text="api design"),
        )
        result = retrieve_and_rerank(corpus, RetrievalQuery(query="django api"))
        for row in result.ranked:
            self.assertEqual(row.rerank_score, sum(row.components.values()))

    def test_reasons_are_derived_and_ordered_deterministically(self) -> None:
        record = _record(
            "project:a",
            title="Django platform",
            text="a django platform built end to end",
            tags=("django",),
            role_lenses=("backend",),
        )
        corpus = _corpus(record)
        query = RetrievalQuery(query="django platform", role_lens="backend")

        first = retrieve_and_rerank(corpus, query).ranked[0]
        second = retrieve_and_rerank(corpus, query).ranked[0]
        self.assertEqual(first.reasons, second.reasons)
        self.assertEqual(first.reasons[0], "matched 2/2 query terms")
        self.assertIn("exact phrase match", first.reasons)
        self.assertIn("query term in title", first.reasons)
        self.assertIn("query term in tags", first.reasons)
        self.assertIn("role lens match: backend", first.reasons)

    def test_role_lens_component_applies_only_with_lens(self) -> None:
        record = _record("project:a", text="django work", role_lenses=("backend",))
        corpus = _corpus(record)

        plain = retrieve_and_rerank(corpus, RetrievalQuery(query="django"))
        lensed = retrieve_and_rerank(
            corpus, RetrievalQuery(query="django", role_lens="Backend")
        )
        self.assertEqual(plain.ranked[0].components["role_lens"], 0)
        self.assertGreater(lensed.ranked[0].components["role_lens"], 0)

    def test_ties_break_on_lexical_then_record_id(self) -> None:
        # Identical text yields identical rerank AND lexical scores, so the
        # ordering must fall back to record id.
        corpus = _corpus(
            _record("project:b", text="django rest"),
            _record("project:a", text="django rest"),
        )
        result = retrieve_and_rerank(corpus, RetrievalQuery(query="django rest"))
        self.assertEqual(
            [c.record.id for c in result.ranked], ["project:a", "project:b"]
        )


class CandidatePoolTests(unittest.TestCase):
    def test_pool_size_is_three_times_top_k_capped_at_max(self) -> None:
        self.assertEqual(candidate_pool_size(1), 3)
        self.assertEqual(candidate_pool_size(5), 15)
        self.assertEqual(candidate_pool_size(7), CANDIDATE_POOL_MAX)
        self.assertEqual(candidate_pool_size(20), CANDIDATE_POOL_MAX)

    def test_pool_never_smaller_than_top_k(self) -> None:
        for top_k in range(1, 21):
            self.assertGreaterEqual(candidate_pool_size(top_k), top_k)

    def test_selected_respects_top_k_with_larger_pool(self) -> None:
        records = [
            _record(f"project:r{i}", text="django evidence work") for i in range(6)
        ]
        corpus = _corpus(*records)
        result = retrieve_and_rerank(
            corpus, RetrievalQuery(query="django evidence", top_k=2)
        )
        self.assertEqual(len(result.selected), 2)
        self.assertEqual(len(result.candidates), 6)  # pool kept all matches
        self.assertTrue(all(c.selected for c in result.ranked[:2]))
        self.assertFalse(any(c.selected for c in result.ranked[2:]))


class LedgerBuilderTests(unittest.TestCase):
    def _result(self):
        corpus = _corpus(
            _record(
                "project:concentrated",
                title="Pipelines dashboard",
                text="pipelines monitoring",
                tags=("pipelines",),
            ),
            _record(
                "project:broad",
                text="reliable pipelines deployment automation notes",
            ),
            _record("project:minor", text="deployment"),
        )
        query = RetrievalQuery(
            query="pipelines deployment automation", top_k=2
        )
        return retrieve_and_rerank(corpus, query)

    def test_ledger_shape_mode_and_counts(self) -> None:
        result = self._result()
        ledger = build_retrieval_ledger(result)
        self.assertEqual(ledger["mode"], RERANK_MODE)
        self.assertEqual(ledger["retrieve_k"], 6)
        self.assertEqual(ledger["selected_k"], 2)
        self.assertEqual(len(ledger["initial"]), 3)
        self.assertEqual(len(ledger["reranked"]), 3)
        self.assertEqual(len(ledger["selected"]), 2)

    def test_initial_is_lexical_order_and_reranked_is_rerank_order(self) -> None:
        result = self._result()
        ledger = build_retrieval_ledger(result)
        self.assertEqual(
            [e["initial_rank"] for e in ledger["initial"]], [1, 2, 3]
        )
        self.assertEqual(
            [e["rerank_rank"] for e in ledger["reranked"]], [1, 2, 3]
        )
        # The movement scenario: broad wins on rerank despite lexical rank 2.
        self.assertEqual(ledger["initial"][0]["evidence_id"], "project:concentrated")
        self.assertEqual(ledger["reranked"][0]["evidence_id"], "project:broad")

    def test_delta_equals_initial_rank_minus_rerank_rank(self) -> None:
        ledger = build_retrieval_ledger(self._result())
        for entry in ledger["reranked"]:
            self.assertEqual(
                entry["delta"], entry["initial_rank"] - entry["rerank_rank"]
            )

    def test_selected_entries_match_selected_flags(self) -> None:
        ledger = build_retrieval_ledger(self._result())
        selected_ids = [e["evidence_id"] for e in ledger["selected"]]
        flagged_ids = [
            e["evidence_id"] for e in ledger["reranked"] if e["selected"]
        ]
        self.assertEqual(selected_ids, flagged_ids)
        self.assertEqual(len(selected_ids), 2)

    def test_empty_pool_yields_empty_ledger(self) -> None:
        corpus = _corpus(_record("project:a", text="unrelated"))
        result = retrieve_and_rerank(corpus, RetrievalQuery(query="zzqqxxyyzz"))
        ledger = build_retrieval_ledger(result)
        self.assertEqual(ledger["mode"], RERANK_MODE)
        self.assertEqual(ledger["initial"], [])
        self.assertEqual(ledger["reranked"], [])
        self.assertEqual(ledger["selected"], [])


if __name__ == "__main__":
    unittest.main()
