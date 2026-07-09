"""
Django settings for the portfolio-api skeleton (Django 6.0 + DRF).

Health-check-only backend (migration step 3 of docs/agent/agent-architecture-plan.md).
Deliberately minimal: no DB, no admin/auth/sessions, no models. Configuration is read
from the environment via python-decouple (``config.env``). For local development,
``apps/api/.env`` is read by AutoConfig; process env still overrides file values.

Layer S note: the CORS allowlist, DRF throttling, request-size limit, and fail-closed defaults
below are *foundations* for the runtime abuse controls in docs/agent/layer-s-policy.md - not a
full abuse-control system. Concurrency limits, token/output budgets, and prompt/log
minimisation arrive with Layer 1.
"""

from config.env import Csv, config

# --- Core / security -------------------------------------------------------
# SECURITY WARNING: set DJANGO_SECRET_KEY in any non-local environment.
SECRET_KEY = config("DJANGO_SECRET_KEY", default="django-insecure-dev-only-change-me")

# Fail-closed: defaults to False; set DJANGO_DEBUG=true for local development.
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())


# --- Applications ----------------------------------------------------------
# Minimal: DRF + corsheaders + this project's core app. No contrib apps
# (no admin/auth/sessions/DB). core is installed so its management commands
# (build_evidence_index) and tests are discoverable; it has no models.
INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
    "core",
]

# Minimal middleware for an API-only, GET-only skeleton: no sessions/auth/CSRF.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

# No server-rendered templates (DRF returns JSON only - see REST_FRAMEWORK below).
TEMPLATES = []

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# --- Database --------------------------------------------------------------
# No database in the skeleton; nothing uses the ORM yet.
DATABASES = {}


# --- CORS (Layer S allowlist, env-driven) ---------------------------------
# Default to the production frontend origin plus common local dev ports.
CORS_ALLOWED_ORIGINS = config(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    default="https://piusagboola.com,http://localhost:5173,http://localhost:3000",
    cast=Csv(),
)


# --- DRF -------------------------------------------------------------------
REST_FRAMEWORK = {
    # JSON only in production - avoids the browsable API's template/staticfiles
    # dependencies. The DEBUG-only block below adds the browsable API for
    # local manual testing.
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # No auth in the skeleton. DRF's defaults import contrib.auth models, which
    # aren't installed in this minimal no-DB setup - disable auth entirely.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    # Default is django.contrib.auth.models.AnonymousUser, imported per request -
    # which would pull in contrib.auth/contenttypes. None avoids that import.
    "UNAUTHENTICATED_USER": None,
    # Layer S rate-limit foundation (placeholder). Tune via DJANGO_ANON_THROTTLE_RATE.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": config("DJANGO_ANON_THROTTLE_RATE", default="60/min"),
    },
}

# Dev only: enable DRF's browsable API for manual endpoint testing. Needs the
# staticfiles app (page CSS/JS, served by runserver in DEBUG) and an APP_DIRS
# template engine (DRF's api.html). Production stays JSON-only and minimal.
if DEBUG:
    INSTALLED_APPS.append("django.contrib.staticfiles")
    TEMPLATES = [
        {
            "BACKEND": "django.template.backends.django.DjangoTemplates",
            "DIRS": [],
            "APP_DIRS": True,
            "OPTIONS": {},
        }
    ]
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"].append(
        "rest_framework.renderers.BrowsableAPIRenderer"
    )

# Layer S request-size foundation: cap non-file request bodies (default 1 MiB).
# This bounds payload size now; full message-length / token budgets come with Layer 1.
DATA_UPLOAD_MAX_MEMORY_SIZE = config(
    "DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE", default=1024 * 1024, cast=int
)


# --- Internationalization --------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# --- Static ----------------------------------------------------------------
STATIC_URL = "static/"
