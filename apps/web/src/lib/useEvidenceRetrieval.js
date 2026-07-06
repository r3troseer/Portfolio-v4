import { useEffect, useState } from "react";
import { retrieveEvidence } from "./retrievalClient";

// Shared retrieval state machine for the Cmd+K modal and /playground page - same
// fetch/retry contract, but each surface renders with its own card UI (pf-ask-* vs
// pf-pg-*). Fetches whenever `query` (or `roleLens`) changes, cancelling any
// superseded in-flight request, and exposes a `retry` for the offline state. An
// empty query is the idle state.
export function useEvidenceRetrieval(query, roleLens) {
  const [result, setResult] = useState({ status: "idle" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const q = (query || "").trim();
    if (!q) {
      setResult({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setResult({ status: "loading" });
    retrieveEvidence({ query: q, roleLens, signal: controller.signal })
      .then((r) => setResult({ status: "done", ...r }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult({
          status: "done",
          kind: "error",
          message: "Something went wrong while searching.",
        });
      });
    return () => controller.abort();
  }, [query, roleLens, nonce]);

  return { result, retry: () => setNonce((n) => n + 1) };
}

// A short, polite announcement for assistive tech, derived from a result.
export function retrievalLiveMessage(result) {
  if (result.status === "loading") return "Searching evidence...";
  if (result.status !== "done") return "";
  if (result.kind === "ok") {
    const n = result.matches.length;
    if (n === 0) return "No evidence matched your search.";
    return `${n} evidence result${n === 1 ? "" : "s"} found.`;
  }
  if (result.kind === "invalid") return result.message;
  return "Retrieval is unavailable.";
}
