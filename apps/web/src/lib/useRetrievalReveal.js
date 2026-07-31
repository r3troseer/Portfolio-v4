import { useEffect, useRef, useState } from "react";

// Phase machine for the handoff-style rag-reveal loader and retrieval
// inspector on /playground. It combines the /api/retrieve/ result (fast, real
// ledger for the reveal rows) with the /api/answer/ result (authoritative
// final ledger). Honesty rule: reveal rows are only ever real backend ledger
// data - before /api/retrieve/ resolves the reveal shows neutral skeleton
// rows with no titles, scores, or ranks.
//
// Phases:
//   idle    - no query.
//   pending - retrieve in flight: skeleton reveal rows only.
//   active  - retrieve resolved with a non-empty ledger: real reveal rows
//             animate in (handoff rag-reveal).
//   done    - ~1.4s after entering active (handoff timing; shortened under
//             prefers-reduced-motion): the reveal collapses to the inspector
//             pill while the answer may still be composing underneath.

const REVEAL_MS = 1400; // prototype: setTimeout(..., 1400) after reveal starts
const REVEAL_REDUCED_MS = 200;
const REVEAL_ROWS = 5; // prototype shows the top 5 rows in the reveal

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Map the ledger's selected rows to reveal-row view models. Widths are
// relative to the top rerank score in this result set (ordering, not
// confidence); the prototype's absolute 0.72 dim threshold becomes relative.
function revealRows(ledger) {
  const selected = Array.isArray(ledger?.selected) ? ledger.selected : [];
  const rows = selected.slice(0, REVEAL_ROWS);
  const topScore = rows.length ? Math.max(rows[0].rerank_score, 1) : 1;
  return rows.map((row, index) => ({
    id: row.evidence_id,
    title: row.title,
    score: row.rerank_score,
    widthPct: Math.max(4, Math.round((row.rerank_score / topScore) * 100)),
    delaySeconds: (index * 0.1).toFixed(1),
    dim: row.rerank_score < topScore * 0.72,
  }));
}

/**
 * @param {object} retrieval - result of useEvidenceRetrieval (idle|loading|done).
 * @param {object} answer - result of useGroundedAnswer (idle|loading|done).
 * @returns {{ phase: "idle"|"pending"|"active"|"done", rows: object[], ledger: object|null }}
 */
export function useRetrievalReveal(retrieval, answer) {
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef(null);

  const retrieveOk = retrieval.status === "done" && retrieval.kind === "ok";
  const retrieveFailed = retrieval.status === "done" && retrieval.kind !== "ok";
  const answerOk = answer.status === "done" && answer.kind === "ok";
  const answerLedger = answerOk && answer.ledger ? answer.ledger : null;

  // The answer's ledger is authoritative once present; until then the
  // retrieve ledger drives the reveal/inspector.
  const ledger = answerLedger ?? (retrieveOk ? retrieval.ledger : null);

  // Collapse the reveal into the pill REVEAL_MS after real rows appear.
  useEffect(() => {
    if (retrieval.status === "loading" || retrieval.status === "idle") {
      setCollapsed(false);
      return undefined;
    }
    if (!retrieveOk) return undefined;
    const delay = prefersReducedMotion() ? REVEAL_REDUCED_MS : REVEAL_MS;
    timerRef.current = setTimeout(() => setCollapsed(true), delay);
    return () => clearTimeout(timerRef.current);
  }, [retrieval.status, retrieveOk]);

  if (retrieval.status === "idle" && answer.status === "idle") {
    return { phase: "idle", rows: [], ledger: null };
  }

  // Refusal hides all retrieval artifacts (the backend omits the ledger too).
  if (answerOk && answer.answerStatus === "refused") {
    return { phase: "idle", rows: [], ledger: null };
  }

  // Retrieve failed but the answer brought its own ledger: skip straight to
  // the pill - there was never a reveal worth animating.
  if (retrieveFailed) {
    if (answerLedger) return { phase: "done", rows: [], ledger: answerLedger };
    return { phase: "idle", rows: [], ledger: null };
  }

  if (retrieval.status === "loading") {
    return { phase: "pending", rows: [], ledger: null };
  }

  if (!ledger || !(ledger.selected || []).length) {
    // Deterministic no-results ledger (or none): nothing to reveal/inspect.
    return { phase: "idle", rows: [], ledger: null };
  }

  return {
    phase: collapsed ? "done" : "active",
    rows: revealRows(ledger),
    ledger,
  };
}
