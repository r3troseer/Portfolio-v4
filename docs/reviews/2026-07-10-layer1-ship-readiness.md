# Layer 1 Ship-Readiness — Deferred Items Triage

**Date:** 2026-07-10 · **Reviewed at:** `origin/dev` @ `b0d34af` · **Companion to:** `2026-07-10-dev-layer1-review.md`
**Question:** which deferred/known-open Layer 1 items are worth visiting before promoting `dev` → `main` (production)?

Sources swept: `docs/agent/pre-layer1-validation-plan.md` (steps 2–4), `docs/ui/pre-layer1-accessibility-audit.md` (deferred set — the "fix now" set is verified landed: `:focus-visible`, dialog hook, skip link, reduced-motion, h3/h1 fixes), `docs/agent/layer1-evidence-index.md` ("deliberately NOT here yet"), `docs/agent/layer1-playground.md` (CONFLICT items), `docs/deployment/layer1-runtime.md` ("explicitly not in this runtime"), the Layer S enforcement matrix, and the open findings from the companion review.

## A. Two items no list captures (found in this triage — both weaken the only abuse control)

1. **Throttle identity is spoofable behind the proxy.** DRF's `AnonRateThrottle` keys on `get_ident()`; with the default `NUM_PROXIES = None`, DRF uses the **entire `X-Forwarded-For` header** as the client identity when present. Behind Railway's edge, a caller who sends a randomized `X-Forwarded-For` on each request may mint unlimited fresh identities and bypass the 60/min throttle entirely (depends on whether Railway *overwrites* or *appends to* client-supplied XFF — verify, but fail safe). Fix: set `REST_FRAMEWORK["NUM_PROXIES"] = 1` (env-tunable) so DRF takes the real client hop.
2. **Throttle counters are per-worker.** No `CACHES` is configured, so Django falls back to per-process `LocMemCache`; with N gunicorn workers the effective anon rate is N × 60/min, and counters reset on every deploy/restart. Acceptable if N is small and known — but it should be a *decision*, not an accident. Options: single worker (document it), or a tiny shared cache (Redis is overkill today; even `DatabaseCache` is unavailable DB-less — so document the multiplier and set worker count deliberately).

## B. Ship gate (do before `main`) — small, roughly a day combined

3. **Scoped throttle + budget for `/api/answer/`** (companion review finding 1). Every allowed request is a paid Gemini call; it currently shares the generic 60/min anon rate. `ScopedRateThrottle` with a tight `answer` scope (single-digit/min) + a coarse global daily counter → 503. Complementary external control either way: set a hard quota/budget cap on the Gemini key in the Google console, so the blast radius of any bypass (see A) is bounded by billing, not code.
4. **Safe truncation of the answer budget** (decided in the companion review): validate the model's full output, truncate at a boundary outside `[[...]]`/`==...==`, recompute `citation_ids` from served prose; fail closed only when truncation would drop every marker.
5. **Honesty copy fix the playground doc itself flags:** the "Open in Playground" subcopy promises "scores, **reranking** & the evidence behind this" — reranking is not live. The doc says "soften … only once reranking lands"; shipping to prod with over-promising copy contradicts the project's own honesty rules. One-string change.
6. **Loud prod misconfig for `VITE_API_BASE_URL`.** Unset at Vercel build time → silent same-origin fallback → every query "unavailable." Fail the build (or at minimum warn loudly) when `PROD && !VITE_API_BASE_URL`.
7. **CORS/env sanity for the production pair:** production Vercel domain(s) in `DJANGO_CORS_ALLOWED_ORIGINS` (scheme included), `DJANGO_ALLOWED_HOSTS` with the Railway domain, `GEMINI_API_KEY` present in the production Railway environment (note: `/health/` cannot detect a missing key — the failure appears only on first `/api/answer/` call; smoke-test one answer post-deploy).

## C. Cheap pre-ship wins (each <1h; ship without them if time-boxed)

8. **Stopword filter in `_tokenize`** (~30 words): natural-language questions are exactly what the ⌘K input invites, and "what/and/his" currently score like "FastAPI."
9. **Retry affordance on transient failures:** resubmitting the identical query is a no-op (hook deps unchanged) and the modal error state doesn't wire the hook's existing `retry`. After a 503, the user's natural "try again" does nothing.
10. **SPA route titles** (audit item 8, deferred pre-Layer-1 but more relevant now): `/playground` and citation→detail hops leave `document.title` stale across what is now a multi-surface app. A small title effect covers home/detail/playground/404.
11. **Dockerfile `CMD` comment** still claims `railway.toml startCommand` takes precedence — the final fix removed it for the opposite reason. One line.

## D. Correctly deferred — ship without, schedule after

- **ESLint + first web tests** (validation plan 3–4): the API has 84 tests; the web has zero while owning the answer state machine, `renderProse`/`stripProseMarkup`, and resume-navigation logic — that's where the first `vitest` file belongs. Post-ship, near-term.
- **Controlled-vocab single source** (validation plan 2): both sides carry keep-in-sync comments and CI runs both gates; divergence would be caught. Do it when `packages/contracts` gets its second consumer.
- **Remaining a11y deferrals** (mobile-menu focus trap, decorative-icon `aria-hidden` sweep, touch targets, contrast measurement): audited, low-stakes, none regressed.
- **Reranking, embeddings/vector DB, chat memory, tools, generated UI, content hashing, streaming:** roadmap by design, not ship items. (Reranking's only pre-ship footprint is the copy fix in B5.)
- **Registry `featured` flag / Train Booking metrics / contentCards markdown-in-JSON:** carried-over content decisions, orthogonal to the Layer 1 ship.

## Recommendation

Block promotion on **A1–A2 + B3–B7** (throttle identity, worker multiplier decision, scoped answer throttle + billing cap, safe truncation, reranking copy, loud env misconfig, prod env sanity + one post-deploy smoke answer). That is roughly a day of work and it hardens the exact surface prod exposes: an unauthenticated endpoint that spends money per request. C8–C11 ride along if the slice has room; everything in D stays deferred with a clear conscience.
