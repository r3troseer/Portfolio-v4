"""Layer 1 evidence-index gating tests.

Plain stdlib unittest (no DB, no test-framework dependency): runnable via
``uv run python manage.py test core`` or ``uv run python -m unittest``.

Two layers of proof:
- a synthetic fixture tree (tests/fixtures/content/) exercising every gating
  branch: indexable, summary-only redaction, private/blocked/limited,
  unregistered, missing/unknown visibility, broken front matter, silo without
  governance fields;
- the real Layer 0 content root, proving ESG/private content stays out and
  that builds are deterministic with stable IDs.
"""

import unittest
from pathlib import Path

from core.layer1.builder import DEFAULT_CONTENT_ROOT, build_index
from core.layer1.records import INDEXABLE

FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures" / "content"


class FixtureGatingTests(unittest.TestCase):
    """Gating behaviour against the synthetic fixture content tree."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.result = build_index(FIXTURE_ROOT)
        cls.records_by_id = {r.id: r for r in cls.result.records}
        cls.exclusions_by_path = {e.source_path: e for e in cls.result.exclusions}

    def test_only_expected_sources_are_indexed(self) -> None:
        self.assertEqual(
            set(self.records_by_id),
            {
                "project:pub-project",
                "project:summary-project",
                "markdown:good",
                "markdown:summary-only",
                "profile:profile",
                "profile:experience",
                "profile:education",
                "profile:links",
            },
        )

    def test_every_indexed_record_is_publicly_visible(self) -> None:
        for record in self.result.records:
            self.assertIn(record.visibility, INDEXABLE, record.id)

    def test_public_project_text_is_summary_plus_talking_points(self) -> None:
        record = self.records_by_id["project:pub-project"]
        self.assertIn("Curated public summary", record.text)
        self.assertIn("Safe talking point one.", record.text)
        self.assertEqual(record.title, "Public Project")
        self.assertEqual(record.project_id, "pub-project")
        self.assertEqual(record.role_lenses, ("backend",))
        self.assertEqual(record.tags, ("Python", "Django"))

    def test_deep_detail_never_enters_any_record(self) -> None:
        for record in self.result.records:
            self.assertNotIn("DEEP_DETAIL_MARKER", record.text, record.id)

    def test_public_summary_only_project_is_redacted_to_summary(self) -> None:
        record = self.records_by_id["project:summary-project"]
        self.assertEqual(record.text, "High-level summary that is allowed into the index.")
        self.assertNotIn("Talking point", record.text)

    def test_public_markdown_body_is_indexed(self) -> None:
        record = self.records_by_id["markdown:good"]
        self.assertIn("indexed verbatim", record.text)

    def test_public_summary_only_markdown_body_is_withheld(self) -> None:
        record = self.records_by_id["markdown:summary-only"]
        self.assertEqual(record.text, "")
        self.assertEqual(record.title, "Summary-Only Markdown")

    def test_expected_exclusions_are_not_errors(self) -> None:
        expected = {
            "projects/private-project.json": "visibility_not_indexable:private",
            "projects/blocked-project.json": "visibility_not_indexable:blocked",
            "projects/limited-project.json": "visibility_not_indexable:limited",
            "projects/unregistered-pub.json": "unregistered",
        }
        for path, reason in expected.items():
            exclusion = self.exclusions_by_path[path]
            self.assertEqual(exclusion.reason, reason)
            self.assertFalse(exclusion.is_error, path)

    def test_governance_problems_are_error_exclusions(self) -> None:
        expected = {
            "projects/badvis-project.json": "unknown_visibility:internal",
            "projects/novis-project.json": "missing_visibility",
            "markdown/broken.md": "invalid_front_matter",
            "skills.json": "missing_visibility",
        }
        for path, reason in expected.items():
            exclusion = self.exclusions_by_path[path]
            self.assertEqual(exclusion.reason, reason)
            self.assertTrue(exclusion.is_error, path)
        self.assertEqual(len(self.result.errors), len(expected))

    def test_excluded_content_never_leaks_into_record_text(self) -> None:
        markers = (
            "PRIVATE_MARKER",
            "BLOCKED_MARKER",
            "LIMITED_MARKER",
            "UNREG_MARKER",
            "BADVIS_MARKER",
            "NOVIS_MARKER",
            "BROKEN_MARKER",
            "MD_DEEP_DETAIL_MARKER",
            "NOVIS_SILO_MARKER",
        )
        for record in self.result.records:
            for marker in markers:
                self.assertNotIn(marker, record.text, record.id)


class RealContentTests(unittest.TestCase):
    """The real Layer 0 content root respects the Layer S index rule."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.result = build_index(DEFAULT_CONTENT_ROOT)

    def test_real_content_has_no_governance_errors(self) -> None:
        self.assertEqual(self.result.errors, ())

    def test_esg_research_is_excluded(self) -> None:
        for record in self.result.records:
            self.assertNotIn("esg-greenwashing", record.id)
            self.assertNotIn("esg-greenwashing", record.source_path)
            self.assertNotIn("greenwashing", record.text.lower(), record.id)
        reasons = {e.source_path: e.reason for e in self.result.exclusions}
        self.assertEqual(
            reasons.get("projects/esg-greenwashing.json"),
            "visibility_not_indexable:private",
        )

    def test_every_real_record_is_publicly_visible(self) -> None:
        for record in self.result.records:
            self.assertIn(record.visibility, INDEXABLE, record.id)

    def test_builds_are_deterministic_with_stable_ids(self) -> None:
        again = build_index(DEFAULT_CONTENT_ROOT)
        self.assertEqual(self.result, again)
        ids = [r.id for r in self.result.records]
        self.assertEqual(ids, sorted(ids))
        self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
