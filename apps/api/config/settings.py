"""
Django settings for the portfolio-api skeleton (Django 6.0 + DRF).

Health-check-only backend (migration step 3 of docs/agent/agent-architecture-plan.md).
Deliberately minimal: no DB, no admin/auth/sessions, no models. Configuration is read from
the environment via the standard library only (no python-dotenv / extra config packages).

Layer S note: the CORS allowlist, DRF throttling, request-size limit, and fail-closed defaults
below are *foundations* for the runtime abuse controls in docs/agent/layer-s-policy.md — not a
full abuse-control system. Concurrency limits, token/output budgets, and prompt/log
minimisation arrive with Layer 1.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_list(name: str, default: str) -> list[str]:
    """Comma-separated env value -> list of trimmed, non-empty strings."""
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --- Core / security -------------------------------------------------------
# SECURITY WARNING: set DJANGO_SECRET_KEY in any non-local environment.
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "django-insecure-dev-only-change-me"
)

# Fail-closed: defaults to False; set DJANGO_DEBUG=true for local development.
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"

ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")


# --- Applications ----------------------------------------------------------
# Minimal: only DRF + corsheaders. No contrib apps (no admin/auth/sessions/DB).
INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
]

# Minimal middleware for an API-only, GET-only skeleton: no sessions/auth/CSRF.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

# No server-rendered templates (DRF returns JSON only — see REST_FRAMEWORK below).
TEMPLATES = []

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# --- Database --------------------------------------------------------------
# No database in the skeleton; nothing uses the ORM yet.
DATABASES = {}


# --- CORS (Layer S allowlist, env-driven) ---------------------------------
# Default to the production frontend origin plus common local dev ports.
CORS_ALLOWED_ORIGINS = _env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "https://piusagboola.com,http://localhost:5173,http://localhost:3000",
)


# --- DRF -------------------------------------------------------------------
REST_FRAMEWORK = {
    # JSON only — avoids the browsable API's template/staticfiles dependencies.
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # No auth in the skeleton. DRF's defaults import contrib.auth models, which
    # aren't installed in this minimal no-DB setup — disable auth entirely.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    # Default is django.contrib.auth.models.AnonymousUser, imported per request —
    # which would pull in contrib.auth/contenttypes. None avoids that import.
    "UNAUTHENTICATED_USER": None,
    # Layer S rate-limit foundation (placeholder). Tune via DJANGO_ANON_THROTTLE_RATE.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("DJANGO_ANON_THROTTLE_RATE", "60/min"),
    },
}

# Layer S request-size foundation: cap non-file request bodies (default 1 MiB).
# This bounds payload size now; full message-length / token budgets come with Layer 1.
DATA_UPLOAD_MAX_MEMORY_SIZE = int(
    os.environ.get("DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE", 1024 * 1024)
)


# --- Internationalization --------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# --- Static ----------------------------------------------------------------
STATIC_URL = "static/"
