"""Production SECRET_KEY startup enforcement (B-07).

Uses isolated subprocess imports so each case gets a fresh settings load.
No secret values are asserted in output beyond a dedicated leak sentinel.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[2]

# Ephemeral test-only key (>= MIN_PRODUCTION_SECRET_KEY_LENGTH); not a deployment secret.
STRONG_TEST_SECRET_KEY = (
    "ci-ephemeral-test-django-secret-key-not-for-production-use-0001"
)
LEAK_SENTINEL_SECRET_KEY = "LEAK_SENTINEL_do-not-print-me"
WEAK_SHORT_SECRET_KEY = "too-short-for-production-use"


def _isolated_env(**overrides: str | None) -> dict[str, str]:
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("DJANGO_")
    }
    for key, value in overrides.items():
        if value is None:
            env.pop(key, None)
        else:
            env[key] = value
    return env


def _load_settings(env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    script = (
        "import os\n"
        "from pathlib import Path\n"
        "from decouple import AutoConfig\n"
        "test_root = Path(os.environ['SECRET_KEY_TEST_ROOT'])\n"
        "import config.env as env_mod\n"
        "env_mod.BASE_DIR = test_root\n"
        "env_mod.config = AutoConfig(search_path=test_root)\n"
        "import django\n"
        "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')\n"
        "django.setup()\n"
        "from django.conf import settings\n"
        "print('BOOT_OK', len(settings.SECRET_KEY))\n"
    )
    with tempfile.TemporaryDirectory(prefix="django-secret-key-test-") as test_root:
        isolated_env = env.copy()
        isolated_env["SECRET_KEY_TEST_ROOT"] = test_root
        return subprocess.run(
            [sys.executable, "-c", script],
            cwd=API_ROOT,
            env=isolated_env,
            capture_output=True,
            text=True,
            check=False,
        )


class SecretKeyStartupTests(unittest.TestCase):
    def test_debug_missing_key_uses_development_fallback(self) -> None:
        result = _load_settings(
            _isolated_env(DJANGO_DEBUG="true", DJANGO_SECRET_KEY=None)
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("BOOT_OK", result.stdout)
        self.assertEqual(result.stdout.strip().split()[-1], "34")

    def test_debug_explicit_empty_key_uses_development_fallback(self) -> None:
        result = _load_settings(
            _isolated_env(DJANGO_DEBUG="true", DJANGO_SECRET_KEY="")
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("BOOT_OK", result.stdout)
        self.assertEqual(result.stdout.strip().split()[-1], "34")

    def test_production_missing_key_fails(self) -> None:
        result = _load_settings(
            _isolated_env(DJANGO_DEBUG="false", DJANGO_SECRET_KEY=None)
        )
        self.assertNotEqual(result.returncode, 0)
        combined = f"{result.stdout}\n{result.stderr}"
        self.assertIn("DJANGO_SECRET_KEY", combined)
        self.assertIn("DJANGO_DEBUG is false", combined)

    def test_production_explicit_empty_key_fails(self) -> None:
        result = _load_settings(
            _isolated_env(DJANGO_DEBUG="false", DJANGO_SECRET_KEY="")
        )
        self.assertNotEqual(result.returncode, 0)
        combined = f"{result.stdout}\n{result.stderr}"
        self.assertIn("DJANGO_SECRET_KEY", combined)
        self.assertIn("DJANGO_DEBUG is false", combined)

    def test_production_development_fallback_fails(self) -> None:
        result = _load_settings(
            _isolated_env(
                DJANGO_DEBUG="false",
                DJANGO_SECRET_KEY="django-insecure-dev-only-change-me",
            )
        )
        self.assertNotEqual(result.returncode, 0)
        combined = f"{result.stdout}\n{result.stderr}"
        self.assertIn("development fallback", combined)
        self.assertNotIn("django-insecure-dev-only-change-me", combined)

    def test_production_weak_short_key_fails(self) -> None:
        result = _load_settings(
            _isolated_env(
                DJANGO_DEBUG="false",
                DJANGO_SECRET_KEY=WEAK_SHORT_SECRET_KEY,
            )
        )
        self.assertNotEqual(result.returncode, 0)
        combined = f"{result.stdout}\n{result.stderr}"
        self.assertIn("at least 50", combined)
        self.assertNotIn(WEAK_SHORT_SECRET_KEY, combined)

    def test_production_placeholder_denylist_fails(self) -> None:
        result = _load_settings(
            _isolated_env(DJANGO_DEBUG="false", DJANGO_SECRET_KEY="changeme")
        )
        self.assertNotEqual(result.returncode, 0)
        combined = f"{result.stdout}\n{result.stderr}"
        self.assertIn("placeholder", combined)
        self.assertNotIn("changeme", combined)

    def test_production_whitespace_only_fails(self) -> None:
        result = _load_settings(
            _isolated_env(DJANGO_DEBUG="false", DJANGO_SECRET_KEY="   \t  ")
        )
        self.assertNotEqual(result.returncode, 0)
        combined = f"{result.stdout}\n{result.stderr}"
        self.assertIn("whitespace-only", combined)

    def test_production_strong_key_boots(self) -> None:
        result = _load_settings(
            _isolated_env(
                DJANGO_DEBUG="false",
                DJANGO_SECRET_KEY=STRONG_TEST_SECRET_KEY,
            )
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("BOOT_OK", result.stdout)
        self.assertNotIn(STRONG_TEST_SECRET_KEY, f"{result.stdout}\n{result.stderr}")

    def test_production_strong_key_strips_surrounding_whitespace(self) -> None:
        padded = f"  {STRONG_TEST_SECRET_KEY}  "
        result = _load_settings(
            _isolated_env(DJANGO_DEBUG="false", DJANGO_SECRET_KEY=padded)
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("BOOT_OK", result.stdout)
        self.assertEqual(
            result.stdout.strip().split()[-1],
            str(len(STRONG_TEST_SECRET_KEY)),
        )

    def test_production_rejection_never_leaks_secret_value(self) -> None:
        result = _load_settings(
            _isolated_env(
                DJANGO_DEBUG="false",
                DJANGO_SECRET_KEY=LEAK_SENTINEL_SECRET_KEY,
            )
        )
        self.assertNotEqual(result.returncode, 0)
        combined = f"{result.stdout}\n{result.stderr}"
        self.assertIn("DJANGO_SECRET_KEY", combined)
        self.assertNotIn(LEAK_SENTINEL_SECRET_KEY, combined)
        self.assertNotIn("LEAK_SENTINEL", combined)
