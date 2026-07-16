"""Privacy-safe operational event tests for answer and retrieve endpoints.

Captures structured telemetry logs, asserts the fixed outcome taxonomy,
correlation header stability, unchanged public response bodies, one event per
terminal outcome, and that sensitive sentinel values never enter logs.
"""

from __future__ import annotations

import json
import logging
import re
import unittest
from dataclasses import replace
from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from core.layer1.answering.limits import reset_answer_usage_for_tests
from core.layer1.answering.providers.base import (
    ProviderError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from core.layer1.answering.providers.fake import FakeProvider
from core.layer1.answering.schemas import AnswerOutputError
from core.layer1.retrieval import (
    Corpus,
    IndexUnavailableError,
    RetrievalQuery,
    get_corpus,
)
from core.layer1.reranking import retrieve_and_rerank
from core.telemetry import (
    ALLOWED_OUTCOMES,
    CORRELATION_HEADER,
    ENDPOINT_ANSWER,
    ENDPOINT_RETRIEVE,
    OUTCOME_ANSWER_CORPUS_UNAVAILABLE,
    OUTCOME_ANSWER_DISABLED,
    OUTCOME_ANSWER_INVALID_REQUEST,
    OUTCOME_ANSWER_OK,
    OUTCOME_ANSWER_PROVIDER_CONTRACT,
    OUTCOME_ANSWER_PROVIDER_TIMEOUT,
    OUTCOME_ANSWER_PROVIDER_UNAVAILABLE,
    OUTCOME_ANSWER_SOFT_LIMIT,
    OUTCOME_ANSWER_THROTTLED,
    OUTCOME_RETRIEVE_CORPUS_UNAVAILABLE,
    OUTCOME_RETRIEVE_INVALID_REQUEST,
    OUTCOME_RETRIEVE_OK,
    emit_api_outcome,
)
from core.throttling import AnswerRateThrottle

# Unique sentinels: must never appear in captured operational output.
QUERY_SENTINEL = "SENSITIVE_QUERY_BOB5_7f3a9c2e"
PROMPT_SENTINEL = "SENSITIVE_PROMPT_BOB5_a1b2c3d4"
ANSWER_SENTINEL = "SENSITIVE_ANSWER_BOB5_e5f6a7b8"
EVIDENCE_SENTINEL = "SENSITIVE_EVIDENCE_BOB5_c9d0e1f2"
EXCEPTION_SENTINEL = "SENSITIVE_EXCEPTION_BOB5_11223344"
SECRET_SENTINEL = "SENSITIVE_SECRET_BOB5_deadbeef"

MATCHING_QUERY = "multi-agent fintech loan reallocation"
_SAFE_KEYS = frozenset(
    {"outcome", "correlation_id", "endpoint", "status_code", "duration_ms"}
)
_HEX_ID = re.compile(r"^[0-9a-f]{32}$")


def _fake_json(status: str, answer: str, citation_ids: list[str]) -> str:
    return json.dumps(
        {"status": status, "answer": answer, "citation_ids": citation_ids}
    )


def _corpus_with_evidence_sentinel() -> Corpus:
    corpus = get_corpus()
    result = retrieve_and_rerank(
        corpus, RetrievalQuery(query=MATCHING_QUERY)
    )
    selected_id = result.selected[0].record.id
    entries = tuple(
        replace(
            entry,
            record=replace(
                entry.record,
                text=f"{entry.record.text} {EVIDENCE_SENTINEL}",
            ),
        )
        if entry.record.id == selected_id
        else entry
        for entry in corpus.entries
    )
    return replace(corpus, entries=entries)


def _parse_events(log_output: list[str]) -> list[dict]:
    events: list[dict] = []
    for line in log_output:
        # assertLogs format: LEVEL:logger:message
        _, _, message = line.partition(":")
        _, _, payload = message.partition(":")
        text = payload.strip()
        if not text.startswith("{"):
            continue
        parsed = json.loads(text)
        if "outcome" in parsed:
            events.append(parsed)
    return events


class _TelemetryCapture:
    """Context manager around assertLogs for core.telemetry."""

    def __init__(self, test_case: unittest.TestCase) -> None:
        self._cm = test_case.assertLogs("core.telemetry", level="INFO")
        self.events: list[dict] = []
        self.raw_blob: str = ""

    def __enter__(self) -> _TelemetryCapture:
        self._raw = self._cm.__enter__()
        return self

    def __exit__(self, *args: object) -> None:
        self.raw_blob = "\n".join(self._raw.output)
        self.events = _parse_events(self._raw.output)
        self._cm.__exit__(*args)


class TelemetryHelperTests(unittest.TestCase):
    def test_emit_rejects_unknown_outcome_silently(self) -> None:
        with self.assertLogs("core.telemetry", level="INFO") as cm:
            logging.getLogger("core.telemetry").info('{"probe":true}')
            emit_api_outcome(
                outcome="answer.invented",
                correlation_id="abc123",
                endpoint=ENDPOINT_ANSWER,
                status_code=200,
                duration_ms=1,
            )
        payloads = " ".join(cm.output)
        self.assertNotIn("answer.invented", payloads)

    def test_allowed_outcomes_match_fixed_taxonomy(self) -> None:
        expected = {
            OUTCOME_ANSWER_OK,
            OUTCOME_ANSWER_INVALID_REQUEST,
            OUTCOME_ANSWER_THROTTLED,
            OUTCOME_ANSWER_SOFT_LIMIT,
            OUTCOME_ANSWER_PROVIDER_TIMEOUT,
            OUTCOME_ANSWER_PROVIDER_UNAVAILABLE,
            OUTCOME_ANSWER_PROVIDER_CONTRACT,
            OUTCOME_ANSWER_CORPUS_UNAVAILABLE,
            OUTCOME_ANSWER_DISABLED,
            OUTCOME_RETRIEVE_OK,
            OUTCOME_RETRIEVE_INVALID_REQUEST,
            OUTCOME_RETRIEVE_CORPUS_UNAVAILABLE,
        }
        self.assertEqual(ALLOWED_OUTCOMES, expected)


class RetrieveTelemetryTests(SimpleTestCase):
    def setUp(self) -> None:
        get_corpus.cache_clear()
        cache.clear()

    def _assert_privacy(self, blob: str) -> None:
        for sentinel in (
            QUERY_SENTINEL,
            PROMPT_SENTINEL,
            ANSWER_SENTINEL,
            EVIDENCE_SENTINEL,
            EXCEPTION_SENTINEL,
            SECRET_SENTINEL,
        ):
            self.assertNotIn(sentinel, blob)

    def _assert_event(
        self,
        event: dict,
        *,
        outcome: str,
        endpoint: str,
        status_code: int,
        correlation_id: str,
    ) -> None:
        self.assertEqual(set(event), _SAFE_KEYS)
        self.assertEqual(event["outcome"], outcome)
        self.assertEqual(event["endpoint"], endpoint)
        self.assertEqual(event["status_code"], status_code)
        self.assertEqual(event["correlation_id"], correlation_id)
        self.assertIsInstance(event["duration_ms"], int)
        self.assertGreaterEqual(event["duration_ms"], 0)

    def test_retrieve_ok_emits_one_event_and_correlation_header(self) -> None:
        with _TelemetryCapture(self) as cap:
            response = self.client.post(
                "/api/retrieve/",
                data=json.dumps({"query": f"{MATCHING_QUERY} {QUERY_SENTINEL}"}),
                content_type="application/json",
                headers={CORRELATION_HEADER: "client-supplied-should-ignore"},
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("matches", body)
        self.assertNotIn("answer", body)
        cid = response.headers[CORRELATION_HEADER]
        self.assertTrue(_HEX_ID.match(cid))
        self.assertNotEqual(cid, "client-supplied-should-ignore")
        self.assertEqual(len(cap.events), 1)
        self._assert_event(
            cap.events[0],
            outcome=OUTCOME_RETRIEVE_OK,
            endpoint=ENDPOINT_RETRIEVE,
            status_code=200,
            correlation_id=cid,
        )
        self._assert_privacy(cap.raw_blob)
        self._assert_privacy(json.dumps(cap.events))

    def test_retrieve_invalid_request(self) -> None:
        with _TelemetryCapture(self) as cap:
            response = self.client.post(
                "/api/retrieve/",
                data=json.dumps(
                    {"query": "   ", "role_lens": QUERY_SENTINEL}
                ),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())
        self.assertEqual(len(cap.events), 1)
        cid = response.headers[CORRELATION_HEADER]
        self._assert_event(
            cap.events[0],
            outcome=OUTCOME_RETRIEVE_INVALID_REQUEST,
            endpoint=ENDPOINT_RETRIEVE,
            status_code=400,
            correlation_id=cid,
        )
        self._assert_privacy(cap.raw_blob)
        self._assert_privacy(json.dumps(cap.events))

    def test_retrieve_corpus_unavailable(self) -> None:
        with (
            mock.patch(
                "core.views.get_corpus",
                side_effect=IndexUnavailableError(EXCEPTION_SENTINEL),
            ),
            _TelemetryCapture(self) as cap,
        ):
            response = self.client.post(
                "/api/retrieve/",
                data=json.dumps({"query": QUERY_SENTINEL}),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"error": "evidence index unavailable"})
        self.assertEqual(len(cap.events), 1)
        self._assert_event(
            cap.events[0],
            outcome=OUTCOME_RETRIEVE_CORPUS_UNAVAILABLE,
            endpoint=ENDPOINT_RETRIEVE,
            status_code=503,
            correlation_id=response.headers[CORRELATION_HEADER],
        )
        blob = cap.raw_blob + "\n" + json.dumps(cap.events)
        self._assert_privacy(blob)


class AnswerTelemetryTests(SimpleTestCase):
    def setUp(self) -> None:
        get_corpus.cache_clear()
        reset_answer_usage_for_tests()
        cache.clear()

    def _post(self, payload: object, **extra: object):
        return self.client.post(
            "/api/answer/",
            data=json.dumps(payload),
            content_type="application/json",
            **extra,
        )

    def _assert_privacy(self, blob: str) -> None:
        for sentinel in (
            QUERY_SENTINEL,
            PROMPT_SENTINEL,
            ANSWER_SENTINEL,
            EVIDENCE_SENTINEL,
            EXCEPTION_SENTINEL,
            SECRET_SENTINEL,
        ):
            self.assertNotIn(sentinel, blob)

    def _assert_single(
        self,
        cap: _TelemetryCapture,
        response,
        *,
        outcome: str,
        status_code: int,
    ) -> dict:
        self.assertEqual(response.status_code, status_code)
        self.assertEqual(len(cap.events), 1)
        event = cap.events[0]
        cid = response.headers[CORRELATION_HEADER]
        self.assertEqual(set(event), _SAFE_KEYS)
        self.assertEqual(event["outcome"], outcome)
        self.assertEqual(event["endpoint"], ENDPOINT_ANSWER)
        self.assertEqual(event["status_code"], status_code)
        self.assertEqual(event["correlation_id"], cid)
        self.assertTrue(_HEX_ID.match(cid))
        self._assert_privacy(cap.raw_blob)
        self._assert_privacy(json.dumps(cap.events))
        return event

    def _matching_provider(self, answer_text: str | None = None) -> FakeProvider:
        result = retrieve_and_rerank(
            get_corpus(), RetrievalQuery(query=MATCHING_QUERY)
        )
        evidence_id = result.selected[0].record.id
        prose = answer_text or f"Grounded [[{evidence_id}]]."
        return FakeProvider(
            _fake_json("answered", prose, [evidence_id]),
        )

    def test_answer_ok(self) -> None:
        corpus = _corpus_with_evidence_sentinel()
        result = retrieve_and_rerank(
            corpus, RetrievalQuery(query=MATCHING_QUERY)
        )
        evidence_id = result.selected[0].record.id
        provider = FakeProvider(
            _fake_json(
                "answered",
                f"{ANSWER_SENTINEL} [[{evidence_id}]].",
                [evidence_id],
            )
        )
        with (
            mock.patch(
                "core.layer1.answering.service.get_corpus",
                return_value=corpus,
            ),
            mock.patch(
                "core.layer1.answering.service.get_provider", return_value=provider
            ),
            _TelemetryCapture(self) as cap,
        ):
            response = self._post(
                {
                    "query": (
                        f"{MATCHING_QUERY} {QUERY_SENTINEL} {PROMPT_SENTINEL} "
                        f"{EVIDENCE_SENTINEL}"
                    )
                },
                headers={CORRELATION_HEADER: "client-id-ignored"},
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "answered")
        self.assertIn(ANSWER_SENTINEL, body["answer"])
        self.assertIn(EVIDENCE_SENTINEL, json.dumps(body["evidence"]))
        self._assert_single(
            cap, response, outcome=OUTCOME_ANSWER_OK, status_code=200
        )
        self.assertNotEqual(
            response.headers[CORRELATION_HEADER], "client-id-ignored"
        )

    def test_answer_invalid_request(self) -> None:
        with _TelemetryCapture(self) as cap:
            response = self._post(
                {"query": "  ", "role_lens": f"{QUERY_SENTINEL}-{SECRET_SENTINEL}"}
            )
        self.assertIn("error", response.json())
        self._assert_single(
            cap,
            response,
            outcome=OUTCOME_ANSWER_INVALID_REQUEST,
            status_code=400,
        )

    @override_settings(ANSWER_ENDPOINT_ENABLED=False)
    def test_answer_disabled(self) -> None:
        with _TelemetryCapture(self) as cap:
            response = self._post({"query": QUERY_SENTINEL})
        self.assertEqual(
            response.json(), {"error": "answer service unavailable"}
        )
        self._assert_single(
            cap, response, outcome=OUTCOME_ANSWER_DISABLED, status_code=503
        )

    @override_settings(
        ANSWER_DAILY_SOFT_LIMIT=1,
        ANSWER_PER_CLIENT_DAILY_LIMIT=0,
    )
    def test_answer_soft_limit(self) -> None:
        provider = self._matching_provider()
        with mock.patch(
            "core.layer1.answering.service.get_provider", return_value=provider
        ):
            self.assertEqual(self._post({"query": MATCHING_QUERY}).status_code, 200)
            with _TelemetryCapture(self) as cap:
                response = self._post(
                    {"query": f"{MATCHING_QUERY} {QUERY_SENTINEL}"}
                )
        self.assertEqual(response.status_code, 429)
        self.assertIn("error", response.json())
        self._assert_single(
            cap, response, outcome=OUTCOME_ANSWER_SOFT_LIMIT, status_code=429
        )

    def test_answer_throttled_preserves_drf_body(self) -> None:
        provider = self._matching_provider()
        with (
            mock.patch(
                "core.layer1.answering.service.get_provider", return_value=provider
            ),
            mock.patch.object(AnswerRateThrottle, "get_rate", return_value="1/min"),
        ):
            first = self._post({"query": MATCHING_QUERY})
            self.assertEqual(first.status_code, 200)
            with _TelemetryCapture(self) as cap:
                response = self._post(
                    {
                        "query": (
                            f"{MATCHING_QUERY} {QUERY_SENTINEL} "
                            f"{SECRET_SENTINEL}"
                        )
                    }
                )
        self.assertEqual(response.status_code, 429)
        body = response.json()
        self.assertIn("detail", body)
        self.assertNotIn("error", body)
        self._assert_single(
            cap, response, outcome=OUTCOME_ANSWER_THROTTLED, status_code=429
        )

    def test_answer_provider_timeout(self) -> None:
        with (
            mock.patch(
                "core.views.generate_answer",
                side_effect=ProviderTimeoutError(
                    f"gemini request failed (TimeoutError): {EXCEPTION_SENTINEL}"
                ),
            ),
            _TelemetryCapture(self) as cap,
        ):
            response = self._post({"query": f"{MATCHING_QUERY} {QUERY_SENTINEL}"})
        self.assertEqual(
            response.json(), {"error": "answer service unavailable"}
        )
        self._assert_single(
            cap,
            response,
            outcome=OUTCOME_ANSWER_PROVIDER_TIMEOUT,
            status_code=503,
        )

    def test_answer_provider_unavailable_config(self) -> None:
        with (
            mock.patch(
                "core.views.generate_answer",
                side_effect=ProviderUnavailableError(
                    f"missing key {SECRET_SENTINEL} {EXCEPTION_SENTINEL}"
                ),
            ),
            _TelemetryCapture(self) as cap,
        ):
            response = self._post({"query": QUERY_SENTINEL})
        self.assertEqual(
            response.json(), {"error": "answer service unavailable"}
        )
        self._assert_single(
            cap,
            response,
            outcome=OUTCOME_ANSWER_PROVIDER_UNAVAILABLE,
            status_code=503,
        )

    def test_answer_provider_unavailable_execution(self) -> None:
        with (
            mock.patch(
                "core.views.generate_answer",
                side_effect=ProviderError(
                    f"gemini request failed (APIError): {EXCEPTION_SENTINEL}"
                ),
            ),
            _TelemetryCapture(self) as cap,
        ):
            response = self._post({"query": QUERY_SENTINEL})
        self.assertEqual(
            response.json(), {"error": "answer service unavailable"}
        )
        self._assert_single(
            cap,
            response,
            outcome=OUTCOME_ANSWER_PROVIDER_UNAVAILABLE,
            status_code=503,
        )

    def test_answer_provider_contract(self) -> None:
        with (
            mock.patch(
                "core.views.generate_answer",
                side_effect=AnswerOutputError(
                    f"bad output {ANSWER_SENTINEL} {EVIDENCE_SENTINEL}"
                ),
            ),
            _TelemetryCapture(self) as cap,
        ):
            response = self._post({"query": QUERY_SENTINEL})
        self.assertEqual(
            response.json(), {"error": "answer could not be produced"}
        )
        self._assert_single(
            cap,
            response,
            outcome=OUTCOME_ANSWER_PROVIDER_CONTRACT,
            status_code=502,
        )

    def test_answer_corpus_unavailable(self) -> None:
        with (
            mock.patch(
                "core.views.generate_answer",
                side_effect=IndexUnavailableError(
                    f"index boom {EXCEPTION_SENTINEL} {EVIDENCE_SENTINEL}"
                ),
            ),
            _TelemetryCapture(self) as cap,
        ):
            response = self._post({"query": QUERY_SENTINEL})
        self.assertEqual(
            response.json(), {"error": "answer service unavailable"}
        )
        self._assert_single(
            cap,
            response,
            outcome=OUTCOME_ANSWER_CORPUS_UNAVAILABLE,
            status_code=503,
        )

    def test_health_has_correlation_header_without_outcome_event(self) -> None:
        with _TelemetryCapture(self) as cap:
            # assertLogs requires at least one record; probe is filtered out.
            logging.getLogger("core.telemetry").info('{"probe":true}')
            response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "portfolio-api"})
        self.assertTrue(_HEX_ID.match(response.headers[CORRELATION_HEADER]))
        self.assertEqual(cap.events, [])


class GeminiTimeoutMappingTests(unittest.TestCase):
    def test_timeout_error_maps_to_provider_timeout_error(self) -> None:
        from core.layer1.answering.providers.gemini import GeminiProvider

        fake_client = mock.Mock()
        fake_client.models.generate_content.side_effect = TimeoutError(
            EXCEPTION_SENTINEL
        )
        with (
            mock.patch(
                "core.layer1.answering.providers.gemini.config",
                side_effect=lambda key, default="": {
                    "GEMINI_API_KEY": SECRET_SENTINEL,
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
            with self.assertRaises(ProviderTimeoutError) as ctx:
                provider.generate(
                    system=PROMPT_SENTINEL, user=QUERY_SENTINEL
                )
        message = str(ctx.exception)
        self.assertIn("TimeoutError", message)
        self.assertNotIn(EXCEPTION_SENTINEL, message)
        self.assertNotIn(SECRET_SENTINEL, message)
        self.assertNotIn(PROMPT_SENTINEL, message)
        self.assertNotIn(QUERY_SENTINEL, message)


if __name__ == "__main__":
    unittest.main()
