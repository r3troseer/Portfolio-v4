# Pre-Layer-1 Validation Plan

**Date:** 2026-07-05 · **Status:** step 1 implemented; steps 2-4 deferred.

> Documents the lightest useful validation path for the content/governance layer, so
> Layer S stops relying purely on authorial care. Step 1 (the content-validation script and
> its CI wiring) is now implemented; steps 2-4 remain deferred as described below.

## Why
The consolidated review (finding 17 / Part II) flagged that the repo's values
(fail-closed, validated, evidence-based) are enforced by discipline, not by CI, and that
drift was already observable - e.g. the ESG `visibility` doc<->file mismatch fixed in this
branch. A small validation step would have caught that mechanically.

## Current state
- `apps/web/package.json`: `dev` / `build` / `preview` only - **no lint, no tests**.
- `.github/workflows/ci.yml`: builds `apps/web` and runs `manage.py check` on `apps/api`,
  triggered on push/PR to **`dev` and `main`** (feature-branch gap already closed).
- Governance is documented in `docs/agent/layer-s-policy.md` but not enforced in code.

## Proposed (lightest first)

### 1. Content-validation script - IMPLEMENTED (zero new dependencies)
`apps/web/scripts/validate-content.mjs` (pure Node ESM: `fs` + `JSON.parse`), run via
`npm run validate:content`, and wired into the `web` CI job (before `npm run build`). Checks:

- **Strict JSON:** every `src/content/public/projects/*.json` parses; `id` matches filename.
- **Governance fields present + controlled vocab:**
  - `visibility in { public, public_summary_only, limited, private, blocked }`
  - `sensitivity in { safe, sensitive }`
  - `repo.visibility in { public, private }` (when present)
  - `status` is a non-empty string (display label; not vocab-gated - it is cosmetic).
- **Registry integrity (`projects/index.json`):** unique `id`, unique positive `displayOrder`,
  boolean `featured`, and every registered `id` has a matching file on disk.
- **Index-gating (the core Layer S rule):** any project *registered* in `index.json` (i.e.
  surfaced in the UI, and later indexable) must be `public` or `public_summary_only`. A
  registered `private`/`blocked` project **fails**. Present-but-unregistered files (ESG) are
  allowed by design and reported as info, not failure.

Exit non-zero on any violation so CI (and a future pre-commit hook) fails the build - matching
the plan's intent that "content violations should fail the build."

### 2. Controlled-vocabulary single source (small follow-on)
Export the visibility/sensitivity vocab from one module the script imports, so the doc, the
future AI adapter, and the validator can't diverge. YAGNI until a second consumer exists -
today the script can hold the lists inline.

### 3. ESLint - **deferred; needs dependency approval**
Adds several dev-dependencies (`eslint`, `@eslint/js`, `eslint-plugin-react-hooks`,
`eslint-plugin-react-refresh`, `globals`) plus a flat config. Real value (unused vars/imports,
hooks rules - would have flagged the stale imports removed in Phase 3), but per the repo's
no-new-dependencies rule it requires explicit sign-off on the exact packages before installing.

### 4. Adapter-shape / README-drift checks - deferred
The review found `content/adapters/README.md` drift. A test asserting the adapter selectors
return the documented shapes would catch that, but belongs with a test runner (another dep
decision) - defer past Layer 1.

## CI integration (when 1 lands)
Add one step to the `web` job in `ci.yml`, before or after `npm run build`:
```yaml
- run: npm run validate:content
```
Runs on the existing `dev` + `main` triggers; no new workflow, no new services.

## Sequencing
`validate-content.mjs` (1) is the natural next investment - it is the Layer S mechanization the
architecture plan already promises, at zero dependency cost. ESLint (3) and adapter-shape tests
(4) follow only if/when their dependency + maintenance cost is accepted. This note is the record;
implementation is a separate, approved slice.
