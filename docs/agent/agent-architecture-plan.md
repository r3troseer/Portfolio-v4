# Agent Architecture Plan

> **Status: living document - target architecture with partial implementation.**
> Layer 0, the monorepo layout (`apps/web`, `apps/api`), the public evidence index, lexical
> retrieval, and the web retrieval-ledger UI are live. Grounded answers, tools, and
> `packages/contracts` remain future work. Safety, visibility, and content rules live in
> [`layer-s-policy.md`](./layer-s-policy.md); this document references that policy rather than
> repeating it.

The portfolio is phase one of a layered, recruiter-facing assistant (Layers S, 0, 1, 2, 2.5...).
Layer 0 (the canonical public content foundation) is merged and the SPA now builds on Vite.
Later phases add shared contracts and a grounded generated-answer assistant; the monorepo backend
(`apps/api`) and retrieval-ledger UI are partially live today. This plan sets the target shape
sets the target shape and the migration sequence so each step stays small and reversible.

---

## 1. Current baseline

- **Frontend:** Vite + React SPA, deployed directly on **Vercel** (`vercel.json` handles the
  Cloudinary `/images/*` rewrite and the SPA fallback). A live Layer 1 **retrieval-ledger UI**
  (Cmd+K inline retrieval + `/playground`) consumes `POST /api/retrieve/`. The future
  **generated-answer/chat surface** (grounded answers, citations, refusal cards) is not
  implemented yet.
- **Content (Layer 0):** canonical, file-backed **portfolio content safe to commit publicly**
  under `apps/web/src/content/public/` (per-project JSON + `index.json` registry, profile silos,
  and AI-facing markdown), consumed only through `apps/web/src/content/adapters/`. Everything here is already
  cleared for a public repo; **visibility metadata controls UI rendering and future agent
  indexing**, not whether the file may exist in the repo. Single source of truth; UI and the
  future AI layer share canonical IDs but use **separate adapters**.
- **Policy (Layer S seed):** [`layer-s-policy.md`](./layer-s-policy.md) documents the
  visibility / sensitivity taxonomy and content boundaries. Index gating and content validation
  are enforced in CI; full runtime Layer S controls remain future work.
- **Backend (`apps/api`):** Django 6 + DRF, deployed separately (Railway). Health check and
  Layer 1 lexical retrieval (`POST /api/retrieve/`) are live. No database, vector store, LLM,
  grounded-answer pipeline, or agent tooling yet.

---

## 2. Target architecture

A **monorepo with split deploys**. The web app keeps shipping exactly as it does now; the
backend is added alongside it and deployed independently.

```
repo-root/
+- apps/
|  +- web/        # the current Vite React SPA - stays on Vercel
|  +- api/        # Django / DRF service - deployed separately (e.g. api.piusagboola.com)
+- packages/
   +- contracts/  # shared schemas: UI specs, content shapes, agent response shapes
```

- **`apps/web`** - the existing SPA, moved in as-is. Still Vite + React, still on Vercel, same
  routes, content, adapters, and analytics. Migration must be a relocation, not a rewrite.
- **`apps/api`** - Django / DRF, **deployed separately** from Vercel (Railway). Owns the
  evidence index and lexical retrieval (`POST /api/retrieve/`) today; the grounded-answer
  runtime, reranking, and tools land in later slices. The web app calls it over HTTP; they are
  never co-deployed.
- **`packages/contracts`** - shared, language-agnostic schemas so web and api never drift:
  the **content shape** (already de-facto defined by Layer 0), **agent response schemas**
  (grounded answers + evidence), and the **typed UI-spec schema** (Layer 2.5). Added only when
  a second consumer exists - not before.

The split-deploy boundary is deliberate: the public site stays cheap, fast, and static on the
edge; the agent runtime lives where it can hold secrets, state, and model access safely.

---

## 3. Layer S enforcement roadmap

Layer S policy intent lives in [`layer-s-policy.md`](./layer-s-policy.md). Enforcement is
**partial today** - content and index rules run in CI/build; full runtime controls (grounded-
answer egress, refusal, answer-pipeline budgets) remain future work.

**Enforced now (CI, build, retrieval slice)**
- Content validation: `npm run validate:content` in the web CI job (controlled vocab for
  `status`, `visibility`, `sensitivity`, `roleLenses`; registry consistency).
- Index gating (fail-closed): `build_evidence_index --check` in API CI; only `public` /
  `public_summary_only` enters the index at runtime.
- **`public_summary_only` redaction** in the indexer (summary in, deep detail out) - proven by
  test fixtures; no live content uses it yet.
- **`private` / `blocked` exclusion** from the index (and from the UI via adapter/registry
  discipline); unregistered project files never surface.
- Retrieval input limits and fail-closed corpus loading on `POST /api/retrieve/`.
- Runtime foundations: CORS allowlist, anon rate limiting, request-size cap, server-side secrets
  only (see `apps/api/README.md`).

**Still documentation-only or incomplete**
- **`packages/contracts` schema validation** - content checks exist in `validate-content.mjs`;
  shared cross-language contracts are not extracted yet.
- **Grounded-answer egress** - no answer pipeline; retrieval returns ranked entities only.
- **Refusal as a first-class response** - out-of-scope queries return empty matches, not a
  governance refusal object.
- **Answer-pipeline budgets** - token/output limits, concurrent caps, prompt/log minimisation
  beyond retrieval; tool allowlist and UI-spec validation (Layers 2 / 2.5).

**Visibility / status / sensitivity rules (unchanged, see policy doc)**
- `status` = display label only, **never** a privacy signal.
- `visibility` = agent-index access level.
- `sensitivity` = how carefully wording is handled.
- Privacy lives only in `visibility`, `repo.visibility`, and `sensitivity`.

**Public / public_summary_only / private / blocked boundaries**
- `public` - usable by UI and the agent index.
- `public_summary_only` - only the summary may enter the index; deep detail withheld.
- `private` - never surfaced by the application UI or to the agent index.
- `blocked` - explicitly excluded everywhere.

> **Visibility is an application/indexing control, not a secrecy mechanism for committed files.**
> `private` / `blocked` decide what the UI renders and what the agent may index; they do **not**
> make a committed file secret. The frontend repo is (or will be) public, so anything committed
> is effectively published. **Truly private, confidential, or secret content must never be
> committed to the frontend repo at all - even if it is marked `private` or `blocked` in
> metadata.** Such material lives outside this repo (e.g. backend-only stores or private
> infrastructure), not in `apps/web/src/content/`.

**Never exposed, in any layer**
- Secrets / credentials, private-repo internals, and non-public **ESG / X-RAG internals**
  (datasets, model names, prompts, eval metrics, label taxonomies, dissertation methods);
  internal notes and IP-restricted material.

### Runtime / API abuse controls

Layer S is not only about *what* content is exposed but *how* the agent runtime is accessed.
Once `apps/api` exists it is a public HTTP endpoint backed by paid model calls, so it needs
abuse controls in addition to the content rules above. These are runtime concerns, enforced in
`apps/api` (and at its edge), and default to **fail-closed** - if a control cannot be evaluated,
the request is rejected rather than allowed.

- **Rate limiting** - per-IP / per-session request caps so the endpoint and model budget can't
  be exhausted.
- **Request size & message length limits** - bound payload and prompt length before processing.
- **Token / output budgets** - cap input and generated tokens per request and per window.
- **Concurrent request limits** - bound in-flight requests per client.
- **CORS allowlist** - only the known web origins may call the API from a browser.
- **Server-side secrets only** - API keys and model credentials live in `apps/api`, never in
  `apps/web` or any committed file.
- **Prompt / log minimisation** - log only what's needed to operate; don't retain raw prompts or
  visitor content beyond what is required, and never log secrets.
- **No silent visitor identification / tracking** - no fingerprinting or profiling; analytics on
  conversation content only with explicit consent.

### Layer S enforcement matrix

Practical view of each rule: where it is enforced, what happens on violation, and when it lands.
"Phase" maps to the migration sequence in Section 6.

| Rule | Enforcement location | Failure behaviour | Phase |
|---|---|---|---|
| Content schema validation | Build / CI (`validate-content.mjs` today; `packages/contracts` later) | Fail the build; content can't ship | Layer 0 / Contracts |
| Visibility-based index gating | `apps/api` indexer (AI/content adapter) | Item excluded from index; not retrievable | Layer 1 |
| `public_summary_only` redaction | `apps/api` indexer (pre-embed) | Deep detail dropped; summary-only indexed | Layer 1 |
| `private` / `blocked` content exclusion | Build + `apps/api` indexer | Excluded from application rendering and indexing; never returned by the API | Layer 1 |
| Grounded answer requirement | `apps/api` answer pipeline | Drop / refuse answers lacking approved evidence | Layer 1 |
| Rate limiting | `apps/api` edge / middleware | Reject over-limit requests (HTTP 429) | Backend skeleton |
| Request size / message length limits | `apps/api` request validation | Reject oversized requests (HTTP 413 / 400) | Backend skeleton |
| Token / output budget limits | `apps/api` answer pipeline | Truncate or refuse; never exceed budget | Layer 1 |
| Concurrent request limits | `apps/api` edge / middleware | Reject / queue excess; shed load | Backend skeleton |
| CORS allowlist | `apps/api` config | Reject disallowed origins | Backend skeleton |
| Server-side secrets only | `apps/api` config + repo hygiene | No secret in client/repo; deploy/CI blocks | Backend skeleton |
| Prompt / log minimisation | `apps/api` logging | Minimal retention; secrets never logged | Backend skeleton |
| Tool allowlist | `apps/api` tool dispatcher | Reject any non-allowlisted tool call | Layer 2 |
| UI spec validation | `apps/api` (validate) + `apps/web` (render) | Reject invalid spec; render only approved components | Layer 2.5 |
| No silent visitor identification / tracking | `apps/api` + `apps/web` | No profiling; tracking only with consent | Layer 1 |
| Fail-closed defaults | All of the above | On any ambiguous / unevaluable check, deny | All phases |

---

## 4. Layer 1 - RAG scope

> **Progress:** the backend-owned public evidence index (fail-closed gating) and the
> deterministic lexical retrieval endpoint (`POST /api/retrieve/`) are implemented; see
> [`layer1-evidence-index.md`](./layer1-evidence-index.md). The web **retrieval-ledger UI**
> (Cmd+K + `/playground`) and `POST /api/retrieve/` are live. **Grounded answers**, citations,
> refusal cards, reranking, and the future **generated-answer/chat surface** remain deferred.

Layer 1 is a **public portfolio assistant only**. Deliberately small:

- **Indexes only approved public content** - `public` and `public_summary_only` items from
  Layer 0 (and the AI-facing markdown), and nothing else.
- **Answers with grounded evidence** (future target) - every answer backed by retrieved,
  citable content; no ungrounded generation. Not live today; retrieval returns ranked entities
  only.
- **No tools** - retrieval + answer only; no actions, no web access.
- **No private data** - enforced by the index gate (Section 3), not by prompt wording.
- **No recruiter identification** - never infer or assert who the visitor is.
- **No user tracking beyond explicit consent** - no silent profiling or analytics on
  conversation content.

Retrieval runs in `apps/api` today (`POST /api/retrieve/`). A future **generated-answer/chat
surface** in `apps/web` will call a grounded-answer endpoint once it exists. Until
`packages/contracts` is extracted, the retrieval response shape stays **API-local** (see
`apps/api/README.md` and `core/layer1/records.py`).

### Backend behaviours the evidence playground needs (handoff-derived)

The evidence playground ([`layer1-playground.md`](./layer1-playground.md)) ports the profile
handoff's "Evidence" view. Its retrieval surface is live against `POST /api/retrieve/`. The
affordances below are intentional in the handoff but depend on backend behaviours that do not
exist yet - they are **deferred, not cut**, and must be built server-side (never faked in the
browser):

1. **Grounded answers** - a cited, grounded answer for a query (retrieval + server-side model).
   Drives the modal/page answer, citations, and the `composing -> answered` phases. Retrieval-
   only today.
2. **Reranking + retrieval ledger** - a rerank step over the lexical candidates that exposes
   pre- and post-rerank candidate sets, so the UI can show the expanded Retrieval Ledger
   (`rag-reveal` / `rag-insp`) and the "scores, reranking" the handoff promises. Retrieval is
   single-pass lexical over source entities today.
3. **Refusal as a response state** - a first-class Layer S refusal object for out-of-scope /
   sensitive queries (Section 3), rendered as the assistant's refusal card, not an error.
4. **Passage / claim detail** - per-entity passages, claims, and signals behind a result,
   backing a passage-detail view (the evidence cards currently link to the existing project-
   detail page where a `project_id` exists; records without one are intentionally static). The
   index carries summary-level `text` plus a short display `snippet` today.
5. **Slash commands** - the generative/canned slash commands (`/answer`, `/quote`, `/recruiter`
   ...) depend on the grounded-answer behaviour above; the menu itself is a frontend affordance.

Explicitly **backend-only, never client-side** (the handoff hardcodes these in the browser as a
prototype shortcut): model selection and API keys (`ev-keypanel`, model selects). Keys and model
choice live in `apps/api` only.

---

## 5. Layer 2 / 2.5 preview (later, not now)

- **Layer 2 - safe tools:** a small, **allowlisted** set of tools (e.g. CV generation and
  download) with token / tool / request budgets. No arbitrary actions.
- **CV generation / download:** generated server-side in `apps/api`; delivered via
  signed, expiring links.
- **Layer 2.5 - guarded generative UI:** the model may return only **typed UI specs** that
  reference an **approved component set**. It never emits raw HTML, JS, event handlers, or
  arbitrary links.
- **Validation boundary:** `apps/api` validates every UI spec against the
  `packages/contracts` schema; `apps/web` **renders only approved components** and rejects
  anything else.

---

## 6. Migration sequence

Small, ordered, reversible steps. Each step lands before the next begins.

1. **Planning** - this document and the target shape (done in this phase).
2. **Monorepo setup** - introduce `apps/web` by relocating the current SPA unchanged; keep the
   Vercel deploy working. No backend yet.
3. **Backend skeleton** - stand up `apps/api` (Django / DRF) deployed separately; health check
   (done). Lexical retrieval (`POST /api/retrieve/`) and the evidence index are live.
4. **Contracts** - extract shared schemas into `packages/contracts` once web + api both consume
   them (content shape first, then agent response shape). Deferred; retrieval shape is API-local.
5. **Layer 1 RAG prototype** - index approved public content, return grounded answers, wire the
   future generated-answer/chat surface to the api. Lands in slices: the evidence index,
   retrieval endpoint, and retrieval-ledger UI ([`layer1-evidence-index.md`](./layer1-evidence-index.md),
   [`layer1-playground.md`](./layer1-playground.md)) are done; grounded answers remain.

Layers 2 / 2.5 follow only after Layer 1 is solid.
