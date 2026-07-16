# Layer 1: evidence playground (answer + retrieval UI)

The production UI over the Layer 1 slice, ported from the profile handoff's **Evidence** view
(`.notes/prototypes/profile-handoff` - the `ev-`/`rag-` surface). Two backend endpoints back it:

- **`POST /api/answer/`** = grounded answer. Runs two-stage retrieval (lexical candidates +
  deterministic rerank), calls a server-side model (Gemini) with the **selected** evidence
  only, validates the output, and returns a cited answer (`answered` /
  `insufficient_evidence` / `refused`) plus the retrieval ledger.
- **`POST /api/retrieve/`** = the raw evidence ledger: the same deterministic, model-free
  two-stage retrieval, returning the selected matches plus the expanded retrieve-to-rerank
  ledger (`initial` / `reranked` / `selected`).

The playground fires **both** per query: `/api/retrieve/`'s real ledger drives the rag-reveal
loader and the retrieval inspector while `/api/answer/` composes; the answer's ledger becomes
authoritative when it arrives. **Reranking + the expanded retrieval ledger are LIVE**
(`deterministic_rerank_v1` - backend-backed, never frontend-fabricated; no embeddings /
vector DB / cross-encoder / LLM rerank). The temporary evidence score-card UI was replaced by
the handoff rag-reveal + retrieval inspector. Passage/claim detail, model/API-key
configuration, and slash commands remain CONFLICT/deferred post-release - see the fidelity
map below. Live / pre-prod / deferred placement: [`roadmap-review.md`](./roadmap-review.md).

## Flow (as designed in the handoff)

- **Cmd/Ctrl+K opens the assistant modal - an interactive answer surface, not a launcher.**
  Submitting a query (or a preset) runs `POST /api/answer/` and renders the grounded answer
  in the modal (`pf-ask-answer` plain text), the evidence ledger (`pf-ask-evdoc`), then a
  Sources row (`pf-ask-cites` title chips). `apps/web/src/components/AssistantShell.jsx`.
- **"Open in Playground" is the only path to the full page - the user's choice.** It seeds the
  page per the handoff's `_launchPlayground` states:
  - **STATE 3** - already answered in the modal -> jump straight to the results strip for that
    query (`navigate("/playground", { state: { q } })`).
  - **STATE 2** - a query typed but not run -> pre-fill the hero, do not run
    (`state: { stage }`).
  - **STATE 1** - nothing typed -> empty hero (`navigate("/playground")`).
- **`/playground`** (`apps/web/src/pages/Playground.jsx`) is the full workspace: hero <-> results
  strip. It runs `useGroundedAnswer` (same hook as the modal) plus `useEvidenceRetrieval`,
  combined by `useRetrievalReveal` into the reveal/inspector phases. Order: `rag-reveal`
  (skeleton while retrieve is in flight, then real ledger rows) -> retrieval inspector pill/panel
  (`retrieve to rerank`, pre/post scores, movement) -> `ev-gen-status` loading -> `gen-prose`
  with inline `gen-cite` chips (`[[evidence_id]]` markup parsed client-side). The modal keeps
  handoff `pf-ask-*` class names verbatim (compact `pf-ask-evdoc` cards); the page re-authors
  `ev-gen-status` / `gen-prose` / `gen-cite` as `pf-pg-gen-*` and `rag-reveal*` / `rag-insp*`
  as `pf-pg-rag-*` (`RagReveal.jsx`, `RetrievalInspector.jsx`).
- **Evidence mode is chromeless.** Like the handoff (`.v-evidence nav { display:none }`), the
  `/playground` route drops the shared site nav/footer, particle field, and the "Ask" launcher
  (via a route-aware `Layout` in `App.jsx`). It provides its own chrome: a `< portfolio` hero
  exit, a sticky `portfolio > rag playground` results strip with `new` and About controls, and
  a results-only evidence footer.
- **`POST /api/retrieve/`** = the source-entity retrieval endpoint. Deterministic, model-free
  two-stage retrieval (lexical candidates + `deterministic_rerank_v1`). It returns model
  context (`text`), user-facing display fields (`entity_id`, `entity_type`, `snippet`), and
  the expanded `ledger` (initial/reranked/selected with ranks, scores, component breakdowns,
  and reasons). Contract: [`layer1-evidence-index.md`](./layer1-evidence-index.md) and
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

### Ported now (frontend, driven by `/api/answer/`)

Production re-authors the handoff page answer surface under **`pf-pg-gen-*`** (`playground.css`,
`GroundedAnswer.jsx`, `renderProse.jsx`). Layout values match handoff `ev-gen-status` /
`gen-prose` / `gen-cite`; only the modal keeps handoff `pf-ask-*` class names verbatim.

- Hero + query box + preset chips (`ev-main-hero`, `ev-query*`, `rag-hero-chips` -> `pf-pg-*`).
- Results strip + sticky query (`ev-main-strip`).
- **Rag-reveal loader** (`rag-reveal*` -> `pf-pg-rag-reveal*`): pulsing-dot header
  (`retrieving · reranking N entities`), title + animated fill bar + mono score rows. Rows are
  the real `/api/retrieve/` ledger's selected evidence (bar widths relative to the top rerank
  score; dim below ~0.72x top, the prototype threshold made relative for integer scores).
  Before retrieve resolves, only neutral shimmer skeleton rows render - titles/scores/ranks
  are **never fabricated**. Collapses to the inspector pill ~1.4s after real rows appear
  (prototype timing; ~0.2s under `prefers-reduced-motion`), while the answer may still be
  composing underneath.
- **Retrieval inspector** (`rag-insp*` -> `pf-pg-rag-*`): pill (layers icon / `retrieval` /
  `N entities` / chevron) opening the `retrieve to rerank` panel with a `k=N` badge and one
  row per reranked candidate - pre (lexical) score, arrow, post (rerank) score, and trend
  (up green / down rose / same dim, with abs delta). `open full ledger` / `show top 5`
  toggles between the selected slice and the whole candidate pool. Row tooltips carry the
  backend `reasons`. Backed by `ledger.reranked`; hidden on refusal (the backend omits the
  ledger there too).
- Page loading: `ev-gen-status` with static `retrieving evidence · composing interface` copy
  (single loader until the full answer payload arrives - **no fake streaming**).
- Page-lead headline (`gen-headline` -> `pf-pg-gen-headline`): an h2 lead statement plus one
  dim supporting line above the prose. **Model-authored, backend-validated** - the answer
  payload's optional `headline` `{title, sub}` (plain text; markup or malformed shapes are
  dropped fail-soft server-side without affecting the answer). Rendered only when the model
  provides one; never fabricated client-side. Modal stays headline-free (handoff parity).
- Page answer: `gen-prose` with `[[evidence_id]]` -> `pf-pg-gen-cite` chips (handoff display
  labels from API `citations[].ref`: `exp`, project `displayOrder`, narrative `01`, role-lens
  slug, else retrieval rank) and `==highlight==` -> `pf-pg-ev-mark` spans.
- Results-only footer and retrieval-honest About popover.
- Cmd+K modal: `pf-ask-loading` ("Retrieving evidence..."), plain `pf-ask-answer` for
  `answered`, compact `pf-ask-evdoc` ledger, then `pf-ask-cites` title chips (Sources after
  ledger). `refused` uses boxed `pf-ask-refusal` (info icon); `insufficient_evidence` uses
  plain `pf-ask-answer` (no callout box). Rich `pf-ask-footcta` when an answer or evidence
  exists. Playground `insufficient_evidence` uses `pf-pg-ev-meta` (mono meta line); playground
  `refused` uses `pf-pg-ev-meta is-refusal`.

### Backend behaviours (NOT faked client-side)

- **Grounded answer generation** - `assistant.answer/blocks/citations`, the
  `composing -> answered` phases. **LIVE:** `POST /api/answer/` retrieves public evidence, calls
  a server-side model (Gemini), validates strict JSON plus handoff prose markup (`[[evidence_id]]`
  markers must match `citation_ids`), and returns a grounded answer with hydrated citations
  (`ref` handoff display labels via `presentation.citation_display_ref`, `score`). Page
  renders inline `gen-cite` chips; modal strips markup for plain `pf-ask-answer` and shows
  title chips in `pf-ask-cites`. Refusal and insufficient-evidence are first-class statuses
  with **server-authored messages** after strict empty non-answer output validation.
  **No fake streaming**
  (single atomic response; no token-by-token UI, no trailing "composing..." loader). No chat memory or `blocks`
  yet. Prompt text: `apps/api/core/layer1/answering/prompts.py`.
- **Reranking + expanded Retrieval Ledger** - `rag-reveal*` / `rag-insp*` (the pre->post rerank
  inspector; the "Open in Playground" handoff copy promises "scores, reranking"). **LIVE:**
  retrieval is now two-stage - lexical candidates (`min(3 * top_k, 20)` pool) then
  `deterministic_rerank_v1` (integer components: capped lexical carry-over, query-term
  coverage, title/tag hits, role-lens, exact/near phrase; `rerank_score` = component sum,
  with per-row `reasons`). Both endpoints return the `ledger`
  (`initial` / `reranked` / `selected`); `matches`/`evidence` are the selected reranked rows
  and the **`score` field now carries the rerank score** (lexical stays visible as
  `lexical_score`). The answer provider sees selected evidence only, and citing an unselected
  initial candidate fails closed. The inspector renders only this backend data. Deterministic
  and model-free - no embeddings, vector DB, cross-encoder, or LLM reranking, and no token
  streaming. Contract: [`apps/api/README.md`](../../apps/api/README.md).
- **Refusal / scope-guard as a response state** - `pf-ask-refusal`, `assistant.refusal`.
  **LIVE (via `/api/answer/`):** `refused` is a first-class answer status with a server-authored
  message and no citations/evidence, rendered as the boxed modal refusal row (`pf-ask-refusal`)
  or playground meta row (`pf-pg-ev-meta is-refusal`). `insufficient_evidence` uses plain answer
  typography (`pf-ask-answer` / `pf-pg-ev-meta`) - not the refusal callout. Governance still
  leans on the index gate (private content never reaches retrieval); the model refusal is a
  scope guard on top, not the privacy boundary.
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
  behind this · grounded data`. **Restored** verbatim in production `pf-ask-footcta`, and
  **now honest**: reranking is live and the playground's retrieval inspector shows the
  scores and movement it promises.
- **Hero tagline.** Handoff (exact): `query the work - retrieve - compose`. **Restored** (as
  `query the work &middot; retrieve &middot; compose`) now that grounded answers (#1) are live.
- **Modal foot note.** Handoff (exact): `Answers are grounded in Pius's portfolio data`.
  **Restored** now that grounded answers (#1) are live.
- **Page evidence surface = inspector + citation chips (score cards replaced).** The interim
  page surface (full `ev-doc`-style score-card list under the answer, `EvidenceResults.jsx` /
  `pf-pg-doc*`) was **removed** when the rag-reveal + retrieval inspector landed: selected
  evidence rows now live in the ledger inspector, and entity navigation happens via the
  answer's citation chips. Project-backed citations link to `/projects/:id`; profile and
  markdown citations use one controlled disclosure at a time with hover preview, button,
  keyboard, touch, Escape, and outside-pointer dismissal. Escape restores the trigger;
  outside pointer focus follows the clicked target. Placement is recalculated when opened or
  focused without a global resize/scroll listener, and open state resets when the answer or
  query changes. The modal keeps its compact `pf-ask-evdoc` cards, where only **project-backed**
  entities (`project_id`) are links - markdown/profile entities render as static cards, not
  dead `#` links. Wire these to a dedicated passage-detail view when it exists (backend
  behaviour #4).
- **Snippet vs. context.** The API keeps `text` as retrieval/model context, but the UI renders
  `snippet`: short plain text for humans. Raw indexed context should aid grounding; it is not the
  primary user-facing artifact.
- **Preset chips.** Merge: the task's safe preset *set* with the handoff's terse lowercase chip
  *style* (`AI work`, `backend depth`, `fintech experience`, `strongest evidence`,
  `project proof`).
- **gen-cite relevance row (`gen-cite-pop-r`).** Handoff shows a rerank-style relevance %.
  Still **omitted deliberately** (popover shows title + snippet only) even though a real
  rerank score now exists - the retrieval inspector is the dedicated score surface, and a
  bare % in the popover would read as confidence. Restore only if a per-citation relevance
  display is explicitly wanted.
- **Modal score.** Shown as a relative-rank **percentage** (score / top score), per the handoff's
  `pf-ask-evdoc-score` pill - labelled as rank, not confidence.
- **Results footer.** Handoff (exact, with the copyright glyph encoded for ASCII source):
  `composed for your query · &#169; 2025 Pius Agboola`. Shown now:
  `composed for your query · &copy; [current year] Pius Agboola`. **"composed" restored** now
  that grounded answers (#1) are live.
- **About control.** The handoff's results-strip `?` was wired to browser-side model/API-key
  configuration. The production control keeps the visual location but explains grounded
  answers plus two-stage retrieval (lexical candidate generation + deterministic reranking,
  with the inspector showing candidate movement; scores explain ordering, not confidence);
  it never accepts keys or exposes model configuration.
- **Origin-aware project back nav.** A project opened from page evidence says `Back to
  playground` and restores the query and role lens. A project opened from modal evidence says
  `Back to assistant` and restores the modal results on the originating portfolio route. This
  keeps "Open in Playground" as the modal's only path into `/playground`. Both carry free text
  in React Router state, never the URL.

## Configuration

The answer client (`apps/web/src/lib/answerClient.js`) and retrieval client
(`apps/web/src/lib/retrievalClient.js`) share helpers in `apps/web/src/lib/apiClient.js` for
API base URL resolution and safe JSON parsing:
`VITE_API_BASE_URL` -> `http://localhost:8000` in local dev. Production builds fail when
`VITE_API_BASE_URL` is missing; set the Railway API origin in the Vercel project. This is public
build configuration, not a secret. Non-JSON / HTML / empty ok bodies become typed `unavailable`
(no React crash from `JSON.parse`). Deploy/runtime wiring:
[`docs/deployment/layer1-runtime.md`](../deployment/layer1-runtime.md).
The playground calls `/api/retrieve/` (rag-reveal + inspector ledger) and `/api/answer/`
(grounded answer + authoritative ledger) per query; the Cmd+K modal stays single-request on
`/api/answer/`.
