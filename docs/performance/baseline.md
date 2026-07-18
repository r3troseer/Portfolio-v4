# Frontend initial-load performance baseline

Frozen production baseline for the initial-load performance programme (PA1 measurement
only). Optimization work (PA2+) must not begin from unverified numbers.

## Frozen base

| Field | Value |
| --- | --- |
| Base branch | `dev` |
| Frozen base SHA | `44776a9a1638a24347bca089730f1cdf3bb174d5` |
| Surface under test | Homepage `/` initial load |
| Measurement owner | Codex controller (factual slots below) |

## Methodology

1. Install web dependencies from the approved manifest/lockfile on the frozen base.
2. Production build with the real `VITE_API_BASE_URL` guard satisfied (`npm run build`).
3. Deterministic build-output report: `npm run perf:report` -> `dist/performance/build-report.json`.
4. Bundle composition artifact (uncommitted): `npm run build:analyze` ->
   `dist/performance/bundle-analysis.html`.
5. Standalone Lighthouse against an explicit target only:
   - require `LIGHTHOUSE_URL` (no silent localhost/production default)
   - `npm run perf:lighthouse`
   - exactly five runs
   - JSON, HTML, and aggregate output under ignored `dist/performance/lighthouse/`
6. Record medians and worst values across the five runs. Do not invent, estimate, or
   copy unverified figures into this document.

## Required result fields

Controller fills every `CONTROLLER_MEASUREMENT` slot with observed values or an explicit
`unverified` marker. Empty/placeholder text is not a measured result.

### Build output (controller-owned)

| Field | Slot |
| --- | --- |
| Report path | `dist/performance/build-report.json` |
| Total assets raw bytes | `993,518` |
| Total assets gzip bytes | `528,831` |
| Homepage critical-path raw bytes | `396,528` |
| Homepage critical-path gzip bytes | `121,531` |
| Entry JS chunk (file + gzip) | `assets/index-wJM7irfB.js` - `112,018` gzip bytes |
| Entry CSS (file + gzip) | `assets/index-D6zvshqv.css` - `7,862` gzip bytes |
| Homepage critical JS/CSS inventory | Entry JS, entry CSS, `index.html` (`1,147` gzip bytes), and `assets/rolldown-runtime-CNC7AqOf.js` (`504` gzip bytes) |
| Deferred/async chunk inventory | Answer validator `36,251`; Playground `4,290`; ProjectDetail `3,155`; NotFound `478` gzip bytes |
| Bundle analysis artifact | `dist/performance/bundle-analysis.html` (CI artifact `web-bundle-analysis`) |

### Lighthouse five-run series (controller-owned)

Target URL used: `http://127.0.0.1:5399/` (`LIGHTHOUSE_URL`)

| Run | Performance score | LCP (ms) | CLS | TBT (ms) | Speed Index (ms) | Request count |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 91 | 2,401.93 | 0 | 304 | 2,155.57 | 11 |
| 2 | 86 | 2,493.09 | 0 | 425 | 2,468.39 | 11 |
| 3 | 92 | 2,361.62 | 0 | 256 | 2,035.11 | 11 |
| 4 | 90 | 2,419.95 | 0 | 314.5 | 2,236.56 | 11 |
| 5 | 88 | 2,436.50 | 0 | 367 | 2,224.43 | 11 |

### Aggregates (controller-owned)

| Field | Median | Worst |
| --- | --- | --- |
| Performance score | 90 | 86 (minimum) |
| LCP (ms) | 2,419.95 | 2,493.09 |
| CLS | 0 | 0 |
| TBT (ms) | 314.5 | 425 |
| Speed Index (ms) | 2,224.43 | 2,468.39 |
| Request count | 11 | 11 |

### Qualitative / attribution evidence (controller-owned)

| Field | Slot |
| --- | --- |
| Request inventory (critical vs third-party) | 11 requests: 10 localhost plus one inline data URI; 4 scripts, 2 fonts, 1 document, 1 stylesheet, 1 manifest, 1 image, and 1 other; no third-party network origin |
| LCP element | `h1.pf-hero-headline`; representative run 4 attributes 1,965.30 ms (81%) of LCP to render delay |
| CLS source | All five runs measured 0; representative run 4 reported no layout-shift items |
| Waterfall evidence reference | Ignored `dist/performance/lighthouse/run-01` through `run-05` JSON/HTML reports; run 4 is the representative median-LCP report |
| Browser / environment notes | Windows host, Headless Chrome 150, Lighthouse 12.6.1, simulated mobile 412x823, 4x CPU slowdown, 150 ms RTT, local production Vite preview |

## Initial measurement budgets

These rounded PA1 guardrails are for comparing PA2-PA5 checkpoints, not CI enforcement. They add a
small noise allowance above the observed worst run while still detecting a material regression.
PA6 will replace them with frozen post-optimization ceilings and enforce those values in CI.

| Metric | Initial guardrail |
| --- | --- |
| Performance score | at least 85 |
| LCP | at most 2,600 ms |
| CLS | at most 0.02 |
| TBT | at most 450 ms |
| Speed Index | at most 2,600 ms |
| Requests | at most 12 |
| Homepage critical-path gzip | at most 128,000 bytes |

## Out of scope for this baseline document

- PA2-PA6 optimizations, route or UI changes, asset compression policy changes, and any
  fabricated metric values.
- Committing generated `dist/performance/*` outputs.

## Lighthouse tooling decision

PA1 uses exact `lighthouse@12.6.1` with the repository-owned five-run wrapper instead of
`@lhci/cli`. An isolated npm audit reported zero advisories for this Lighthouse version, while
current and older LHCI releases retain vulnerable legacy `tmp`, `uuid`, and `inquirer`
dependencies. The wrapper supplies only the required collection, local reports, and median/worst
aggregation. Budget enforcement remains PA6 work after this baseline is frozen.

Revisit LHCI or another managed service if the programme later requires a historical performance
dashboard, centralized report uploads, or cross-branch trend storage. Any revisit requires a fresh
dependency/security review and explicit approval before enabling external uploads.
