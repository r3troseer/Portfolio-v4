// Client for POST /api/answer/ - the Layer 1 grounded-answer endpoint. It
// retrieves public evidence server-side, calls the model server-side, validates
// the output, and returns a grounded answer with citations plus the evidence
// ledger. The raw evidence endpoint (/api/retrieve/) is unchanged; this is a
// separate call. No model config or keys ever touch the browser.
// See docs/agent/layer1-playground.md and apps/api/README.md for the contract.

// Base-URL resolution mirrors retrievalClient.js: explicit build-time env wins;
// local dev falls back to the Django dev server; a prod build with no env set
// falls back to same-origin "/api".
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : "")
).replace(/\/$/, "");

const ANSWER_URL = `${API_BASE}/api/answer/`;

async function readErrorMessage(res, fallback) {
  try {
    const data = await res.json();
    return typeof data?.error === "string" && data.error ? data.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Request a grounded answer for a query.
 *
 * Never throws for HTTP or network faults - it returns a typed result the UI
 * maps to a state. Only an AbortError propagates, so a superseded in-flight
 * request cancels silently. The answer status ("answered" | "refused" |
 * "insufficient_evidence") is returned as `answerStatus` to avoid colliding
 * with the hook's state-machine `status`.
 *
 * @param {Object} args
 * @param {string} args.query - the question (backend caps at 500 chars).
 * @param {number} [args.topK=5] - 1..20; how much evidence to ground on.
 * @param {string} [args.roleLens] - optional soft ranking boost (never a filter).
 * @param {AbortSignal} [args.signal] - to cancel a superseded request.
 * @returns {Promise<
 *   | { kind: "ok", answerStatus: string, answer: string, citations: object[], evidence: object[], meta: object }
 *   | { kind: "invalid", message: string }
 *   | { kind: "unavailable", message: string }
 *   | { kind: "malformed", message: string }
 *   | { kind: "error", message: string }
 * >}
 */
export async function getGroundedAnswer({ query, topK = 5, roleLens, signal }) {
  const body = { query, top_k: topK };
  if (roleLens) body.role_lens = roleLens;

  let res;
  try {
    res = await fetch(ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return { kind: "error", message: "Could not reach the answer service." };
  }

  if (res.ok) {
    const data = await res.json();
    return {
      kind: "ok",
      answerStatus:
        typeof data?.status === "string" ? data.status : "insufficient_evidence",
      answer: typeof data?.answer === "string" ? data.answer : "",
      citations: Array.isArray(data?.citations) ? data.citations : [],
      evidence: Array.isArray(data?.evidence) ? data.evidence : [],
      meta: data?.meta ?? {},
    };
  }

  if (res.status === 400) {
    return {
      kind: "invalid",
      message: await readErrorMessage(res, "That question could not be processed."),
    };
  }
  if (res.status === 503) {
    return {
      kind: "unavailable",
      message: "The answer service is currently unavailable.",
    };
  }
  if (res.status === 502) {
    return {
      kind: "malformed",
      message: "A grounded answer could not be produced for that question.",
    };
  }
  if (res.status === 429) {
    return {
      kind: "error",
      message: "Too many requests - please wait a moment and try again.",
    };
  }
  return { kind: "error", message: `Answer failed (HTTP ${res.status}).` };
}
