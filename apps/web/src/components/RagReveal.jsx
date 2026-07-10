// The handoff's rag-reveal retrieval loader (re-authored as pf-pg-rag-*):
// while the grounded answer composes, the real retrieve-to-rerank rows from
// the backend ledger animate in. Honesty rule: before /api/retrieve/ resolves
// (phase "pending") only neutral skeleton rows render - titles, scores, and
// ranks are never fabricated client-side.
// See .notes/prototypes/profile-handoff (local-only) and
// docs/agent/layer1-playground.md.

const SKELETON_ROWS = 3;

export function RagReveal({ phase, rows }) {
  if (phase !== "pending" && phase !== "active") return null;

  const isPending = phase === "pending";

  return (
    <div className="pf-pg-rag-reveal pf-pg-settle" aria-hidden="true">
      <div className="pf-pg-rag-reveal-header">
        <span className="pf-pg-rag-reveal-dot" />
        {isPending
          ? "retrieving · reranking entities"
          : `retrieving · reranking ${rows.length} entities`}
      </div>
      <div className="pf-pg-rag-reveal-rows">
        {isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div className="pf-pg-rag-reveal-row" key={`skeleton-${i}`}>
                <span className="pf-pg-rag-reveal-title is-skeleton" />
                <div className="pf-pg-rag-reveal-bar">
                  <div className="pf-pg-rag-reveal-shimmer" />
                </div>
                <span className="pf-pg-rag-reveal-score is-skeleton" />
              </div>
            ))
          : rows.map((row) => (
              <div className="pf-pg-rag-reveal-row" key={row.id}>
                <span className="pf-pg-rag-reveal-title">{row.title}</span>
                <div className="pf-pg-rag-reveal-bar">
                  <div
                    className="pf-pg-rag-reveal-fill"
                    style={{
                      width: `${row.widthPct}%`,
                      animationDelay: `${row.delaySeconds}s`,
                    }}
                  />
                </div>
                <span
                  className={`pf-pg-rag-reveal-score${row.dim ? " dim" : ""}`}
                >
                  {row.score}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}
