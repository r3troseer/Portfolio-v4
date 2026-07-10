# Layer roadmap review (pre-Layer 1 main release)

> **Status: register / source of truth for what is live vs deferred vs pre-prod.**
> This document does not invent new architecture. It consolidates the current baseline from
> [`agent-architecture-plan.md`](./agent-architecture-plan.md), [`layer-s-policy.md`](./layer-s-policy.md),
> [`layer1-playground.md`](./layer1-playground.md), [`layer1-evidence-index.md`](./layer1-evidence-index.md),
> and [`docs/deployment/layer1-runtime.md`](../deployment/layer1-runtime.md).
>
> **Deferred means parked for a named later slice - not cut.** Pre-prod items are required
> before the Layer 1 main release; they are not optional polish.

---

## 1. Current release baseline

### Live now (dev / shipping baseline)

| Surface | Status |
|---|---|
| Layer 0 public content foundation (`apps/web/src/content/public/` + adapters) | Live |
| `apps/web` Vite SPA on Vercel | Live |
| `apps/api` Django/DRF on Railway | Live |
| `POST /api/retrieve/` single-pass lexical evidence ledger | Live |
| `POST /api/answer/` grounded answer (retrieve -> server-side Gemini -> validated citations) | Live |
| Cmd+K modal + `/playground` grounded-answer UI | Live |
| Railway GitHub autodeploy + Wait for CI (`railway.toml` / Dockerfile) | Live |

**Current retrieval:** single-pass lexical only - **no reranking on dev yet.**

**Pre-prod completion target (before main release):** real backend reranking + the exact
handoff expanded evidence ledger (initial candidates, reranked candidates, selected evidence).
See Section 3A.

### Explicitly not in this release

- No database
- No vector store / embeddings
- No tools / CV generation
- No chat memory
- No token streaming
- No `packages/contracts` package yet

Embeddings, vector DB, and cross-encoder rerankers stay out unless explicitly added later.
Lexical candidate generation + a real backend rerank stage is the pre-prod path - not a
vector-store rewrite.

Split-deploy detail: [`docs/deployment/layer1-runtime.md`](../deployment/layer1-runtime.md).

---

## 2. Layer S (safety / policy / runtime controls)

Policy intent: [`layer-s-policy.md`](./layer-s-policy.md). Enforcement matrix detail:
[`agent-architecture-plan.md`](./agent-architecture-plan.md) Section 3.

### Live

| Control | Where |
|---|---|
| Content validation (`status` / `visibility` / `sensitivity` / registry) | `npm run validate:content` (web CI) |
| Visibility-based index gating | `build_evidence_index --check` + runtime indexer |
| `public_summary_only` redaction | Indexer (summary in, deep detail out) |
| `private` / `blocked` exclusion | Index + UI/registry discipline |
| Grounded-answer citation validation | `POST /api/answer/` fail-closed egress |
| Refusal / insufficient-evidence as first-class states | Server-authored messages; model prose discarded |
| CORS allowlist | `apps/api` foundation |
| Request-size cap | `apps/api` foundation |
| Basic anon rate limiting | Exists as a foundation - **not** sufficient alone for production answer spend |
| Server-side secrets / model config only | Railway env; never in `apps/web` |

### Pre-prod release gates (answer cost / abuse)

`/api/answer/` spends money per allowed request. Basic anon rate limiting is not enough for
production. Before main release:

| Gate | Why |
|---|---|
| Scoped `/api/answer/` throttle | Bound paid answer calls separately from cheap retrieve |
| Proxy-aware throttle identity | Correct client identity behind Vercel / Railway / CDN |
| Worker / cache multiplier decision | Align throttle math with gunicorn workers and cache backend |
| Coarse daily / budget cap or kill switch | Hard stop when spend or volume is wrong |
| External Gemini billing / quota cap | Operational protection outside the app |

### Deferred (not cut)

| Item | Belongs with |
|---|---|
| `packages/contracts` schema validation | Contracts (before / with Layer 2.5) |
| Fuller token / input / concurrency budgets beyond the pre-prod answer gates above | Later Layer 1 / backend hardening |
| Prompt / log minimisation enforcement beyond current practice | Later Layer 1 / backend hardening |
| Tool allowlist | Layer 2 |
| UI-spec validation | Layer 2.5 |

---

## 3. Layer 1 (RAG / evidence / grounded answers)

Scope detail: [`agent-architecture-plan.md`](./agent-architecture-plan.md) Section 4;
UI fidelity: [`layer1-playground.md`](./layer1-playground.md).

### Live (current dev)

| Capability | Notes |
|---|---|
| Public evidence index | Fail-closed gating over Layer 0 |
| Single-pass lexical retrieval | `POST /api/retrieve/` - no rerank stage yet |
| Raw evidence ledger UI | Cmd+K + `/playground` |
| Grounded answer | `POST /api/answer/` |
| Citation validation | Unknown / missing citations fail closed |
| Deployed runtime wiring | Vercel web <-> Railway API |

### A. Pre-prod Layer 1 completion / hardening

Required before the Layer 1 main release. Do not fake backend behaviours in the browser.

| Item | Notes |
|---|---|
| Answer-endpoint cost controls | Section 2 pre-prod gates - release-blocking because each allowed call spends money |
| Safe answer truncation | Validate full model output first, truncate outside citation/highlight spans, then recompute served citation ids. Fail closed if truncation drops every citation marker. |
| Citation badge cleanup | Pre-prod Layer 1 polish: reserve numeric refs for project `displayOrder` only; use semantic refs for non-project evidence. Examples: project -> `01`/`02`/`03` by displayOrder; profile -> `profile`; skills -> `skills`; experience -> `exp`; education -> `edu`; links -> `links`; about -> `about`; `role-lenses/<slug>` -> `<slug>`; fallback -> `doc`/`src`. Retrieval rank must not be used as citation `ref`. |
| Reranking + expanded retrieval ledger | Pre-prod Layer 1 completion: real backend rerank stage, initial candidates, reranked candidates, selected evidence, and exact handoff ledger UI. Pipeline target: query -> lexical candidates -> rerank -> selected evidence -> answer. **Must be backend-backed.** Do not render a pre/post rerank inspector from frontend-only fabricated data. Embeddings / vector DB / cross-encoder remain out of this release unless explicitly added later. |
| Stopword filter | Cheap win: stopword filter in `_tokenize` |
| Retry affordance | Cheap win: retry after transient failures / identical query resubmission |
| SPA route titles | Cheap win: titles for home / playground / project detail / 404 |
| Dockerfile CMD comment cleanup | Cheap win |
| Prod env sanity | CORS / allowed-hosts smoke checks before production |

Cheap wins above are pre-prod polish, not hard blockers on their own; cost controls, safe
truncation, citation refs, and real rerank + ledger are the substantive pre-prod gates.

### B. Post-release deferred Layer 1 / later

Parked after main release - still intentional, not cut:

| Item | Placement |
|---|---|
| Evidence detail / passage inspector | Layer 1 evidence inspector |
| Slash commands | Layer 1 assistant UX after answer service |
| Progress streaming (honest phase updates, no fake tokens) | Later Layer 1 UX |
| Validated token / answer streaming | Later Layer 1 chat / streaming slice |
| Full chat surface / memory | Later chat layer - **not** this release |

Also still out of this release: BM25/dense retrieval, vector DB, browser model/API-key UI,
tools, generated UI/`blocks`.

---

## 4. Contracts (`packages/contracts`)

**Deferred until a second consumer exists.**

Today content checks live in `validate-content.mjs` and retrieval/answer shapes stay API-local.
Shared cross-language schemas are extracted when web + api both need them without drift.

Likely needed **before or with Layer 2.5** (typed UI specs). Content shape and agent response
shapes can land earlier if a second consumer appears first. See architecture plan migration
step 4.

---

## 5. Layer 2 - safe allowlisted tools

Later, after Layer 1 is solid:

- Small **allowlisted** tool set only (no arbitrary actions)
- CV generation / download as the primary example
- **Server-side** generation in `apps/api`
- Delivery via **signed, expiring links**
- Token / tool / request **budgets**

---

## 6. Layer 2.5 - guarded generative UI

- Model may return only **typed UI specs**
- Specs reference an **approved component set**
- **No** raw HTML, JS, event handlers, or arbitrary unsafe links
- `apps/api` validates specs (via contracts); `apps/web` renders approved components only

Depends on Contracts (Section 4).

---

## 7. Layer 3 / Layer 4 (later)

Ordered after Layers 1-2.5 are stable. Preview only - no implementation commitment in this
release:

| Layer | Intent |
|---|---|
| **Layer 3** | Agent-readable profile / external agent compatibility (structured, policy-gated surface for outside agents) |
| **Layer 4** | Bounty / evals / red-team testing (adversarial and quality evaluation of the assistant stack) |

---

## 8. Remaining ordered layers (summary)

| Order | What | Role |
|---|---|---|
| Done / shipping | Layer 0 | Public content foundation |
| Shipping baseline | Layer 1 core | Evidence index, retrieve, grounded answer, UI, deploy (single-pass lexical today) |
| Pre-prod hardening | Layer S + Layer 1 | Answer cost controls, safe truncation, env sanity, citation badges, stopwords, retry, route titles |
| Pre-prod completion | Layer 1 | Real reranking + exact expanded evidence ledger (backend-backed) |
| Post-release Layer 1 | Layer 1 later | Evidence detail / passage inspector, slash commands, streaming / chat work |
| Later | Contracts | When a second consumer exists; before / with Layer 2.5 |
| Later | Layer 2 | Allowlisted tools + CV |
| Later | Layer 2.5 | Guarded generative UI |
| Later | Layer 3 | External agent compatibility |
| Later | Layer 4 | Evals / red-team |

---

## Related docs

- [`agent-architecture-plan.md`](./agent-architecture-plan.md) - target architecture and migration sequence
- [`layer-s-policy.md`](./layer-s-policy.md) - visibility / sensitivity / content boundaries
- [`layer1-evidence-index.md`](./layer1-evidence-index.md) - index + retrieval contract
- [`layer1-playground.md`](./layer1-playground.md) - evidence UI + handoff fidelity map
- [`docs/deployment/layer1-runtime.md`](../deployment/layer1-runtime.md) - Vercel / Railway wiring
