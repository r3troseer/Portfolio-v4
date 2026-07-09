# Railway deploy image for the portfolio API (apps/api).
#
# Build context is the monorepo root (Railway Root Directory = /) so the
# evidence index build can read Layer 0 content under apps/web/src/content/public/.
# This replaces the Railpack/Mise toolchain: Mise installed Python only on the
# build image, so the .venv shebangs pointed at paths missing at runtime.
# A Dockerfile owns both build and runtime, in one image.

FROM python:3.13-slim

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
# the repo root (core/layer1/builder.py: parents[4]).
COPY apps/api apps/api
COPY apps/web/src/content/public apps/web/src/content/public

# Bake the evidence index artifact (var/evidence_index.json) into the image.
RUN cd apps/api && uv run python manage.py build_evidence_index

WORKDIR /app/apps/api

EXPOSE 8000

# Railway injects PORT; sh -c so the variable expands. railway.toml's
# startCommand mirrors this and takes precedence on Railway.
CMD ["sh", "-c", ".venv/bin/gunicorn --bind 0.0.0.0:${PORT:-8000} config.wsgi:application"]
