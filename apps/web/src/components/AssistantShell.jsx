import { useEffect, useRef, useState } from "react";
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
  AlertTriangle,
} from "lucide-react";
import { AskLauncher } from "./AskLauncher";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { useEvidenceRetrieval, retrievalLiveMessage } from "../lib/useEvidenceRetrieval";
import { EVIDENCE_ORIGIN } from "../lib/evidenceNavigation";
import { PRESETS } from "../lib/playgroundPresets";
import "../styles/profile/assistant.css";

// Assistant shell: the flying "Ask about Pius" launcher + the Cmd/Ctrl+K modal.
// The modal is an interactive evidence surface (not just a launcher): submitting a
// query - or a preset - runs POST /api/retrieve/ and renders the ranked entities
// INLINE. Moving to the full /playground page is the user's explicit choice via
// "Open in Playground", which seeds the page with the query/results (the handoff's
// STATE 1/2/3). No generated answers. See docs/agent/layer1-playground.md.
export const AssistantShell = () => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [ran, setRan] = useState({ query: "", lens: undefined });
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  const { result } = useEvidenceRetrieval(ran.query, ran.lens);
  const hasQueried = ran.query !== "";
  const hasResults =
    hasQueried &&
    result.status === "done" &&
    result.kind === "ok" &&
    result.matches.length > 0;

  useDialogA11y(open, () => setOpen(false), panelRef);

  // Route changes normally close the modal. A project opened from modal evidence
  // can explicitly restore the same query on its originating route.
  useEffect(() => {
    const resume = location.state?.resumeAssistant;
    if (typeof resume?.query === "string" && resume.query.trim()) {
      const query = resume.query.trim();
      setInputValue(query);
      setRan({ query, lens: resume.roleLens });
      setOpen(true);
      return;
    }
    setOpen(false);
  }, [location.key]);

  // Cmd/Ctrl+K toggles the panel; Escape closes it.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The launcher (and any other trigger) opens the panel via this event.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("pf:open-assistant", onOpen);
    return () => window.removeEventListener("pf:open-assistant", onOpen);
  }, []);

  // Lock body scroll while the panel is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Submit / presets run retrieval INLINE (no navigation).
  const submit = (e) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) return;
    setRan({ query: q, lens: undefined });
  };

  const runPreset = (p) => {
    setInputValue(p.query);
    setRan({ query: p.query, lens: p.roleLens });
  };

  // The only path to the full page - the user's choice. Seeds per the handoff:
  //  STATE 3: already answered here -> open the results strip for that query.
  //  STATE 2: something typed but not run -> pre-fill the hero (no run).
  //  STATE 1: nothing -> empty hero.
  const openInPlayground = () => {
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
    setOpen(false);
  };

  return (
    <>
      <AskLauncher />

      {open && (
        <div className="pf-assistant-overlay" onClick={() => setOpen(false)}>
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
                Search Pius's public work
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
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </form>

            <p className="pf-ask-sr" role="status" aria-live="polite">
              {retrievalLiveMessage(result)}
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
                <ModalEvidence
                  result={result}
                  query={ran.query}
                  roleLens={ran.lens}
                  returnTo={returnTo}
                />
              )}
            </div>

            {hasResults ? (
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
                      <span>See the ranked entities behind this</span>
                    </span>
                  </span>
                  <ArrowRight className="pf-ask-footcta-ar" size={15} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="pf-ask-foot">
                <span className="pf-ask-foot-note">
                  <ShieldCheck size={12} aria-hidden="true" /> Sources grounded in
                  Pius&apos;s portfolio
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
      )}
    </>
  );
};

// The modal's own compact evidence rendering (handoff pf-ask-*), distinct from the
// page's ev-doc surface: a dot loader, a red error, and compact entity cards
// (entity id + relative-rank score pill + title + clamped display snippet).
function ModalEvidence({ result, query, roleLens, returnTo }) {
  if (result.status === "loading") {
    return (
      <div className="pf-ask-loading">
        <span className="pf-ask-dot" />
        <span className="pf-ask-dot" />
        <span className="pf-ask-dot" />
        <span className="pf-ask-loading-text">Retrieving entities...</span>
      </div>
    );
  }

  if (
    result.kind === "invalid" ||
    result.kind === "unavailable" ||
    result.kind === "error"
  ) {
    return (
      <div className="pf-ask-error">
        <AlertTriangle size={16} aria-hidden="true" /> {result.message}
      </div>
    );
  }

  const matches = result.matches || [];
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
        <span className="pf-ask-evdoc-id">entity &middot; {entityId}</span>
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

  // Only project-backed entities link out (to the existing project-detail page);
  // markdown/profile entities are static cards, not dead links.
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
