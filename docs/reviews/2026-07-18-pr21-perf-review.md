# PR #21 Review — `perf/frontend-initial-load` (+ slop / unnecessaries audit)

**Date:** 2026-07-18 · **Reviewed at:** `origin/dev` @ `e930309` (merge of PR #21; 11 commits, ~7,380 insertions over merge-base `44776a9`)
**Verified:** `npm ci` + production build green on the new lockfile — **29 assets, main chunk 283 kB / 91.6 kB gzip** (down from 331/107); measured homepage critical path 101.6 kB gzip (baseline doc: 121.5). Requested focus: general review **plus a specific pass for slop and unnecessary additions**.

Context noted but out of scope here: PRs #16–20 (landed between the last review and this one) executed most of the ship-gate triage — scoped `answer` throttle (6/min), `NUM_PROXIES=1`, safe truncation (`truncate_answer_prose`), structured content cards replacing markdown-in-JSON (now *enforced* by the validator), `packages/contracts` with a real second consumer, privacy-safe operational events, non-root artifact-only runtime image. Those deserve their own pass; this review is PR #21.

---

## Part I — What the PR genuinely delivers

1. **Real, measured initial-load wins.** Per-project detail JSON moved out of the home graph via a build-time manifest + fail-closed generated loader map (each detail JSON is its own deferred chunk); the assistant dialog body (and its icons/answer machinery) deferred behind an idle/intent preload with a Retry UI; Vercel Analytics + new Speed Insights deferred post-LCP behind an error boundary that can never take the UI down; immutable cache headers for hashed assets/fonts in `vercel.json`; Cloudinary responsive thumbnails (`srcset`/`sizes`, 16:10 `c_fill`, `f_auto,q_auto`) with intrinsic dimensions for CLS reservation, originals kept for the lightbox.
2. **Real bug fixes riding along:** the ParticleEffect resize handler no longer locks the canvas to the first viewport (and correctly resets the DPR transform); the skip link targeted `#main` while `<main>` had no id — found by the first live Lighthouse hard-gate run, fixed by deleting the conditional-id dance in favor of a static `id="main"`; nav background state churn removed.
3. **Exceptional measurement discipline.** Frozen baseline SHA, five-run Lighthouse series with per-run tables of *observed* values, explicit "do not invent, estimate, or copy unverified figures" rules, a fixture-tested budget asserter (13 checks incl. malformed evidence), occupied-port rejection and process-tree cleanup in the CI audit runner, and a principled loopback-only exception for the two Vercel-injected script 404s. The budgets encode a defensible hard/advisory split (CLS/accessibility/structural = hard every run; noisy speed metrics = advisory medians).

This is the strongest *process* of any PR in the repo so far. The findings below are almost all about proportion, not correctness.

## Part II — Slop findings

S1. **Programme jargon shipped in production source.** "PA3-shaped" (`nonCriticalScheduler.js:5`), `?pa3-retry=` import specifiers (`assistantDialogLoader.js`), "PA5-shaped" (fixtures, `assert-budgets.fixture-test.mjs`), "FE-B12" (`validate-content.mjs`), "Branch A / PA5 evidence" (`budgets.json` description). These are internal agent-programme task labels (the PA1–PA6 / Codex-controller workflow recorded in `docs/performance/branch-a-results.md`). In the docs they're the programme record — fine. In shipped code and config they're opaque to any future reader: comments should say what the code does, not which task authored it. Sweep and replace with plain descriptions.

S2. **`docs/performance/branch-a-results.md` (411 lines) is a workflow log, not documentation.** Worker/controller tables, "expected commit message" fields, checkpoint approvals. It has archival value as evidence — keep it — but it's the programme's diary; the durable engineering content (methodology, frozen numbers, budget rationale) already lives in `baseline.md` + `budgets.json`. Don't let future docs grow this shape by default.

S3. **Duplicate scheduling logic.** `scheduleIdleAssistantDialogPreload` (`assistantDialogLoader.js`) re-implements the same LCP-observer → finite-animations → double-rAF → idle gating that `scheduleAfterCriticalIdle` (`nonCriticalScheduler.js`) provides, with small variations (`Number.isFinite(getTiming().iterations)` vs `iterations !== Infinity`, silent-skip vs load-fallback). Two hand-rolled copies of subtle timing code is exactly where drift bugs breed. The loader should compose the scheduler (its save-data/connection gate is the only genuinely distinct part).

## Part III — Unnecessaries

U1. **The dialog ships in triplicate.** The `?pa3-retry=1/2` "alternate import identity" trick makes Vite emit **three byte-identical `AssistantDialog` chunks** (5,861 B × 3 — verified in `dist/assets`) in every deploy, to defeat a rare Chromium cached-failed-dynamic-import edge case. The bytes are minor; the permanent 3× graph noise and the cleverness tax are not. A single import plus a "Reload the page" hint on second failure covers the same edge with zero duplication. Recommend deleting the facade list.

U2. **Runtime Ajv in the browser: the app's largest JS chunk.** `answerResponseValidator` compiles the shared contract schema with Ajv 2020 at runtime — a **126.8 kB / 36.7 kB gzip** deferred chunk, larger than Playground + ProjectDetail + the dialog combined, to validate one response shape produced by a server that already validates its own output fail-closed. The contract package and schema are the right move (a real second consumer — this is what `packages/contracts` was waiting for); the runtime *compiler* is not. `ajv` supports **build-time standalone compilation**: precompile the schema to a small generated validator module (also removes Ajv's codegen/CSP-eval concern). Same guarantee, ~90% less weight.

U3. **CI now runs two full builds + five Lighthouse runs on every push/PR to `dev` and `main`.** That's minutes of headless-Chrome per push for a solo repo, and the advisory medians already brush their bounds (worst runs: perf 84 vs advisory-min 87, TBT 564 ms vs 460) — variance the authors themselves documented. Suggestion: keep `perf:report` + budget fixtures on every push (fast, deterministic); run the Lighthouse audit + analyzer build on PRs to `main` (or nightly), not every `dev` push.

U4. **Frozen hard ceilings have near-zero headroom.** `homepageCriticalPathGzipBytes` max 101,640 vs measured 101,581 — **59 bytes (0.06%)**; advisory total-JS 175,000 vs 174,343; ProjectDetail 4,500 vs 4,389. The next React/lucide patch bump trips a hard CI failure by design-or-accident. If the intent is a strict ratchet, document the re-freeze procedure next to `budgets.json`; otherwise grant 3–5% headroom so the gate catches regressions, not dependency churn.

U5. **`nonCriticalScheduler.js` is 256 lines to defer two tolerant consumers** (particles, telemetry). It is well-written, cancelable, and the TBT numbers suggest deferral earns its keep — but an `requestIdleCallback`-with-timeout + load fallback (~20 lines) would serve these two consumers at a fraction of the surface. Keep it only if it becomes the single shared scheduler (see S3); two competing sophisticated implementations is the worst of both.

U6. **Minor:** `build:analyze` runs the *identical* command as `build`, distinguished only by `npm_lifecycle_event` sniffing inside `vite.config.js` — subtle magic; a `--mode analyze` or env flag would be self-explanatory. Registry-integrity checks now exist in three places (validator, manifest generator, API builder) — the validator at least imports the generator, but this strengthens the already-deferred "single validation source" item.

## Part IV — Verdict

Merge-worthy work with real, honestly-measured wins — the critical path dropped ~16%, the deferrals are correctly error-bounded, and the measurement/budget infrastructure is fixture-tested rather than aspirational. The slop is localized and cosmetic (jargon sweep, one workflow-log doc); the unnecessaries are four deliberate over-engineerings worth unwinding while they're fresh: delete the triple-facade retry (U1), precompile the contract validator (U2), move Lighthouse off the every-push path (U3), and give the budgets real headroom or a documented ratchet procedure (U4). None of them blocks anything; all of them get more expensive to remove the longer they sit.
