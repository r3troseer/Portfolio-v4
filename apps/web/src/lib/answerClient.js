// Client for POST /api/answer/ - the Layer 1 grounded-answer endpoint. It
// retrieves and deterministically reranks public evidence server-side, calls
// the model server-side with the selected evidence only, validates the output,
// and returns a grounded answer with citations, the selected evidence, and the
// retrieve-to-rerank ledger. The raw evidence endpoint (/api/retrieve/) is a
// separate call. No model config or keys ever touch the browser.
// See docs/agent/layer1-playground.md and apps/api/README.md for the contract.

import { readErrorMessage, resolveApiBase, safeReadJson } from "./apiClient.js";

const ANSWER_URL = `${resolveApiBase()}/api/answer/`;

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
 *   | { kind: "ok", answerStatus: string, answer: string, citations: object[], evidence: object[], headline: object | null, ledger: object | null, meta: object }
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
    const parsed = await safeReadJson(res);
    if (!parsed.ok) {
      return {
        kind: "unavailable",
        message: "The answer service is currently unavailable.",
      };
    }
    const data = parsed.data;
    return {
      kind: "ok",
      answerStatus:
        typeof data?.status === "string" ? data.status : "insufficient_evidence",
      answer: typeof data?.answer === "string" ? data.answer : "",
      citations: Array.isArray(data?.citations) ? data.citations : [],
      evidence: Array.isArray(data?.evidence) ? data.evidence : [],
      headline:
        typeof data?.headline?.title === "string" && data.headline.title
          ? data.headline
          : null,
      ledger: data?.ledger ?? null,
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
