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

Committed at [`apps/api/railway.toml`](../../apps/api/railway.toml), with repo-root
[`mise.toml`](../../mise.toml) so Railpack installs Python + uv when the service
root is `/` (there is no root `pyproject.toml`, so the Python provider would not
autodetect otherwise):

- **buildCommand** - `cd apps/api && uv sync --locked && uv run python manage.py build_evidence_index`
  (writes the gitignored `var/evidence_index.json` artifact into the image)
- **startCommand** - `cd apps/api && .venv/bin/gunicorn --bind 0.0.0.0:${PORT:-8000} config.wsgi:application`
  (uses the venv from build; avoids needing `uv` on the runtime image)
- **healthcheckPath** - `/health/`
- **watchPatterns** - `/apps/api/**` and `/apps/web/src/content/public/**`
- **No migrate / preDeployCommand** - DB-less backend

### Dashboard settings (required)

- **Root Directory:** `/` (monorepo root). The index builder reads
  `apps/web/src/content/public/` via repo-root-relative paths. A root of
  `/apps/api` alone would omit Layer 0 content and break the build.
- **Config file path:** `/apps/api/railway.toml` (absolute; Railway config does
  not follow Root Directory).
- **Wait for CI:** enabled. Deploys wait for `.github/workflows/ci.yml` on push
  to `dev` / `main`. Failed CI -> deploy skipped.
- **Branch -> environment:** staging/dev tracks `dev`; production tracks `main`.
  Feature branches do not deploy.
- If a build still reports `uv: not found`, set service env
  `RAILPACK_PACKAGES=python@3.13 uv` as a backup (see
  [Railpack packages](https://railpack.com/guides/installing-packages/)).

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
