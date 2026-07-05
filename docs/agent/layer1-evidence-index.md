# Layer 1, step 1: the public evidence index

**Status: implemented** (branch `feature/layer1-evidence-index`). First increment of the
Layer 1 RAG scope in [`agent-architecture-plan.md`](./agent-architecture-plan.md) Section 4;
gating rules per [`layer-s-policy.md`](./layer-s-policy.md) Section 1.

## What this step is

A backend-owned pipeline (`apps/api/core/layer1/`) that transforms approved Layer 0 public
content into a deterministic, safe, indexable corpus of **evidence records**. It proves the
Layer S index gate in code before anything model-shaped exists:

- **Sources:** per-project JSON (`ai` block), the AI-facing markdown (`about.md`,
  `role-lenses/*.md`), and the profile silos (which now carry explicit
  `visibility`/`sensitivity` fields).
- **Index gate (fail-closed):** only `public` / `public_summary_only` sources are indexed.
  `private` / `blocked` / `limited` and unregistered project files are excluded (expected,
  reported as info). Missing or out-of-vocabulary governance - unknown `visibility`,
  unparseable front matter, a missing `ai` block - is excluded **and** treated as an error,
  never silently indexed.
- **`public_summary_only` redaction:** the curated summary enters; deep detail (project
  `detail.*`, markdown bodies) is withheld. No live content uses it yet; the behaviour is
  proven by test fixtures.
- **Record text is summary-level:** projects contribute `ai.publicSummary` +
  `ai.safeTalkingPoints`; markdown contributes its body (it exists as AI-facing prose);
  profile silos contribute a deterministic plain-text rendering. Project `detail.*` never
  enters the index in this slice.
- **Deterministic:** stable IDs (`project:<id>`, `markdown:<path>`, `profile:<silo>`), sorted
  output, no timestamps, no hashes (content hashing stays deferred - policy Section 4).

## Running it

From `apps/api/`:

```bash
uv run python manage.py build_evidence_index --check   # validate gating only, write nothing
uv run python manage.py build_evidence_index           # also write var/evidence_index.json
uv run python manage.py test core                      # gating + determinism tests
```

`--check` exits non-zero on any governance error, so it can join CI next to
`npm run validate:content`. The generated `apps/api/var/evidence_index.json` is gitignored -
the index is an artifact, never committed content.

The builder reads `apps/web/src/content/public/` directly (override with `--content-root`).
That is safe because indexing is a local/CI command, not a runtime dependency: the deployed
API (Railway) never reads raw web content. When a retrieval endpoint arrives, the CI-built
index artifact ships with the deploy.

## What is deliberately NOT here yet

Each of these is a later, separate slice - kept out so this branch stays small and reviewable:

- **No LLM / model calls** - nothing to generate answers with; the corpus must exist and be
  provably safe first.
- **No embeddings / vector DB** - chunking and embedding decisions belong with the retrieval
  slice; premature now and would add dependencies.
- **No retrieval API endpoint** - the index has no consumer yet; exposing one would be a
  public surface with no purpose and new abuse-control obligations.
- **No playground / chat UI** - `apps/web` gets a chat surface only once there is a grounded
  answer pipeline to call.

## Contracts note

The record schemas (`core/layer1/records.py`) are deliberately **API-local**. Per the
architecture plan, `packages/contracts` is introduced only when a second consumer exists;
when `apps/web` needs these shapes (e.g. to render evidence citations), extract the module
rather than duplicating it. The controlled vocabularies are mirrored from
`apps/web/scripts/validate-content.mjs` with keep-in-sync comments on both sides
(cross-language single-sourcing stays deferred, see
[`pre-layer1-validation-plan.md`](./pre-layer1-validation-plan.md) item 2).
