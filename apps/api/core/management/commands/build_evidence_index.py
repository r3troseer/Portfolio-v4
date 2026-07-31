"""Build (or check) the Layer 1 public evidence index from Layer 0 content.

Usage (from apps/api/):
    uv run python manage.py build_evidence_index            # build + write JSON
    uv run python manage.py build_evidence_index --check    # validate only

Default output is apps/api/var/evidence_index.json (gitignored - the index is
a generated artifact, never committed). --check writes nothing and exits
non-zero on any governance error (missing/unknown visibility, unparseable
front matter, ...); expected exclusions (private/blocked/limited/unregistered
sources such as esg-greenwashing) are reported as info and do not fail.
"""

import json
from argparse import ArgumentParser
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from core.layer1.builder import (
    DEFAULT_ARTIFACT_PATH,
    DEFAULT_CONTENT_ROOT,
    build_index,
    records_as_dicts,
)


class Command(BaseCommand):
    help = "Build the Layer 1 public evidence index from approved Layer 0 content."

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--check",
            action="store_true",
            help="Validate gating only; write nothing, exit non-zero on governance errors.",
        )
        parser.add_argument(
            "--content-root",
            type=Path,
            default=DEFAULT_CONTENT_ROOT,
            help=f"Layer 0 content root (default: {DEFAULT_CONTENT_ROOT})",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        content_root: Path = options["content_root"]
        if not content_root.is_dir():
            raise CommandError(f"content root not found: {content_root}")

        result = build_index(content_root)

        for exclusion in result.exclusions:
            line = f"{exclusion.source_path}: excluded ({exclusion.reason})"
            if exclusion.is_error:
                self.stderr.write(self.style.ERROR(f"ERROR {line}"))
            else:
                self.stdout.write(f"info  {line}")

        summary = (
            f"{len(result.records)} evidence record(s), "
            f"{len(result.exclusions)} exclusion(s), "
            f"{len(result.errors)} error(s)"
        )

        if result.errors:
            raise CommandError(f"evidence index gating failed: {summary}")

        if options["check"]:
            self.stdout.write(self.style.SUCCESS(f"Evidence index check passed: {summary}"))
            return

        DEFAULT_ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
        DEFAULT_ARTIFACT_PATH.write_text(
            json.dumps(records_as_dicts(result), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        self.stdout.write(
            self.style.SUCCESS(f"Wrote {DEFAULT_ARTIFACT_PATH} - {summary}")
        )
