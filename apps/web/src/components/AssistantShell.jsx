import { useEffect, useState } from "react";
import { Sparkles, X, Info, ArrowUp, CornerDownRight, ShieldCheck } from "lucide-react";
import "../styles/profile/assistant.css";

// Assistant shell: the Cmd/Ctrl+K launcher + a placeholder "Ask about Pius"
// panel. Shell only — no backend, LLM, retrieval, or key storage. The real
// grounded assistant is a future backend concern (docs/ui/profile-ui-refresh.md).
export const AssistantShell = () => {
  const [open, setOpen] = useState(false);
  const [showFloating, setShowFloating] = useState(true);

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

  // The hero's inline launcher opens the panel via this event.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("pf:open-assistant", onOpen);
    return () => window.removeEventListener("pf:open-assistant", onOpen);
  }, []);

  // The floating launcher appears once the hero scrolls out of view — or
  // immediately on pages that have no hero (e.g. project detail).
  useEffect(() => {
    const hero = document.getElementById("home");
    if (!hero) {
      setShowFloating(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setShowFloating(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" }
    );
    observer.observe(hero);
    return () => observer.disconnect();
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

  return (
    <>
      <button
        type="button"
        className={`pf-fab pf-ask-pill${showFloating ? " pf-fab-visible" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Ask about Pius (Command or Control + K)"
      >
        <Sparkles size={16} /> Ask about Pius
        <span className="pf-kbd">⌘K</span>
      </button>

      {open && (
        <div className="pf-assistant-overlay" onClick={() => setOpen(false)}>
          <div
            className="pf-assistant-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Ask about Pius"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pf-ask-inputrow">
              <span className="pf-ask-inputicon">
                <Sparkles size={18} />
              </span>
              <input
                className="pf-assistant-input"
                placeholder="Ask anything about Pius: his work, skills, experience"
                disabled
              />
              <button
                type="button"
                className="pf-ask-submit"
                disabled
                aria-label="Ask (coming soon)"
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="pf-assistant-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="pf-ask-body">
              <div className="pf-ask-note">
                <Info size={16} />
                <span>
                  The grounded assistant is coming soon. It will answer using
                  only Pius&apos;s public work — with cited evidence, not
                  guesses.
                </span>
              </div>
              <span className="pf-ask-suggestlabel">
                Grounded in Pius&apos;s portfolio. Try asking:
              </span>
              <div className="pf-ask-suggestions">
                <button type="button" className="pf-ask-suggestion" disabled>
                  <CornerDownRight size={14} /> What is Pius best at?
                </button>
                <button type="button" className="pf-ask-suggestion" disabled>
                  <CornerDownRight size={14} /> Show me his AI and NLP work
                </button>
                <button type="button" className="pf-ask-suggestion" disabled>
                  <CornerDownRight size={14} /> What did he build at Touch and Pay?
                </button>
                <button type="button" className="pf-ask-suggestion" disabled>
                  <CornerDownRight size={14} /> Is he a good fit for a backend role?
                </button>
              </div>
            </div>

            <div className="pf-ask-foot">
              <ShieldCheck size={14} /> Answers are grounded in Pius&apos;s
              portfolio data
            </div>
          </div>
        </div>
      )}
    </>
  );
};
