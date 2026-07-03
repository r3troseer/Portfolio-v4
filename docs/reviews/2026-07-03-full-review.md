# Portfolio-v4 — Consolidated Review

**Date:** 2026-07-03
**Reviewed at:** `feature/profile-ui-refresh` @ `93d6c14` (18 commits ahead of `master`, contains `master`, `npm run build` green)
**Scope:** the product idea, the engineering approach, the architecture of the profile-UI-refresh branch, a head-to-tail read of every source file in the repository (both apps, all content, styles, docs, and config), and a review of the portfolio-related items in the idea backlog (Part VI). Review only — no code changes were made.

---

## Part I — The Idea

### What the project is

A recruiter-facing portfolio that is also a working demonstration of its author's stated niche. The site presents Pius as an engineer who builds *evidence-based AI* — models wrapped in architecture, validation, and guardrails — and its flagship planned feature is exactly that: a grounded "Ask about Pius" assistant that answers only from curated public content, with citations, a retrieval ledger, and refusal as a first-class response state.

### Strengths of the idea

1. **The medium is the message.** The portfolio's headline claim ("I build evidence-based AI") is proven by the portfolio itself. The governance docs, the layered content model, and the eventual grounded assistant are not decoration around the evidence — they *are* the evidence. For the technical evaluators who will actually open the repo, this coherence is worth more than any project card.

2. **Two audiences, both served.** Recruiters skim: they get a statement-led hero, a facts panel, one featured project, and evidence-row experience — all consumable in seconds. Technical evaluators dig: they get the repo, the Layer S enforcement matrix, and the adapter discipline. The design doesn't force either audience through the other's experience.

3. **Content-as-data is the right foundation.** Keeping every portfolio fact in canonical JSON/markdown (Layer 0) and rendering it through adapters means the same corpus feeds the UI today and the RAG index tomorrow. The site and the future bot cannot disagree, because they read the same files. This is the single most consequential design decision in the repo, and it was made first.

4. **Governance designed before the model call.** The visibility/sensitivity taxonomy, the index-gating rule ("only `public` / `public_summary_only` may ever enter the agent index"), and the refusal-first answer contract all exist *before* any LLM is wired in. Critically, scope enforcement is placed at **retrieval time** — private content is never indexed — rather than in prompt wording. That is the correct architecture; "tell the model not to talk about it" is the anti-pattern, and the docs explicitly reject it.

5. **The prototype was treated as a reference, not a source.** The design prototype's browser-side RAG mock (API keys in the client, model selects, fabricated answers) was identified as an anti-pattern and cut, while its *concepts* (pipeline states, retrieval ledger, citations, role lenses) were captured as the future backend contract. That's exactly how a design handoff should be consumed.

### Risks and honest critiques of the idea

1. **Effort vs. audience.** The assistant is substantial infrastructure for an audience (recruiters) that may spend under a minute on the site and never press ⌘K. The mitigation is real — the repo itself is the artifact for the audience that matters most — but it should be an explicit bet: the primary consumer of this architecture is the engineer reading the code, not the visitor clicking the pill.

2. **A visible "coming soon" feature cuts both ways.** The ⌘K launcher is prominent (hero chip + floating pill) and opens a fully disabled panel. To a sympathetic reader it's a roadmap; to a skeptical one it's vaporware on a portfolio that claims to value shipping. Options: hold the launcher until Layer 1 ships, or make the interim shell do honest non-LLM work (e.g. deterministic keyword search over the public corpus with linked results — grounded by construction, no fabrication, no model).

3. **"Is he a good fit for a backend role?" is a spicy suggestion chip.** An AI evaluating its author's fit invites skepticism. The grounding + citation design mitigates this, but the answer contract for fit-style questions should lean heavily on *retrieved evidence* ("here are the backend projects and their metrics") rather than generated judgement.

4. **Public endpoint + paid model calls = abuse surface.** The plan acknowledges this thoroughly (rate limits, token budgets, concurrency caps, fail-closed defaults) and the skeleton already carries the first foundations. This risk is identified and sequenced, not ignored.

5. **Minor tension: "no silent visitor tracking" vs. Vercel Analytics.** The Layer S stance is about the *agent* (no profiling, no identity inference) and Vercel Analytics is anonymous page analytics, so there is no real conflict — but a one-line note in the policy doc distinguishing the two would close the gap.

**Verdict on the idea:** sound, differentiated, and unusually self-consistent. The main discipline required is restraint — the layers beyond 1 (tools, generative UI) are ideas that could consume months for marginal portfolio value, and the plan's own sequencing ("Layers 2/2.5 follow only after Layer 1 is solid") is the right guard.

---

## Part II — The Approach

### Engineering strategy

1. **Sliced, reversible migration.** The history shows the plan being executed as written: content foundation → Vite migration → monorepo relocation → API skeleton → CI → UI refresh, each phase a reviewable slice, each landing before the next begins, with baseline tags (`layer0-vite-baseline`, `monorepo-web-baseline`, `api-skeleton-baseline`) marking known-good states. The refresh branch itself follows its own committed rollout order (scope doc first, then tokens, then sections, each commit buildable).

2. **Docs-first, and the docs are load-bearing.** `docs/ui/profile-ui-refresh.md` records keep/cut/defer decisions *before* the code was written, including explicit anti-patterns not to port. The Layer S enforcement matrix (rule → enforcement location → failure behaviour → phase) is better governance writing than most production teams produce. Crucially, the code matches the docs — every claimed boundary was verified in this review and holds.

3. **Right-sized architecture decisions.**
   - *Monorepo with split deploys*: the static site stays cheap on the edge; the secret-holding runtime lives elsewhere. Correct.
   - *`packages/contracts` deferred until a second consumer exists*: textbook YAGNI, explicitly reasoned.
   - *Django/DRF for the backend*: defensible — it matches the author's professional evidence and DRF's throttling is already earning its keep in the skeleton. One design note: the planned streaming pipeline states (`retrieving → composing → answered`) are awkward in classic DRF; plan for `StreamingHttpResponse`/SSE under ASGI (or a thin async view beside DRF) before Layer 1 hardens the contract.
   - *Deliberate minimalism in the skeleton*: no DB, no admin, no auth — and every no-DB footgun (contrib.auth imports, Railpack's auto-`migrate`) found and documented.

4. **Honest scope boundaries.** The UI refresh explicitly never touches `apps/api`; the assistant shell explicitly contains no backend logic; images are explicitly production-only via the Cloudinary rewrite with the fallback work deferred and scoped. Boundaries are stated, then respected.

### Weaknesses of the approach

1. **Enforcement lags policy, and drift is already observable.** Layer S is "single-author discipline now, validation later" — but this review found exactly the failure mode that validation would catch: the adapter README documents stale shapes, the policy doc cites ESG as `public_summary_only` while the file says `private`, and `skills.json` outgrew its documentation. None of it is dangerous today; all of it argues for pulling the planned schema/consistency checks **earlier** than the contracts phase — even a small CI script validating controlled vocabularies and adapter-shape assumptions would pay for itself now.

2. **No lint, no tests, CI only on `master`.** For a repo whose plan says content violations should "fail the build," there is currently no lint step, no test suite in either app, and feature branches get no CI until PR time. The refresh's "keep `npm run build` green" discipline is real but thin — a build passing is not the same as correctness (several of the bugs in Part IV survive a green build).

3. **Legacy debt was carried, not retired.** The refresh correctly prioritized the new experience, but the legacy detail-page layer (Modal, MetricItem, gallery components) still contains the repo's actual bugs, and a commit titled "remove dead legacy CSS and unused components" left several dead files behind (Part IV, items 9–12).

**Verdict on the approach:** disciplined and well-sequenced; the plan-execute-verify loop is genuinely working. The gap is mechanization — the repo's values (fail-closed, validated, evidence-based) are enforced by authorial care instead of by CI, and the observed doc drift shows care alone won't scale past this phase.

---

## Part III — Architecture Review

### System overview

Monorepo with split deploys: **`apps/web`** (Vite 8 + React 19 SPA → Vercel) and **`apps/api`** (Django 6 + DRF health-only skeleton → Railway), plus `docs/` (agent architecture plan, Layer S policy, UI refresh scope) and one GitHub Actions workflow. Layered design: Layer 0 (canonical content) → adapters → UI today; Layer S as policy plus API foundations; Layers 1/2/2.5 (RAG, tools, guarded generative UI) planned and deliberately absent.

### Frontend (`apps/web`)

- **Entry & routing.** `index.html` carries thorough SEO (Open Graph, Twitter card, JSON-LD Person schema, a noscript fallback with contact details). `main.jsx` loads tokens, self-hosted JetBrains Mono (OFL, four weights, latin subset, `font-display: swap`), profile primitives, and Vercel Analytics. `App.jsx` defines a `Layout` route (Navigation, `<main><Outlet/></main>`, Footer, ParticleEffect, AssistantShell) with routes `/`, `/projects/:id`, and `*` → NotFound. `vercel.json` provides the SPA fallback and the `/images/*` → Cloudinary rewrite (images resolve in production only — documented trade-off).

- **Content layer (Layer 0).** Ten project JSONs + a registry (`index.json`: `id`/`displayOrder`/`featured` only), profile/skills/experience/education/links silos, and AI-facing markdown (`about.md`, four role lenses) with YAML front-matter governance. Every project carries `visibility`/`status`/`sensitivity`/`repo.visibility` plus an `ai.*` block (publicSummary, roleLenses, evidenceSkills, safeTalkingPoints) for the future index. All are `public`/`safe` except `esg-greenwashing` (`private`/`sensitive`, unregistered — unreachable by the adapters, by construction).

- **Adapters.** `projectsAdapter.js` and `profileAdapter.js` are the only modules that read the JSON. Image base-URL resolution lives in the adapter; `getProjectById` returns a legacy-compatible shape so the detail page renders unchanged; the refresh added purpose-built selectors (`getFeaturedProject`, `getProjectListItems`, `getCapabilities`) rather than reshaping data in components. No component imports content directly — verified.

- **Components.** Two generations coexist. The new profile suite (Hero with facts panel, Capabilities bento, FeaturedProject + numbered ProjectList, Experience evidence rows, Contact card, AssistantShell) is clean and consistent. The legacy detail-page suite (PageHeader, ProjectHeader, MetricItem, ContentCard + GalleryItem/Modal/TechTags, ProblemSolutionCard, Timeline, Badge) is noticeably older — stray TODO comments, commented-out imports, and the bugs in Part IV. The AssistantShell is verified inert: disabled input, disabled suggestions, no fetch, no keys, no model code anywhere in the SPA. The hero launcher opens it via a `pf:open-assistant` CustomEvent — reasonable decoupling for components with no shared ancestor state.

- **CSS.** Tokens in `index.css` (additive `--pf-*` layer), shared primitives in `styles/profile/base.css`, per-section files imported by their owning component, all `pf-`-namespaced. `prefers-reduced-motion` collapses animation globally. Legacy `projectDetail.css`/`badge.css` are heavier and contain large commented-out blocks, but function.

### Backend (`apps/api`)

A well-executed "deliberately minimal" skeleton: no DB, no contrib apps, JSON-only DRF, one throttle-exempt `/health/` view served at `/health/` and `/api/health/`. The no-database footguns are all handled (`DEFAULT_AUTHENTICATION_CLASSES: []`, `UNAUTHENTICATED_USER: None`, `TEMPLATES = []`). Config is env-driven and fail-closed (`DEBUG` off by default), with a CORS allowlist, anon throttle (60/min), and 1 MiB body cap as Layer S foundations. The README documents the Railway/Railpack trap where an auto-added `migrate` would crash the DB-less app. uv-managed, Python 3.13 pinned, gunicorn for deploy. Nothing wrong for its declared scope; HSTS/`SECURE_PROXY_SSL_HEADER` hardening can land with Layer 1.

### Docs, CI, hygiene

The three planning docs are excellent and, unusually, accurate to the code. CI builds the web app and runs `manage.py check` on the API — but only on push/PR to `master`. `.gitignore` correctly excludes `.notes/`, `CLAUDE.md`, and env files; committed `uv.lock`/`.python-version` are intentional and documented. The root `README.md` is empty — it undersells a repo whose internal docs are this good.

---

## Part IV — Findings (head-to-tail codebase review)

### Bugs (real, visible today)

1. **Home page double-renders Navigation and ParticleEffect.** `App.jsx` (Layout) and `Home.jsx` both render them: two stacked fixed navs with duplicate scroll listeners and backdrop blurs, and two full-screen canvases each running a 50-particle rAF loop. Pre-dates the refresh branch; highest-impact fix in the repo.
2. **Modal description text is unstyled** — `Modal.jsx` uses class `modal-descriptions`; `projectDetail.css` defines `.modal-description`. Singular/plural mismatch; the rule never applies.
3. **Nested `.metrics-grid`** — `ProjectDetail.jsx` wraps metrics in `.metrics-grid` and `MetricItem.jsx` wraps *each item* in its own `.metrics-grid` again. Layout mostly survives via `auto-fit`, but the DOM is doubled and inner grids re-apply vertical margins.
4. **Footer hardcodes "© 2025"** — it is 2026. Use `new Date().getFullYear()` or move it to content.

### Latent bugs (will bite when a code path activates)

5. `Modal.jsx` reads `data.title` unconditionally while its guard explicitly allows a `children`-only render where `data` is null → TypeError on first children-mode use.
6. `ProjectHeader.jsx` maps link icons to `"bookOpen"`/`"playCircle"`, but `DynamicIcon` requires kebab-case (`"book-open"`, `"play-circle"`). Harmless today (content only uses `github`/`website`); the first `docs` or `demo` link renders no icon.
7. Icon names flow from JSON into `DynamicIcon` with no fallback validation (Hero facts, Capabilities categories) — a content typo silently drops an icon.

### Performance

8. **`lucide-react/dynamic` explodes the build:** 1,620 files in `dist/assets` (one lazy chunk per lucide icon) plus a 549 kB / 165 kB-gzip main chunk. The real icon vocabulary is ~12 names; a static `{ name: Component }` map restores tree-shaking and shrinks the deploy dramatically.

### Dead code & drift

9. Unimported/unused files: `App.css` (CRA leftover), `styles/base.css` (172-line stale duplicate of the `index.css` tokens), `styles/projectList.css` (empty), `pages/ProjectList.jsx` (an empty one-line file whose route is commented out in `App.jsx`).
10. Unused adapter exports: `getAllProjectCards`, `getFeaturedProjects`, `getRestProjects` (no consumer); `getSkills`/`getEducation` have no UI consumer (the latter documented as intentional).
11. `index.css` duplicates the entire nav style block that also lives in `navigation.css` — both load; edits must be made twice or silently diverge.
12. The registry's `featured` flag no longer drives anything — the new Projects section uses `displayOrder` only.
13. `content/adapters/README.md` has drifted: `getSkills()` documented as `{ groups: [...] }` (now `{ niche, categories }`), `getProfile()` missing the new headline/facts/availability fields, responsibilities documented as strings (now `{ t, m }` objects).

### Governance (needs a decision, not code)

14. `layer-s-policy.md` cites ESG/greenwashing as the `public_summary_only` example, but the file says `visibility: "private"` — while the architecture plan separately states truly-private content "must never be committed to the frontend repo at all." The committed content reads as carefully sanitized public-safe prose, so nothing leaks, but the three artifacts disagree. Either the project is publishable at summary level (mark it `public_summary_only`, matching the policy) or it does not belong in the repo. Right now the metadata claims a stricter status than the commit behaviour implies.

### Accessibility

15. Assistant dialog: correct `role="dialog"`/`aria-modal`, Escape and overlay close — but no focus trap, and focus is neither moved in on open nor restored on close. Low stakes while inert; required before it goes live. The global ⌘K also preempts the browser's own shortcut (intended, but worth knowing).
16. `GalleryItem` is a click-only `<div>` — no keyboard access, no role/tabindex; the legacy Modal has no Escape handler and its close button lacks an accessible label.

### Process gaps

17. No linting (no ESLint config or script), no tests in either app, and CI fires only on `master` push/PR — feature branches are unverified until PR time. Given the plan's stated intent that content violations should fail the build, a lint step plus a small content/schema validation script are the natural next CI investments (see Part II).

---

## Part V — Recommended sequence & overall verdict

**Fix order (highest leverage first):**

1. Remove the duplicate `Navigation`/`ParticleEffect` render (finding 1).
2. Replace `DynamicIcon` with a static icon map (finding 8).
3. Dead-code sweep: findings 9–12, plus refresh the adapter README (13).
4. Legacy component fixes: findings 2–6.
5. Decide the ESG metadata question (finding 14).
6. Add ESLint + a feature-branch CI trigger + a minimal content-validation script (finding 17) — this also front-loads the Layer S mechanization the plan already promises.
7. Before Layer 1 ships: assistant focus management (15) and the gallery/modal a11y pass (16).

**Overall verdict.** This is a disciplined, well-documented codebase whose architecture is real rather than aspirational: content/adapter separation holds everywhere, governance boundaries are enforced by structure (the private project is unreachable by construction), and the assistant shell contains none of the anti-patterns its own scope doc bans. The idea is coherent — the portfolio demonstrates the exact skill it advertises — and the approach (sliced migrations, docs-first, fail-closed defaults) is executing as planned. The defects cluster in the pre-refresh legacy layer and in build hygiene; nothing found is a security or data-exposure issue. The one strategic correction: the repo's values are currently enforced by authorial care, and the observed drift shows it's time to let CI carry some of that weight.

---

## Part VI — Idea Backlog Review (portfolio-related items only)

Reviewed against the actual repo state at `feature/profile-ui-refresh` @ `93d6c14`. In scope: backlog §1 (AI-driven portfolio), §2.1 (monorepo/CI), the portfolio-facing slices of §3–§5, §7–§9, §11–§12, §16–§19, §22–§27, §29–§32. Out of scope (ignored per instruction): the ESG/X-RAG research pipeline internals, GDELT/BigQuery work, and product-feature work on OPS, MealSync, EPrep, TicketSage, etc.

The headline: **the backlog is materially out of date — a substantial share of its OPEN/PARTIAL portfolio items are done and shipped**, a few items conflict with decisions already committed in the repo docs, and two items conflict with each other.

### VI.1 Backlog items that are actually DONE (close them)

- **§1.2 CRA → Vite** — done (Vite 8, React 19, engines pinned, CI building). The follow-ups (`?raw`, `import.meta.glob`, markdown-as-source-of-truth) were resolved *differently and better*: strict JSON + static imports for the UI, markdown reserved for the AI layer. Do not retrofit glob imports — the explicit registry in `projectsAdapter.js` is the governance gate, not CRA residue.
- **§1.7 Markdown vs JSON vs JSON-LD** — resolved exactly as the backlog's "likely best direction": JSON for UI metadata, markdown for AI-facing narrative, and JSON-LD already shipped (Person schema in `index.html`), which also partially closes §19's "add JSON-LD later."
- **§1.3 Profile UI refresh** — essentially complete on the branch; every hard constraint verified: no backend/LLM calls, no keys, no fake RAG, no terminal, `apps/api` untouched, build green, `.notes/`/`CLAUDE.md` ignored.
- **§9 Train Booking schema** — exactly 2 contentCards ✓, exactly 2 problemSolutions ✓, stop-ranking and seat-hold are the two problem/solution stories ✓. The **metrics item remains open** (see VI.2, item 6).
- **§12 EPrep marked MVP** — done (`status: "mvp"` + badge).
- **§22/§3 ESG public-safe description** — drafted; `esg-greenwashing.json` is precisely the backlog's "safe angle" wording (research context, evidence alignment, human review; no methods/datasets/scoring internals).
- **§26 Safety guard layer** — designed (Layer S policy + per-file governance fields + registry gating). Vocabulary mismatch remains (VI.2, item 3).
- **§27 ⌘K Evidence flow** — shell shipped (launcher, panel, scroll-aware fab); the *actions* are the open part.
- **§32 portfolio checklist** — already satisfied: schema ✓, content files ✓ (JSON, not md), Evidence-in-⌘K-only ✓, terminal out ✓, ESG summary ✓ (visibility decision pending), PACTGuard case study ✓ (registered, featured #2 in registry), GFA case study ✓, TBS case study ✓. Remaining: skill map, evidence-metadata surfacing, CV action, RAG, UI-intent work.

### VI.2 Conflicts and drift to resolve (backlog ↔ repo ↔ docs)

1. **Layer ordering disagreement.** Backlog: Layer **1.5 AI-selected UI before Layer 2 tools**. `agent-architecture-plan.md`: guarded generative UI is Layer **2.5, after tools**. Real sequencing decision, not naming. Recommendation: the backlog's order is right for a portfolio — evidence UI is the differentiator and exercises the exact component catalog later layers need; CV tools are lower value. Whichever wins, reconcile the plan doc.
2. **ESG visibility three-way inconsistency — the backlog's §3 constraint settles it.** The supervisor external-use restriction is the authoritative input and supports the file's actual `visibility: "private"` — meaning `layer-s-policy.md`'s example ("ESG is `public_summary_only`") is the stale artifact, not the file. Fix the policy doc. And given the plan's own rule that truly restricted material shouldn't be committed at all, decide deliberately that the sanitized text is *publishable prose that happens to be UI-hidden* — otherwise remove the file.
3. **Safety-level vocabulary mismatch.** Backlog: `public / public_summary_only / interview_high_level / private / restricted_do_not_use`. Policy doc: `public / public_summary_only / limited / private / blocked`. Same intent, two vocabularies — the future validation CI needs exactly one.
4. **XpressMart does not exist in the repo.** Backlog §8 wants it as the "strongest backend example" and the terminal idea references `compare xpressmart train-booking` — but there is no `xpressmart.json`, no registry entry, no mention anywhere in the codebase. Either it was the hidden private project (commit `10a50eb`) or it never migrated into Layer 0. Decide: add it or strike it from the backlog.
5. **StudyMate is StudyBud.** The repo's canonical id/title is `studybud`; the backlog consistently says StudyMate. The RAG index will inherit whatever name the content uses — pick one.
6. **Train Booking metrics violate the backlog's own rule.** The backlog says the metrics were "wrong/insignificant and need fixing," and §30 says "do not invent metrics." Current values — `99.9% conflict-free booking reliability`, `<150ms availability check`, `500+ seats` — read as invented precision unless actually backed. For a portfolio whose brand is *evidence*, unverifiable metrics on a case study are a self-inflicted wound. Replace with defensible ones (test counts, query round-trips eliminated, concrete flow properties) or drop them.
7. **`open project xrag` in the deferred terminal command list** contradicts the §3 restriction — X-RAG must not be an openable portfolio object, even in a deferred sketch. Strike it.
8. **§1.4 (merge Profile/Refined; "3 main views + terminal HTML") is superseded** by the newer, better decision already committed in `docs/ui/profile-ui-refresh.md`: one primary experience, Refined as a polish pass, no variant switcher, Evidence never a view. Close as resolved-by-supersession.

### VI.3 Review of the genuinely open ideas

- **§1.5 Functional Evidence (strongest open idea).** Matches the biggest critique in Part I: the disabled ⌘K panel is the branch's weak point. A *deterministic* query→evidence mapping (skill-to-project map from `ai.evidenceSkills`, proof cards, comparison table) needs no model, no backend, no fabrication risk — and converts the "coming soon" shell into a working feature while doubling as the component registry Layers 1.5/2.5 need. Pull it forward ahead of the RAG chatbot. Layer 0 already anticipates it: `evidenceSkills`, `safeTalkingPoints`, and `status` exist and are unconsumed.
- **§1.8 RAG chatbot.** Requirements align with the plan. Make one synergy explicit: the "don't overclaim / distinguish MVP vs complete" behaviour is already encoded in the `status` field — carry it into the index schema so answers can say "prototype, ~70% implemented" (the GFA card already honestly displays this).
- **§1.9/§1.10/§17 Tools and the AI-selected-UI package.** The strategic note is correct: build in-portfolio, extract only after repeated use. Two cautions: the three-package split (`ai-ui-core/react/portfolio`) is premature detail — a sketch, not a plan; and Zod + UI-intent schemas implicitly pull the repo toward TypeScript, which is its own migration for a plain-JSX codebase. Budget for that before committing to the schema approach.
- **§1.11 Bounty / "break my portfolio agent".** Highest-risk item in the backlog. On-brand (adversarial testing of an evidence-grounded system is exactly the niche), but it invites hostile traffic against a paid model endpoint, makes rate-limiting/budget caps load-bearing on day one, and *requires* the logging/retention/deletion apparatus the backlog itself lists — the rules page is a prerequisite, not a follow-up. Run it only after Layer 1 has been quietly stable; scope it to prompt-injection against the same public-only index (nothing secret to leak by construction — that is the point being demonstrated); treat the attack logs as the eval dataset — that is the real payoff.
- **§1.12 Visitor personalization.** The resolution ("declared intent, not hidden profiling") is correct and already half-built: the `roleLenses` vocabulary *is* the intent picker, and the policy doc's deferred `?src=`/`?view=` routing is the same feature. Merge the three fragments into one design when the time comes.
- **§1.13 Cheap model strategy.** Right priorities (content + guardrails before model choice). Note: the backlog leans Gemini-Flash-style while the architecture plan says default to latest Claude models — not a real conflict (every provider has a cheap tier), but it is a decision the backend config phase makes once, server-side, exactly as the scope doc requires.
- **§1.14/§18 No frameworks yet.** Already encoded in the docs, consistent, agreed — the custom runtime *is* the portfolio piece.
- **§19 Recruiter agents.** The pragmatic assessment is right (no universal protocol to target). Cheap near-term win: a public read-only endpoint on `apps/api` serving the Layer 0 public JSON — machine-readable profile with zero model cost, and it forces the index-gating code into existence early.
- **§2.1 Monorepo/CI.** Matches Part IV finding 17: the gap is lint + feature-branch CI + a content-validation script. The backlog says "add tests/linting incrementally when stable" — that point is now; the doc drift found in this review is the evidence that discipline alone has hit its limit.
- **§16 CLAUDE.md/AGENTS.md.** Minor tension: the repo deliberately gitignores `CLAUDE.md` while the backlog wants a general agents file. Both work if the general one is a sanitized, committed `AGENTS.md` and the personal one stays ignored.

### VI.4 Corrected priority order

Backlog §31 is right in spirit but stale — its items 2, 5, 6, 7 (content foundation, ESG description, PACTGuard/GFA/TBS case studies) are already done. The real remaining sequence, folding in the Part IV findings:

1. **Land the refresh** — fix the duplicate Navigation/ParticleEffect render, static icon map, dead-code sweep, TBS metrics honesty pass → merge.
2. **Mechanize Layer S** — one safety vocab, fix the policy-doc ESG example, ESLint + feature-branch CI + content-validation script.
3. **Functional Evidence in ⌘K** (deterministic, no model) — skill-to-project map + proof cards + comparison; backlog ideas 5/23/24 in one slice; kills the "vaporware pill" problem.
4. **Machine-readable profile endpoint** on `apps/api` (cheap; forces index gating into code).
5. **Layer 1 RAG**, with `status`-aware honesty in the answer contract.
6. **AI-selected UI** (backlog's 1.5-before-tools order), reusing the Evidence components.
7. **Tools (CV gen/download)**, then — only if 5–6 are stable — **the bounty challenge**, rules page first.

**Backlog verdict.** The portfolio thinking in the backlog is coherent, and most of its "decisions already made" have genuinely been executed. Its defects are staleness (roughly a third of the portfolio items are done), three unreconciled contradictions (layer ordering, ESG visibility, safety vocabulary), and one item — the Train Booking metrics — that quietly violates the backlog's own integrity rules.
