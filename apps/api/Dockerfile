# Railway deploy image for the portfolio API (apps/api).
#
# Build context is the monorepo root (Railway Root Directory = /) so the
# builder stage can read Layer 0 content under apps/web/src/content/public/.
# Multi-stage: the builder installs locked production deps, indexes approved
# public content, and writes var/evidence_index.json; the runtime ships only
# the API source, production venv, and generated artifact. Raw canonical
# Layer 0 content is absent from the final image.
#
# This replaces the Railpack/Mise toolchain: Mise installed Python only on the
# build image, so the .venv shebangs pointed at paths missing at runtime.
# The Dockerfile owns both build and runtime; CMD stays the Railway start owner.

FROM python:3.13-slim AS builder

# uv as a static binary from the official image (no pip bootstrap).
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    # Use the image's Python and never download a uv-managed interpreter,
    # so .venv shebangs point at a path that exists in the final image.
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Dependencies first, for Docker layer caching.
COPY apps/api/pyproject.toml apps/api/uv.lock apps/api/.python-version apps/api/
RUN cd apps/api && uv sync --locked --no-dev

# API source plus the Layer 0 content the index builder resolves relative to
# the repo root (core/layer1/builder.py: parents[4]). Layer 0 stays in this
# stage only; it is not copied into the runtime image.
COPY apps/api apps/api
COPY apps/web/src/content/public apps/web/src/content/public

# Bake the evidence index artifact (var/evidence_index.json) in the builder.
# This management-command-only layer uses development settings so the image
# build does not require or embed a production secret.
RUN cd apps/api && DJANGO_DEBUG=true uv run python manage.py build_evidence_index

FROM python:3.13-slim AS runtime

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Production venv, API source, and generated artifact only (no Layer 0 tree).
COPY --from=builder /app/apps/api /app/apps/api

WORKDIR /app/apps/api

EXPOSE 8000

# Dockerfile CMD owns runtime startup; Railway startCommand stays unset.
# sh -c expands Railway's PORT and the configurable worker count.
CMD ["sh", "-c", ".venv/bin/gunicorn --workers ${WEB_CONCURRENCY:-2} --bind 0.0.0.0:${PORT:-8000} config.wsgi:application"]
