# Dev Delta Review — since the Layer 1 ship-readiness point

**Date:** 2026-07-18 · **Scope:** everything merged to `dev` since the last review point — `b0d34af` (ship-readiness triage) → `e930309`: PRs #16–#21, ~18,300 insertions across 142 files. This reviews **merged, shipping code** — findings are about the current state of `dev`, not gate decisions.
**Verified:** API suite green on the new modules; web `npm ci` + production build green (29 assets, main chunk 283 kB / 91.6 kB gzip; measured homepage critical path 101.6 kB gzip, down from 121.5). Includes a requested **slop / unnecessaries audit** (Part IV).

The delta is three workstreams: **(1)** answer-contract + release/operations hardening on the API, **(2)** frontend semantics/content fixes plus the retrieval-inspector UI, **(3)** the initial-load performance programme with CI budgets and the production image.

---

## Part I — Ship-readiness triage: execution scorecard

Nearly every item from `2026-07-10-layer1-ship-readiness.md` landed. Verified in code:

| Triage item | Status on `dev` |
|---|---|
| A1 — throttle identity spoofable (`NUM_PROXIES` default) | **Done** — `NUM_PROXIES` set (default 1, env-tunable `DJANGO_NUM_PROXIES`), documented as "Railway is the one trusted proxy" |
| A2 — per-worker throttle counters | **Partially** — still `LocMemCache` per process (throttle *and* the new soft budgets are process-local, acknowledged in `limits.py`); residual: make worker count deliberate and document effective totals |
| B3 — scoped throttle + budget on `/api/answer/` | **Done and exceeded** — dedicated `AnswerRateThrottle` scope (6/min default), `ANSWER_ENDPOINT_ENABLED` kill switch, and soft daily budgets (global + per-client) rejecting **before** any provider spend |
| B4 — safe truncation | **Done, exactly per the agreed design** — `truncate_answer_prose` cuts only at boundaries outside `[[...]]`/`==...==`, runs **after** full-output validation, served `citation_ids` are recomputed from the truncated prose, and dropping every marker fails closed |
| B5 — "reranking" copy honesty | **Resolved by implementing reranking** (better than softening): deterministic two-stage retrieve→rerank with integer component breakdowns and human-readable reasons, surfaced in a real inspector UI (`RagReveal`/`RetrievalInspector`) |
| B6 — loud `VITE_API_BASE_URL` misconfig | **Done** — production build throws without it |
| B7 — prod env sanity | Docs updated (incl. `healthcheck.railway.app`, port alignment); smoke-answer remains an operational step |
| C8 — stopword filter | **Done** (`_STOPWORDS` in `retrieval.py`) |
| C9 — retry affordance | **Done** for the deferred dialog load (retry button + cached-preload recovery) |
| C10 — SPA route titles | **Done** (`useDocumentTitle`) |
| C11 — Dockerfile comment drift | **Superseded** — image rewritten (artifact-only runtime, non-root, CI-verified behavior) |
| D — first web tests | **Started** — `answerResponseValidator.fixture-test.mjs` + a shared contract fixture suite (valid/invalid + manifest); ESLint remains the only unexecuted validation-plan item |

This is an unusually high execution rate on review feedback, and the roadmap-register misclassification (cost controls as "hardening") was corrected in practice: the controls shipped with the release work.

## Part II — New surfaces reviewed (PRs #16–20)

1. **Answer contract (`packages/contracts`)** — the contracts package now exists with a real second consumer, exactly per the architecture plan's trigger. JSON Schema (2020-12) + a companion invariant (`citations[].evidence_id ⊆ evidence[].id`) + a valid/invalid fixture suite shared by both sides. API-side enforcement is at the **test boundary** (`validate_served_answer` over every `generate_answer` status shape) rather than per-request in prod — the right cost trade. Non-answer statuses are now *strict* provider contracts: prose, citations, and generated headline content must be empty before the server substitutes its message (previously they were silently discarded; now a non-compliant model is a 502 — stricter fail-closed posture).
2. **Headline extension** — answered payloads may carry a clipped `headline` (title/sub); non-answers must omit it or send the exact blank shape. Validated on both sides via the shared fixtures.
3. **Operational events (`telemetry.py`, `middleware.py`, `throttling.py`)** — privacy-by-design done properly: one-line JSON events with an **allow-listed field set** (outcome/correlation_id/endpoint/status_code/duration_ms), a fixed outcome taxonomy (13 values), server-generated correlation ids that ignore client-supplied headers, and an explicit rule that no prompts/queries/prose/payloads/exception text are ever interpolated. Tested. This implements the Layer S "prompt/log minimisation" row ahead of schedule.
4. **Deterministic reranking (`reranking.py`)** — breadth/phrase-aware integer rescoring over a lexical candidate pool, deliberately non-monotone vs the lexical order (capped lexical carry), fully explainable (`components` + `reasons` per row), stable tie-breaks, tested. The playground inspector renders the pre→post movement honestly. Still model-free — the "no embeddings, no cross-encoder" boundary holds.
5. **Release operations** — startup test refusing the dev `SECRET_KEY` outside DEBUG; artifact-only, non-root runtime image; CI job that runs the built image and probes real behavior; `jsonschema` added to API deps (note: it's a test-time dependency living in runtime deps — minor).
6. **Frontend semantics/content batch** — structured cards now *validator-enforced* (no markdown fields), heading hierarchy and contrast fixes, citation popover viewport clamping, operable static citations, focus-ownership rules for cross-surface navigation, and the portfolio self-referential link hidden from UI while remaining in content. All small, all in the right direction.
7. **`docs/development/ai-agent-orchestration.md`** — the Codex/Cursor delegation policy is now written down, including isolation, atomic-commit, and verification rules. Reviewing it as process: it is the reason the delta's commits are small, revertible, and evidence-backed; its weakness is vocabulary leakage into product code (Part IV, S1).

## Part III — PR #21 (perf programme) findings

The perf work delivers real, honestly-measured wins: per-project detail JSON split behind a fail-closed generated loader map; assistant dialog deferred behind idle/intent preload; telemetry deferred post-LCP behind an error boundary; immutable cache headers; responsive Cloudinary thumbnails with CLS reservation; ParticleEffect resize/DPR bugs actually fixed; a skip-link defect found by the first hard-gate run and fixed. The measurement discipline (frozen baseline SHA, five-run series of observed values, fixture-tested budget asserter, "do not invent figures" rules) is the strongest process in the repo.

Findings on the merged state:

1. **`AssistantDialog` ships in triplicate** — the `?pa3-retry=1/2` alternate-import-identity trick makes Vite emit three byte-identical chunks (5,861 B × 3, verified in `dist/assets`) every deploy, to defeat a rare Chromium cached-failed-import edge. A single import + "reload the page" hint covers the edge with zero duplication.
2. **Runtime Ajv is the app's largest JS chunk** — 126.8 kB / 36.7 kB gzip deferred, larger than Playground + ProjectDetail + dialog combined, to re-validate a shape the producer already validates fail-closed. Keep the schema and the client check; **precompile it** (`ajv` standalone codegen at build time) for the same guarantee at ~10% of the weight, minus Ajv's runtime codegen/CSP concern.
3. **CI cost:** every push/PR to `dev`/`main` now runs two full builds + five headless-Chrome Lighthouse runs. Advisory worst-values already brush their bounds (perf 84 vs min 87; TBT 564 vs 460). Keep `perf:report` + fixtures per-push; move the Lighthouse audit + analyzer build to PRs-to-`main` or nightly.
4. **Hard budget headroom is 59 bytes** (`homepageCriticalPathGzipBytes` 101,640 vs measured 101,581; advisory total-JS 657 B; ProjectDetail 111 B). The next dependency patch trips CI by construction. Either document the ratchet/re-freeze procedure beside `budgets.json` or grant 3–5% headroom so the gate catches regressions, not churn.
5. **Duplicate timing machinery:** `scheduleIdleAssistantDialogPreload` re-implements `scheduleAfterCriticalIdle`'s LCP→finite-animations→double-rAF→idle gating with small variations. Two hand-rolled copies of subtle timing code breed drift; the loader should compose the scheduler (its save-data gate is the only distinct part). Relatedly, the 256-line scheduler serves two tolerant consumers — justified only if it becomes the single shared implementation.

## Part IV — Slop audit

S1. **Programme jargon shipped in product code:** "PA3-shaped" (`nonCriticalScheduler.js`), `?pa3-retry=` import specifiers, "PA5-shaped" (budget fixtures/tests), "FE-B12" (`validate-content.mjs`), "Branch A / PA5 evidence" (`budgets.json`). These are task labels from the orchestration workflow; in `docs/performance/` they're the programme record, in shipped source they're opaque to any future reader. One sweep replaces them with plain descriptions.
S2. **`docs/performance/branch-a-results.md` (411 lines)** is a worker/controller diary (atomic-unit tables, "expected commit message" fields) wearing a docs filename. Keep as evidence; don't let future docs default to this shape — the durable content already lives in `baseline.md` + `budgets.json`.
S3. Otherwise notably clean for ~18k inserted lines: comments state constraints rather than narrating, dead code from the refactors was actually deleted (`EvidenceResults` superseded, old assistant CSS split moved, legacy fields removed), and the docs were updated in the same PRs as the code they describe.

## Part V — Residuals (current state)

1. **The soft daily budgets default to 0 = disabled** (`ANSWER_DAILY_SOFT_LIMIT`, `ANSWER_PER_CLIENT_DAILY_LIMIT`). The mechanism shipped; the protection is dormant until the production environment sets values. Set both in Railway prod (and staging), and keep the external Gemini billing cap as the independent backstop.
2. **Process-local counters** (A2 residual): both the DRF throttle (LocMem) and `limits.py` budgets multiply by gunicorn worker count and reset on deploy. Acceptable if the worker count is 1–2 and deliberate — document the effective totals where the env vars are documented.
3. **ESLint** is now the only unexecuted validation-plan item, while the web codebase has grown its most lint-catchable surface to date (hand-rolled hooks/scheduling). The first real test runner (the fixture tests are runner-less by design) remains the next step after it.
4. `jsonschema` sits in the API's runtime dependencies but is only used by the contract test boundary — move to a dev/test dependency group when convenient.
5. Carried over, still open: registry `featured` flag unused; Train Booking metrics unverifiable.

## Part VI — Assessment

Since the last review point the project executed its entire ship gate, upgraded the answer contract from "server discards bad prose" to "non-compliant output is rejected," implemented reranking rather than apologizing for its absence, built privacy-correct observability, and produced honest, fixture-tested performance budgets — while keeping every governance boundary intact. The residual list is short and operational: turn the dormant budget env vars on in prod, decide the worker-count multiplier deliberately, unwind the four perf-programme over-engineerings (triple facade, runtime Ajv, every-push Lighthouse, zero-headroom budgets), and sweep the programme jargon out of shipped source. The codebase is in the best state it has been across all five reviews.
