"""Minimal, fail-closed front-matter parser for the AI-facing markdown files.

The markdown under apps/web/src/content/public/markdown/ carries flat
``key: value`` YAML front matter (see apps/web/src/content/adapters/README.md).
This parser handles exactly that shape with the standard library only - no
PyYAML dependency. Anything unexpected (missing delimiters, nested/list values,
duplicate keys) is treated as invalid so the index builder can fail closed.
"""


class FrontMatterError(ValueError):
    """Raised when a markdown file's front matter is missing or malformed."""


def parse_front_matter(raw: str) -> tuple[dict[str, str], str]:
    """Split a markdown document into (front matter dict, body).

    The document must start with a ``---`` line, contain only flat
    ``key: value`` pairs (blank lines and ``#`` comments allowed), and close
    with a second ``---`` line. Raises FrontMatterError otherwise.
    """
    lines = raw.splitlines()
    if not lines or lines[0].strip() != "---":
        raise FrontMatterError("document does not start with a '---' front matter block")

    fields: dict[str, str] = {}
    close_index: int | None = None
    for i, line in enumerate(lines[1:], start=1):
        stripped = line.strip()
        if stripped == "---":
            close_index = i
            break
        if stripped == "" or stripped.startswith("#"):
            continue
        key, sep, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        # Fail closed on anything that is not a flat scalar pair.
        if sep != ":" or not key or not value or line.startswith((" ", "\t")) or key in fields:
            raise FrontMatterError(f"invalid front matter line {i + 1}: {line!r}")
        fields[key] = value

    if close_index is None:
        raise FrontMatterError("front matter block is not closed with '---'")

    body = "\n".join(lines[close_index + 1 :]).strip()
    return fields, body
