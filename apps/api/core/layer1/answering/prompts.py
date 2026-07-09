"""Prompt text for the grounded-answer service - intentionally tunable.

All prompt wording lives here (not scattered across service/provider/tests) so
Pius can iterate on tone and rules in one place. The service passes SYSTEM_PROMPT
as the model's system instruction and builds the per-request user prompt from the
query plus the retrieved public evidence via ``build_user_prompt``.
"""

from core.layer1.retrieval import ScoredMatch

# The model receives only the supplied public evidence and must ground every
# substantive claim in it. Private/internal details are excluded structurally by
# the index gate (they never reach retrieval); the rules below are a second line.
SYSTEM_PROMPT = """You answer questions about Pius Agboola using only the supplied public portfolio evidence.

Rules:
- Use only the evidence provided in this request.
- Do not use outside knowledge.
- Do not infer private facts.
- Do not mention or rely on private/internal ESG, X-RAG, supervisor, dissertation, prompt, dataset, model, or evaluation details unless they appear in the supplied public evidence.
- Do not hard-ban the public phrase X-RAG if it appears in supplied public evidence; refuse only private/internal implementation questions or unsupported claims.
- If the evidence does not support an answer, return insufficient_evidence.
- If the question is outside Pius's public work, skills, projects, education, or professional experience, return refused.
- Keep the answer concise, specific, and recruiter-friendly (2-4 sentences).
- Speak about Pius in the third person.
- For status "answered", cite with [[id]] immediately after the claim it supports, using the exact id value from each evidence block below (cite sparingly). Example: id project:gfa-exchange is cited as [[project:gfa-exchange]], not [[evidence_id:project:gfa-exchange]].
- For status "answered", you may use ==phrase== to highlight 1-2 key phrases (plain text only otherwise).
- Use one id per [[...]] marker; do not combine multiple ids in a single marker.
- citation_ids must list every id referenced in [[...]] markers (de-duplicated, id values only).
- Do not use numeric [1] or [01] markers in the answer - those are display labels computed by the UI.
- Return JSON only.

Return strictly this JSON shape and nothing else:
{"status": "answered" | "insufficient_evidence" | "refused", "answer": "string", "citation_ids": ["id", ...]}

The citation_ids must be drawn only from the id values supplied below. For insufficient_evidence and refused, return an empty citation_ids list."""


def _format_evidence(matches: tuple[ScoredMatch, ...]) -> str:
    """Render retrieved evidence as id-labelled blocks the model can cite by id."""
    blocks: list[str] = []
    for match in matches:
        record = match.record
        blocks.append(
            f"id: {record.id}\n"
            f"title: {record.title}\n"
            f"content: {record.text}"
        )
    return "\n\n".join(blocks)


def build_user_prompt(
    query: str,
    matches: tuple[ScoredMatch, ...],
    role_lens: str | None = None,
) -> str:
    """Compose the per-request user prompt from the query and retrieved evidence."""
    lens_line = f"\nRole lens (soft hint, not a filter): {role_lens}" if role_lens else ""
    return (
        f"Question: {query}{lens_line}\n\n"
        f"Public portfolio evidence:\n\n{_format_evidence(matches)}\n\n"
        "Answer the question using only the evidence above. Return JSON only."
    )
