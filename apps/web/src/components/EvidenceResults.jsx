import { Link } from "react-router";
import { Search, FileSearch, AlertTriangle, RotateCw, ArrowUpRight } from "lucide-react";
import { EVIDENCE_ORIGIN } from "../lib/evidenceNavigation";
import "../styles/profile/playground.css";

// Page-only evidence renderer for /playground. The assistant modal intentionally
// has its own compact pf-ask-* result surface.
export function EvidenceResults({ result, query, roleLens, onRetry }) {
  if (result.status === "idle") return null;

  if (result.status === "loading") {
    return (
      <div className="pf-pg-skel" aria-hidden="true">
        <div className="pf-pg-skel-bar" />
        <div className="pf-pg-skel-cards">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pf-pg-skel-card" />
          ))}
        </div>
      </div>
    );
  }

  if (result.kind === "invalid") {
    return (
      <div className="pf-pg-notice">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <p className="pf-pg-notice-title">That search could not be run</p>
          <p className="pf-pg-notice-body">{result.message}</p>
        </div>
      </div>
    );
  }

  if (result.kind === "unavailable" || result.kind === "error") {
    return (
      <div className="pf-pg-notice is-offline">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <p className="pf-pg-notice-title">Retrieval is offline</p>
          <p className="pf-pg-notice-body">
            {result.message}
            {import.meta.env.DEV
              ? " In local dev, make sure the API is running on http://localhost:8000."
              : ""}
          </p>
          {onRetry && (
            <button type="button" className="pf-pg-retry" onClick={onRetry}>
              <RotateCw size={14} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const matches = result.matches;
  if (matches.length === 0) {
    return (
      <div className="pf-pg-empty">
        <FileSearch size={22} aria-hidden="true" />
        <p>
          No public entities matched <span className="pf-pg-q">"{query}"</span>.
          Try different words or a starting point.
        </p>
      </div>
    );
  }

  const maxScore = matches.reduce((m, x) => Math.max(m, x.score ?? 0), 0);
  const total = result.meta?.total_records;

  return (
    <>
      <div className="pf-pg-seclabel">
        <Search size={14} aria-hidden="true" />
        <span>
          Retrieved entities &middot; {matches.length} result{matches.length === 1 ? "" : "s"}
          {typeof total === "number" ? ` of ${total} indexed` : ""}
        </span>
      </div>
      <div className="pf-pg-docs">
        {matches.map((m) => (
          <EvidenceDoc
            key={m.id}
            match={m}
            maxScore={maxScore}
            query={query}
            roleLens={roleLens}
          />
        ))}
      </div>
    </>
  );
}

function EvidenceDoc({ match, maxScore, query, roleLens }) {
  const pct = maxScore > 0 ? Math.round(((match.score ?? 0) / maxScore) * 100) : 0;
  const entityId = match.entity_id || match.project_id || match.source_id;
  const entityKind = match.entity_type || match.source_type;
  const snippet = match.snippet || match.text || "";

  const isLink = Boolean(match.project_id);

  const inner = (
    <>
      <div className="pf-pg-score" role="img" aria-label={`Lexical rank score ${match.score}`}>
        <span className="pf-pg-score-bar">
          <span className="pf-pg-score-fill" style={{ "--pf-pg-fill": `${pct}%` }} />
        </span>
        <span className="pf-pg-score-num" aria-hidden="true">
          {match.score}
        </span>
      </div>
      <div className="pf-pg-doc-body">
        <div className="pf-pg-doc-head">
          {entityId && <span className="pf-pg-doc-id">{entityId}</span>}
          <h2 className="pf-pg-doc-title">{match.title}</h2>
          <span className="pf-pg-doc-kind">{entityKind}</span>
        </div>
        <p className="pf-pg-doc-snippet">{snippet}</p>
        {(match.role_lenses?.length > 0 || match.tags?.length > 0) && (
          <div className="pf-pg-doc-tags">
            {(match.role_lenses ?? []).map((l) => (
              <span key={`l-${l}`} className="pf-pg-niche-tag">
                {l}
              </span>
            ))}
            {(match.tags ?? []).map((t) => (
              <span key={`t-${t}`} className="pf-pg-doc-tag">
                {t}
              </span>
            ))}
          </div>
        )}
        {match.source_path && <p className="pf-pg-doc-src">{match.source_path}</p>}
        {isLink && (
          <span className="pf-pg-doc-open">
            open entity <ArrowUpRight size={13} aria-hidden="true" />
          </span>
        )}
      </div>
    </>
  );

  // Only project-backed entities have a destination: the existing profile
  // project-detail page (carrying a playground origin so its back nav returns
  // here). Markdown/profile entities have no detail page, so they are static cards,
  // not a dead link. Wire those up if a dedicated passage-detail view is added
  // (see docs/agent/layer1-playground.md).
  if (isLink) {
    return (
      <Link
        to={`/projects/${match.project_id}`}
        state={{ from: EVIDENCE_ORIGIN.PLAYGROUND, q: query || "", roleLens }}
        className="pf-pg-doc"
      >
        {inner}
      </Link>
    );
  }
  return <article className="pf-pg-doc">{inner}</article>;
}
