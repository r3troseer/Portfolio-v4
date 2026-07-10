import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Search, ChevronLeft, ChevronRight, CornerDownLeft } from "lucide-react";
import { useGroundedAnswer, answerLiveMessage } from "../lib/useGroundedAnswer";
import { EvidenceResults } from "../components/EvidenceResults";
import { GroundedAnswer } from "../components/GroundedAnswer";
import { PRESETS, PRESET_BY_ID } from "../lib/playgroundPresets";
import { getProfile } from "../content/adapters/profileAdapter";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "../styles/profile/playground.css";

// The Layer 1 evidence workspace, ported from the profile handoff's "Evidence"
// view (.notes/prototypes/profile-handoff). It calls POST /api/answer/ for a
// grounded, cited answer and renders the evidence ledger underneath. The raw
// ledger endpoint (POST /api/retrieve/) is unchanged; there is no reranking yet.
//
// Query source (privacy): free text arrives via navigation state (never the URL);
// only whitelisted preset ids use ?p=. It resolves in three states, matching the
// handoff's _launchPlayground:
//   - state.q      -> run and show the results strip (also the modal's STATE 3)
//   - state.stage  -> pre-fill the hero, do NOT run (the modal's STATE 2)
//   - ?p=<id>      -> run a whitelisted preset
//   - otherwise    -> empty hero (STATE 1)
// See docs/agent/layer1-playground.md.
function resolveRequest(state, presetId) {
  const freeText = typeof state?.q === "string" ? state.q.trim() : "";
  const stateLens =
    typeof state?.roleLens === "string" ? state.roleLens.trim() || undefined : undefined;
  if (freeText) return { query: freeText, roleLens: stateLens, stage: "" };
  const preset = presetId ? PRESET_BY_ID[presetId] : undefined;
  if (preset) return { query: preset.query, roleLens: preset.roleLens, stage: "" };
  const staged = typeof state?.stage === "string" ? state.stage.trim() : "";
  return { query: "", roleLens: undefined, stage: staged };
}

function PlaygroundAbout() {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="pf-pg-about-wrap" ref={wrapRef}>
      <button
        type="button"
        className="pf-pg-about-toggle"
        aria-label="About this playground"
        aria-expanded={open}
        aria-controls="pf-pg-about"
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open && (
        <aside className="pf-pg-about" id="pf-pg-about">
          <strong>About this playground</strong>
          <p>
            Ask about Pius&apos;s public portfolio. Answers are composed by a
            server-side model, grounded only in the retrieved public evidence
            shown below. Evidence is ranked by lexical retrieval - there is no
            reranking yet.
          </p>
          <p>Score bars show relative rank in this result set, not confidence.</p>
        </aside>
      )}
    </div>
  );
}

export function Playground() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { name } = getProfile();
  useDocumentTitle("Evidence Playground - Pius Agboola");

  const { query: requestedQuery, roleLens: requestedLens, stage } = resolveRequest(
    location.state,
    searchParams.get("p")
  );

  const [inputValue, setInputValue] = useState(requestedQuery || stage);
  const { result, retry } = useGroundedAnswer(requestedQuery, requestedLens);

  // Mirror the resolved/staged query into the box when navigation changes it.
  useEffect(() => {
    setInputValue(requestedQuery || stage);
  }, [requestedQuery, stage]);

  const runQuery = (e) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) return;
    if (q === requestedQuery && requestedLens === undefined) {
      retry();
      return;
    }
    // Free text goes via navigation state - never the URL.
    navigate("/playground", { state: { q } });
  };

  const goPreset = (id) => {
    const preset = PRESET_BY_ID[id];
    if (
      preset &&
      preset.query === requestedQuery &&
      preset.roleLens === requestedLens
    ) {
      retry();
      return;
    }
    navigate(`/playground?p=${id}`);
  };
  const goPortfolio = () => navigate("/");
  const newQuery = () => navigate("/playground");

  const isHero = !requestedQuery.trim();
  const evidence = result.kind === "ok" ? result.evidence ?? [] : [];
  const hasEvidence = evidence.length > 0;
  // Show starting-point chips when there is nothing else to act on.
  const showChips = result.status === "done" && !hasEvidence;
  // Feed the existing ledger renderer with the evidence from the answer response.
  const ledgerResult = { status: "done", kind: "ok", matches: evidence, meta: result.meta };

  const queryBox = (
    <form className="pf-pg-query" role="search" onSubmit={runQuery}>
      <Search className="pf-pg-query-ico" size={18} aria-hidden="true" />
      <span className="pf-pg-query-label">query &gt;</span>
      <label htmlFor="pf-pg-input" className="pf-pg-sr">
        Search Pius's public work
      </label>
      <input
        id="pf-pg-input"
        className="pf-pg-query-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="ask anything about Pius's work, skills, or experience"
        autoComplete="off"
        maxLength={500}
      />
      <button
        type="submit"
        className="pf-pg-query-run"
        disabled={!inputValue.trim()}
        aria-label="Run query"
      >
        <CornerDownLeft size={15} aria-hidden="true" />
      </button>
    </form>
  );

  const chips = (
    <div className="pf-pg-chips">
      {PRESETS.map((p) => (
        <button key={p.id} type="button" className="pf-pg-chip" onClick={() => goPreset(p.id)}>
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className="pf-pg">
      <p className="pf-pg-sr" role="status" aria-live="polite">
        {answerLiveMessage(result)}
      </p>

      {isHero ? (
        <div className="pf-pg-hero">
          <button type="button" className="pf-pg-exit" onClick={goPortfolio}>
            <ChevronLeft size={14} aria-hidden="true" /> portfolio
          </button>
          <div className="pf-pg-hero-mark">
            <span className="pf-pg-hero-dot" aria-hidden="true" />
            <span className="pf-pg-hero-name">pius</span>
            <span className="pf-pg-hero-slash">/ rag playground</span>
          </div>
          <p className="pf-pg-hero-sub">query the work &middot; retrieve &middot; compose</p>
          <div className="pf-pg-query-wrap">{queryBox}</div>
          {chips}
        </div>
      ) : (
        <>
          <div className="pf-pg-chrome">
            <div className="pf-pg-crumb" role="navigation" aria-label="Breadcrumb">
              <button type="button" className="pf-pg-crumb-home" onClick={goPortfolio}>
                portfolio
              </button>
              <ChevronRight className="pf-pg-crumb-sep" size={13} aria-hidden="true" />
              <span className="pf-pg-crumb-dot" aria-hidden="true" />
              <span className="pf-pg-crumb-here">rag playground</span>
            </div>
            <div className="pf-pg-chrome-actions">
              <button type="button" className="pf-pg-new" onClick={newQuery}>
                <CornerDownLeft size={12} aria-hidden="true" /> new
              </button>
              <PlaygroundAbout />
            </div>
          </div>
          <div className="pf-pg-strip">
            <div className="pf-pg-query-wrap is-sticky">{queryBox}</div>
            <GroundedAnswer
              result={result}
              variant="page"
              query={requestedQuery}
              roleLens={requestedLens}
              onRetry={retry}
            />
            {hasEvidence && (
              <EvidenceResults
                result={ledgerResult}
                query={requestedQuery}
                roleLens={requestedLens}
              />
            )}
            {showChips && chips}
            <footer className="pf-pg-footer">
              <p>
                composed for your query &middot; &copy; {new Date().getFullYear()} {name}
              </p>
            </footer>
          </div>
        </>
      )}
    </section>
  );
}
