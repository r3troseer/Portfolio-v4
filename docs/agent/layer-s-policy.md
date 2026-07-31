# Layer S: Safety, Policy & Visibility (Seed)

> **Status: living document.** This is a Layer S *seed* created alongside Layer 0
> (canonical content foundation). Most rules below are documented intent. **Partial
> enforcement** is live: content validation (`validate:content`) and the API evidence-index
> gate (`build_evidence_index --check`) run in CI. Full runtime enforcement (grounded-answer
> egress, refusal, abuse controls beyond retrieval input caps) arrives with later Layer 1-2 slices.

## 1. Visibility rules (active now)

Every canonical content item carries three **independent** signals:

| Field | Meaning | Notes |
|---|---|---|
| `status` | Display/cosmetic label only | e.g. `live`, `mvp`, `prototype`, `case-study`, `archived`, `honourable-mention`, `in-progress`. **Never** a privacy signal. |
| `visibility` | Agent-index access level | `public`, `public_summary_only`, `limited`, `private`, `blocked`. |
| `sensitivity` | How carefully wording must be handled | e.g. `safe`, `sensitive`. |

Privacy lives **only** in `visibility`, `repo.visibility`, and `sensitivity`, not in `status`.

Visibility levels:
- **`public`**: fully usable by the UI and (later) the agent index.
- **`public_summary_only`**: only the summary may enter the future agent index; deep detail
  is withheld. Used for IP-sensitive work that can be described at a high level.
- **`limited`**: usable in narrow, explicitly-approved contexts only.
- **`private`**: never surfaced publicly or to the agent.
- **`blocked`**: explicitly excluded everywhere.

Examples:
- A project with a private source repo stays a normal **public** card but sets
  `repo.visibility: "private"` and shows no repo link.
- The ESG/greenwashing research is `visibility: "private"` + `sensitivity: "sensitive"`:
  kept out of the UI (present-but-unregistered in the projects registry) and excluded from
  the future agent index; only sanitized, high-level prose lives in the repo.
- No project currently uses `public_summary_only`; it is reserved for IP-sensitive work that
  may later be described at summary level only (summary in, deep detail withheld).

**Agent-index rule:** only `public` and `public_summary_only` content may ever enter the
future agent/RAG index.

## 2. Content boundaries (active now)

The following must **never** enter Layer 0 content:
- Secrets / credentials of any kind.
- Private-repo internals.
- Confidential research internals (ESG/greenwashing internals, X-RAG internals).
- Internal notes, strategy notes, supervisor/IP-restricted material.
- Chat-derived personality analysis.

UI content and AI content may **share canonical IDs** but must be consumed through
**separate adapters** (a UI adapter today; an AI/RAG adapter later). No single adapter
serves both concerns.

**UI vs AI prose:** structured JSON (e.g. `profile.json` bio) is the UI source of truth.
The Markdown under `apps/web/src/content/public/markdown/` (`about.md`, `role-lenses/*.md`) is the
expanded AI-facing prose for the future AI/RAG layer and is not imported by the SPA UI. The
two must be kept consistent (single-author discipline now; a derive-or-check step later).

**Markdown front matter:** each `.md` file carries YAML front matter so it has the same
machine-readable governance as the JSON content. Fields: `title`, `type` (`about` |
`role-lens`), `roleLens` (controlled vocab, role-lenses only), `visibility`, `sensitivity`,
and optional `source` (provenance / UI-truth link). The future AI adapter reads this to apply
the index rule (only `public` / `public_summary_only` may enter the agent index). Dates are
intentionally omitted; git is the record of when.

## 3. Deferred: deployment / architecture (not implemented now)

- The frontend remains deployed directly on **Vercel**.
- The future AI/backend runtime will be a **separate Django/DRF service**, likely hosted on
  Railway / Render / Fly / a VPS, under something like `api.piusagboola.com`.
- Layer 0 is file-backed inside the frontend repo *for this phase only*. The
  `apps/web/src/content/public/...` structure is laid out so it can move later to
  `backend/content/public` without reshaping the data.

## 4. Deferred: integrity / versioning (not implemented now)

- Content version metadata on canonical files.
- SHA-256 hashes for public content files (tamper-evidence / change detection).
- Source + version tracking attached to any generated answer.
- Signed, expiring download links once CV generation is added.

## 5. Deferred: entry-context routing (not implemented now)

- Soft context hints via query params: `?src=linkedin`, `?src=github`, `?src=cv`;
  `?view=backend`, `?view=ai-nlp`.
- Referrer may be used only as a **weak fallback**.
- **Never infer personal identity.** Always allow the visitor to override any inferred context.

## 6. Deferred: guarded generative UI (not implemented now)

- The future LLM may only return **typed UI specs** that reference an approved component set.
- The LLM must **never** generate raw HTML, JavaScript, event handlers, arbitrary links, or
  any unsafe UI action.
- Future tools must be **allowlisted**; token / tool / web budgets will be enforced.
