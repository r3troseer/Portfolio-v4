# portfolio-api

Django 6 + Django REST Framework backend - migration step 3 of
[`docs/agent/agent-architecture-plan.md`](../../docs/agent/agent-architecture-plan.md), plus the
first Layer 1 slice (the public evidence index, see below). This is the backend seam the future
RAG runtime (Layer 1) and Layer S runtime controls grow into. It remains deliberately minimal:
no database, no admin/auth/sessions, no models. Layer 1 adds **server-side** Gemini calls
via `POST /api/answer/` only (keys never in the browser or repo).

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (dependency + environment manager)
- Python 3.13 (pinned via `.python-version` / `requires-python = ">=3.13,<3.14"`; Django 6.0)

Dependencies are managed with **uv + `pyproject.toml`** (`uv add ...`). There is **no
`requirements.txt`** and we do not use `pip freeze`.

## Run locally

All commands run from `apps/api/`:

```bash
uv sync                                   # install/sync from pyproject + uv.lock
uv run python manage.py check             # system checks
DJANGO_DEBUG=true uv run python manage.py runserver   # dev server on :8000
uv run python manage.py build_evidence_index --check  # Layer 1 index gating check
uv run python manage.py test core         # unit tests (stdlib unittest, no DB)
```

For local secrets/config, copy `.env.example` to `.env` in this directory. Configuration
is read via `python-decouple` (`config/env.py` -> `AutoConfig(search_path=BASE_DIR)`).
Process environment values override `.env`.

To add a dependency later: `uv add <package>` (updates `pyproject.toml` + `uv.lock`).

With `DJANGO_DEBUG=true`, DRF's **browsable API** is enabled for manual endpoint testing -
open `http://127.0.0.1:8000/api/retrieve/` in a browser and use the POST form. Production
(`DEBUG` off) stays JSON-only with no template/staticfiles machinery.

## Layer 1: public evidence index

`core/layer1/` builds the first Layer 1 artifact: deterministic **evidence records** from the
approved Layer 0 content in `apps/web/src/content/public/`, with the Layer S index gate
enforced fail-closed in code (only `public` / `public_summary_only` is indexed;
`public_summary_only` is redacted to its curated summary; missing/unknown governance is an
error, never silently indexed). `manage.py build_evidence_index` writes the gitignored
`var/evidence_index.json`; `--check` validates without writing and exits non-zero on
governance errors. No LLM, embeddings, or vector store - see
[`docs/agent/layer1-evidence-index.md`](../../docs/agent/layer1-evidence-index.md) for the
full rationale and the record/contract shape (kept API-local until a second consumer exists).
Runtime retrieval is live: `POST /api/retrieve/` (raw evidence ledger). Grounded generation is
also live: `POST /api/answer/` retrieves public evidence, calls a server-side model (Gemini),
validates the output, and returns a grounded answer with citations (see **Endpoints** below).
The web UI (Cmd+K modal + `/playground`) now composes answers via `/api/answer/` and shows the
evidence ledger underneath. No chat surface, memory, reranking, tools, or generated UI exist yet.

> Note: the production WSGI server **gunicorn** is a dependency (used on Railway). It is
> Unix-only and does not run on Windows - locally, use `manage.py runserver` as above.

## Deployment (Railway)

The service deploys to Railway via **GitHub autodeploy** (separately from the Vercel frontend).
There is no Railway CLI CD workflow and no GitHub `RAILWAY_*` deploy secrets. Full wiring:
[`docs/deployment/layer1-runtime.md`](../../docs/deployment/layer1-runtime.md).

- **Config as code** - [`railway.toml`](./railway.toml) points the build at
  [`Dockerfile`](./Dockerfile). The Dockerfile CMD owns the gunicorn start command; keep
  `startCommand` unset in Railway config and the dashboard. Point the Railway service config-file
  path at `/apps/api/railway.toml`.
- **Dockerfile build** - `python:3.13-slim` + the official `uv` binary; `uv sync --locked`,
  then `build_evidence_index` bakes `var/evidence_index.json` into the image. Not Railpack:
  Railpack/Mise installed Python only on the build image, which broke the venv shebangs at
  runtime. Build locally with `docker build -f apps/api/Dockerfile .` from the repo root.
- **Root Directory** - `/` (monorepo root). The Docker build context must include Layer 0
  content under `apps/web/src/content/public/`; a root of `/apps/api` alone would omit it.
- **Wait for CI** - enable on the API service so deploys wait for `.github/workflows/ci.yml`
  (`dev` / `main` pushes). Failed CI skips the deploy. Feature branches do not deploy.
- **Branch -> environment** - Railway staging/dev tracks `dev`; production tracks `main`.
- **Start command** - the Dockerfile `CMD` only (`sh -c ".venv/bin/gunicorn --workers
  ${WEB_CONCURRENCY:-2} --bind 0.0.0.0:${PORT:-8000} config.wsgi:application"`). Do not set a start command in
  `railway.toml` or the dashboard: Railway runs custom start commands on Docker images
  without a shell, so `${PORT}` reaches gunicorn unexpanded and the deploy fails.
- **No `migrate` step.** Railpack's default is `migrate && gunicorn`; on this DB-less backend
  `migrate` fails. Do not add a `preDeployCommand` migrate until a real database exists.
- **Runtime env vars** (Railway dashboard, per environment): `DJANGO_SECRET_KEY`,
  `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, `GEMINI_API_KEY`,
  `GEMINI_MODEL=gemini-3.1-flash-lite`, `ANSWER_PROVIDER=gemini`,
  `ANSWER_ENDPOINT_ENABLED=true`, and `WEB_CONCURRENCY=2`. Leave `DJANGO_DEBUG` unset/`false`.
  Optional: `GEMINI_TIMEOUT_SECONDS` and the soft daily caps. See the table below.
- **Vercel** must set `VITE_API_BASE_URL` to the Railway API origin.

## Endpoints

| Method | Path             | Response                                          |
|--------|------------------|---------------------------------------------------|
| GET    | `/health/`       | `{"status": "ok", "service": "portfolio-api"}`    |
| GET    | `/api/health/`   | `{"status": "ok", "service": "portfolio-api"}`    |
| POST   | `/api/retrieve/` | Ranked evidence matches + meta (raw ledger, see below) |
| POST   | `/api/answer/`   | Grounded answer + citations + evidence (see below) |

Both health paths reuse the same view (`core/views.py`); health is exempt from throttling.

### `POST /api/retrieve/` - Layer 1 retrieval

Deterministic lexical retrieval over the evidence index. **No generated answer, no LLM, no
embeddings** - just ranked, publicly-indexable evidence records. Covered by the global anon
throttle (deliberately not exempted).

Request (JSON body):

```json
{ "query": "multi-agent fintech", "role_lens": "backend", "top_k": 5 }
```

- `query` - required, non-empty, max 500 chars.
- `role_lens` - optional; a soft ranking boost (+2), never a filter, so lens-less records
  (profile silos, about) still rank. Max 50 chars.
- `top_k` - optional integer, 1-20, default 5.

Response: `200` with `{"matches": [{...evidence record fields..., "entity_id",
"entity_type", "snippet", "score": n}], "meta": {"total_records", "top_k",
"role_lens", "index_source"}}`. `text` remains the longer retrieval/model context; `snippet`
is the short plain-text display field for the user-facing entity ledger. An empty `matches`
list is the deterministic no-results response. `400` on invalid input; `405` on non-POST.

Scoring is integer token overlap per unique query token: text +1, tags +2, title +3, plus
the role-lens boost; ties break on record id, so results are reproducible.

**Index sourcing (fail-closed):** if the Layer 0 content root exists (dev/CI/monorepo) the
corpus is built in-process; otherwise the shipped `var/evidence_index.json` artifact is read
(deployed environments - build it in CI/deploy via `build_evidence_index`). The endpoint
returns `503` and serves nothing if neither source works, if the build reports any
governance error, or if the artifact contains a non-indexable record. The corpus is cached
for the process lifetime, so local content edits need a server restart to appear.

### `POST /api/answer/` - Layer 1 grounded answer

Retrieves public evidence (via the same unchanged lexical retrieval), calls a **server-side
model** (Gemini), validates the model's strict-JSON output against the retrieved evidence, and
returns a grounded, cited answer. `/api/retrieve/` stays the raw evidence ledger; this endpoint
grounds an answer on top of it. **The model is never trusted directly** - a citation that was
not retrieved, malformed JSON, or an unsupported status fails closed. Model keys and model
choice are **server-side only**; they are never exposed to the frontend. Code lives in
`core/layer1/answering/` (the prompt text is isolated in `prompts.py` for easy tuning).

Request (JSON body): same shape as retrieval - `{ "query": "...", "role_lens": "backend",
"top_k": 5 }` (validated by the shared `parse_retrieval_request`; same limits).

Statuses (all HTTP `200`):

- `answered` - a grounded answer plus `citations` (hydrated from retrieved evidence), the
  `evidence` ledger, and `meta` (`model`, `provider`, `retrieval_count`, `index_source`).
  The `answer` string uses handoff prose mini-markup for page rendering:
  `[[evidence_id]]` entity refs (exact ids from retrieval) and optional `==highlight==`
  spans (max 3). `citation_ids` must match every `[[...]]` marker. Each citation includes
  `ref` (stable display label from `core/layer1/presentation.py`: zero-padded project
  `displayOrder` from `projects/index.json`; semantic refs for profile silos, about, and
  role-lens/markdown slugs; never retrieval rank) plus
  `score` from lexical retrieval for optional UI relevance display.
- `insufficient_evidence` - not enough public evidence; a fixed server message and any
  retrieved `evidence`. Returned **without calling the model** when retrieval finds nothing,
  or when the model selects this status (model prose is discarded either way).
- `refused` - out of scope; a fixed server message, no citations, no evidence. For `refused`
  and `insufficient_evidence` the model's prose is **discarded** and a server-authored message
  is used instead.

HTTP status codes: `200` for the three answer statuses; `400` invalid request; `429` when the
answer throttle or a soft daily cap is exceeded; `503` if the endpoint is disabled, the corpus
is unavailable, or the answer provider is unavailable (e.g. `GEMINI_API_KEY` unset); `502` if
the model output is malformed/unsupported or cites evidence that was not retrieved.

## Configuration (environment variables)

All config is read via `python-decouple` (`config/env.py`). `apps/api/.env` is loaded for
local development; process environment values take precedence. Defaults are dev-friendly
and **fail-closed** (`DEBUG` off by default).

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | insecure dev key | **Set in any non-local environment.** |
| `DJANGO_DEBUG` | `false` | `true` enables debug (local only). |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated allowed hosts. Railway needs its domain plus `healthcheck.railway.app`. |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://piusagboola.com,http://localhost:5173,http://localhost:3000` | Comma-separated CORS allowlist. |
| `DJANGO_ANON_THROTTLE_RATE` | `60/min` | DRF anonymous throttle rate. |
| `DJANGO_NUM_PROXIES` | `1` | Trusted proxy count for DRF client identity behind Railway. |
| `DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE` | `1048576` (1 MiB) | Max non-file request body size. |
| `GEMINI_API_KEY` | _(unset)_ | **Required for `/api/answer/`.** Server-side only; never commit. Unset -> `503`. |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Gemini model id for grounded answers. |
| `GEMINI_TIMEOUT_SECONDS` | `20` | Gemini HTTP request timeout (seconds). Invalid / non-positive -> 20. Timeout -> `503`. |
| `ANSWER_PROVIDER` | `gemini` | Answer provider. `fake` is **DEBUG-only** (`DJANGO_DEBUG=true`) for local UI verify; rejected in production. |
| `ANSWER_ENDPOINT_ENABLED` | `true` | Manual kill switch. `false` returns a controlled `503` without a model call. |
| `ANSWER_THROTTLE_RATE` | `6/min` | Paid answer throttle, separate from the looser retrieval rate. |
| `ANSWER_DAILY_SOFT_LIMIT` | `0` | Optional process-local global UTC-day cap; `0` disables. |
| `ANSWER_PER_CLIENT_DAILY_LIMIT` | `0` | Optional process-local per-client UTC-day cap; `0` disables. |
| `PORT` | `8000` in Railway | Must align with Dockerfile `EXPOSE` and the domain target port. |
| `WEB_CONCURRENCY` | `2` | Initial Gunicorn worker count. |

## Layer S foundations (not full controls yet)

Per [`docs/agent/layer-s-policy.md`](../../docs/agent/layer-s-policy.md), this skeleton lays the
*foundations* for runtime abuse controls - it does **not** implement the full system:

- **CORS allowlist** - env-driven (`CORS_ALLOWED_ORIGINS`).
- **Rate limiting** - looser DRF anonymous retrieval throttle plus an answer-only paid-call
  throttle (`ANSWER_THROTTLE_RATE`).
- **Request-size limit** - `DATA_UPLOAD_MAX_MEMORY_SIZE`.
- **Server-side secrets only** - `SECRET_KEY` from the environment; no secrets committed.
- **Fail-closed defaults** - `DEBUG` off unless explicitly enabled.

Landed with the retrieval endpoint: message-length limits for `/api/retrieve/` (query and
role_lens caps, bounded top_k) and fail-closed index sourcing. Landed with `/api/answer/`:
grounded-answer enforcement (every answered claim must cite retrieved evidence; unknown
citations, malformed output, or unsupported statuses fail closed), safe post-validation
truncation, a first-class refusal status, server-authored refusal/insufficient messages, the
answer-only throttle, an env kill switch, and optional soft process-local daily caps.
Two Gunicorn workers improve availability, but each worker owns its own throttle and daily
counters until Redis/shared cache is introduced; effective limits can therefore multiply.
See the runtime guide for the Redis upgrade triggers. Still to come: exact shared counters,
concurrency limits, full token/input budgets, and prompt/log minimisation.
