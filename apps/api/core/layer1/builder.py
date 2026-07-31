"""Layer 1 evidence index builder.

Reads approved Layer 0 content from the canonical public content root
(apps/web/src/content/public/ by default) and produces deterministic
EvidenceRecords, applying the Layer S agent-index rule fail-closed:

- only ``public`` / ``public_summary_only`` sources are indexed;
- ``public_summary_only`` is redacted to its curated summary (deep detail and
  markdown bodies are withheld);
- projects must also be registered in projects/index.json (defense in depth -
  present-but-unregistered files like esg-greenwashing are hidden by design);
- anything with missing/unknown governance is excluded AND reported as an
  error, never silently indexed.

Record text is summary-level only: projects contribute their curated
``ai.publicSummary`` (+ safeTalkingPoints); the AI-facing markdown contributes
its body (it exists as AI-facing prose); profile silos contribute a
deterministic plain-text rendering. ``detail.*`` project content never enters
the index in this slice. No model calls, no embeddings.
"""

import json
from pathlib import Path
from typing import Any

from core.layer1.frontmatter import FrontMatterError, parse_front_matter
from core.layer1.records import (
    INDEXABLE,
    SENSITIVITY,
    SOURCE_MARKDOWN,
    SOURCE_PROFILE,
    SOURCE_PROJECT,
    VISIBILITY,
    EvidenceRecord,
    ExcludedSource,
    IndexResult,
)

# Repo-root-relative default content root (the builder runs from the monorepo,
# locally or in CI; the deployed API never reads raw content - the built index
# artifact ships with the deploy instead).
_REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_CONTENT_ROOT = _REPO_ROOT / "apps" / "web" / "src" / "content" / "public"

# Where the built index artifact lives (gitignored). Written by the
# build_evidence_index command; read at runtime by the retrieval service when
# the raw content root is absent (deployed environments).
DEFAULT_ARTIFACT_PATH = _REPO_ROOT / "apps" / "api" / "var" / "evidence_index.json"

# The five non-project content silos (see apps/web/src/content/adapters/README.md).
PROFILE_SILOS = (
    "profile.json",
    "skills.json",
    "experience.json",
    "education.json",
    "links.json",
)


def build_index(content_root: Path = DEFAULT_CONTENT_ROOT) -> IndexResult:
    """Build the evidence index from a Layer 0 content root, fail-closed."""
    records: list[EvidenceRecord] = []
    exclusions: list[ExcludedSource] = []

    _index_projects(content_root, records, exclusions)
    _index_markdown(content_root, records, exclusions)
    _index_profile_silos(content_root, records, exclusions)

    return IndexResult(
        records=tuple(sorted(records, key=lambda r: r.id)),
        exclusions=tuple(sorted(exclusions, key=lambda e: e.source_path)),
    )


def records_as_dicts(result: IndexResult) -> dict[str, Any]:
    """Serialize an IndexResult to a JSON-ready dict (deterministic order)."""
    return {
        "records": [
            {
                "id": r.id,
                "source_type": r.source_type,
                "source_id": r.source_id,
                "title": r.title,
                "text": r.text,
                "visibility": r.visibility,
                "sensitivity": r.sensitivity,
                "role_lenses": list(r.role_lenses),
                "tags": list(r.tags),
                "project_id": r.project_id,
                "source_path": r.source_path,
            }
            for r in result.records
        ],
        "exclusions": [
            {
                "source_path": e.source_path,
                "source_id": e.source_id,
                "reason": e.reason,
                "is_error": e.is_error,
            }
            for e in result.exclusions
        ],
    }


# --- Gating helpers ----------------------------------------------------------


def _gate_visibility(visibility: Any) -> str | None:
    """Return an exclusion reason if ``visibility`` may not be indexed.

    Fail-closed: a missing or out-of-vocabulary value is an error reason, a
    known-but-not-indexable value is an expected exclusion reason, and None
    means the source may be indexed.
    """
    if not isinstance(visibility, str) or visibility not in VISIBILITY:
        return "missing_visibility" if visibility is None else f"unknown_visibility:{visibility}"
    if visibility not in INDEXABLE:
        return f"visibility_not_indexable:{visibility}"
    return None


def _gate_sensitivity(sensitivity: Any) -> str | None:
    """Return an error reason if ``sensitivity`` is missing/out of vocabulary.

    Sensitivity is not an index gate (safe and sensitive items may both be
    indexed - it guides wording, not access), but a record must never carry an
    unvalidated value: missing/unknown sensitivity is a governance error.
    """
    if not isinstance(sensitivity, str) or sensitivity not in SENSITIVITY:
        return (
            "missing_sensitivity"
            if sensitivity is None
            else f"unknown_sensitivity:{sensitivity}"
        )
    return None


def _is_governance_error(reason: str) -> bool:
    """Expected exclusions (private/blocked/limited/unregistered) are not errors."""
    return not reason.startswith("visibility_not_indexable:") and reason != "unregistered"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _clean_str_tuple(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item for item in value if isinstance(item, str) and item.strip())


# --- Projects ----------------------------------------------------------------


def _index_projects(
    content_root: Path,
    records: list[EvidenceRecord],
    exclusions: list[ExcludedSource],
) -> None:
    projects_dir = content_root / "projects"

    registered_ids: set[str] = set()
    registry_path = projects_dir / "index.json"
    try:
        registry = _load_json(registry_path)
        for entry in registry.get("projects", []):
            if isinstance(entry, dict) and isinstance(entry.get("id"), str):
                registered_ids.add(entry["id"])
    except (OSError, json.JSONDecodeError) as exc:
        # Without a readable registry nothing can prove it is surfaced: index
        # no projects at all (fail-closed) and surface the error.
        exclusions.append(
            ExcludedSource(
                source_path="projects/index.json",
                source_id="index",
                reason=f"registry_unreadable:{exc.__class__.__name__}",
                is_error=True,
            )
        )
        return

    for path in sorted(projects_dir.glob("*.json")):
        if path.name == "index.json":
            continue
        rel_path = f"projects/{path.name}"
        source_id = path.stem

        try:
            data = _load_json(path)
        except json.JSONDecodeError:
            exclusions.append(
                ExcludedSource(rel_path, source_id, "invalid_json", is_error=True)
            )
            continue

        reason = _gate_visibility(data.get("visibility"))
        if reason is None and source_id not in registered_ids:
            reason = "unregistered"
        if reason is None and not isinstance(data.get("ai"), dict):
            reason = "missing_ai_block"
        if reason is None:
            reason = _gate_sensitivity(data.get("sensitivity"))
        if reason is not None:
            exclusions.append(
                ExcludedSource(rel_path, source_id, reason, _is_governance_error(reason))
            )
            continue

        visibility: str = data["visibility"]
        ai: dict[str, Any] = data["ai"]
        card = data.get("card") if isinstance(data.get("card"), dict) else {}

        summary = ai.get("publicSummary")
        if not isinstance(summary, str) or not summary.strip():
            exclusions.append(
                ExcludedSource(rel_path, source_id, "missing_public_summary", is_error=True)
            )
            continue

        # public: curated summary + safe talking points. public_summary_only:
        # the redaction rule - summary only, nothing else.
        parts = [summary.strip()]
        if visibility == "public":
            parts.extend(_clean_str_tuple(ai.get("safeTalkingPoints")))

        records.append(
            EvidenceRecord(
                id=f"{SOURCE_PROJECT}:{source_id}",
                source_type=SOURCE_PROJECT,
                source_id=source_id,
                title=str(card.get("title") or source_id),
                text="\n".join(parts),
                visibility=visibility,
                sensitivity=data["sensitivity"],
                role_lenses=_clean_str_tuple(ai.get("roleLenses")),
                tags=_clean_str_tuple(ai.get("evidenceSkills")),
                project_id=source_id,
                source_path=rel_path,
            )
        )


# --- AI-facing markdown --------------------------------------------------------


def _index_markdown(
    content_root: Path,
    records: list[EvidenceRecord],
    exclusions: list[ExcludedSource],
) -> None:
    markdown_dir = content_root / "markdown"
    if not markdown_dir.is_dir():
        return

    for path in sorted(markdown_dir.rglob("*.md")):
        rel = path.relative_to(markdown_dir).as_posix()
        source_id = rel[: -len(".md")]
        rel_path = f"markdown/{rel}"

        try:
            fields, body = parse_front_matter(path.read_text(encoding="utf-8"))
        except (OSError, FrontMatterError):
            exclusions.append(
                ExcludedSource(rel_path, source_id, "invalid_front_matter", is_error=True)
            )
            continue

        reason = _gate_visibility(fields.get("visibility"))
        if reason is None:
            reason = _gate_sensitivity(fields.get("sensitivity"))
        if reason is not None:
            exclusions.append(
                ExcludedSource(rel_path, source_id, reason, _is_governance_error(reason))
            )
            continue

        visibility = fields["visibility"]
        # public_summary_only redaction: the markdown body is deep detail, so
        # only the front-matter title survives (there is no summary field).
        text = body if visibility == "public" else ""

        role_lens = fields.get("roleLens", "").strip()
        records.append(
            EvidenceRecord(
                id=f"{SOURCE_MARKDOWN}:{source_id}",
                source_type=SOURCE_MARKDOWN,
                source_id=source_id,
                title=fields.get("title", source_id),
                text=text,
                visibility=visibility,
                sensitivity=fields["sensitivity"],
                role_lenses=(role_lens,) if role_lens else (),
                tags=(),
                project_id=None,
                source_path=rel_path,
            )
        )


# --- Profile silos -------------------------------------------------------------


def _index_profile_silos(
    content_root: Path,
    records: list[EvidenceRecord],
    exclusions: list[ExcludedSource],
) -> None:
    for name in PROFILE_SILOS:
        path = content_root / name
        source_id = path.stem

        if not path.is_file():
            exclusions.append(
                ExcludedSource(name, source_id, "missing_file", is_error=True)
            )
            continue
        try:
            data = _load_json(path)
        except json.JSONDecodeError:
            exclusions.append(
                ExcludedSource(name, source_id, "invalid_json", is_error=True)
            )
            continue

        reason = _gate_visibility(data.get("visibility"))
        if reason is None:
            reason = _gate_sensitivity(data.get("sensitivity"))
        if reason is not None:
            exclusions.append(
                ExcludedSource(name, source_id, reason, _is_governance_error(reason))
            )
            continue

        visibility: str = data["visibility"]
        # Silo text is a deterministic flattening of the silo's own prose.
        # public_summary_only would withhold it (no curated summary exists).
        text = _render_silo_text(source_id, data) if visibility == "public" else ""

        records.append(
            EvidenceRecord(
                id=f"{SOURCE_PROFILE}:{source_id}",
                source_type=SOURCE_PROFILE,
                source_id=source_id,
                title=source_id,
                text=text,
                visibility=visibility,
                sensitivity=data["sensitivity"],
                role_lenses=(),
                tags=(),
                project_id=None,
                source_path=name,
            )
        )


def _render_silo_text(source_id: str, data: dict[str, Any]) -> str:
    """Deterministic plain-text rendering of one profile silo."""
    lines: list[str] = []

    if source_id == "profile":
        for key in ("name", "role", "headline", "tagline", "intro", "location", "availability"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                lines.append(value.strip())
        for fact in data.get("facts", []):
            if isinstance(fact, dict):
                lines.append(f"{fact.get('label', '')}: {fact.get('value', '')}".strip(": "))
        lines.extend(p for p in data.get("bio", []) if isinstance(p, str))

    elif source_id == "skills":
        niche = data.get("niche")
        if isinstance(niche, dict):
            label = niche.get("label", "")
            chips = ", ".join(_clean_str_tuple(niche.get("chips")))
            lines.append(f"Niche: {label} ({chips})" if chips else f"Niche: {label}")
            if isinstance(niche.get("description"), str):
                lines.append(niche["description"])
        for cat in data.get("categories", []):
            if isinstance(cat, dict):
                items = ", ".join(
                    [str(cat.get("primary", ""))] + list(_clean_str_tuple(cat.get("items")))
                ).strip(", ")
                lines.append(f"{cat.get('label', '')}: {items}")

    elif source_id == "experience":
        for role in data.get("roles", []):
            if not isinstance(role, dict):
                continue
            lines.append(
                f"{role.get('title', '')} at {role.get('company', '')} "
                f"({role.get('date', '')}, {role.get('location', '')})"
            )
            for resp in role.get("responsibilities", []):
                if isinstance(resp, dict) and isinstance(resp.get("t"), str):
                    metric = resp.get("m")
                    suffix = f" ({metric})" if isinstance(metric, str) and metric else ""
                    lines.append(f"- {resp['t']}{suffix}")

    elif source_id == "education":
        for entry in data.get("entries", []):
            if isinstance(entry, dict):
                detail = entry.get("detail")
                suffix = f" - {detail}" if isinstance(detail, str) and detail else ""
                lines.append(
                    f"{entry.get('qualification', '')}, {entry.get('institution', '')}{suffix}"
                )

    elif source_id == "links":
        if isinstance(data.get("email"), str):
            lines.append(f"Email: {data['email']}")
        for profile in data.get("profiles", []):
            if isinstance(profile, dict):
                lines.append(f"{profile.get('label', '')}: {profile.get('href', '')}")

    return "\n".join(lines)
