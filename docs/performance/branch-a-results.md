# Branch A results - frontend initial-load programme

Checkpoint results for cumulative branch `perf/frontend-initial-load`. PA1 baseline values
live in `docs/performance/baseline.md` and must not be altered here. Controllers fill every
`CONTROLLER_MEASUREMENT` slot with observed values or an explicit `unverified` marker.
Workers must not invent Lighthouse, bundle, request, browser, or deployment figures.

## PA2 checkpoint - defer full project-detail data

### Implementation summary (worker)

| Field | Value |
| --- | --- |
| Atomic unit | PA2.1 |
| Change | Home consumes generated public-safe `project-manifest.json`; each `/projects/:id` route loads only that project's canonical JSON via generated `project-detail-loaders.js` literal dynamic imports |
| Expected commit message | `perf(web): defer full project detail data` |
| Worker verification | `validate:content` + production `build` only; no Lighthouse / browser claims |

### Build output (controller-owned)

| Field | Slot |
| --- | --- |
| Report path | `dist/performance/build-report.json` |
| Total assets raw bytes | `999,308` (`+5,790` vs PA1) |
| Total assets gzip bytes | `536,090` (`+7,259` vs PA1) |
| Homepage critical-path raw bytes | `347,297` (`-49,231`, `-12.4%` vs PA1) |
| Homepage critical-path gzip bytes | `106,820` (`-14,711`, `-12.1%` vs PA1) |
| Entry JS chunk (file + gzip) | `assets/index-BXEXN5JD.js` - `97,306` gzip bytes (`-14,712`, `-13.1%` vs PA1 entry JS) |
| Entry CSS (file + gzip) | `assets/index-D6zvshqv.css` - `7,862` gzip bytes (unchanged) |
| Homepage critical JS/CSS inventory | Entry JS, entry CSS, `index.html` (`1,148` gzip bytes), and `assets/rolldown-runtime-CNC7AqOf.js` (`504` gzip bytes) |
| Deferred project-detail chunk inventory | Route shell `3,778` gzip bytes plus 9 separate project payload chunks from `1,892` to `3,112` gzip bytes |
| Homepage critical graph contains full project prose? | No. Production entry search found no sampled detail-only prose; all 9 project payloads are separate deferred chunks. |
| Opening one project loads every other project detail? | No. Production-browser request capture loaded exactly the selected project chunk for each of the 9 public routes. |
| Delta vs PA1 homepage critical-path gzip | `-14,711` bytes (`-12.1%`) |

### Lighthouse five-run series (controller-owned)

Target URL used: `http://127.0.0.1:5399/` (`LIGHTHOUSE_URL`)

| Run | Performance score | LCP (ms) | CLS | TBT (ms) | Speed Index (ms) | Request count |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 92 | 2,202.81 | 0 | 301 | 1,936.40 | 11 |
| 2 | 86 | 2,309.30 | 0 | 460 | 2,171.88 | 11 |
| 3 | 79 | 2,549.88 | 0 | 684 | 2,573.96 | 11 |
| 4 | 90 | 2,221.49 | 0 | 332 | 1,978.44 | 11 |
| 5 | 92 | 2,283.37 | 0 | 265 | 1,918.17 | 11 |

### Aggregates (controller-owned)

| Field | Median | Worst |
| --- | --- | --- |
| Performance score | 90 (same as PA1) | 79 (PA1: 86) |
| LCP (ms) | 2,283.37 (`-136.58` vs PA1 median) | 2,549.88 (`+56.79` vs PA1 worst; within 2,600 ms guardrail) |
| CLS | 0 | 0 |
| TBT (ms) | 332 (`+17.5` vs PA1 median) | 684 (PA1: 425; exceeds the 450 ms comparison guardrail) |
| Speed Index (ms) | 1,978.44 (`-245.99` vs PA1 median) | 2,573.96 (`+105.57` vs PA1 worst; within 2,600 ms guardrail) |
| Request count | 11 | 11 |

### Behaviour / visual (controller- or human-owned)

| Field | Slot |
| --- | --- |
| Direct navigation for every public project | Passed in production Chromium for all 9 routes; each requested exactly its matching detail chunk. |
| Invalid project -> NotFound (no temporary NotFound flash on valid ids) | Passed: invalid ID rendered `Page not found` and requested no project chunk; valid routes settled directly to their project heading. |
| Document titles + route destination focus | Route source contract retained; automated title/focus assertions remain unverified in this PA2-specific driver. |
| Evidence-origin return paths | Source contract retained; assistant/playground-origin journeys remain unverified in this PA2-specific driver. |
| Browser Back/Forward without stale project content | Passed for Home -> GFA Exchange -> Back -> Forward; destination content remained correct. |
| Home featured + selected-work appearance unchanged | Structural automation passed (one featured card, four initial rows, no project detail request). Human visual comparison remains unverified. |
| Visible loading UI / skeleton / spinner introduced? | No new loading component or CSS was added. Subjective flash/layout-shift confirmation remains human-owned. |

### Measurement note

The PA2 objective reduced the deterministic homepage critical path by 14,711 gzip bytes and
improved median LCP and Speed Index. The first PA2 checkpoint contained one 696 ms entry-chunk task,
raising worst TBT to 684 ms and the worst performance score to 79. A second clean five-run PA1 then
PA2 comparison reproduced one PA2 outlier (634 ms), so the signal was investigated rather than
ignored.

A Grok High read-only review found no Home execution path through `projectDetailLoader`, React
`use()`, or the generated detail import map. Controller inspection then confirmed the production
entry chunk contains none of the project IDs, canonical project paths, generated-loader name, or
per-project chunk URLs. A balanced 20-run experiment alternated PA1 and PA2 order across 10 pairs:

| Interleaved aggregate | PA1 | PA2 |
| --- | --- | --- |
| Performance score median (min/max) | 86 (82/94) | 88.5 (85/91) |
| LCP median (min/max) | 2,477.19 ms (2,340.15/2,607.27) | 2,283.30 ms (2,210.78/2,342.58) |
| TBT median (min/max) | 443.25 ms (199.19/573.50) | 396.50 ms (293/502.50) |
| TBT over 450 ms | 5/10 | 3/10 |
| TBT over 500 ms | 2/10 | 1/10 |
| Speed Index median | 2,301.39 ms | 2,095.17 ms |
| CLS | 0 | 0 |

The order-balanced evidence reverses the apparent regression: PA2 has the better TBT median, lower
maximum, fewer threshold breaches, better score distribution, and better LCP/Speed Index. The earlier
worst runs were measurement/scheduling variance on the still-large shared entry execution, not a
causal cost of deferred project detail loading. Keep assistant deferral and non-critical scheduling
in PA3/PA4; do not expand PA2 with unrelated execution changes.

### Out of scope for PA2

- PA3 assistant-dialog deferral and later programme units
- Canonical project JSON edits, routes, CSS, dependencies, lockfiles, deployment, backend, CI
- Fabricated performance numbers in this document
