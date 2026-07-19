# Branch B results - Framework Mode and static prerendering

Final experimental checkpoint for cumulative branch `perf/framework-prerender`.
Branch B is complete as an evidence-bearing experiment, but it is not selected for this release.
The unchanged Branch A hard ceiling remains authoritative.

## Implemented architecture

- React Router Framework Mode with `ssr: false` and route-specific static prerendering.
- Static output under `build/client`, with Vercel serving prerendered routes before the SPA fallback.
- Generated public project paths and route data; Django remains the only runtime backend.
- A hydration repair keeps route content visible in the initial document while preserving the
  deferred Assistant mount signal.
- Route-specific canonical, Open Graph, Twitter, and descriptive metadata.
- Project and Playground payloads prefetch only after matching hover/focus intent on capable
  connections; Save-Data suppresses optional project prefetch.

## G6 evidence matrix

| Requirement | Result | Evidence |
| --- | --- | --- |
| Route-specific HTML | Pass | Home, Playground, and all 9 public projects were emitted as route-specific HTML. |
| Direct navigation and SPA fallback | Pass locally | Home, project, Playground, and invalid-route direct loads hydrated with one `main` and no page errors. |
| Route metadata | Pass | Raw output has exactly one title, description, canonical, Open Graph title/URL, and Twitter title per Home, Playground, and project route. The SPA fallback uses Home metadata; hydrated NotFound removes the fallback canonical and uses NotFound metadata. |
| Hydration stability | Pass locally | Chromium and WebKit, desktop and mobile, 3 direct-load runs per route produced no page errors. The older matrix reports Playground only because that surface intentionally has no `h1`. |
| FE-A focus and route behavior | Pass from the repaired Framework matrix | Home/project/NotFound route behavior and existing focus ownership remained intact; PB4 adds no CSS or visible treatment. |
| Intent prefetch boundary | Pass | Initial Home loaded no project or Playground payload. Project intent loaded only `/projects/pactguard.data` and its route chunk; Assistant CTA intent loaded only the Playground route chunk. Save-Data loaded neither project payload. |
| Production build and content validation | Pass | Content validation, production build, diff check, generated head inspection, and PB4 targeted browser checks passed. |
| Preview deployment after final PB4 | Unverified | PB4 and the preceding local repairs have not been published. Earlier PB3 preview evidence does not cover the final local branch. |
| Branch A hard performance ceiling | Fail | Home critical-path gzip is `140,341` bytes against the unchanged `101,640` byte maximum. |

## Final five-run production audit

The existing Branch A budget and Lighthouse configuration was applied unchanged. The local audit
owned and cleaned preview port `5398`, checked 11 known paths, and completed five Lighthouse runs.

| Measurement | Branch B result | Branch A limit | Classification |
| --- | ---: | ---: | --- |
| Performance score | median `93`, worst `93` | median minimum `87` | Advisory pass |
| Accessibility | median `100`, worst `100` | every run minimum `100` | Hard pass |
| LCP | median `2,575.04 ms`, worst `2,577.29 ms` | median maximum `2,200 ms` | Advisory warning |
| CLS | median `0`, worst `0` | every run maximum `0.01` | Hard pass |
| TBT | median `1 ms`, worst `7 ms` | median maximum `460 ms` | Advisory pass |
| Speed Index | median `3,520.87 ms`, worst `3,566.22 ms` | median maximum `2,275 ms` | Advisory warning |
| Request count | median `36`, worst `36` | no hard ceiling | Recorded |
| Home critical gzip | `140,341 bytes` | maximum `101,640 bytes` | Hard fail (`+38,701`, `+38.1%`) |
| Total JavaScript gzip | `183,946 bytes` | maximum `175,000 bytes` | Advisory warning |
| Project route shell gzip | `3,574 bytes` | maximum `4,500 bytes` | Advisory pass |

The budget checker initially stopped before classification because it recognized only the SPA-era
`ProjectDetail-*` chunk name. A narrow compatibility repair recognizes both that name and Framework
Mode's `project-detail-*` name; its fixture proves both shapes resolve to the same measurement.

## Gate decision

G6 is a no-go for release integration. The branch provides useful route-specific HTML, metadata,
very low TBT, and correct intent prefetch, but breaches the deterministic Home byte ceiling and is
materially worse for LCP and Speed Index. The missing final Vercel preview is also marked unverified
rather than inferred from earlier PB3 evidence. Do not merge this branch into the release lineage
without an explicit later decision to revisit the architecture or its budgets.
