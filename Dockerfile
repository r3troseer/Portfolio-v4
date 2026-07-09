# Multi-stage build for Portfolio API
# Stage 1: Builder - install dependencies
FROM ghcr.io/railwayapp/railpack-builder:mise-2026.6.12 AS builder

WORKDIR /app
COPY . .

# Install Python and uv via Mise
RUN mkdir -p /etc/mise && \
    echo '[tools]\npython = "3.13"\nuv = "latest"' > /etc/mise/config.toml && \
    eval "$(mise activate bash)" && \
    cd apps/api && \
    uv sync --locked && \
    uv run python manage.py build_evidence_index

# Stage 2: Runtime
FROM ghcr.io/railwayapp/railpack-runtime:mise-2026.6.12

WORKDIR /app

# Copy the entire app including .venv from builder
COPY --from=builder /app /app

# Set environment
ENV PORT=8000
EXPOSE 8000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health/ || exit 1

# Start the app
CMD ["sh", "-c", "cd apps/api && .venv/bin/python -m gunicorn --bind 0.0.0.0:${PORT:-8000} config.wsgi:application"]

