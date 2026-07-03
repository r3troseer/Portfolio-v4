# Profile UI Refresh — Scope & Decisions

Status: implemented (home + project detail) · Branch: `feature/profile-ui-refresh` · see **Outcomes** below

This note records the agreed scope for integrating the matured design prototype into the real
`apps/web` app. It is the durable, committed record of what we keep, cut, defer, and leave to a
future backend. The prototype itself (claude.ai/design project "Portfolio",
`Portfolio (Handoff).dc.html`) is a **reference artifact only** — its bundled HTML is never
pasted into production source; all CSS/JSX here is authored fresh and reads canonical content
through the existing Layer 0 adapters.

## Three directions, and how each is treated

- **Refined** — a *minor, conservative polish* of the current portfolio. Not a separate
  user-selectable variant; small refinements that can ride alongside the Profile work.
- **Profile** — the *primary refreshed experience* and the main rethink/repaint. Same broad
  section structure (`home / about / projects / experience / contact`), with:
  - a repainted hero + tagline ("Evidence-based AI · NLP · Data Pipelines") and an
    "Ask about Pius" ⌘K launcher chip;
  - About/Skills restructured into a **bento capabilities grid** (hero cell + language /
    framework / data / practices cells), fed by `getProfile()` / `getSkills()`;
  - more intentional, differentiated project cards (clear Featured vs. rest treatment);
  - experience presented as cleaner "evidence rows".
- **Evidence** — **not a portfolio variant.** It is the answer surface reached through the
  Cmd/Ctrl+K assistant flow, and in this repo it is a **placeholder shell only**.

## Terminal — out of scope

The prototype's terminal exploration and anything terminal-related are **explicitly excluded**
and ignored entirely.

## Keep (re-authored from the prototype as reference)

- Profile hero repaint + tagline.
- Bento capabilities grid, driven by existing profile/skills adapters.
- Differentiated project cards and more intentional project detail presentation.
- Experience as evidence rows.
- ⌘K / Ctrl+K "Ask about Pius" launcher **as a visual shell only**.
- The existing shared design-token set (the prototype's `:root` tokens already match
  `apps/web/src/index.css`).

## Cut (do not port)

- All Evidence browser-side LLM plumbing: API-key inputs, Anthropic/Gemini model selects,
  answer generation, and retrieval/"Retrieval Ledger" logic.
- Terminal view and anything terminal-related.
- Any Refined / Profile / Evidence **variant-switcher** UI — Profile is simply the primary
  experience; Evidence is never exposed as a selectable variant.
- RAG / API playground surfaces.

## Defer (later slice — still this repo, no backend)

- ~~Surfacing project gallery imagery on the detail page with graceful missing-media fallbacks.~~
  **Done** — implemented in the detail rebuild (media grid + lightbox + per-image `onError`); see
  Outcomes.
- Evidence result **shell** content and ⌘K panel polish.
- The Refined conservative-polish pass.

## Backend-later (future phase — not this repo, not now)

Real assistant answers, retrieval/RAG, evidence grounding, and any model calls belong to the
future Django/DRF + grounded-RAG layer described in `docs/agent/agent-architecture-plan.md`.
**Nothing in this refresh makes backend calls, LLM calls, stores browser-side API keys, or
fabricates RAG answers.** The ⌘K/Evidence surface is a client shell only.

### Worth carrying over from the prototype (concepts, not its browser implementation)

The prototype's Evidence view is a full client-side RAG mock. Its *implementation* (keys +
generation in the browser) is an anti-pattern we cut, but the *concepts* it models are the right
shape for the backend contract. Capture these so the design intent isn't lost:

1. **Ask endpoint / grounded-answer contract.** A single "Ask anything about Pius's work" query
   → grounded answer. The backend owns retrieval + generation; the client only sends the query
   and renders the response.
2. **Pipeline phases the UI already expects.** The mock steps through `idle → retrieving →
   composing → answered | refused`. The backend should expose (ideally stream) these states so
   the shell's loader/skeleton can reflect real progress instead of a fake timer.
3. **Retrieval Ledger.** The prototype shows the retrieved/reranked candidates ("ledger") for
   transparency. Backend should return the ranked/reranked retrieved items (source id + section
   + score) alongside the answer, so the UI can show *what was consulted*.
4. **Grounded citations / Sources.** Answers cite the canonical content they came from
   ("Grounded in …"). Backend returns citations bound to real content ids/sections — no
   uncited claims.
5. **Scope guard + refusal (governance-critical).** The assistant only answers about Pius's
   work and must refuse/deflect out-of-scope, private, or sensitive topics. The backend must
   enforce Layer S at **retrieval time**: never index or retrieve `private` / `blocked` /
   `sensitive` content (ESG/greenwashing, X-RAG, supervisor, research internals). Refusal is a
   first-class response state, not an error.
6. **Role lenses.** `ai.roleLenses` + `markdown/role-lenses/*.md` (backend / ai-nlp / fintech /
   fullstack) let answers be framed per audience. Backend selects/applies the lens; the
   prototype's "niche-tag" chips hint at surfacing the active lens.
7. **Grounding corpus = the public `ai.*` metadata.** `ai.publicSummary`,
   `ai.evidenceSkills`, `ai.safeTalkingPoints` per project + `markdown/about.md` are the
   intended index. Only `public` canonical content is indexed. The Layer 0 files are already
   the single source of truth for both UI and this future RAG index.
8. **Server-side model config.** The prototype's Anthropic/Gemini model selects and API-key
   inputs move **server-side** — keys and model choice live in the backend, never the client.
   Default to the latest Claude models per `docs/agent/agent-architecture-plan.md`.
9. **Query telemetry (privacy-aware).** The mock tracks a `HasQueried` session flag; a real
   backend could log queries for evaluation, subject to privacy rules.

Anti-patterns to explicitly **not** carry to the client: browser-side API keys, client model
selection, and any answer/retrieval generation in the SPA.

## Media note

Per-project detail JSONs reference gallery images such as `/images/eprep-login.png`. Those files
are **not committed to the repo**; `apps/web/vercel.json` rewrites `/images/:path*` to Cloudinary
(`res.cloudinary.com/dyzzyrfdq/...`), so they resolve **in production**, not locally. Image `src`
resolution already lives in `projectsAdapter.js`. **Implemented** (see Outcomes): the detail page
surfaces these in a media grid + lightbox where they resolve, and degrades gracefully (failed
`<img>`s hide via `onError`; the media block hides entirely when all fail) where they don't. No
images are imported into the repo.

## Content & governance boundaries

- Canonical content stays in `apps/web/src/content/public/**`; components read it only through
  the adapters. No portfolio facts are moved into JSX.
- Private/internal ESG, greenwashing, X-RAG, supervisor, and research internals are never
  surfaced. `esg-greenwashing.json` remains present-but-unregistered, as today.

## Rollout order (sliced; stop after each commit for review)

1. `docs(ui): record profile refresh scope` — this note.
2. `refactor(web): prepare refreshed profile layout` — token/style foundation
   (`apps/web/src/styles/profile.css`, small `index.css` token additions, import in `main.jsx`);
   additive and non-visual, current portfolio unchanged.
3. `feat(web): refresh profile experience` — hero repaint + ⌘K launcher chip, bento capabilities
   grid, experience evidence rows.
4. `feat(web): improve project presentation` — differentiated cards + graceful gallery media.
5. `feat(web): add assistant command shell` — ⌘K/Ctrl+K handler + placeholder Evidence panel;
   no input wiring, backend, LLM, or key storage.
6. `chore(web): clean up responsive build` — responsive fixes (768px / 425px) + final build.

Each slice must keep `npm run build` (from `apps/web`) green and must not touch `apps/api`,
`.notes/`, or `CLAUDE.md`.

## Outcomes (2026-07 — what actually shipped)

The Profile direction was built in three passes on `feature/profile-ui-refresh`, verified with
headless-Edge (DevTools Protocol) screenshots against the standalone prototype's Profile view at
each step; `npm run build` stayed green throughout.

**1. Home rebuild (faithful, section by section):**
- Content + adapters enriched (`profile.json` role/headline/intro/availability/facts/bioShort;
  `skills.json` niche + categorized `capabilities`; `experience.json` structured responsibilities;
  per-project curated `card.listTech`). Facts live in JSON, never in JSX.
- Self-hosted **JetBrains Mono**; modular per-section CSS under `styles/profile/`.
- Statement-led hero (gradient-emphasis headline, facts panel), capabilities **bento** (niche tile
  + Languages/Frameworks/Data/Practices), featured project card + numbered "Selected Work" list,
  résumé-style experience with metric pills, centered contact card.
- **⌘K assistant shell** (placeholder only — no backend/LLM/keys/RAG): inline hero launcher that
  animates into a **floating bottom-left** button on scroll; modal styled to the prototype's
  `pf-ask` system. Nav underline is a **scroll-spy** that follows the active section.
- Background banding fixed via a fixed gradient + faint SVG-noise dither. `prefers-reduced-motion`
  guard added.

**2. Project detail rebuild (`pf-pd`):** back link, editorial hero (badge, title, subtitle,
overview, **Focus / Stack / Links** meta — `detail.focus` added per project), metric cards, markdown
content cards, rose→cyan problem/solution, dot timeline, gradient CTA. **Galleries kept and extended**
(prototype had none) with a `pf`-surface lightbox and per-image `onError` that hides failed shots and
drops the whole media block when all fail. Legacy `projectDetail.css` (556 lines), `styles/base.css`,
`App.css`, empty `projectList.css`, and `PageHeader`/`ProjectHeader`/`TechTags`/`MetricItem` removed;
404 restyled in the profile language.

**3. Architecture + bundle:** dead adapter exports removed (`getAllProjectCards`/`getFeaturedProjects`/
`getRestProjects`/`getSkills`); `getEducation` retained deliberately (silo with no UI consumer yet —
see `.notes` layer-0 **D22**). Bundle shrunk **537 KB → 311 KB** main (100 KB gzip) by replacing
`lucide-react/dynamic` with a 16-icon `Icon` registry (emitted JS files **1618 → 3**) and lazy-loading
the detail/404 routes so react-markdown leaves the home bundle.

**Governance held:** featured project is `gfa-exchange`; ESG/greenwashing stays unregistered; **X-RAG
genericized** to "RAG / retrieval" in the niche chips. The one remaining `xRAG` mention is PACTGuard's
own detail markdown — **intentionally left** (Pius's decision). UI never imports `content/public/markdown/`
and never reads project `ai.*` fields, so the Layer-0 seam for the future RAG layer stays clean.

**Deliberately not done / deferred:** terminal, Evidence-as-variant, real assistant/RAG (backend
phase), a dedicated Education section (data ready), and any PR/merge to `master` (Pius's call).

**Commit convention:** history on this branch carries **no `Co-Authored-By`/AI-attribution trailer**
(also recorded in `CLAUDE.md`).
