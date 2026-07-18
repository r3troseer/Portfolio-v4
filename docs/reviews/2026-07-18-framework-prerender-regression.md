# Investigation — performance regression on `perf/framework-prerender`

**Date:** 2026-07-18 · **Branch:** `origin/perf/framework-prerender` @ `7e50785` (3 commits on `dev` @ `e930309`)
**Question:** why did performance get worse on the latest performance branch?

The branch migrates the SPA to **React Router framework mode** (`@react-router/dev`, `ssr: false`) with build-time **prerendering** of Home, Playground, and every public project route (paths derived fail-closed from the generated manifest — that part is done well).

## Measurements (this container, identical conditions for both builds)

Both builds produced here; Lighthouse 12.6.1, three runs each, same headless Chromium, same throttling. Absolute numbers aren't comparable to the repo's frozen baseline environment — the *deltas* are the finding.

| Metric (median of 3) | `dev` (SPA, `e930309`) | `perf/framework-prerender` | Δ |
|---|---|---|---|
| Performance score | **87** | **70** | −17 |
| FCP | 2,556 ms | 3,644 ms | **+1,088 ms** |
| LCP | 3,298 ms | 4,053 ms | **+755 ms** |
| Speed Index | 2,556 ms | 3,644 ms | +1,088 ms |
| TBT | 138 ms | **0 ms** | −138 (the one win) |
| CLS | 0 | 0 | — |

Variance was tight (prerender runs: 70/70/70; FCP within 6 ms) — this is a real regression, not noise.

**Deterministic byte evidence** (gzip, homepage critical path = HTML + all render-blocking CSS + scripts/preloads in `index.html`):

| | `dev` | prerender branch |
|---|---|---|
| Critical path total | **101,581 B** (hard budget: 101,640) | **≈140,272 B** (+38%) |
| Bootstrap runtime | `rolldown-runtime` 504 B | `entry.client` **57,041 B** |
| React vendor | (inside 91.6 kB entry) | `jsx-runtime` chunk 42,548 B |
| Render-blocking stylesheets | **1** | **4** (root / base / site-layout / home) |
| HTML | 1,147 B | 7,396 B (prerendered content — good) |

## Root cause

1. **The framework runtime swamped the prerender win.** Framework mode adds ~39 kB gzip of client runtime (hydration machinery, route-module protocol: the 57 kB `entry.client` replaces a 0.5 kB bootstrap) and fragments the module graph into ~20 preloaded files. Under Lighthouse's simulated mobile network, that extra transfer contends with the render-blocking CSS, so first paint moves *later* even though the HTML now contains the full content.
2. **One render-blocking stylesheet became four.** Framework mode's per-route CSS splitting emits `root`/`base`/`site-layout`/`home` CSS as four separate render-blocking links. Lighthouse's own audit: `dev` = one blocking resource (603 ms wasted); branch = four (601 + 301 + 301 + 301 ms). The LCP element is identical in both (the hero headline, prerendered and sitting in the HTML!) — but its **render delay grew from 2,845 ms to 3,602 ms**: paint waits on the CSS/bandwidth chain, and the branch made that chain heavier. Prerendering delivered content the browser wasn't allowed to paint any sooner.
3. **TBT fell to 0** because hydration work is smaller/better chunked than the SPA's single 283 kB entry evaluation — the only metric that improved, and not one that was failing before (advisory bound 460 ms; `dev` measured 138 here).

## Why the budget gate didn't catch it

**The measurement harness was never migrated to the new output directory.** The build now writes `build/client/`, but `perf:report`, `assert-budgets`, and the CI audit still read `dist/` — on this checkout `perf:report` happily reported the *stale `dev` build* sitting in `dist/` (`rolldown-runtime … 504 B` — a file the new build doesn't even produce); in CI, `dist/` wouldn't exist at all. The hard 101,640-byte ceiling that exists precisely to stop this (+38 kB) regression was disconnected by the same PR that caused it. The 59-byte-headroom budget would have failed loudly and correctly here — this is the strongest argument yet for that gate, and for making the perf scripts fail hard when the expected build directory is absent rather than reading whatever is lying around.

## Secondary findings on the branch

- `@vitejs/plugin-react` and `reactRouter()` are both active in `vite.config.js` — React Router's docs require *removing* plugin-react when the framework plugin owns the React transform; double-transform is a latent dev-server/fast-refresh breakage.
- `isbot` added to runtime dependencies but never imported (SSR-template residue; meaningless with `ssr: false`).
- `@react-router/node` sits in runtime dependencies though it's only needed at build time for prerendering.
- The 3× duplicated `AssistantDialog` chunks carried over — now duplicated in the server build too.
- Done well, for the record: prerender paths derive fail-closed from the public manifest with a safe-id regex; SEO head parity held (title/OG/JSON-LD/noscript all present in the prerendered HTML); `vercel.json` correctly repoints `outputDirectory` and the SPA fallback.

## Recommendation

The branch pays +38% critical-path bytes and −17 Lighthouse points to get static HTML that the browser cannot paint any earlier, on a stack (`ssr: false`, static hosting) that can never use framework mode's actual payoff (real SSR/streaming). Options, in order of preference:

1. **Don't adopt framework mode now.** If prerendered HTML is the goal (SEO/no-JS content), snapshot the *existing* SPA at build time (e.g. `vite-prerender-plugin`, or a Playwright post-build render of the manifest routes) — keeps the 101 kB path and the intact budget gate, adds the static HTML.
2. **If framework mode is strategically wanted anyway** (future SSR/streaming), the regression must be paid down first: single/inlined critical CSS instead of four blocking links, remove plugin-react, drop `isbot`, demote `@react-router/node`, port the perf harness to `build/client`, re-measure, and *consciously* re-freeze the budgets if the trade (TBT 0, content-without-JS) is judged worth it. As-is, it is not.
3. **Either way:** make `perf:report`/`run-ci-audit` fail hard when the expected output directory is missing, so the budget gate can never again be silently detached by a build-layout change.
