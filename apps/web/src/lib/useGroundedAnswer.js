import { useEffect, useState } from "react";
import { getGroundedAnswer } from "./answerClient";
import { HANDOFF_MODAL_UNAVAILABLE } from "./answerMessages";

// Shared grounded-answer state machine for the Cmd+K modal and /playground page -
// mirrors useEvidenceRetrieval, but calls POST /api/answer/ instead of retrieve.
// Fetches whenever `query` (or `roleLens`) changes, cancelling any superseded
// in-flight request, and exposes a `retry` for the offline state. An empty query
// is the idle state. The result carries the answer payload (answerStatus, answer,
// citations, evidence, meta) alongside the transport `kind`.
export function useGroundedAnswer(query, roleLens) {
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
    getGroundedAnswer({ query: q, roleLens, signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) {
          setResult({ status: "done", ...r });
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResult({
          status: "done",
          kind: "error",
          message: HANDOFF_MODAL_UNAVAILABLE,
        });
      });
    return () => controller.abort();
  }, [query, roleLens, nonce]);

  return { result, retry: () => setNonce((n) => n + 1) };
}

// A short, polite announcement for assistive tech, derived from a result.
export function answerLiveMessage(result) {
  if (result.status === "loading") return "Retrieving evidence for your question.";
  if (result.status !== "done") return "";
  if (result.kind !== "ok") {
    if (result.kind === "invalid") return result.message;
    return HANDOFF_MODAL_UNAVAILABLE;
  }
  if (result.answerStatus === "answered") {
    const n = result.citations.length;
    return `Answer ready, grounded in ${n} citation${n === 1 ? "" : "s"}.`;
  }
  if (result.answerStatus === "refused") {
    return "That question is outside Pius's public portfolio.";
  }
  return "Not enough public evidence to answer that confidently.";
}
