# Layer 1 runtime deploy wiring

How the portfolio assistant API and web clients are deployed and connected. No
streaming, chat memory, tools, or reranking yet - `/api/retrieve/` and
`/api/answer/` remain separate atomic endpoints.

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
- `WORKDIR /app/apps/api`; `CMD ["sh", "-c", ".venv/bin/gunicorn --bind
  0.0.0.0:${PORT:-8000} config.wsgi:application"]`. The `sh -c` matters: it is
  what expands `${PORT}`.

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
- CORS origins must include the scheme, e.g.
  `https://agboola-pius-git-dev-r3troseers-projects.vercel.app` (not bare host).

### Runtime environment variables (per Railway environment)

| Variable | Notes |
|---|---|
| `DJANGO_SECRET_KEY` | Required |
| `DJANGO_ALLOWED_HOSTS` | Include the Railway domain |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Frontend origin(s), e.g. production site + local Vite |
| `GEMINI_API_KEY` | Required for `/api/answer/` |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `ANSWER_PROVIDER` | `gemini` (`fake` is DEBUG-only; rejected when `DJANGO_DEBUG` is false) |
| `GEMINI_TIMEOUT_SECONDS` | Optional; default `20` |
| `DJANGO_DEBUG` | Unset / `false` in deployed environments |

## Vercel (web)

Set build-time:

```text
VITE_API_BASE_URL=https://<railway-api-origin>
```

Without it, production falls back to same-origin `/api`, which is not the
Railway API. The web clients treat non-JSON / HTML ok responses as typed
`unavailable` (no React crash). See `apps/web/src/lib/apiClient.js`.

## Endpoints (unchanged)

- `POST /api/retrieve/` - raw deterministic lexical evidence ledger
- `POST /api/answer/` - grounded answer over retrieved public evidence (server-side
  Gemini; validated citations; atomic response - no token streaming)

## Explicitly not in this runtime

Token/progress streaming, chat memory, tools, CV generation, model selector UI,
browser API keys, generated UI/spec nodes, BM25, dense retrieval, vector DB,
cross-encoder reranking.
