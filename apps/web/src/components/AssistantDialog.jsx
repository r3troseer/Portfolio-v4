import { useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Sparkles,
  X,
  ArrowUp,
  CornerDownRight,
  ShieldCheck,
  Layers,
  ArrowRight,
  FileText,
} from "lucide-react";
import { GroundedAnswer } from "./GroundedAnswer";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { useGroundedAnswer, answerLiveMessage } from "../lib/useGroundedAnswer";
import { EVIDENCE_ORIGIN } from "../lib/evidenceNavigation";
import { PRESETS } from "../lib/playgroundPresets";
import "../styles/profile/assistant-dialog.css";

// Lazy-loaded assistant dialog body: input, presets, GroundedAnswer, evidence,
// sources, and Playground CTA. Open/close orchestration stays in AssistantShell.
export function AssistantDialog({
  inputValue,
  setInputValue,
  ran,
  setRan,
  onClose,
  onPrepareRouteExit,
}) {
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  const { result, retry } = useGroundedAnswer(ran.query, ran.lens);
  const hasQueried = ran.query !== "";
  const isDone = hasQueried && result.status === "done";
  const hasAnswer =
    isDone && result.kind === "ok" && result.answerStatus === "answered";
  const evidence = isDone && result.kind === "ok" ? result.evidence ?? [] : [];
  const citations = isDone && result.kind === "ok" ? result.citations ?? [] : [];
  const showFootCTA =
    isDone &&
    result.kind === "ok" &&
    (result.answerStatus === "answered" || evidence.length > 0);
  const showLedger =
    isDone && result.kind === "ok" && result.answerStatus !== "refused";

  useDialogA11y(true, onClose, panelRef);

  const submit = (e) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) return;
    if (q === ran.query && ran.lens === undefined) {
      retry();
      return;
    }
    setRan({ query: q, lens: undefined });
  };

  const runPreset = (p) => {
    setInputValue(p.query);
    if (p.query === ran.query && p.roleLens === ran.lens) {
      retry();
      return;
    }
    setRan({ query: p.query, lens: p.roleLens });
  };

  const openInPlayground = () => {
    // F-01: release any temporary entrance reparent before Layout unmounts
    // AssistantShell on /playground. Same event turn; navigation is not delayed.
    onPrepareRouteExit?.();
    const typed = inputValue.trim();
    const answered = hasQueried && result.status === "done";
    if (answered && (!typed || typed === ran.query)) {
      navigate("/playground", {
        state: { q: ran.query, roleLens: ran.lens },
      });
    } else if (typed) {
      navigate("/playground", { state: { stage: typed } });
    } else {
      navigate("/playground");
    }
    onClose();
  };

  return (
    <div className="pf-assistant-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="pf-assistant-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Ask about Pius"
        onClick={(e) => e.stopPropagation()}
      >
        <form className="pf-ask-inputrow" onSubmit={submit} role="search">
          <span className="pf-ask-inputicon">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <label htmlFor="pf-ask-field" className="pf-ask-sr">
            Search Pius&apos;s public work
          </label>
          <input
            id="pf-ask-field"
            className="pf-assistant-input"
            placeholder="Ask anything about Pius: his work, skills, experience"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoComplete="off"
            maxLength={500}
          />
          <button
            type="submit"
            className="pf-ask-submit"
            disabled={!inputValue.trim()}
            aria-label="Search public entities"
          >
            <ArrowUp size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pf-assistant-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </form>

        <p className="pf-ask-sr" role="status" aria-live="polite">
          {answerLiveMessage(result)}
        </p>

        <div className="pf-ask-body">
          {!hasQueried ? (
            <div className="pf-ask-intro">
              <p className="pf-ask-intro-label">
                Grounded in Pius&apos;s portfolio. Try asking:
              </p>
              <div className="pf-ask-suggestions">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="pf-ask-suggestion"
                    onClick={() => runPreset(p)}
                  >
                    <CornerDownRight size={14} aria-hidden="true" /> {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <GroundedAnswer
                result={result}
                variant="modal"
                query={ran.query}
                roleLens={ran.lens}
                returnTo={returnTo}
                onRetry={retry}
              />
              {showLedger && (
                <ModalEvidence
                  matches={evidence}
                  query={ran.query}
                  roleLens={ran.lens}
                  returnTo={returnTo}
                />
              )}
              {isDone && hasAnswer && citations.length > 0 && (
                <ModalSources
                  citations={citations}
                  query={ran.query}
                  roleLens={ran.lens}
                  returnTo={returnTo}
                />
              )}
            </>
          )}
        </div>

        {showFootCTA ? (
          <div className="pf-ask-footwrap">
            <button
              type="button"
              className="pf-ask-footcta"
              onClick={openInPlayground}
            >
              <span className="pf-ask-footcta-l">
                <Layers size={16} aria-hidden="true" />
                <span className="pf-ask-footcta-tx">
                  <strong>Open in Playground</strong>
                  <span>
                    See scores, reranking &amp; the evidence behind this &middot;
                    grounded data
                  </span>
                </span>
              </span>
              <ArrowRight className="pf-ask-footcta-ar" size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="pf-ask-foot">
            <span className="pf-ask-foot-note">
              <ShieldCheck size={12} aria-hidden="true" /> Answers are grounded in
              Pius&apos;s portfolio data
            </span>
            <button
              type="button"
              className="pf-ask-foot-btn"
              onClick={openInPlayground}
            >
              <Layers size={13} aria-hidden="true" /> Open in Playground
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalSources({ citations, query, roleLens, returnTo }) {
  return (
    <div className="pf-ask-cites">
      <span className="pf-ask-cites-label">Sources</span>
      {citations.map((citation) => (
        <ModalCiteChip
          key={citation.evidence_id}
          citation={citation}
          query={query}
          roleLens={roleLens}
          returnTo={returnTo}
        />
      ))}
    </div>
  );
}

function ModalCiteChip({ citation, query, roleLens, returnTo }) {
  const label = citation.title || citation.evidence_id;
  if (citation.project_id) {
    return (
      <Link
        to={`/projects/${citation.project_id}`}
        state={{
          from: EVIDENCE_ORIGIN.ASSISTANT,
          q: query || "",
          roleLens,
          returnTo,
        }}
        className="pf-ask-cite"
      >
        {label}
      </Link>
    );
  }
  return <span className="pf-ask-cite is-static">{label}</span>;
}

function ModalEvidence({ matches, query, roleLens, returnTo }) {
  if (matches.length === 0) {
    return (
      <p className="pf-ask-empty">
        No public entities matched that query. Try different words or a starting point.
      </p>
    );
  }

  const maxScore = matches.reduce((m, x) => Math.max(m, x.score ?? 0), 0);
  return (
    <div className="pf-ask-blocks">
      {matches.map((m) => (
        <ModalDoc
          key={m.id}
          match={m}
          maxScore={maxScore}
          query={query}
          roleLens={roleLens}
          returnTo={returnTo}
        />
      ))}
    </div>
  );
}

function ModalDoc({ match, maxScore, query, roleLens, returnTo }) {
  const pct = maxScore > 0 ? Math.round(((match.score ?? 0) / maxScore) * 100) : 0;
  const entityId = match.entity_id || match.project_id || match.source_id;
  const snippet = match.snippet || match.text || "";

  const inner = (
    <>
      <div className="pf-ask-evdoc-head">
        <FileText size={14} aria-hidden="true" />
        <span className="pf-ask-evdoc-id">doc &middot; {entityId}</span>
        <span
          className="pf-ask-evdoc-score"
          aria-label={`Relative rank ${pct} percent`}
        >
          {pct}%
        </span>
      </div>
      <h4>{match.title}</h4>
      <p>{snippet}</p>
    </>
  );

  if (match.project_id) {
    return (
      <Link
        to={`/projects/${match.project_id}`}
        state={{
          from: EVIDENCE_ORIGIN.ASSISTANT,
          q: query || "",
          roleLens,
          returnTo,
        }}
        className="pf-ask-evdoc"
      >
        {inner}
      </Link>
    );
  }
  return <div className="pf-ask-evdoc">{inner}</div>;
}
