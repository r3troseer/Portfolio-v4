"""Display-field helpers shared by the retrieval and answer surfaces.

These turn an internal ``EvidenceRecord`` into the user-facing shapes the API
serves: a full retrieval/answer ``match`` dict and the narrower ``citation``
dict. Kept out of ``views.py`` so both the retrieve view and the answer service
can reuse them without a circular import (views -> service -> presentation, and
views -> presentation). No behaviour change from the original ``views.py``
helpers - only their location moved.
"""

import json
import re
from functools import lru_cache
from pathlib import Path

from core.layer1.records import (
    SOURCE_MARKDOWN,
    SOURCE_PROFILE,
    SOURCE_PROJECT,
    EvidenceRecord,
)

SNIPPET_MAX_LENGTH = 180
_REPO_ROOT = Path(__file__).resolve().parents[4]
_PROJECT_INDEX_PATH = (
    _REPO_ROOT / "apps" / "web" / "src" / "content" / "public" / "projects" / "index.json"
)
_PROFILE_REFS = {
    "profile": "profile",
    "skills": "skills",
    "experience": "exp",
    "education": "edu",
    "links": "links",
}


def plain_text(value: str) -> str:
    """Convert indexed context into a short display-safe source snippet."""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    text = re.sub(r"[`*_>#]", "", text)
    text = re.sub(r"(?m)^\s*[-+]\s+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def snippet(record: EvidenceRecord) -> str:
    text = plain_text(record.text or record.title)
    if len(text) <= SNIPPET_MAX_LENGTH:
        return text
    return text[: SNIPPET_MAX_LENGTH - 3].rstrip() + "..."


def entity_type(record: EvidenceRecord) -> str:
    if record.source_type == SOURCE_PROJECT:
        return "project"
    if record.source_type == SOURCE_PROFILE:
        return "profile"
    if (
        record.source_type == SOURCE_MARKDOWN
        and record.source_id.startswith("role-lenses/")
    ):
        return "role_lens"
    return "content"


def entity_id(record: EvidenceRecord) -> str:
    return record.project_id or record.source_id


def match_dict(record: EvidenceRecord, score: int) -> dict[str, object]:
    """Retrieval/answer hit plus user-facing entity display fields."""
    return {
        "id": record.id,
        "source_type": record.source_type,
        "source_id": record.source_id,
        "entity_id": entity_id(record),
        "entity_type": entity_type(record),
        "title": record.title,
        "snippet": snippet(record),
        "text": record.text,
        "visibility": record.visibility,
        "sensitivity": record.sensitivity,
        "role_lenses": list(record.role_lenses),
        "tags": list(record.tags),
        "project_id": record.project_id,
        "source_path": record.source_path,
        "score": score,
    }


@lru_cache(maxsize=1)
def _project_display_orders() -> dict[str, int]:
    """Map project id to registry displayOrder (handoff portfolioProjects index)."""
    try:
        registry = json.loads(_PROJECT_INDEX_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return {}
    projects = registry.get("projects")
    if not isinstance(projects, list):
        return {}
    orders: dict[str, int] = {}
    for entry in projects:
        if not isinstance(entry, dict):
            continue
        project_id = entry.get("id")
        display_order = entry.get("displayOrder")
        if isinstance(project_id, str) and isinstance(display_order, int):
            orders[project_id] = display_order
    return orders


def citation_display_ref(record: EvidenceRecord) -> str:
    """Stable semantic label; numeric refs are reserved for project order."""
    if record.source_type == SOURCE_PROJECT and record.project_id:
        order = _project_display_orders().get(record.project_id)
        if order is not None:
            return str(order).zfill(2)
        return "src"
    if record.source_type == SOURCE_PROFILE:
        return _PROFILE_REFS.get(record.source_id, "src")
    if record.source_type == SOURCE_MARKDOWN:
        if record.source_id == "about":
            return "about"
        slug = record.source_id.rstrip("/").rsplit("/", 1)[-1].removesuffix(".md")
        return slug or "doc"
    return "src"


def resolve_citation_ref(record: EvidenceRecord) -> str:
    """Resolve a display ref without using retrieval rank."""
    return citation_display_ref(record)


def citation_dict(
    record: EvidenceRecord, *, ref: str, score: int | None = None
) -> dict[str, object]:
    """The narrower citation shape hydrated from a retrieved evidence record."""
    payload: dict[str, object] = {
        "evidence_id": record.id,
        "ref": ref,
        "title": record.title,
        "snippet": snippet(record),
        "source_type": record.source_type,
        "project_id": record.project_id,
        "source_path": record.source_path,
    }
    if score is not None:
        payload["score"] = score
    return payload
