# Layer 1 runtime deploy wiring

How the portfolio assistant API and web clients are deployed and connected. No
streaming, chat memory, or tools yet - `/api/retrieve/` and `/api/answer/`
remain separate atomic endpoints. Both run the deterministic two-stage
retrieval (lexical candidates + model-free rerank) and return the
retrieve-to-rerank ledger.

## Split deploys

| Surface | Host | Trigger |
|---|---|---|
| `apps/web` | Vercel | Vercel Git integration (frontend only) |
| `apps/api` | Railway | GitHub autodeploy after CI (Wait for CI) |

There is **no** GitHub Actions Railway CLI deploy workflow and **no** GitHub
`RAILWAY_*` deploy secrets. Existing CI (`.github/workflows/ci.yml`) stays the
gate: web validate/build + API check / evidence-index `--check` / `test core`.

## Railway (API)

### Config as code

Committed at [`apps/api/railway.toml`](../../apps/api/railway.toml), which points
the build at [`apps/api/Dockerfile`](../../apps/api/Dockerfile)
(`builder = "DOCKERFILE"`). The earlier Railpack/Mise approach (root `mise.toml`
+ `railpack.json`) is gone: Mise installed Python only on the *build* image, so
the venv's shebangs / `uv` were missing on the runtime image no matter how the
start command was phrased. The Dockerfile owns build and runtime in one image.

Dockerfile shape (context = repo root):

- `python:3.13-slim` base; `uv` copied as a static binary from
  `ghcr.io/astral-sh/uv:latest`; `UV_PYTHON_DOWNLOADS=never` so the venv links
  against the image's own interpreter.
- `uv sync --locked --no-dev` (deps layer cached), then copy `apps/api` +
  `apps/web/src/content/public`, then `manage.py build_evidence_index` bakes
  the gitignored `var/evidence_index.json` artifact into the image.
- `WORKDIR /app/apps/api`; `CMD ["sh", "-c", ".venv/bin/gunicorn --workers
  ${WEB_CONCURRENCY:-2} --bind 0.0.0.0:${PORT:-8000}
  config.wsgi:application"]`. The `sh -c` matters: it expands `${PORT}` and
  `${WEB_CONCURRENCY}`. The Dockerfile CMD is the only runtime start command.

`railway.toml` on top of that:

- **No startCommand.** Railway runs a custom start command on Docker images
  *without* a shell, so `${PORT:-8000}` reaches gunicorn unexpanded and the
  container dies with `'${PORT' is not a valid port number`. The Dockerfile
  `CMD` is the start command; the dashboard Start Command field must also stay
  empty.
- **healthcheckPath** - `/health/`
- **watchPatterns** - `/apps/api/**` and `/apps/web/src/content/public/**`
- **No migrate / preDeployCommand** - DB-less backend

Verify locally from the repo root (a root `.dockerignore` keeps `.env`, venvs,
and local-only folders out of the context):

```bash
docker build -f apps/api/Dockerfile -t portfolio-api .
docker run --rm -e PORT=8080 -p 8080:8080 portfolio-api
curl http://localhost:8080/health/
```

### Dashboard settings (required)

- **Root Directory:** `/` (monorepo root). It is the Docker build context; the
  index builder reads `apps/web/src/content/public/` via repo-root-relative
  paths. A root of `/apps/api` alone would omit Layer 0 content and break the
  build.
- **Config file path:** `/apps/api/railway.toml` (absolute; Railway config does
  not follow Root Directory).
- **Clear any custom Build / Start Command in the dashboard** left over from
  the Railpack attempts - the Dockerfile and `railway.toml` are the source of
  truth now.
- **Wait for CI:** enabled. Deploys wait for `.github/workflows/ci.yml` on push
  to `dev` / `main`. Failed CI -> deploy skipped.
- **Branch -> environment:** staging/dev tracks `dev`; production tracks `main`.
  Feature branches do not deploy.
- **Port alignment:** set service variable `PORT=8000` and the public domain's
  target port to `8000` (matching the Dockerfile `EXPOSE`). If the domain's
  target port differs from the port gunicorn listens on, the healthcheck can
  pass (it uses `PORT` directly) while public traffic 502s with "Application
  failed to respond".
- CORS origins must include the scheme, e.g.
  `https://agboola-pius-git-dev-r3troseers-projects.vercel.app` (not bare host).
- **Worker count:** leave `WEB_CONCURRENCY=2` for the initial deployment. One
  slow Gemini call then occupies one worker rather than blocking the entire API.

### Runtime environment variables (per Railway environment)

| Variable | Notes |
|---|---|
| `DJANGO_SECRET_KEY` | Required |
| `DJANGO_ALLOWED_HOSTS` | Railway domain **plus `healthcheck.railway.app`** - Railway healthchecks send that Host header; without it Django 400s the probe and the deploy fails as "service unavailable" |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Frontend origin(s), e.g. production site + local Vite |
| `GEMINI_API_KEY` | Required for `/api/answer/` |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `ANSWER_PROVIDER` | `gemini` (`fake` is DEBUG-only; rejected when `DJANGO_DEBUG` is false) |
| `GEMINI_TIMEOUT_SECONDS` | Optional; default `20` |
| `ANSWER_ENDPOINT_ENABLED` | `true`; set `false` for a manual kill switch that returns 503 without calling Gemini |
| `ANSWER_THROTTLE_RATE` | `6/min`; paid-answer scope, independent of the looser retrieve throttle |
| `ANSWER_DAILY_SOFT_LIMIT` | Optional process-local global UTC-day cap; `0` disables |
| `ANSWER_PER_CLIENT_DAILY_LIMIT` | Optional process-local per-client UTC-day cap; `0` disables |
| `DJANGO_ANON_THROTTLE_RATE` | `60/min`; looser anonymous rate used by `/api/retrieve/` |
| `DJANGO_NUM_PROXIES` | `1`; trusted Railway proxy count used for DRF client identity |
| `DJANGO_DEBUG` | Unset / `false` in deployed environments |
| `PORT` | `8000` - pins gunicorn, the healthcheck, and the domain target port to the Dockerfile's `EXPOSE`d port |
| `WEB_CONCURRENCY` | `2`; initial Gunicorn worker count |

## Vercel (web)

Set build-time:

```text
VITE_API_BASE_URL=https://<railway-api-origin>
```

Production builds fail if this value is missing, preventing a broken
same-origin `/api` fallback from shipping. `VITE_API_BASE_URL` is public build
configuration, not a secret. Production Vercel must use the Railway API origin.
See `apps/web/vite.config.js` and `apps/web/src/lib/apiClient.js`.

## Worker and cache strategy

The initial runtime uses two Gunicorn workers. This improves availability for
the synchronous Django endpoint because one slow Gemini request should not
block all health, retrieve, and answer traffic.

There is no Redis or shared cache yet. DRF throttle histories and the optional
daily answer counters use process-local memory. Each worker therefore has its
own counters, and effective limits can multiply by `WEB_CONCURRENCY` (for
example, `6/min` can behave like roughly `12/min` across two workers). This is
acceptable for Layer 1 because the counters are explicitly soft and are backed
by the answer-scoped throttle, the env kill switch, and external Gemini quota
or billing caps.

Redis/shared cache is the next infrastructure step for shared per-IP counters,
shared global daily answer caps, temporary block windows, concurrency counters,
and fair enforcement across workers or instances. Introduce it before:

- increasing `WEB_CONCURRENCY` significantly beyond 2;
- running multiple app instances;
- launching a public bounty or challenge;
- relying on exact global or per-client daily quotas;
- upgrading to paid Gemini usage where app-level counters must be accurate
  across workers.

## Pre-prod deployment checklist

- `DJANGO_ALLOWED_HOSTS` includes the Railway domain and
  `healthcheck.railway.app`.
- `DJANGO_CORS_ALLOWED_ORIGINS` includes each deployed Vercel origin with its
  scheme.
- `GEMINI_API_KEY` is present and `GEMINI_MODEL` is set or intentionally using
  its default.
- `ANSWER_ENDPOINT_ENABLED=true`; answer throttle and optional daily limits are
  set for the environment.
- `VITE_API_BASE_URL` is set at Vercel build time to the Railway API origin.
- Railway `PORT`, Dockerfile `EXPOSE`, and the public domain target port all
  align on `8000`.
- `WEB_CONCURRENCY` is left at the documented initial value of `2`.
- An external Gemini quota or billing cap is configured.
- After deploy, `/health/` succeeds and one real `POST /api/answer/` request
  returns a grounded response before release traffic is enabled.

## Endpoints

- `POST /api/retrieve/` - deterministic two-stage evidence retrieval (lexical
  candidates + `deterministic_rerank_v1`) with the expanded retrieve-to-rerank
  ledger
- `POST /api/answer/` - grounded answer over the selected reranked public
  evidence (server-side Gemini; validated citations; same ledger; atomic
  response - no token streaming)

## Explicitly not in this runtime

Token/progress streaming, chat memory, tools, CV generation, model selector UI,
browser API keys, generated UI/spec nodes, BM25, dense retrieval, vector DB,
cross-encoder / model-based reranking.
