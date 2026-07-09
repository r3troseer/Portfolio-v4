// The only code in apps/web that talks to the backend. Layer 1 retrieval:
// POST /api/retrieve/ returns ranked, publicly-indexable source entities - no
// generated answers, no model config, nothing but the query in the request body.
// See docs/agent/layer1-playground.md and apps/api/README.md for the contract.

import { readErrorMessage, resolveApiBase, safeReadJson } from "./apiClient.js";

const RETRIEVE_URL = `${resolveApiBase()}/api/retrieve/`;

/**
 * Retrieve ranked source entities for a query.
 *
 * Never throws for HTTP or network faults - it returns a typed result the UI
 * maps to a state. Only an AbortError propagates, so a superseded in-flight
 * request cancels silently.
 *
 * @param {Object} args
 * @param {string} args.query - the search text (backend caps at 500 chars).
 * @param {number} [args.topK=5] - 1..20; how many matches to return.
 * @param {string} [args.roleLens] - optional soft ranking boost (never a filter).
 * @param {AbortSignal} [args.signal] - to cancel a superseded request.
 * @returns {Promise<
 *   | { kind: "ok", matches: object[], meta: object }
 *   | { kind: "invalid", message: string }
 *   | { kind: "unavailable", message: string }
 *   | { kind: "error", message: string }
 * >}
 */
export async function retrieveEvidence({ query, topK = 5, roleLens, signal }) {
  const body = { query, top_k: topK };
  if (roleLens) body.role_lens = roleLens;

  let res;
  try {
    res = await fetch(RETRIEVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // A superseded request cancels silently; anything else is unreachable API
    // (offline, DNS, CORS, dev server down).
    if (err?.name === "AbortError") throw err;
    return { kind: "error", message: "Could not reach the retrieval service." };
  }

  if (res.ok) {
    const parsed = await safeReadJson(res);
    if (!parsed.ok) {
      return {
        kind: "unavailable",
        message: "The evidence index is unavailable.",
      };
    }
    const data = parsed.data;
    return {
      kind: "ok",
      matches: Array.isArray(data?.matches) ? data.matches : [],
      meta: data?.meta ?? {},
    };
  }

  if (res.status === 400) {
    return {
      kind: "invalid",
      message: await readErrorMessage(res, "That query could not be processed."),
    };
  }
  if (res.status === 503) {
    return { kind: "unavailable", message: "The evidence index is unavailable." };
  }
  if (res.status === 429) {
    return {
      kind: "error",
      message: "Too many requests - please wait a moment and try again.",
    };
  }
  return { kind: "error", message: `Retrieval failed (HTTP ${res.status}).` };
}
