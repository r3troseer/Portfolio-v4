# Branch C navigation results

## Outcome

Performance Branch C is rejected for this release. Final Branch A at `4735383` remains the
selected Vite and React Router SPA implementation.

The full Branch C treatment improved delayed-route explanation and route-module failure recovery,
but it did not improve common-case speed. Its final repair also introduced a larger and more
fragmented initial module graph. The user selected Branch A after weighing common-case perceived
speed, exceptional-route resilience, maintenance cost, accessibility, request count, and evidence
maturity without relying only on the fixed byte ceiling.

Audit finding `F-07` is therefore not technically closed by an accepted implementation. Its
unexplained blank-main and failed-route recovery cases remain an explicitly accepted release
residual for unusually delayed or failed lazy-route loads. A smaller PC2-only recovery experiment
from Branch A is deferred until post-release.

Nothing from Branch C is merged into `dev`.

## Candidates

| Candidate | Commit/state | Description | Disposition |
| --- | --- | --- | --- |
| Final Branch A | `4735383` | Existing SPA with route code splitting and no custom transition runtime | Selected |
| SPA PC1 | `7acc645` lineage | 200 ms progress line and 800 ms destination status | Rejected |
| Published SPA PC2 | `ee62a99` | PC1 plus bounded route-module recovery | Rejected |
| Repaired SPA PC2 | Uncommitted `G7-R1` working tree | PC1/PC2 plus retained non-empty main and deferred transition runtime | Rejected and retained locally as evidence |
| Framework PC1/PC2 | `perf/navigation-transition-framework` | Transition treatment on the rejected Framework Mode lineage | Architecture evidence only |
| Next static RSC | `b3b8d95` | Separate static RSC architecture experiment with PC1/PC2 | Rejected architecture evidence |

## Test method

- Production builds only.
- Lighthouse 12.6.1 default simulated mobile.
- Fresh Chrome profile for every run.
- Sequential rotating or alternating candidate order. No concurrent Lighthouse runs.
- Five runs per candidate, reporting raw values, median, and range.
- Deterministic production-output gzip report.
- Chromium and WebKit at 1280x800 and 390x844.
- Cold, warm, prefetched, deliberately delayed, invalid-route, Back, and Forward journeys.
- Real first-request route-module failure followed by one explicit same-URL retry.
- Connected-browser inspection of Home and a representative project route.

Raw local evidence is gitignored under `tools/verify/shots/` and is not published:

- `pc1-four-candidate-lighthouse.json`
- `pc2-four-candidate-lighthouse.json`
- `pc-transition-baseline-spa-a.json`
- `pc-transition-baseline-pc1-spa-standardized-rerun.json`
- `pc-transition-baseline-pc2-spa-final.json`
- `pc-transition-baseline-g7-r1-final.json`
- `g7-repaired-c-vs-a-lighthouse.json`

## PC1 A/B result

The first SPA A/B run compared Branch A with the thresholded progress treatment.

| Metric, five-run median | Branch A | SPA PC1 | Difference |
| --- | ---: | ---: | ---: |
| Performance score | 79 | 81 | +2 |
| LCP | 3,320 ms | 3,291 ms | -29 ms |
| TBT | 332 ms | 344 ms | +12 ms |
| Speed Index | 2,609 ms | 3,003 ms | +394 ms |
| CLS | 0 | 0 | 0 |
| Homepage critical gzip | 101,546 B | 103,744 B | +2,198 B |

PC1 passed its interaction, threshold, focus, bounds, reduced-motion, forced-colors, CLS, and route
checks. It did not demonstrate a common-case performance improvement: score and LCP were within
run variance, TBT was effectively neutral, Speed Index regressed, and the critical graph grew.

The 200 ms and 800 ms thresholds worked as intended:

- below 200 ms: no visible feedback;
- from 200 ms: thin progress treatment;
- from 800 ms: destination-specific polite status;
- settlement: immediate removal with no minimum display duration.

Those thresholds remain valid evidence for a future treatment, but no Branch C feedback treatment
is selected for this release.

## Published PC2 result

PC2 added privacy-safe route-module failure categorization, an actionable recovery screen, retry,
state-aware Back/Home actions, focus, and announcements.

| Metric, five-run median | Branch A | Published SPA PC2 | Difference |
| --- | ---: | ---: | ---: |
| Performance score | 78 | 78 | 0 |
| LCP | 3,317 ms | 3,456 ms | +139 ms |
| TBT | 424 ms | 377 ms | -47 ms |
| Speed Index | 2,610 ms | 2,755 ms | +145 ms |
| CLS | 0 | 0 | 0 |
| Homepage critical gzip | 101,546 B | 104,726 B | +3,180 B |

Independent G7 review found that the published PC2 implementation could still leave `<main>`
empty during delayed lazy-route transitions. Its functional recovery improvement therefore did not
satisfy the non-empty-main contract.

## Repaired PC2 versus Branch A

The final same-session comparison used five alternating pairs after the retained-main and runtime
deferral repair.

### Raw Lighthouse runs

| Run | Candidate | Performance | Accessibility | FCP | LCP | TBT | Speed Index | CLS | Requests |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Branch A | 93 | 100 | 1,816 ms | 2,128 ms | 250.0 ms | 1,896 ms | 0 | 20 |
| 2 | Repaired C | 92 | 100 | 1,707 ms | 2,461 ms | 247.0 ms | 1,914 ms | 0 | 25 |
| 3 | Repaired C | 94 | 100 | 2,180 ms | 2,548 ms | 114.5 ms | 2,180 ms | 0 | 25 |
| 4 | Branch A | 94 | 100 | 1,555 ms | 2,001 ms | 242.0 ms | 1,803 ms | 0 | 20 |
| 5 | Branch A | 95 | 100 | 1,816 ms | 2,086 ms | 190.0 ms | 1,816 ms | 0 | 20 |
| 6 | Repaired C | 93 | 100 | 1,661 ms | 2,528 ms | 211.0 ms | 1,829 ms | 0 | 25 |
| 7 | Repaired C | 93 | 100 | 1,663 ms | 2,546 ms | 227.0 ms | 1,850 ms | 0 | 25 |
| 8 | Branch A | 95 | 100 | 1,509 ms | 2,086 ms | 204.0 ms | 1,762 ms | 0 | 20 |
| 9 | Branch A | 94 | 100 | 1,810 ms | 2,090 ms | 210.0 ms | 1,817 ms | 0 | 20 |
| 10 | Repaired C | 93 | 100 | 1,661 ms | 2,526 ms | 210.0 ms | 1,835 ms | 0 | 25 |

### Aggregate comparison

| Metric | Branch A median (range) | Repaired C median (range) | Interpretation |
| --- | --- | --- | --- |
| Performance | 94 (93-95) | 93 (92-94) | A is one point higher |
| Accessibility | 100 (100-100) | 100 (100-100) | Equal |
| FCP | 1,810 ms (1,509-1,816) | 1,663 ms (1,661-2,180) | C paints something 147 ms earlier at median |
| LCP | 2,086 ms (2,001-2,128) | 2,528 ms (2,461-2,548) | A completes largest content 442 ms earlier; ranges do not overlap |
| TBT | 210 ms (190-250) | 211 ms (114.5-247) | Equal at median |
| Speed Index | 1,816 ms (1,762-1,896) | 1,850 ms (1,829-2,180) | A is 34 ms earlier at median |
| CLS | 0 | 0 | Equal |
| Requests | 20 | 25 | C adds five initial requests |
| Critical gzip | 101,546 B | 104,325 B | C adds 2,779 B |

The FCP, Speed Index, TBT, and score results show that repaired C is not broadly slow. The decisive
common-case difference is LCP: C's best LCP remained slower than A's worst LCP. The extra bytes are
small in isolation, but C also increases initial modulepreloads from two to five and adds initial
request fragmentation.

## Route timing distributions

Each row contains four repaired-C cases: Chromium and WebKit at desktop and mobile. Wall time is
activation to settled destination content.

| Journey | Minimum | Median | Maximum | Blank-main cases | Busy cases |
| --- | ---: | ---: | ---: | ---: | ---: |
| Browser Back | 59 ms | 127 ms | 239 ms | 0/4 | 0/4 |
| Browser Forward | 40 ms | 83 ms | 143 ms | 0/4 | 0/4 |
| Home to invalid route | 387 ms | 475 ms | 593 ms | 0/4 | 4/4 |
| Home to Playground, cold | 378 ms | 492 ms | 519 ms | 0/4 | 4/4 |
| Home to Playground, delayed | 3,394 ms | 3,502 ms | 3,549 ms | 0/4 | 4/4 |
| Home to project, cold | 421 ms | 581 ms | 745 ms | 0/4 | 4/4 |
| Home to project, delayed | 6,112 ms | 6,229 ms | 6,376 ms | 0/4 | 4/4 |
| Home to project, prefetched | 394 ms | 486 ms | 561 ms | 0/4 | 4/4 |
| Home to project, warm | 38 ms | 70 ms | 193 ms | 0/4 | 0/4 |
| Project to Home | 99 ms | 192 ms | 331 ms | 0/4 | 2/4 |

The deliberately delayed project case includes the driver delay on both the route shell and
selected project payload, producing approximately six seconds total. Warm routes remain below the
200 ms visual threshold at median and produce no busy state.

The final repaired matrix passed 40/40 cases with:

- zero blank-main samples;
- zero page errors;
- retained content marked busy and `aria-hidden` while pending;
- correct final URL, title, destination content, and focus;
- Back/Forward parity in both engines and viewports.

## Failure and recovery

A real first request for the ProjectDetail route module was aborted in Chromium at desktop and
mobile viewports.

Observed result:

- `Page unavailable` heading focused;
- privacy-safe `route-module` category;
- no raw failure text;
- site navigation and footer retained;
- `Try again` and state-aware `Back home` actions;
- redundant previous-route action hidden for Home/direct entry;
- one explicit same-URL retry succeeded after the asset became available;
- pending/busy state cleared.

This is Branch C's strongest product improvement.

## Visual and accessibility result

- Lighthouse accessibility: 100 for every Branch A and repaired-C run.
- Connected-browser Home and PACTGuard inspection showed no obvious layout or visual regression.
- Normal fast navigation settled directly without a visible indicator flash.
- Automated reduced-motion, forced-colors, keyboard, focus, mobile bounds, launcher, scroll, and
  transition checks passed in the PC1/PC2 evidence runs.

## Rejected alternatives

### Full SPA PC1/PC2

Rejected because its resilience improvement is paid for by every session through a larger,
more fragmented common path and a custom transition lifecycle spanning navigation, timers,
retained DOM, preload coordination, recovery state, assistant handoffs, Playground citations,
focus, and route settlement.

### Framework Mode

Rejected earlier because its framework runtime and compatibility entry materially increased
critical gzip and regressed LCP/Speed Index despite very low TBT. Adding PC1/PC2 did not reverse
that architecture-level result.

### Next static RSC

Rejected earlier after behavioral parity work because its final critical path and LCP/Speed Index
were materially worse than the SPA candidates and it introduced production dependency advisories.

### Further compression of full repaired C

Not selected. One low-risk cleanup remains visible: an eager initial `spaRouteRecovery` import can
be removed. That cannot reasonably eliminate the full request/LCP difference. More aggressive
compression would increase regression risk in global navigation behavior.

## Product-weighted decision

The release decision weighted:

1. common-case perceived loading;
2. exceptional navigation reliability;
3. maintenance and regression exposure;
4. normal navigation communication;
5. accessibility;
6. network efficiency;
7. evidence maturity.

Branch A wins for this release because every visitor pays the common-path and maintenance cost,
while Branch C's strongest benefit addresses a severe but infrequent stale-asset or failed-chunk
case. The user accepted this reasoning and selected Branch A.

The recommended post-release experiment is PC2-only recovery from Branch A:

- keep bounded route-module failure handling;
- keep safe retry, focus, privacy-safe messaging, and state-aware navigation;
- omit PC1 progress/status timers;
- omit retained-DOM cloning;
- omit the full global transition lifecycle.

## Gate disposition and residual risk

G7 is closed as a user-authorized release-line decision, not as a clean technical pass of the full
Branch C acceptance criteria.

Accepted release residual:

- Branch A may expose an unexplained blank main during an unusually delayed lazy-route load;
- a failed route chunk does not receive Branch C's bounded in-app recovery surface.

Monitoring/trigger boundary:

- reopen PC2-only recovery if deployed browser telemetry, user reports, or reproducible Vercel
  stale-asset behavior shows route-module failures or materially slow route settlement;
- treat any repeatable blank route or unrecoverable case-study navigation as a post-release P1.

No Branch C code, threshold treatment, dependency, route, or deployment change is included in the
release candidate.
