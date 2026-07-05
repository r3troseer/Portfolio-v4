# portfolio-api

Django 6 + Django REST Framework backend - migration step 3 of
[`docs/agent/agent-architecture-plan.md`](../../docs/agent/agent-architecture-plan.md), plus the
first Layer 1 slice (the public evidence index, see below). This is the backend seam the future
RAG runtime (Layer 1) and Layer S runtime controls grow into. It remains deliberately minimal:
no database, no admin/auth/sessions, no models, no AI/LLM calls.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (dependency + environment manager)
- Python 3.13 (pinned via `.python-version` / `requires-python = ">=3.13,<3.14"`; Django 6.0)

Dependencies are managed with **uv + `pyproject.toml`** (`uv add …`). There is **no
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

To add a dependency later: `uv add <package>` (updates `pyproject.toml` + `uv.lock`).

## Layer 1: public evidence index

`core/layer1/` builds the first Layer 1 artifact: deterministic **evidence records** from the
approved Layer 0 content in `apps/web/src/content/public/`, with the Layer S index gate
enforced fail-closed in code (only `public` / `public_summary_only` is indexed;
`public_summary_only` is redacted to its curated summary; missing/unknown governance is an
error, never silently indexed). `manage.py build_evidence_index` writes the gitignored
`var/evidence_index.json`; `--check` validates without writing and exits non-zero on
governance errors. No LLM, embeddings, vector store, or retrieval endpoint yet - see
[`docs/agent/layer1-evidence-index.md`](../../docs/agent/layer1-evidence-index.md) for the
full rationale and the record/contract shape (kept API-local until a second consumer exists).

> Note: the production WSGI server **gunicorn** is a dependency (used on Railway). It is
> Unix-only and does not run on Windows — locally, use `manage.py runserver` as above.

## Deployment (Railway)

The service deploys to Railway (separately from the Vercel frontend, per the architecture plan).

- **Start command** — set this as the custom start command in the Railway dashboard
  (Settings → Deploy):
  ```bash
  gunicorn --bind 0.0.0.0:${PORT:-8000} config.wsgi:application
  ```
  Railway injects `$PORT`; the `:-8000` fallback lets the same command run locally on Unix.
- **No `migrate` step — and do not let the autodetected command add one.** Railpack's default
  deploy command is `python manage.py migrate && gunicorn …`; on this DB-less skeleton `migrate`
  exits 1 (`DATABASES = {}` → dummy backend → `ImproperlyConfigured`), which would block gunicorn
  from starting. The custom start command above replaces it. A `migrate` step returns only when
  the backend gains a real database and models.
- **Production environment variables** (set in Railway): `DJANGO_SECRET_KEY` (required),
  `DJANGO_DEBUG` left unset/`false`, and `DJANGO_ALLOWED_HOSTS` including the Railway domain.
  Tune `DJANGO_CORS_ALLOWED_ORIGINS` to the real frontend origin(s). See the table below.

## Endpoints

| Method | Path             | Response                                          |
|--------|------------------|---------------------------------------------------|
| GET    | `/health/`       | `{"status": "ok", "service": "portfolio-api"}`    |
| GET    | `/api/health/`   | `{"status": "ok", "service": "portfolio-api"}`    |
| POST   | `/api/retrieve/` | Ranked evidence matches + meta (see below)        |

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

Response: `200` with `{"matches": [{...evidence record fields..., "score": n}], "meta":
{"total_records", "top_k", "role_lens", "index_source"}}`. An empty `matches` list is the
deterministic no-results response. `400` on invalid input; `405` on non-POST.

Scoring is integer token overlap per unique query token: text +1, tags +2, title +3, plus
the role-lens boost; ties break on record id, so results are reproducible.

**Index sourcing (fail-closed):** if the Layer 0 content root exists (dev/CI/monorepo) the
corpus is built in-process; otherwise the shipped `var/evidence_index.json` artifact is read
(deployed environments - build it in CI/deploy via `build_evidence_index`). The endpoint
returns `503` and serves nothing if neither source works, if the build reports any
governance error, or if the artifact contains a non-indexable record. The corpus is cached
for the process lifetime, so local content edits need a server restart to appear.

## Configuration (environment variables)

All config is read from the environment via the standard library (no `.env` loader). Defaults
are dev-friendly and **fail-closed** (`DEBUG` off by default).

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | insecure dev key | **Set in any non-local environment.** |
| `DJANGO_DEBUG` | `false` | `true` enables debug (local only). |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated allowed hosts. |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://piusagboola.com,http://localhost:5173,http://localhost:3000` | Comma-separated CORS allowlist. |
| `DJANGO_ANON_THROTTLE_RATE` | `60/min` | DRF anonymous throttle rate. |
| `DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE` | `1048576` (1 MiB) | Max non-file request body size. |

## Layer S foundations (not full controls yet)

Per [`docs/agent/layer-s-policy.md`](../../docs/agent/layer-s-policy.md), this skeleton lays the
*foundations* for runtime abuse controls — it does **not** implement the full system:

- **CORS allowlist** — env-driven (`CORS_ALLOWED_ORIGINS`).
- **Rate limiting** — DRF `AnonRateThrottle` placeholder (`DJANGO_ANON_THROTTLE_RATE`).
- **Request-size limit** — `DATA_UPLOAD_MAX_MEMORY_SIZE`.
- **Server-side secrets only** — `SECRET_KEY` from the environment; no secrets committed.
- **Fail-closed defaults** — `DEBUG` off unless explicitly enabled.

Landed with the retrieval endpoint: message-length limits for `/api/retrieve/` (query and
role_lens caps, bounded top_k) and fail-closed index sourcing. Still to come (Layer 1):
concurrency limits, token/output budgets, grounded-answer enforcement, and prompt/log
minimisation.
