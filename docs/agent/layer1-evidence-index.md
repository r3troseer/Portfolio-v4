# Layer 1, step 1: the public evidence index

**Status: implemented** (index: branch `feature/layer1-evidence-index`; retrieval endpoint:
branch `feature/layer1-retrieval-api`). First increments of the Layer 1 RAG scope in
[`agent-architecture-plan.md`](./agent-architecture-plan.md) Section 4; gating rules per
[`layer-s-policy.md`](./layer-s-policy.md) Section 1.

## What this step is

A backend-owned pipeline (`apps/api/core/layer1/`) that transforms approved Layer 0 public
content into a deterministic, safe, indexable corpus of **evidence records**. It proves the
Layer S index gate in code before anything model-shaped exists:

- **Sources:** per-project JSON (`ai` block), the AI-facing markdown (`about.md`,
  `role-lenses/*.md`), and the profile silos (which now carry explicit
  `visibility`/`sensitivity` fields).
- **Index gate (fail-closed):** only `public` / `public_summary_only` sources are indexed.
  `private` / `blocked` / `limited` and unregistered project files are excluded (expected,
  reported as info). Missing or out-of-vocabulary governance - unknown/missing `visibility`
  or `sensitivity`, unparseable front matter, a missing `ai` block - is excluded **and**
  treated as an error, never silently indexed. (`sensitivity` is not an index gate - `safe`
  and `sensitive` items may both be indexed - but a record never carries an unvalidated
  value.)
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

## Retrieval endpoint (second slice)

`POST /api/retrieve/` (branch `feature/layer1-retrieval-api`) is the first runtime consumer
of the index: deterministic lexical retrieval (`core/layer1/retrieval.py`) with validated
inputs, a soft role-lens boost, and fail-closed corpus loading - built in-process where the
content root exists, else read from the shipped `var/evidence_index.json` artifact, else
(or on any governance error / non-indexable record) refuse with 503 and serve nothing. See
`apps/api/README.md` for the request/response contract. The response keeps `text` as retrieval
context and adds `entity_id`, `entity_type`, and `snippet` for the user-facing source ledger.

## Grounded-answer endpoint (third slice)

`POST /api/answer/` retrieves public evidence via the same unchanged lexical retrieval, calls
a server-side model (Gemini), validates strict JSON plus handoff prose markup, and returns a
grounded answer with hydrated citations. `/api/retrieve/` stays the raw evidence ledger. See
[`layer1-playground.md`](./layer1-playground.md) for the UI surfaces and
[`apps/api/README.md`](../../apps/api/README.md) for the answer contract.

## What is deliberately NOT here yet

Each of these is a later, separate slice - kept out so each branch stays small and reviewable:

- **No embeddings / vector DB** - lexical retrieval establishes the safety shape without
  dependencies; embeddings can replace the scorer behind the same endpoint later.
- **No reranking** - the ledger is single-pass lexical retrieval; pre/post rerank inspector
  behaviour is deferred.
- **No chat memory, tools, or generated UI/spec nodes** - answer + evidence ledger only.

## Contracts note

The record schemas (`core/layer1/records.py`) are deliberately **API-local**. Per the
architecture plan, `packages/contracts` is introduced only when a second consumer exists;
when `apps/web` needs these shapes (e.g. to render evidence citations), extract the module
rather than duplicating it. The controlled vocabularies are mirrored from
`apps/web/scripts/validate-content.mjs` with keep-in-sync comments on both sides
(cross-language single-sourcing stays deferred, see
[`pre-layer1-validation-plan.md`](./pre-layer1-validation-plan.md) item 2).
