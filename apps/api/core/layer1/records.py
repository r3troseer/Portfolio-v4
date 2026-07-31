"""Layer 1 evidence contract: record shapes and the controlled vocabularies.

These schemas are deliberately API-local. Per docs/agent/agent-architecture-plan.md
(Section 2), packages/contracts is introduced only once a second consumer exists;
today only apps/api consumes these shapes, so they live here. When apps/web also
needs them (e.g. to render evidence citations), extract this module to
packages/contracts rather than duplicating it.
"""

from dataclasses import dataclass, field


# Controlled vocabularies. Keep in step with the JS validator
# (apps/web/scripts/validate-content.mjs) and docs/agent/layer-s-policy.md
# Section 1 - the two languages cannot share a module yet, so this is a
# documented keep-in-sync duplication (pre-layer1-validation-plan.md item 2).
VISIBILITY: frozenset[str] = frozenset(
    {"public", "public_summary_only", "limited", "private", "blocked"}
)
SENSITIVITY: frozenset[str] = frozenset({"safe", "sensitive"})
# The Layer S agent-index rule: only these may ever enter the evidence index.
INDEXABLE: frozenset[str] = frozenset({"public", "public_summary_only"})

# Evidence source types.
SOURCE_PROJECT = "project"
SOURCE_MARKDOWN = "markdown"
SOURCE_PROFILE = "profile"


@dataclass(frozen=True)
class EvidenceRecord:
    """One indexable piece of approved public content.

    ``id`` is deterministic (``"<source_type>:<source_id>"``) so rebuilding the
    index from unchanged content yields identical records.
    """

    id: str
    source_type: str  # SOURCE_PROJECT | SOURCE_MARKDOWN | SOURCE_PROFILE
    source_id: str  # e.g. "gfa-exchange", "role-lenses/ai-nlp", "skills"
    title: str
    text: str  # summary-level prose; never detail.* content (see builder)
    visibility: str  # always a member of INDEXABLE for emitted records
    sensitivity: str
    role_lenses: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    project_id: str | None = None  # set for project records only
    source_path: str = ""  # content-root-relative posix path


@dataclass(frozen=True)
class ExcludedSource:
    """A source the builder saw but did not index, and why.

    ``is_error`` distinguishes governance problems (missing/unknown visibility,
    unparseable front matter, missing ai block) from expected, by-design
    exclusions (private/blocked/limited/unregistered). The --check command
    fails on errors only; expected exclusions are reported as info.
    """

    source_path: str
    source_id: str
    reason: str  # machine-readable, e.g. "visibility_not_indexable:private"
    is_error: bool = False


@dataclass(frozen=True)
class IndexResult:
    """Deterministic output of a build: records and exclusions, both sorted."""

    records: tuple[EvidenceRecord, ...] = field(default=())
    exclusions: tuple[ExcludedSource, ...] = field(default=())

    @property
    def errors(self) -> tuple[ExcludedSource, ...]:
        return tuple(e for e in self.exclusions if e.is_error)
