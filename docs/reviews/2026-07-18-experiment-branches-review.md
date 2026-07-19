# Review — experiment branches (everything not yet reviewed)

**Date:** 2026-07-18 · **Companion to:** `2026-07-18-framework-prerender-regression.md`
**Scope:** all commits on all branches not covered by prior reviews: `perf/framework-prerender` +5 commits (`613c1e6..4844ee4`), `perf/navigation-transition-framework` (+1 snapshot commit), `perf/navigation-transition-spa` (2 commits), `ab/particles-pause` (1 commit). Builds and measurements run in this container where relevant.

---

## 1. `perf/framework-prerender` — the five commits after the regression

The branch's final state converges with the independent regression investigation, and closes well:

- **`4844ee4` records a G6 audit whose verdict matches this review's independent measurement almost exactly**: home critical path `140,341` gzip vs the hard `101,640` cap (this review measured `140,272` — 69 bytes apart, different container), LCP and Speed Index advisory warnings, TBT ≈ 0, and an explicit **no-go gate decision**: "Branch B is complete as an evidence-bearing experiment, but it is not selected for this release." That is exactly the right way to close a failed experiment — evidence kept, budgets left authoritative, no quiet merge.
- **`613c1e6` fixes the hydration blanking properly**: the `Suspense` wrapper around `Outlet` (which could unmount prerendered HTML during hydration) is replaced by a context-based, non-blocking `RouteHydrationSignal` rendered by each route module — prerendered content stays visible; the deferred Assistant mount signal survives.
- **`a44b864` reconnects the performance gates** (this review's recommendation #3, implemented): `report-build`/`run-ci-audit`/analyzer now target `build/client`, and — bonus — **`@vitejs/plugin-react` is removed**, fixing the double-transform misconfig flagged in the investigation.
- **`3169a94`** teaches the budget checker both chunk-name shapes (`ProjectDetail-*` / `project-detail-*`) with a fixture proving they resolve to the same measurement — narrow, correct.
- **`42f564c` adds two genuinely new capabilities** the SPA lacks: per-route canonical/OG/Twitter metadata (verified in the audit: exactly one of each per route) and intent-based prefetch (hover/focus only, Save-Data suppresses project payloads — verified: initial Home loads no project/playground payload).

Residuals if the branch is ever revived: `isbot` and `@react-router/node` still sit in runtime dependencies (template residue; unused with `ssr: false`); the triple `AssistantDialog` duplication carried into the server build; the missing final Vercel preview is honestly marked "Unverified."

**Assessment:** the experiment failed on its primary metric and was closed honestly with its instruments repaired. The two capabilities worth salvaging into the SPA lineage are per-route metadata (the SPA's `useDocumentTitle` covers only titles — no per-route canonical/OG) and the intent-prefetch pattern.

## 2. `perf/navigation-transition-framework` — parked snapshot

One commit (`4e7d403`, 684 insertions: framework-side transition + recovery machinery) explicitly labeled a snapshot experiment, stacked on the no-go base — so it inherits the closure. Fine as an archive. Structural caution: across branches there now exist **three** navigation/transition state systems (`routeCompletion.js` on `dev`, `spaRouteTransition/`-`Recovery` on the SPA branch, `frameworkRouteRecovery` here), each a 150–260-line hand-rolled listener/state module. Whichever lineage wins, the other implementations should be deleted, not preserved "for reference" — this is exactly the drift-breeding duplication pattern flagged twice before.

## 3. `perf/navigation-transition-spa` — the live candidate, and it breaches the hard budget

Two commits, 826 insertions: cross-path navigations enter a pending lifecycle with **delayed** feedback (200 ms progress bar, 800 ms polite announcement, cleared instantly at the existing route-ready settlement seam — no minimum duration), plus a bounded, privacy-safe recovery surface for terminal lazy-chunk failures (fixed copy, no error text/stack/chunk-URL exposure, try-again/go-back/home actions; the follow-up commit deduplicates the redundant action). The design quality is genuinely good — the delay thresholds avoid flicker on fast loads, and recovery covers a real gap (today a failed `ProjectDetail` chunk load strands the user).

**But: measured on this container's build, the branch's homepage critical path is ≈103.6–104.8 kB gzip against the hard `101,640` cap — a hard-budget breach of ~2–3 kB.** The transition/recovery modules are imported eagerly through `App.jsx`, and `dev` sat 59 bytes under the ceiling; any eager addition was going to breach. The repo's own CI audit would fail this branch. Paths out, in preference order: (a) make the recovery UI lazy (it renders only on failure — the natural split) and keep the eager transition core to the ~200 ms timer + listener minimum; (b) confront the budget-headroom policy explicitly (the PR #21 review's U4: ratchet-with-refreeze-procedure vs 3–5% headroom) — this branch is the first legitimate feature the 59-byte headroom blocks, and silently raising the cap to fit would gut the gate's credibility after it just proved its worth against Branch B.

Also: proportionality. 826 lines of transition machinery for a four-route site continues the pattern (scheduler, dialog loader) of sophisticated infrastructure ahead of demonstrated need — defensible here because chunk-failure recovery is real UX, but the PC1/PC2 programme labels shipping in the code comments continue the jargon accretion flagged in the delta review.

## 4. `ab/particles-pause` — clean, take it

One commit pausing the particle canvas entirely below 600 px, with a live breakpoint listener, loop-stacking guard, canvas clear on stop, and — verified — the visibility-resume handler *also* checks the mobile query, so a tab hide/show on a phone cannot restart the loop; the reduced-motion guard is unaffected. The stated rationale ("the single largest measured baseline cost on weak phones") is consistent with the earlier `particle-pause-followup.md`. Only nit: the 600 px breakpoint appears as two separate `matchMedia` literals — hoist one constant. Merge-ready.

## 5. Cross-cutting observations

1. **The experiment governance is now demonstrably working.** Branch B produced a measured no-go with its evidence preserved and gates repaired; the budgets that were dismissed as "59-byte tripwire" in the PR #21 review caught a real +38% regression the moment the harness was reconnected. The gate earned its keep.
2. **The headroom decision is now unavoidable.** The same gate that killed Branch B also blocks the SPA transitions branch (+2–3 kB of defensible UX). Decide the policy once: either budgets are a ratchet with a documented re-freeze procedure (and this branch's addition triggers one consciously), or grant modest headroom and let the gate catch regressions rather than all growth.
3. **Salvage list from the closed experiment:** per-route canonical/OG/Twitter metadata and intent-based prefetch are SPA-portable wins sitting in a dead branch; the hydration-signal pattern is framework-specific.
4. **Programme jargon** (PB3/PB4/PC1/PC2/G6, Branch A/B/C) continues to spread through shipped comments and doc filenames; the sweep recommended in the delta review grows cheaper the sooner it happens.
