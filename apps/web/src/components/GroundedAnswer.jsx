import { useEffect, useState } from "react";
import { Terminal, AlertTriangle, Info } from "lucide-react";
import {
  HANDOFF_MODAL_UNAVAILABLE,
} from "../lib/answerMessages";
import { genLabelFromQuery, renderProse, stripProseMarkup } from "../lib/renderProse";

// Grounded-answer surfaces ported from the profile handoff:
// - Page: ev-gen-status loading + gen-prose with inline gen-cite chips (pf-pg-*)
// - Modal: pf-ask-answer plain text only (Sources render in AssistantShell)
// See docs/agent/layer1-playground.md.

function PageComposeError({ detail, onRetry }) {
  return (
    <>
      <div className="pf-pg-ev-meta is-error">
        Couldn&apos;t compose a view for that one. Try rephrasing, or pick a skill with{" "}
        <strong>/</strong>.
      </div>
      {detail ? <div className="pf-pg-ev-meta-detail">{detail}</div> : null}
      {onRetry ? (
        <button type="button" className="pf-pg-retry" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </>
  );
}

export function GroundedAnswer({
  result,
  variant = "page",
  query,
  roleLens,
  onRetry,
}) {
  const isModal = variant === "modal";
  const [openCitationId, setOpenCitationId] = useState(null);

  useEffect(() => {
    setOpenCitationId(null);
  }, [query, result.status, result.kind]);

  if (result.status === "idle") return null;

  if (result.status === "loading") {
    if (isModal) {
      return (
        <div className="pf-ask-loading">
          <span className="pf-ask-dot" />
          <span className="pf-ask-dot" />
          <span className="pf-ask-dot" />
          <span className="pf-ask-loading-text">Retrieving evidence...</span>
        </div>
      );
    }
    return (
      <div className="pf-pg-gen-status" aria-hidden="true">
        <span className="pf-pg-gen-skill">
          <Terminal size={13} aria-hidden="true" /> {genLabelFromQuery(query)}
        </span>
        <span className="pf-pg-gen-think">
          retrieving evidence &middot; composing interface
          <span className="pf-pg-ev-caret" />
        </span>
      </div>
    );
  }

  if (result.status !== "done") return null;

  if (result.kind !== "ok") {
    const retry = ["unavailable", "malformed", "error"].includes(result.kind)
      ? onRetry
      : undefined;
    if (isModal) {
      return (
        <div className="pf-ask-error">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{HANDOFF_MODAL_UNAVAILABLE}</span>
          {retry ? (
            <button type="button" className="pf-ask-retry" onClick={retry}>
              Try again
            </button>
          ) : null}
        </div>
      );
    }
    const detail =
      result.kind === "invalid" ||
      result.kind === "malformed" ||
      result.kind === "unavailable" ||
      result.kind === "error"
        ? result.message
        : undefined;
    return <PageComposeError detail={detail} onRetry={retry} />;
  }

  const { answerStatus, answer, citations, headline } = result;

  if (answerStatus === "refused") {
    if (isModal) {
      return (
        <div className="pf-ask-refusal">
          <Info size={16} aria-hidden="true" /> {answer}
        </div>
      );
    }
    return (
      <div className="pf-pg-ev-meta is-refusal">
        <Info size={14} aria-hidden="true" /> {answer}
      </div>
    );
  }

  if (answerStatus === "insufficient_evidence") {
    if (isModal) {
      return <p className="pf-ask-answer">{answer}</p>;
    }
    return <div className="pf-pg-ev-meta">{answer}</div>;
  }

  if (isModal) {
    return <p className="pf-ask-answer">{stripProseMarkup(answer)}</p>;
  }

  return (
    <div className="pf-pg-gen-page">
      {headline?.title ? (
        <div className="pf-pg-gen-node pf-pg-gen-node-in">
          <div className="pf-pg-gen-headline">
            <h2>{headline.title}</h2>
            {headline.sub ? <p>{headline.sub}</p> : null}
          </div>
        </div>
      ) : null}
      <div className="pf-pg-gen-node pf-pg-gen-node-in">
        <div className="pf-pg-gen-prose">
          <p>
            {renderProse(answer, citations, {
              query,
              roleLens,
              openCitationId,
              onCitationToggle: setOpenCitationId,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
