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

## PA3 checkpoint - defer assistant dialog and answer machinery

### Implementation summary (worker)

| Field | Value |
| --- | --- |
| Atomic unit | PA3.1 |
| Change | Keep AskLauncher, dock flight, shortcut/open listeners, and minimal load/open state eager; move AssistantDialog body, GroundedAnswer, retrieval hook, presets, answer client/validator/Ajv, and modal-only icons behind one idempotent `preloadAssistantDialog` boundary with adaptive idle preload plus intent preload; split modal CSS into `assistant-dialog.css` |
| Expected commit message | `perf(web): defer the assistant dialog` |
| Worker verification | `validate:content` + production `build` only; no Lighthouse / browser / bundle claims |

### Build output (controller-owned)

| Field | Slot |
| --- | --- |
| Report path | `dist/performance/build-report.json` |
| Total assets raw bytes | `1,015,479` (`+16,171` vs PA2) |
| Total assets gzip bytes | `543,795` (`+7,705` vs PA2) |
| Homepage critical-path raw bytes | `326,079` (`-21,218`, `-6.1%` vs PA2) |
| Homepage critical-path gzip bytes | `101,448` (`-5,372`, `-5.0%` vs PA2) |
| Entry JS chunk (file + gzip) | `assets/index-M1qhV3oh.js` - `93,291` gzip bytes (`-4,015`, `-4.1%` vs PA2 entry JS) |
| Entry CSS (file + gzip) | `assets/index--_zarol1.css` - `6,507` gzip bytes (`-1,355`, `-17.2%` vs PA2 entry CSS) |
| Homepage critical JS/CSS inventory | Entry JS, entry CSS, `index.html` (`1,146` gzip bytes), and `assets/rolldown-runtime-CNC7AqOf.js` (`504` gzip bytes) |
| Deferred assistant-dialog chunk inventory | Three bounded retry facade chunks (`1,989` to `1,991` gzip bytes each), shared dialog module (`311`), modal CSS (`2,090`), presets (`3,862`), evidence navigation (`166`), dialog accessibility hook (`641`), and answer validator/Ajv (`36,251`) |
| Homepage critical graph contains dialog / GroundedAnswer / Ajv / presets / answer client? | No. Those implementations are emitted only in deferred assistant/shared chunks; the entry contains module URLs and the minimal loader/open state. |
| Playground route still independently lazy and functional? | Yes. `Playground-RNb_rdKj.js` remains deferred; direct Playground and assistant-to-Playground automated journeys passed against the production build. |
| Delta vs PA2 homepage critical-path gzip | `-5,372` bytes (`-5.0%`) |

### Lighthouse five-run series (controller-owned)

Target URL used: `http://127.0.0.1:5199/` (`LIGHTHOUSE_URL`)

| Run | Performance score | LCP (ms) | CLS | TBT (ms) | Speed Index (ms) | Request count |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 84 | 2,328.11 | 0 | 526 | 2,263.86 | 17 |
| 2 | 87 | 2,292.00 | 0 | 429 | 2,191.74 | 17 |
| 3 | 87 | 2,279.23 | 0 | 430 | 2,168.95 | 17 |
| 4 | 83 | 2,370.28 | 0 | 553.5 | 2,414.06 | 17 |
| 5 | 86 | 2,295.66 | 0 | 454 | 2,165.22 | 17 |

### Aggregates (controller-owned)

| Field | Median | Worst |
| --- | --- | --- |
| Performance score | 86 (PA2: 90) | 83 (PA2: 79) |
| LCP (ms) | 2,295.66 (`+12.29` vs PA2 median) | 2,370.28 (`-179.60` vs PA2 worst) |
| CLS | 0 | 0 |
| TBT (ms) | 454 (`+122` vs PA2 median) | 553.5 (`-130.5` vs PA2 worst) |
| Speed Index (ms) | 2,191.74 (`+213.30` vs PA2 median) | 2,414.06 (`-159.90` vs PA2 worst) |
| Request count | 17 (6 post-LCP assistant requests) | 17 |

### Behaviour / visual (controller- or human-owned)

| Field | Slot |
| --- | --- |
| Launcher DOM/classes/flight/geometry/hover/press/mobile/reduced-motion unchanged | Desktop/mobile dock-flight and reduced-motion drivers passed with zero errors. Human visual comparison remains pending. |
| Cmd/Ctrl+K, click, Escape, overlay close, focus trap/restore, scroll lock | Passed in production Chromium; broad transition journeys also passed in Chromium/WebKit desktop/mobile. |
| Input + resume query preserved while dialog chunk loads | Passed for immediate first intent and assistant-to-Playground/project-return journeys. |
| Chunk-import failure accessible retry (no page reload; distinct from answer failure) | Passed: first boundary request was network-aborted, an alert and focused Retry appeared, Retry made a second request, and the dialog opened without reload/navigation. |
| Preset/typed query, loading, answer, insufficient evidence, refusal, malformed, unavailable, retry, evidence/source links, Open in Playground, resume | Preset/typed answered and navigation/resume journeys passed against the fake API. Existing answer-contract fixtures passed; subjective rendering and the complete status matrix remain human/targeted-review owned. |
| Idle preload skipped on save-data / heavily constrained / hidden; intent-only otherwise | Save-data, missing idle signal, normal visible idle, and intent override passed. Source inspection confirms hidden/2g gates. In all five Lighthouse runs, all 6 assistant requests began after observed LCP. |
| Visible spinner / skeleton / styled loading modal / minimum delay introduced? | No. First intent exposes only the visually hidden accessible `Loading assistant.` status while retaining the launcher geometry. Human flash/feel confirmation remains pending. |

### Measurement note

An initial idle implementation loaded the six deferred assistant resources before the final hero
paint because the browser emits early LCP candidates while the one-second entrance animation is
still running. The accepted implementation waits for finite initial document animations, then two
animation frames and a real idle callback; infinite decorative animation is excluded. Across the
accepted five-run series, observed LCP occurred at 1,498-1,610 ms and the first assistant request at
1,725-1,831 ms, with zero assistant requests before observed LCP. The higher request count is the
intentional post-LCP warm-up, not critical-path competition.

### Out of scope for PA3

- PA4 particle / analytics / Speed Insights / below-the-fold scheduling and later programme units
- Dependency, lockfile, route, canonical content, backend, deployment, CI, or PA1/PA2 baseline edits
- Fabricated performance numbers in this document
