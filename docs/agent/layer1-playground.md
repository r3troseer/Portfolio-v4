# Layer 1: evidence playground (retrieval UI)

The production UI over the Layer 1 retrieval slice, ported from the profile handoff's
**Evidence** view (`.notes/prototypes/profile-handoff` - the `ev-`/`rag-` surface). It surfaces
the **retrieval ledger** for a query: ranked public source entities, shown with readable display
snippets. Grounded answers, reranking, and model calls are backend behaviours that do not exist
yet - see the fidelity map below.

This is the **retrieval-ledger UI** only - not the future **generated-answer/chat surface**
(grounded answers, citations, refusal cards, reranking inspector, model calls). Those depend on
backend behaviours documented below as CONFLICT/deferred.

## Flow (as designed in the handoff)

- **Cmd/Ctrl+K opens the assistant modal - an interactive evidence surface, not a launcher.**
  Submitting a query (or a preset) runs `POST /api/retrieve/` and renders the ranked entities
  **inline in the modal**. `apps/web/src/components/AssistantShell.jsx`.
- **"Open in Playground" is the only path to the full page - the user's choice.** It seeds the
  page per the handoff's `_launchPlayground` states:
  - **STATE 3** - already answered in the modal -> jump straight to the results strip for that
    query (`navigate("/playground", { state: { q } })`).
  - **STATE 2** - a query typed but not run -> pre-fill the hero, do not run
    (`state: { stage }`).
  - **STATE 1** - nothing typed -> empty hero (`navigate("/playground")`).
- **`/playground`** (`apps/web/src/pages/Playground.jsx`) is the full workspace: hero <-> results
  strip, driven by the same retrieval hook as the modal. The current slice shows the retrieval
  ledger only. The page uses full `ev-doc` cards while the modal uses its distinct compact
  `pf-ask-evdoc` cards.
- **Evidence mode is chromeless.** Like the handoff (`.v-evidence nav { display:none }`), the
  `/playground` route drops the shared site nav/footer, particle field, and the "Ask" launcher
  (via a route-aware `Layout` in `App.jsx`). It provides its own chrome: a `< portfolio` hero
  exit, a sticky `portfolio > rag playground` results strip with `new` and About controls, and
  a results-only evidence footer.
- **`POST /api/retrieve/`** = the source-entity retrieval endpoint. Deterministic, model-free
  lexical retrieval. It returns both model context (`text`) and user-facing display fields
  (`entity_id`, `entity_type`, `snippet`). Contract: [`layer1-evidence-index.md`](./layer1-evidence-index.md) and
  [`apps/api/README.md`](../../apps/api/README.md).

> Note: this reverses the original task brief ("Cmd+K should not call retrieval; Enter navigates
> to `/playground?q=`"). Per the handoff and Pius's direction, the modal responds inline and the
> page move is an explicit user choice. Recorded here so the reversal is not mistaken for drift.

## Query privacy (free text never in the URL)

Free-text queries travel via React Router **navigation state** (`location.state.q` / `.stage`)
or the POST body - never the URL - so they stay out of browser history, Vercel edge logs, and
`@vercel/analytics`. Only **whitelisted preset IDs** appear in the URL (`?p=backend-depth`, via
`src/lib/playgroundPresets.js`). The page resolver order: `state.q` (run) -> `?p=` preset (run)
-> `state.stage` (pre-fill hero, no run) -> empty hero.

## Handoff fidelity: ported vs. backend behaviours (conflicts)

Per CLAUDE.md, the handoff is intentional and ported faithfully; anything the prototype hardcodes
in the browser that belongs to the backend is documented here as a **backend behaviour**, not
reproduced client-side. Elements whose full fidelity needs a backend behaviour that does not exist
yet are flagged **CONFLICT** - they are deferred (not cut) until that behaviour lands.

### Ported now (frontend, driven by `/api/retrieve/`)

Production re-authors the handoff's page surface under the **`pf-pg-*`** class namespace
(`playground.css`, `EvidenceResults.jsx`, `Playground.jsx`). Layout values match the handoff
`ev-*` / `rag-*` rules; only the modal keeps handoff `pf-ask-*` class names verbatim.

- Hero + query box + preset chips (`ev-main-hero`, `ev-query*`, `rag-hero-chips` -> `pf-pg-*`).
- Results strip + section label + sticky query (`ev-main-strip`, `ev-seclabel`).
- Results-only footer (the hero intentionally has none) and a retrieval-honest About popover.
- Source entity cards (`ev-doc*`): mono entity id, title, purple entity-type chip, display
  snippet. The `ev-doc` / `pf-ask-evdoc` class names are inherited from the handoff; they are
  not product language.
- Score bars (`ev-score*`) - normalized to the top hit, labelled visual ranking (not confidence).
- Role-lens chips (`niche-tag`), mono tags (`ev-doc-tag`), provenance path.
- Loading skeleton (`ev-skel*`).
- Cmd+K modal inline results + "Open in Playground" (STATE 1/2/3). The modal renders its
  **own** compact entity cards (handoff `pf-ask-evdoc` cards: `entity · id` + a relative-rank score
  **percentage** pill + title + a 3-line-clamped snippet), with a `pf-ask-loading` dot loader,
  a `pf-ask-error` card, and the rich `pf-ask-footcta` when results exist - deliberately distinct
  from the page's `ev-doc` surface (the handoff has two representations; they are not shared).

### Backend behaviours (NOT faked client-side)

- **Grounded answer generation** - `assistant.answer/blocks/citations`, `ev-answer*`, `ev-gen*`,
  `evStream`, the `composing -> answered` phases. **CONFLICT:** the backend is retrieval-only; it
  returns ranked evidence, no generated/cited answer. Needs a Layer 1 answer service (grounded,
  cited, server-side model).
- **Reranking + expanded Retrieval Ledger** - `rag-reveal*` / `rag-insp*` (the pre->post rerank
  inspector; the "Open in Playground" handoff copy promises "scores, reranking"). **CONFLICT:**
  the current ledger is single-pass lexical retrieval over source entities. Needs a backend rerank
  step that exposes pre- and post-rerank candidate sets.
- **Refusal / scope-guard as a response state** - `pf-ask-refusal`, `assistant.refusal`.
  **CONFLICT:** the backend returns evidence or an empty list; there is no refusal object. Needs
  Layer S governance refusal as a first-class response (see `layer-s-policy.md`).
- **Passage / claim detail** - `ev-pd*` (per-entity claims, passages, signals). **CONFLICT:**
  the backend returns summary-level `text` plus a short display `snippet`; `detail.*` never enters
  the index. Needs a passage/claim breakdown behaviour.
- **Model + API-key config** - `ev-modebar`/`ev-modechip`, `ev-keypanel*`, model selects
  (`sk-ant...`, `AIza...`). **Backend-only, do NOT port** - keys and model choice live
  server-side (Layer S). Also hidden in the prototype's own evidence variant
  (`.v-evidence .ev-modebar { display: none }`). This is the explicit browser-side anti-pattern.
- **Slash commands** - `ev-slash*` (`/home`, `/project`, `/recruiter`, `/answer`, `/quote`...).
  The menu is a frontend affordance, but the commands drive canned/generative/navigation
  behaviour; the generative ones depend on the answer service above. Deferred with it.

### Adaptations made to resolve conflicts (flagged, not silent)

Each keeps the exact handoff string recorded so it can be restored when the backing behaviour
lands (never over-promise now).

- **"Open in Playground" subcopy.** Handoff (exact): `See scores, reranking & the evidence
  behind this - grounded data`. Shown now: `See the ranked entities behind this`.
  **Restore the exact string once grounded answers (#1) and reranking (#2) land.**
- **Hero tagline.** Handoff (exact): `query the work - retrieve - compose`. Shown now:
  `query the work - retrieve entities` (dropped "compose": no answer composition yet).
  **Restore "compose"
  when grounded answers (#1) land.**
- **Modal foot note.** Handoff (exact): `Answers are grounded in Pius's portfolio data`. Shown
  now: `Sources grounded in Pius's portfolio` (no generated answers). **Restore when #1 lands.**
- **Entity card linking (not every card is a link).** The handoff's `ev-doc`/`pf-ask-evdoc`
  open a source entity. In retrieval-only reality only **project-backed** entities (`project_id`) have
  a destination: it links to the existing project-detail page (`/projects/:id`). Markdown/profile
  entities have no detail page, so they render as **static cards, not dead `#` links** - on both
  the page and the modal. Wire these to a dedicated passage-detail view when it exists
  (backend behaviour #4).
- **Snippet vs. context.** The API keeps `text` as retrieval/model context, but the UI renders
  `snippet`: short plain text for humans. Raw indexed context should aid grounding; it is not the
  primary user-facing artifact.
- **Preset chips.** Merge: the task's safe preset *set* with the handoff's terse lowercase chip
  *style* (`AI work`, `backend depth`, `fintech experience`, `strongest evidence`,
  `project proof`).
- **Modal score.** Shown as a relative-rank **percentage** (score / top score), per the handoff's
  `pf-ask-evdoc-score` pill - labelled as rank, not confidence.
- **Results footer.** Handoff (exact, with the copyright glyph encoded for ASCII source):
  `composed for your query · &#169; 2025 Pius Agboola`. Shown now:
  `entities retrieved for your query · &copy; [current year] Pius Agboola`. **Restore "composed"
  when grounded answers (#1) land.**
- **About control.** The handoff's results-strip `?` was wired to browser-side model/API-key
  configuration. The production control keeps the visual location but explains the live
  retrieval-only behavior; it never accepts keys or exposes model configuration.
- **Origin-aware project back nav.** A project opened from page evidence says `Back to
  playground` and restores the query and role lens. A project opened from modal evidence says
  `Back to assistant` and restores the modal results on the originating portfolio route. This
  keeps "Open in Playground" as the modal's only path into `/playground`. Both carry free text
  in React Router state, never the URL.

## Configuration

The retrieval client (`apps/web/src/lib/retrievalClient.js`) resolves the API base URL as:
`VITE_API_BASE_URL` -> `http://localhost:8000` in local dev -> same-origin `/api` in production.
Set `VITE_API_BASE_URL` (the Railway API origin) in the Vercel project for the deployed site.
