"""
Django settings for the portfolio-api skeleton (Django 6.0 + DRF).

API-only backend for the Layer 1 retrieval and grounded-answer surfaces.
Deliberately minimal: no DB, no admin/auth/sessions, no models. Configuration is read
from the environment via python-decouple (``config.env``). For local development,
``apps/api/.env`` is read by AutoConfig; process env still overrides file values.

Layer S note: the CORS allowlist, DRF throttling, request-size limit, and fail-closed defaults
below are foundations for the runtime abuse controls in docs/agent/layer-s-policy.md.
Answer-specific throttling and soft process-local daily limits protect paid calls;
shared counters and fuller budgets remain later infrastructure.
"""

from decouple import Undefined
from django.core.exceptions import ImproperlyConfigured

from config.env import Csv, config

# --- Core / security -------------------------------------------------------
# Local development may use this named fallback when DJANGO_DEBUG=true and the key is
# missing. Production startup (DJANGO_DEBUG=false) rejects missing, empty, whitespace-only,
# fallback, short, and known-placeholder values before serving traffic.
DEVELOPMENT_SECRET_KEY = "django-insecure-dev-only-change-me"
MIN_PRODUCTION_SECRET_KEY_LENGTH = 50
PRODUCTION_SECRET_KEY_DENYLIST: frozenset[str] = frozenset(
    {
        DEVELOPMENT_SECRET_KEY,
        "changeme",
        "change-me",
        "django-insecure",
        "insert-secret-key-here",
        "password",
        "replace-me",
        "secret",
        "your-secret-key",
    }
)

# Fail-closed: defaults to False; set DJANGO_DEBUG=true for local development.
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)


def _resolve_secret_key(*, debug: bool, raw: str | None) -> str:
    """Return a validated SECRET_KEY; raise ImproperlyConfigured in production when unsafe."""
    if debug:
        if raw is None or raw == "":
            return DEVELOPMENT_SECRET_KEY
        normalized = raw.strip()
        return normalized or DEVELOPMENT_SECRET_KEY

    if raw is None:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false."
        )
    if raw == "":
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false."
        )

    secret_key = raw.strip()
    if not secret_key:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY must not be empty or whitespace-only when "
            "DJANGO_DEBUG is false."
        )
    if secret_key == DEVELOPMENT_SECRET_KEY:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY must not use the development fallback when "
            "DJANGO_DEBUG is false."
        )
    lowered = secret_key.lower()
    if any(lowered == entry.lower() for entry in PRODUCTION_SECRET_KEY_DENYLIST):
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY matches a known placeholder value and is not allowed "
            "when DJANGO_DEBUG is false."
        )
    if len(secret_key) < MIN_PRODUCTION_SECRET_KEY_LENGTH:
        raise ImproperlyConfigured(
            f"DJANGO_SECRET_KEY must be at least {MIN_PRODUCTION_SECRET_KEY_LENGTH} "
            "characters when DJANGO_DEBUG is false."
        )
    return secret_key


if DEBUG:
    _secret_key_raw: str | None = config("DJANGO_SECRET_KEY", default=DEVELOPMENT_SECRET_KEY)
else:
    _secret_key_raw = config("DJANGO_SECRET_KEY", default=Undefined)
    if _secret_key_raw is Undefined:
        _secret_key_raw = None

SECRET_KEY = _resolve_secret_key(debug=DEBUG, raw=_secret_key_raw)

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

# Minimal middleware for a JSON API: no sessions/auth/CSRF.
# RequestCorrelationMiddleware binds a server-generated opaque id for
# operational events and response-header correlation only - it does not log
# request/response bodies, headers, or exception details.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "core.middleware.RequestCorrelationMiddleware",
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
    # Retrieval and other anonymous requests keep this looser default bucket.
    # /api/answer/ overrides it with the paid-call-specific "answer" scope.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": config("DJANGO_ANON_THROTTLE_RATE", default="60/min"),
        "answer": config("ANSWER_THROTTLE_RATE", default="6/min"),
    },
    # Railway is the one trusted proxy in front of the app. DRF uses this to
    # resolve the client address from X-Forwarded-For instead of REMOTE_ADDR.
    "NUM_PROXIES": max(0, config("DJANGO_NUM_PROXIES", default=1, cast=int)),
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

# Paid answer controls. Daily counters are intentionally soft and process-local
# until a shared cache is introduced; zero disables the corresponding cap.
ANSWER_ENDPOINT_ENABLED = config("ANSWER_ENDPOINT_ENABLED", default=True, cast=bool)
ANSWER_DAILY_SOFT_LIMIT = max(
    0, config("ANSWER_DAILY_SOFT_LIMIT", default=0, cast=int)
)
ANSWER_PER_CLIENT_DAILY_LIMIT = max(
    0, config("ANSWER_PER_CLIENT_DAILY_LIMIT", default=0, cast=int)
)


# --- Internationalization --------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# --- Static ----------------------------------------------------------------
STATIC_URL = "static/"

# Operational events: console one-liners for Railway log drains. The telemetry
# helpers allow-list fields; this logger must never be pointed at request bodies.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "core.telemetry": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
