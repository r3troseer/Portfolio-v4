# Agent Architecture Plan

> **Status: living document — target architecture, not yet implemented.**
> This describes where the portfolio agent is going and the order we get there. It does not
> change the current app. Safety, visibility, and content rules live in
> [`layer-s-policy.md`](./layer-s-policy.md); this document references that policy rather than
> repeating it.

The portfolio is phase one of a layered, recruiter-facing assistant (Layers S, 0, 1, 2, 2.5...).
Layer 0 (the canonical public content foundation) is merged and the SPA now builds on Vite. The
next phases add a separate backend, shared contracts, and a grounded RAG assistant. This plan
sets the target shape and the migration sequence so each step stays small and reversible.

---

## 1. Current baseline

- **Frontend:** Vite + React SPA, deployed directly on **Vercel** (`vercel.json` handles the
  Cloudinary `/images/*` rewrite and the SPA fallback).
- **Content (Layer 0):** canonical, file-backed **portfolio content safe to commit publicly**
  under `apps/web/src/content/public/` (per-project JSON + `index.json` registry, profile silos,
  and AI-facing markdown), consumed only through `apps/web/src/content/adapters/`. Everything here is already
  cleared for a public repo; **visibility metadata controls UI rendering and future agent
  indexing**, not whether the file may exist in the repo. Single source of truth; UI and the
  future AI layer share canonical IDs but use **separate adapters**.
- **Policy (Layer S seed):** [`layer-s-policy.md`](./layer-s-policy.md) documents the
  visibility / sensitivity taxonomy and content boundaries. It is **documentation-only** today.
- **Backend:** none yet. There is no server, database, vector store, LLM, or agent tooling.

---

## 2. Target architecture

A **monorepo with split deploys**. The web app keeps shipping exactly as it does now; the
backend is added alongside it and deployed independently.

```
repo-root/
├─ apps/
│  ├─ web/        # the current Vite React SPA — stays on Vercel
│  └─ api/        # Django / DRF service — deployed separately (e.g. api.piusagboola.com)
└─ packages/
   └─ contracts/  # shared schemas: UI specs, content shapes, agent response shapes
```

- **`apps/web`** — the existing SPA, moved in as-is. Still Vite + React, still on Vercel, same
  routes, content, adapters, and analytics. Migration must be a relocation, not a rewrite.
- **`apps/api`** — a **Django / DRF** service added later, **deployed separately** from Vercel
  (Railway / Render / Fly / VPS). Owns the AI/RAG runtime, content indexing, and (eventually)
  tools. The web app calls it over HTTP; they are never co-deployed.
- **`packages/contracts`** — shared, language-agnostic schemas so web and api never drift:
  the **content shape** (already de-facto defined by Layer 0), **agent response schemas**
  (grounded answers + evidence), and the **typed UI-spec schema** (Layer 2.5). Added only when
  a second consumer exists — not before.

The split-deploy boundary is deliberate: the public site stays cheap, fast, and static on the
edge; the agent runtime lives where it can hold secrets, state, and model access safely.

---

## 3. Layer S enforcement roadmap

Layer S today is **intent captured as documentation**. The job of later phases is to turn the
parts that protect real data into **validation and enforcement** in `apps/api` and the build.

**Documentation-only today**
- The `status` / `visibility` / `sensitivity` taxonomy and the content boundaries are written
  down in [`layer-s-policy.md`](./layer-s-policy.md) and followed by single-author discipline.
- Nothing mechanically checks that content respects the rules; nothing strips disallowed
  fields before they could reach an index.

**Should become validation / enforcement later**
- **Schema validation** of canonical content against `packages/contracts` (controlled vocab for
  `status`, `visibility`, `sensitivity`, `roleLenses`) — fail the build on violations.
- **Index gating** in the AI/content adapter: only `public` and `public_summary_only` items may
  enter the agent index, enforced in code, not by convention.
- **Field-level redaction** for `public_summary_only` (summary in, deep detail out) before
  anything is embedded or returned.
- **Egress checks** on agent answers so responses can only cite indexed, approved evidence.

**Visibility / status / sensitivity rules (unchanged, see policy doc)**
- `status` = display label only, **never** a privacy signal.
- `visibility` = agent-index access level.
- `sensitivity` = how carefully wording is handled.
- Privacy lives only in `visibility`, `repo.visibility`, and `sensitivity`.

**Public / public_summary_only / private / blocked boundaries**
- `public` — usable by UI and the agent index.
- `public_summary_only` — only the summary may enter the index; deep detail withheld.
- `private` — never surfaced by the application UI or to the agent index.
- `blocked` — explicitly excluded everywhere.

> **Visibility is an application/indexing control, not a secrecy mechanism for committed files.**
> `private` / `blocked` decide what the UI renders and what the agent may index; they do **not**
> make a committed file secret. The frontend repo is (or will be) public, so anything committed
> is effectively published. **Truly private, confidential, or secret content must never be
> committed to the frontend repo at all — even if it is marked `private` or `blocked` in
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
`apps/api` (and at its edge), and default to **fail-closed** — if a control cannot be evaluated,
the request is rejected rather than allowed.

- **Rate limiting** — per-IP / per-session request caps so the endpoint and model budget can't
  be exhausted.
- **Request size & message length limits** — bound payload and prompt length before processing.
- **Token / output budgets** — cap input and generated tokens per request and per window.
- **Concurrent request limits** — bound in-flight requests per client.
- **CORS allowlist** — only the known web origins may call the API from a browser.
- **Server-side secrets only** — API keys and model credentials live in `apps/api`, never in
  `apps/web` or any committed file.
- **Prompt / log minimisation** — log only what's needed to operate; don't retain raw prompts or
  visitor content beyond what is required, and never log secrets.
- **No silent visitor identification / tracking** — no fingerprinting or profiling; analytics on
  conversation content only with explicit consent.

### Layer S enforcement matrix

Practical view of each rule: where it is enforced, what happens on violation, and when it lands.
"Phase" maps to the migration sequence in §6.

| Rule | Enforcement location | Failure behaviour | Phase |
|---|---|---|---|
| Content schema validation | Build / CI (against `packages/contracts`) | Fail the build; content can't ship | Contracts |
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

## 4. Layer 1 — RAG scope

Layer 1 is a **public portfolio assistant only**. Deliberately small:

- **Indexes only approved public content** — `public` and `public_summary_only` items from
  Layer 0 (and the AI-facing markdown), and nothing else.
- **Answers with grounded evidence** — every answer is backed by retrieved, citable content;
  no ungrounded generation.
- **No tools** — retrieval + answer only; no actions, no web access.
- **No private data** — enforced by the index gate (§3), not by prompt wording.
- **No recruiter identification** — never infer or assert who the visitor is.
- **No user tracking beyond explicit consent** — no silent profiling or analytics on
  conversation content.

This runs in `apps/api`; `apps/web` gets a chat surface that calls it. The answer/evidence
shape is defined in `packages/contracts`.

---

## 5. Layer 2 / 2.5 preview (later, not now)

- **Layer 2 — safe tools:** a small, **allowlisted** set of tools (e.g. CV generation and
  download) with token / tool / request budgets. No arbitrary actions.
- **CV generation / download:** generated server-side in `apps/api`; delivered via
  signed, expiring links.
- **Layer 2.5 — guarded generative UI:** the model may return only **typed UI specs** that
  reference an **approved component set**. It never emits raw HTML, JS, event handlers, or
  arbitrary links.
- **Validation boundary:** `apps/api` validates every UI spec against the
  `packages/contracts` schema; `apps/web` **renders only approved components** and rejects
  anything else.

---

## 6. Migration sequence

Small, ordered, reversible steps. Each step lands before the next begins.

1. **Planning** — this document and the target shape (done in this phase).
2. **Monorepo setup** — introduce `apps/web` by relocating the current SPA unchanged; keep the
   Vercel deploy working. No backend yet.
3. **Backend skeleton** — stand up `apps/api` (Django / DRF) deployed separately; health check
   only, no AI.
4. **Contracts** — extract shared schemas into `packages/contracts` once web + api both consume
   them (content shape first, then agent response shape).
5. **Layer 1 RAG prototype** — index approved public content, return grounded answers, wire the
   web chat surface to the api. No tools, no private data.

Layers 2 / 2.5 follow only after Layer 1 is solid.
