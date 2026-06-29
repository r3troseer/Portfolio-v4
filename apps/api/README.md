# portfolio-api

Django 6 + Django REST Framework **health-only skeleton** — migration step 3 of
[`docs/agent/agent-architecture-plan.md`](../../docs/agent/agent-architecture-plan.md). This is
the backend seam the future RAG runtime (Layer 1) and Layer S runtime controls grow into. It is
deliberately minimal: no database, no admin/auth/sessions, no models, no AI.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (dependency + environment manager)
- Python (uv will use a compatible interpreter; developed against 3.14, Django 6.0)

Dependencies are managed with **uv + `pyproject.toml`** (`uv add …`). There is **no
`requirements.txt`** and we do not use `pip freeze`.

## Run locally

All commands run from `apps/api/`:

```bash
uv sync                                   # install/sync from pyproject + uv.lock
uv run python manage.py check             # system checks
DJANGO_DEBUG=true uv run python manage.py runserver   # dev server on :8000
```

To add a dependency later: `uv add <package>` (updates `pyproject.toml` + `uv.lock`).

## Endpoints

| Method | Path           | Response                                          |
|--------|----------------|---------------------------------------------------|
| GET    | `/health/`     | `{"status": "ok", "service": "portfolio-api"}`    |
| GET    | `/api/health/` | `{"status": "ok", "service": "portfolio-api"}`    |

Both reuse the same view (`core/views.py`); health is exempt from throttling.

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

Still to come (Layer 1): concurrency limits, token/output budgets, message-length limits,
grounded-answer enforcement, and prompt/log minimisation.
