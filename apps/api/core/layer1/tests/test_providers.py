"""Answer-provider registry and Gemini timeout config tests.

No live Gemini calls. Run via ``uv run python manage.py test core``.
"""

from __future__ import annotations

import unittest
from unittest import mock

from django.test import SimpleTestCase, override_settings

from core.layer1.answering.providers import get_provider
from core.layer1.answering.providers.base import ProviderError, ProviderUnavailableError
from core.layer1.answering.providers.fake import AutoFakeProvider
from core.layer1.answering.providers.gemini import (
    DEFAULT_TIMEOUT_SECONDS,
    GeminiProvider,
    resolve_timeout_seconds,
)


class ResolveTimeoutSecondsTests(unittest.TestCase):
    def test_default_when_unset_uses_config_default(self) -> None:
        with mock.patch(
            "core.layer1.answering.providers.gemini.config",
            return_value=str(DEFAULT_TIMEOUT_SECONDS),
        ):
            self.assertEqual(resolve_timeout_seconds(), DEFAULT_TIMEOUT_SECONDS)

    def test_valid_positive_int(self) -> None:
        self.assertEqual(resolve_timeout_seconds("15"), 15)

    def test_invalid_falls_back_to_default(self) -> None:
        self.assertEqual(resolve_timeout_seconds("nope"), DEFAULT_TIMEOUT_SECONDS)
        self.assertEqual(resolve_timeout_seconds(""), DEFAULT_TIMEOUT_SECONDS)
        self.assertEqual(resolve_timeout_seconds("0"), DEFAULT_TIMEOUT_SECONDS)
        self.assertEqual(resolve_timeout_seconds("-5"), DEFAULT_TIMEOUT_SECONDS)


class FakeProviderDebugGuardTests(SimpleTestCase):
    @override_settings(DEBUG=True)
    def test_fake_allowed_when_debug(self) -> None:
        with mock.patch(
            "core.layer1.answering.providers.config",
            return_value="fake",
        ):
            provider = get_provider()
        self.assertIsInstance(provider, AutoFakeProvider)

    @override_settings(DEBUG=False)
    def test_fake_rejected_when_not_debug(self) -> None:
        with mock.patch(
            "core.layer1.answering.providers.config",
            return_value="fake",
        ):
            with self.assertRaises(ProviderUnavailableError) as ctx:
                get_provider()
        self.assertIn("DJANGO_DEBUG", str(ctx.exception))

    @override_settings(DEBUG=False)
    def test_explicit_fake_name_rejected_when_not_debug(self) -> None:
        with self.assertRaises(ProviderUnavailableError):
            get_provider("fake")


class GeminiProviderTimeoutTests(unittest.TestCase):
    def test_client_receives_timeout_http_options(self) -> None:
        fake_client = mock.Mock()
        with (
            mock.patch(
                "core.layer1.answering.providers.gemini.config",
                side_effect=lambda key, default="": {
                    "GEMINI_API_KEY": "test-key",
                    "GEMINI_MODEL": "gemini-test",
                    "GEMINI_TIMEOUT_SECONDS": "12",
                }.get(key, default),
            ),
            mock.patch(
                "core.layer1.answering.providers.gemini.genai.Client",
                return_value=fake_client,
            ) as client_ctor,
        ):
            GeminiProvider()

        kwargs = client_ctor.call_args.kwargs
        self.assertEqual(kwargs["api_key"], "test-key")
        self.assertEqual(kwargs["http_options"].timeout, 12_000)

    def test_generate_wraps_timeout_as_provider_error(self) -> None:
        fake_client = mock.Mock()
        fake_client.models.generate_content.side_effect = TimeoutError("slow")
        with (
            mock.patch(
                "core.layer1.answering.providers.gemini.config",
                side_effect=lambda key, default="": {
                    "GEMINI_API_KEY": "test-key",
                    "GEMINI_MODEL": "gemini-test",
                    "GEMINI_TIMEOUT_SECONDS": "20",
                }.get(key, default),
            ),
            mock.patch(
                "core.layer1.answering.providers.gemini.genai.Client",
                return_value=fake_client,
            ),
        ):
            provider = GeminiProvider()
            with self.assertRaises(ProviderError) as ctx:
                provider.generate(system="s", user="u")
        self.assertIn("TimeoutError", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
