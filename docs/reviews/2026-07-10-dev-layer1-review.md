# Portfolio-v4 — Dev Branch Review (Layer 1)

**Date:** 2026-07-10
**Reviewed at:** `origin/dev` @ `b0d34af` (contains `master` and the completed `feature/profile-ui-refresh`; ~9,250 insertions / 133 files changed since the last reviewed commit `93d6c14`)
**Prior review:** `2026-07-03-full-review.md` (same branch, `claude/profile-ui-refresh-review-rpjdsv`)
**Scope:** in-depth read of everything that changed since the last review — the completed profile refresh, the entire Layer 1 implementation (evidence index, retrieval API, grounded generation, playground UI), content-governance mechanization, accessibility work, and the Railway/Vercel deployment wiring — plus verification runs. Review only; no changes to `dev`.

**Verification performed (all green):**

| Check | Result |
|---|---|
| `manage.py test core` (apps/api) | 84 tests, OK, 0.08s |
| `manage.py build_evidence_index --check` | 19 records, 1 expected exclusion (ESG, private), 0 errors |
| `npm run validate:content` (apps/web) | 10 project files, 9 registered, 5 silos — passed |
| `npm run build` (apps/web) | green; **7 files in `dist/assets` (was 1,620), main chunk 331 kB / 107 kB gzip (was 549/165)** |

---

## Part I — Previous findings: resolution scorecard

The July 3 review listed 17 findings. Fifteen are fixed on `dev`, most exactly as recommended — and `docs/agent/pre-layer1-validation-plan.md` explicitly cites the review ("finding 17 / Part II") as the trigger for the validation work.

| # | Finding (July 3) | Status on `dev` |
|---|---|---|
| 1 | Home double-rendered Navigation + ParticleEffect | **Fixed** — `Home.jsx` renders sections only; chrome lives solely in the `Layout` route |
| 2 | `modal-descriptions` vs `.modal-description` CSS mismatch | **Fixed** — legacy modal + `projectDetail.css` deleted; new `pf-pd-lightbox` |
| 3 | Nested `.metrics-grid` (MetricItem) | **Fixed** — `MetricItem` deleted; detail page renders metrics inline |
| 4 | Footer hardcoded "© 2025" | **Fixed** — `new Date().getFullYear()` |
| 5 | `Modal` latent `data.title` crash in children mode | **Fixed** — children mode removed; null guard before dereference |
| 6 | `bookOpen`/`playCircle` invalid icon names | **Fixed** — kebab-case map + `Icon` registry |
| 7 | JSON icon names unvalidated | **Mitigated** — `Icon` registry falls back to a Link icon |
| 8 | `lucide-react/dynamic` → 1,620 chunks, 549 kB main | **Fixed** — static `Icon.jsx` registry (named imports) + route-splitting (`ProjectDetail`, `NotFound`, `Playground` lazy). 7 chunks, 331 kB main. `lucide-react/dynamic` has zero references left |
| 9 | Dead files (`App.css`, `styles/base.css`, `projectList.css`, empty `ProjectList` page) | **Fixed** — all deleted, along with retired `PageHeader`/`ProjectHeader`/`TechTags`/`MetricItem` |
| 10 | Unused adapter exports (`getAllProjectCards` etc.) | **Fixed** — removed |
| 11 | Nav CSS duplicated in `index.css` and `navigation.css` | **Fixed** — single home in `navigation.css` |
| 12 | Registry `featured` flag semantically dead | **Open** — still validated but unused by the UI |
| 13 | Adapter README drift (stale shapes) | **Fixed** — README now documents the real `getProfile`/`getCapabilities`/`getProjectById` shapes and the silo governance fields |
| 14 | ESG visibility three-way inconsistency | **Fixed exactly as recommended** — `layer-s-policy.md` now states ESG is `private` (present-but-unregistered, sanitized prose only) and marks `public_summary_only` as reserved |
| 15 | Assistant dialog: no focus trap / focus management | **Fixed** — shared `useDialogA11y` (focus-in, Tab trap, Escape, focus restore) on both dialogs; skip link; `aria-live` status announcements; a full pre-Layer-1 accessibility audit is committed |
| 16 | `GalleryItem` click-only div; modal a11y | **Fixed** — real `<button>` with `aria-label`; lightbox gets the same dialog hook; per-image `onError` fallback hides broken media (the deferred "graceful missing-media" slice, now done) |
| 17 | No lint/tests; CI only on master | **Mostly fixed** — CI now triggers on `dev`/`main`, runs `validate:content`, the API test suite (84 tests), and `build_evidence_index --check`. Still no ESLint and no web-side tests (see Part IV) |

Also carried forward from the backlog review: the Train Booking metrics (`99.9%`, `<150ms`, `500+`) are unchanged and still unverifiable — now slightly more exposed, since the detail page renders them prominently and the evidence index makes "no invented metrics" a brand claim.

---

## Part II — What Layer 1 actually is (architecture)

The plan's migration sequence has jumped forward two steps: contracts are still deferred (correctly — records/schemas are deliberately API-local with extraction notes), but Layer 1 steps 1–3 are live: **evidence index → retrieval endpoint → grounded answers**, each on its own feature branch, merged via PRs into `dev`, with docs updated to say "partially implemented" rather than pretending otherwise.

### The evidence index (`core/layer1/builder.py`, `records.py`, `frontmatter.py`)

This is the Layer S index gate, in code, and it is genuinely fail-closed:

- Only `public` / `public_summary_only` enter; `private`/`blocked`/`limited`/unregistered are *expected* exclusions; missing or out-of-vocabulary governance, unparseable front matter, missing `ai` blocks, or an unreadable registry are *errors* that fail the build (and CI).
- **Redaction is structural:** `public` projects contribute only the curated `ai.publicSummary` + `safeTalkingPoints`; `public_summary_only` gets summary-only; `detail.*` content never enters any record; `public_summary_only` markdown bodies are withheld. There's a test asserting deep detail never appears in any record text.
- Deterministic IDs and sorted output; a hand-rolled ~50-line front-matter parser that fails closed on anything non-flat rather than pulling in PyYAML — the right trade at this scale.
- Profile silos gained explicit `visibility`/`sensitivity` fields (content change), so *everything* indexed passes the same gate.
- The 84-test suite covers gating, redaction, determinism, and — notably — runs the real content through the gate (`test_esg_research_is_excluded`, `test_real_content_has_no_governance_errors`).

### Retrieval (`retrieval.py`, `POST /api/retrieve/`)

Deliberately model-free: unique-token overlap scoring (+3 title, +2 tag, +1 text, +2 soft role-lens boost), stable tie-breaks, `top_k` ≤ 20, query ≤ 500 chars, `bool`-rejecting integer validation. Corpus loading is defense-in-depth: build in-process when the content root exists (refusing wholesale on any governance error), else read the baked artifact (refusing wholesale if any record is non-indexable — a tamper/staleness guard), else serve nothing (503). Process-lifetime `lru_cache`.

### Grounded answers (`answering/`, `POST /api/answer/`)

The strongest new code in the repo. The pipeline is: validate request → retrieve → **if no evidence, refuse without spending a model call** → build prompt → provider → validate model output fail-closed → hydrate citations from retrieved records only.

- **The model is never trusted.** Output must be strict JSON with a vocabulary-checked status; `[[evidence_id]]` prose markers and `citation_ids` must each be subsets of the retrieved ids *and* mutually consistent (orphans in either direction are 502s); `refused`/`insufficient_evidence` prose is discarded and replaced with fixed server-authored messages; highlights are capped; answers are length-capped (1,200 chars).
- **Provider seam:** an ABC with `gemini` (server-side key via `.env`/env, `response_mime_type: application/json`, temperature 0, timeout) and a DEBUG-only `fake` (registry-rejected in production; tests inject directly). Lazy SDK import so tests never load it.
- **Prompts centralized** in `prompts.py` with sensible grounding rules (third person, cite-per-claim, no numeric display labels, X-RAG allowed only as it appears in public evidence).
- The view maps each failure class to the right HTTP code (400/502/503) and the web client maps each to a typed UI state.

### Web integration

- `apiClient/retrievalClient/answerClient` are clean typed-result fetch wrappers (never throw except AbortError; HTML-instead-of-JSON becomes `unavailable` — a real bug they hit on Railway and fixed properly).
- The ⌘K shell is now a working assistant: presets → grounded answer → evidence ledger → source chips, with an "Open in Playground" continuation that preserves state, and evidence→project-detail navigation that can resume the assistant on return. Free-text queries travel via navigation state, never the URL — a deliberate privacy decision (out of history/edge logs); only whitelisted preset ids use `?p=`.
- `/playground` is a route-split, full-screen "RAG playground" (hero → query → answer + ledger), honest about its mechanics ("lexical retrieval — no reranking yet"; "score bars show relative rank, not confidence").
- The launcher is a single button flying between hero row and dock via a 384-line imperative rAF controller — over-engineered for a button, but it respects `prefers-reduced-motion` (as does the particle canvas now), never re-renders React, and guards against StrictMode double-mounts. It's documented in its own spec doc.

### Deployment

Dockerfile on Railway (after a visible 8-commit fight with Railpack/Mise venv-shebang breakage — the postmortem is written into `railway.toml` comments and the deploy doc): monorepo build context so Layer 0 content ships into the image, index baked at build time, `sh -c` CMD so `$PORT` expands, healthcheck on `/health/`, Wait-for-CI gating, branch→environment mapping (`dev`→staging, `main`→production). `.env.example` + hardened `.gitignore` (`.env*` ignored, examples allowed). Vercel needs build-time `VITE_API_BASE_URL`, documented.

---

## Part III — New findings

Ordered by importance. Nothing here is a security or governance leak — the gate held up under specific scrutiny.

1. **Cost exposure on `/api/answer/` (the one to fix before promoting `main`).** The endpoint shares the generic `AnonRateThrottle` (60/min *per IP*) with everything else. Every allowed request is a paid Gemini call, so a single IP can legitimately burn ~86k model calls/day, and multiple IPs scale linearly — there is no scoped per-endpoint rate, no global/daily budget, and no concurrency cap. The Layer S matrix has "token/output budgets — Layer 1" partially covered (input 500 chars, output 1,200, top_k 20) but *call volume* is the actual cost lever. Cheap fix: DRF `ScopedRateThrottle` with a tight `answer` scope (single-digit/min) while `retrieve` stays loose, plus a coarse global daily counter that flips the endpoint to 503. The no-evidence-no-model-call short-circuit already helps; it isn't enough on its own.

2. **The 1,200-char truncation can turn a valid answer into a 502.** `schemas.py` slices `answer[:ANSWER_MAX_LENGTH]` *before* parsing markers. A cut mid-`[[evidence_id]]` leaves a dangling marker that no longer parses; if that id appears in `citation_ids`, the prose/citation consistency check then raises `AnswerOutputError` → 502 for output that was actually well-formed. A cut mid-`==highlight==` similarly leaves stray `==`. Truncate at a markup-safe boundary (or validate first, then truncate with marker awareness — the client-side `stripProseMarkup`/`renderProse` already defend against dangling `[[`, so the server is the only brittle layer).

3. **Retrieval scoring counts stopwords.** Unique-token overlap gives "what", "and", "his", "at" the same +1 text weight as "FastAPI". With 19 summary-length records the damage is bounded, and the docs are honest that reranking is future work — but a ~30-word stopword set in `_tokenize` costs nothing and would measurably clean the ledger for natural-language questions (which is exactly what the ⌘K input invites). Worth doing before the corpus grows past summaries.

4. **Silent same-origin fallback in production web builds.** If `VITE_API_BASE_URL` is unset at Vercel build time, `resolveApiBase()` quietly returns `""`, requests go to the Vercel domain, the SPA-fallback rewrite serves `index.html`, and every query reports "unavailable." It degrades gracefully and the doc warns about it — but a deploy misconfiguration should be loud, not graceful: fail (or at least `console.warn` + build-log warning) when `import.meta.env.PROD && !VITE_API_BASE_URL`.

5. **Stale comment in the Dockerfile.** The `CMD` comment still says "railway.toml's startCommand mirrors this and takes precedence" — the final fix (`b0d34af`) removed `startCommand` precisely because it *couldn't* work, and `railway.toml`'s own comment says the opposite. One line, but it's the exact kind of drift that costs an hour during the next deploy incident.

6. **Node engines churn.** `engines` went from `>=20.19.0` to `24.x` with CI on `24.x`; local dev on Node 22 works only because npm doesn't enforce engines by default. Fine if Vercel and all dev machines are actually on 24 — but `24.x` excludes the Node 20/22 LTS lines for no stated reason; `>=20.19` was the more honest constraint unless something genuinely needs 24.

7. **Resubmitting the same query is a no-op.** In both the modal and playground, submitting identical text doesn't refetch (`useGroundedAnswer` deps don't change), and the modal's error state renders no retry control even though the hook exposes `retry`. After a transient 503, a user's natural "try again" does nothing. Wire `retry` into the error surfaces.

8. **Still missing: ESLint and any web-side tests.** The API went from zero to 84 tests; the web went from zero to zero while gaining an async state machine (`useGroundedAnswer`), prose-markup parsing (`renderProse`/`stripProseMarkup` — regex-heavy, edge-case-prone), and navigation-state resume logic. Those three are exactly the units that deserve the first `vitest` file, and the validation plan's remaining steps (shared vocab module, markdown front-matter checks in the JS validator) are still open.

9. **Minor carried-over items:** registry `featured` flag still unused; Train Booking metrics still unverifiable (Part I); `contentCards` markdown-in-JSON decision still open (react-markdown is now at least route-split into the 124 kB detail chunk, so the home bundle no longer pays for it).

---

## Part IV — Verdict

This is an exceptional seven days of work. The last review's core criticism — "the repo's values are enforced by authorial care, not CI" — was not just addressed but institutionalized: content validation and index gating now fail the build, the governance rules got 84 tests including runs against the real content, and the policy docs were reconciled with reality (in the direction the backlog's supervisor constraint required). The bundle problem was solved emphatically (1,620 → 7 assets, 549 → 331 kB main), the "vaporware pill" became a working grounded assistant, and the accessibility gaps were closed with a shared dialog hook and a written audit rather than point fixes.

Layer 1's architecture deserves specific praise for three decisions: **refusing before spending a model call** when retrieval returns nothing; **discarding model prose entirely** on refusal/insufficient states in favor of server-authored messages; and **structural redaction** (deep detail never enters the index) rather than prompt-based discipline. That is the "evidence-based AI with guardrails" claim of the portfolio, implemented as described. The deploy saga (Railpack → Dockerfile) also ended in the right place, with the failure mode documented where the next maintainer will trip over it.

The gap list is short and mostly operational: put a scoped throttle and a budget cap on `/api/answer/` before `main` starts serving real traffic (finding 1 — the only one I'd block promotion on), fix the truncation-502 edge (2), add the stopword filter (3), make the missing-API-base misconfiguration loud (4), and start the web test suite where the new complexity actually lives (8). None of it is architectural rework; the foundations this was built on are sound and are being maintained honestly.
