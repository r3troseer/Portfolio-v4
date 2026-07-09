# Layer roadmap review (pre-Layer 1 main release)

> **Status: register / source of truth for what is live vs deferred.**
> This document does not invent new architecture. It consolidates the current baseline from
> [`agent-architecture-plan.md`](./agent-architecture-plan.md), [`layer-s-policy.md`](./layer-s-policy.md),
> [`layer1-playground.md`](./layer1-playground.md), [`layer1-evidence-index.md`](./layer1-evidence-index.md),
> and [`docs/deployment/layer1-runtime.md`](../deployment/layer1-runtime.md).
>
> **Deferred means parked for a named later slice - not cut.** Items stay intentional until their
> owning layer or Layer 1 sub-slice lands.

---

## 1. Current release baseline

What is live for the Layer 1 main-release candidate:

| Surface | Status |
|---|---|
| Layer 0 public content foundation (`apps/web/src/content/public/` + adapters) | Live |
| `apps/web` Vite SPA on Vercel | Live |
| `apps/api` Django/DRF on Railway | Live |
| `POST /api/retrieve/` lexical evidence ledger | Live |
| `POST /api/answer/` grounded answer (retrieve -> server-side Gemini -> validated citations) | Live |
| Cmd+K modal + `/playground` grounded-answer UI | Live |
| Railway GitHub autodeploy + Wait for CI (`railway.toml` / Dockerfile) | Live |

Explicitly **not** in this release:

- No database
- No vector store / embeddings
- No reranking
- No tools / CV generation
- No chat memory
- No token or progress streaming
- No `packages/contracts` package yet

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
| CORS allowlist, anon rate limit, request-size cap | `apps/api` foundations |
| Server-side secrets / model config only | Railway env; never in `apps/web` |

### Deferred (not cut)

| Item | Belongs with |
|---|---|
| `packages/contracts` schema validation | Contracts (before / with Layer 2.5) |
| Fuller token / input / concurrency budgets | Layer 1 UX hardening / answer-pipeline budgets |
| Prompt / log minimisation enforcement beyond current practice | Layer 1 / backend hardening |
| Tool allowlist | Layer 2 |
| UI-spec validation | Layer 2.5 |

---

## 3. Layer 1 (RAG / evidence / grounded answers)

Scope detail: [`agent-architecture-plan.md`](./agent-architecture-plan.md) Section 4;
UI fidelity: [`layer1-playground.md`](./layer1-playground.md).

### Live

| Capability | Notes |
|---|---|
| Public evidence index | Fail-closed gating over Layer 0 |
| Lexical retrieval | `POST /api/retrieve/` |
| Raw evidence ledger UI | Cmd+K + `/playground` |
| Grounded answer | `POST /api/answer/` |
| Citation validation | Unknown / missing citations fail closed |
| Deployed runtime wiring | Vercel web <-> Railway API |

### Deferred Layer 1 items (placement)

Deferred means the handoff still wants these; they wait on backend (or later UX) slices.
Do not fake them in the browser.

| Deferred item | Placement |
|---|---|
| Citation badge cleanup (if any remaining handoff drift) | Layer 1 answer UI polish - verify against handoff; close if already fixed |
| Reranking | Layer 1 retrieval quality |
| Expanded retrieval ledger (pre/post rerank inspector) | Layer 1 evidence playground |
| Passage / claim detail | Layer 1 evidence inspector |
| Slash commands | Layer 1 assistant UX after answer service |
| Progress streaming (honest phase updates, no fake tokens) | Layer 1 UX hardening |
| Validated token / answer streaming | Later Layer 1 chat / streaming slice |
| Full chat surface / memory | Later chat layer - **not** this release |

Also still out of Layer 1 main release (unchanged from architecture plan): BM25/dense
retrieval, vector DB, browser model/API-key UI, tools, generated UI/`blocks`.

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

| Order | Layer | Role relative to this release |
|---|---|---|
| Done / shipping | Layer 0 | Public content foundation |
| Partial / shipping | Layer S | Policy + CI/index/answer egress live; fuller budgets/contracts/tools later |
| Main release candidate | Layer 1 (core) | Index + retrieve + grounded answer + UI + deploy |
| Next Layer 1 slices | Retrieval quality, evidence playground/inspector, assistant UX, UX hardening | Deferred items in Section 3 |
| Later Layer 1 | Chat / validated streaming | Not this release |
| When second consumer exists | Contracts | Before / with Layer 2.5 |
| After Layer 1 solid | Layer 2 | Allowlisted tools + CV |
| After contracts + Layer 2 path | Layer 2.5 | Guarded generative UI |
| Later | Layer 3 | External agent compatibility |
| Later | Layer 4 | Evals / red-team |

---

## Related docs

- [`agent-architecture-plan.md`](./agent-architecture-plan.md) - target architecture and migration sequence
- [`layer-s-policy.md`](./layer-s-policy.md) - visibility / sensitivity / content boundaries
- [`layer1-evidence-index.md`](./layer1-evidence-index.md) - index + retrieval contract
- [`layer1-playground.md`](./layer1-playground.md) - evidence UI + deferred handoff behaviours
- [`docs/deployment/layer1-runtime.md`](../deployment/layer1-runtime.md) - Vercel / Railway wiring
