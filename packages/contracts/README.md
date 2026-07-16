# packages/contracts

Language-neutral JSON data shared by `apps/web` and `apps/api`. The private
`package.json` only declares the web app's monorepo dependency and exported data
files; there is no JavaScript build system and there are no generated clients.
The API validator continues to load the canonical files directly from the
monorepo.

## Served answer response (`answer-response.schema.json`)

Authoritative JSON Schema (draft 2020-12) for the **HTTP-served**
`POST /api/answer/` response body after the API has assembled it. Web and API
validators must load this committed file; do not duplicate the schema in code.

### Compatibility policy (top-level)

- **Fail-closed unknown properties:** `additionalProperties: false` at the
  response root. Unknown top-level properties are rejected.
- **Declared optional fields** (`headline`, `ledger`) may be omitted.
- **`headline` may be `null`** on `answered` responses (current server behaviour
  when no page-lead is present).
- Do **not** rely on undeclared fields; extend the schema deliberately when a
  new top-level key is intentional.

### Status shapes

| `status` | Required answer text | Citations | Notes |
|---|---|---|---|
| `answered` | Non-empty string (prose with `[[evidence_id]]` markup) | Non-empty; each `evidence_id` must exist in `evidence[].id` | Optional `headline` / `ledger` |
| `insufficient_evidence` | Exact server message | Must be `[]` | `evidence` may be empty; usually includes `ledger` |
| `refused` | Exact server message | Must be `[]` | `evidence` must be `[]`; no `ledger` / `headline` |

Server-authored messages (exact):

- refused: `I can only answer questions about Pius's public portfolio work, skills, projects, education, and professional experience.`
- insufficient_evidence: `I do not have enough public portfolio evidence to answer that confidently.`

### Companion invariant (citation ⊆ evidence)

JSON Schema expresses structural and status-conditional rules. The cross-array
rule **every `citations[].evidence_id` appears as some `evidence[].id`** is a
documented companion invariant enforced identically by both language validators
after schema validation succeeds. Fixture runners apply both steps so web and
API agree on every shared fixture.

### What this is not

| Concern | Where it lives | Distinction |
|---|---|---|
| **Served-response schema** (this package) | `answer-response.schema.json` + web/API validators | Shape of the assembled HTTP payload consumers may trust |
| **Raw model-output validation** | `apps/api/core/layer1/answering/schemas.py` (`validate_model_output`) | Provider JSON before hydration; not the served contract |
| **Semantic entailment** | Not implemented in this package | Whether answer prose is entailed by evidence — separate from structural validity |

## Fixtures

`fixtures/manifest.json` declares the pass/fail corpus under `fixtures/valid/`
and `fixtures/invalid/`. Both `apps/web/scripts/validate-answer-contract.mjs`
and `apps/api` contract tests consume the same files.
