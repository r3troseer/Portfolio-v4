// Served-answer response validator. Loads the committed schema from
// packages/contracts (never duplicated here). Ajv is imported only from this
// module so the homepage critical bundle can keep it out via dynamic import
// from answerClient.js.
//
// Public errors must never include schema paths, validator messages, or raw
// payloads — callers map failures to a controlled internal result.

import Ajv2020 from "ajv/dist/2020.js";
import schema from "../../../../packages/contracts/answer-response.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);

/**
 * Companion invariant: every citations[].evidence_id must appear as some
 * evidence[].id (documented in packages/contracts/invariants.json).
 * @param {unknown} payload
 * @returns {boolean}
 */
export function citationEvidenceIdsSubset(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const citations = /** @type {{ citations?: unknown }} */ (payload).citations;
  const evidence = /** @type {{ evidence?: unknown }} */ (payload).evidence;
  if (!Array.isArray(citations) || !Array.isArray(evidence)) {
    return false;
  }
  const ids = new Set(
    evidence
      .filter((row) => row && typeof row === "object" && !Array.isArray(row))
      .map((row) => /** @type {{ id?: unknown }} */ (row).id)
      .filter((id) => typeof id === "string"),
  );
  for (const citation of citations) {
    if (!citation || typeof citation !== "object" || Array.isArray(citation)) {
      return false;
    }
    const evidenceId = /** @type {{ evidence_id?: unknown }} */ (citation)
      .evidence_id;
    if (typeof evidenceId !== "string" || !ids.has(evidenceId)) {
      return false;
    }
  }
  return true;
}

/**
 * Validate a served answer payload against the shared contract.
 * @param {unknown} payload
 * @returns {{ ok: true } | { ok: false }}
 */
export function validateAnswerResponse(payload) {
  if (!validateSchema(payload)) {
    return { ok: false };
  }
  if (!citationEvidenceIdsSubset(payload)) {
    return { ok: false };
  }
  return { ok: true };
}
