#!/bin/sh
set -e

cd /app/apps/api

# If .venv doesn't exist, create it using pip
if [ ! -d ".venv" ]; then
    echo "Creating venv..."
    python -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -e .
fi

# Run gunicorn
exec .venv/bin/python -m gunicorn --bind 0.0.0.0:${PORT:-8000} config.wsgi:application
