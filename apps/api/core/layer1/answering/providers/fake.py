"""Test-only and verify-session answer providers.

FakeProvider returns a canned raw response for unit tests.
AutoFakeProvider synthesises a valid grounded answer from the user prompt
(evidence ids embedded by build_user_prompt) for local UI verification when
ANSWER_PROVIDER=fake. Never touches the network.
"""

import json
import re

from .base import AnswerProvider

_ID_LINE_RE = re.compile(r"^id:\s*(.+)$", re.MULTILINE)


class FakeProvider(AnswerProvider):
    provider_name = "fake"

    def __init__(self, response: str, model_name: str = "fake-model") -> None:
        self._response = response
        self.model_name = model_name
        self.calls = 0

    def generate(self, *, system: str, user: str) -> str:
        self.calls += 1
        return self._response


class AutoFakeProvider(AnswerProvider):
    """Build a valid answered JSON payload from retrieved ids in the user prompt."""

    provider_name = "fake"

    def __init__(self, model_name: str = "fake-model") -> None:
        self.model_name = model_name
        self.calls = 0

    def generate(self, *, system: str, user: str) -> str:
        self.calls += 1
        ids = _ID_LINE_RE.findall(user)
        if not ids:
            return json.dumps(
                {
                    "status": "insufficient_evidence",
                    "answer": "",
                    "citation_ids": [],
                }
            )
        evidence_id = ids[0].strip()
        answer = (
            f"Pius delivered ==portfolio evidence== grounded in [[{evidence_id}]]."
        )
        return json.dumps(
            {
                "status": "answered",
                "answer": answer,
                "citation_ids": [evidence_id],
            }
        )
