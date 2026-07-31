import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// The handoff's rag-insp retrieval inspector (re-authored as pf-pg-rag-*):
// a pill summarising the retrieval, opening a retrieve-to-rerank panel backed
// entirely by the backend ledger - pre (lexical) score, post (rerank) score,
// and rank movement per candidate. "Open full ledger" expands from the
// selected rows to the whole reranked candidate pool. Nothing here is
// fabricated client-side. See docs/agent/layer1-playground.md.

const COLLAPSED_ROWS = 5;

function TrendCell({ delta }) {
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "same";
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <span className={`pf-pg-rag-trend ${dir}`}>
      <Icon size={12} aria-hidden="true" />
      {Math.abs(delta)}
    </span>
  );
}

export function RetrievalInspector({ ledger }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsidePress = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const reranked = Array.isArray(ledger?.reranked) ? ledger.reranked : [];
  const selectedCount = Array.isArray(ledger?.selected)
    ? ledger.selected.length
    : 0;
  if (!reranked.length) return null;

  const hasMore = reranked.length > COLLAPSED_ROWS;
  const rows = full ? reranked : reranked.slice(0, COLLAPSED_ROWS);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="pf-pg-rag-pillwrap pf-pg-settle" ref={wrapRef}>
      <button
        type="button"
        className="pf-pg-rag-pill"
        aria-expanded={open}
        aria-controls="pf-pg-rag-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Layers size={14} aria-hidden="true" />
        <span>retrieval</span>
        <span className="pf-pg-rag-sep" aria-hidden="true" />
        <span className="pf-pg-rag-count">{selectedCount} entities</span>
        <Chevron size={14} className="pf-pg-rag-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="pf-pg-rag-panel pf-pg-settle" id="pf-pg-rag-panel">
          <div className="pf-pg-rag-head">
            <ArrowLeftRight size={13} aria-hidden="true" />
            <span>retrieve to rerank</span>
            <span className="pf-pg-rag-k">k={reranked.length}</span>
          </div>
          <div className="pf-pg-rag-rows">
            {rows.map((row) => (
              <div
                className="pf-pg-rag-insprow"
                key={row.evidence_id}
                title={row.reasons?.length ? row.reasons.join("; ") : undefined}
              >
                <span className="pf-pg-rag-ititle">{row.title}</span>
                <span className="pf-pg-rag-pre">{row.lexical_score}</span>
                <ArrowRight
                  size={13}
                  className="pf-pg-rag-arrow"
                  aria-hidden="true"
                />
                <span className="pf-pg-rag-post">{row.rerank_score}</span>
                <TrendCell delta={row.delta} />
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              className="pf-pg-rag-foot"
              onClick={() => setFull((value) => !value)}
            >
              {full ? (
                <>
                  <Minimize2 size={13} aria-hidden="true" />
                  show top {COLLAPSED_ROWS}
                </>
              ) : (
                <>
                  <Maximize2 size={13} aria-hidden="true" />
                  open full ledger
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
