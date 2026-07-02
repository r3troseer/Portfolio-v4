import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
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
        className={`pf-fab${showFloating ? " pf-fab-visible" : ""}`}
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
            <div className="pf-assistant-head">
              <span className="pf-eyebrow">
                <Sparkles size={13} /> Ask about Pius
              </span>
              <button
                type="button"
                className="pf-assistant-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="pf-assistant-inputwrap">
              <input
                className="pf-assistant-input"
                placeholder="Ask anything about Pius's work, skills, or experience…"
                disabled
              />
              <span className="pf-kbd">Enter</span>
            </div>

            <div className="pf-assistant-placeholder">
              <p className="pf-assistant-note">
                The grounded assistant is coming soon. It will answer using only
                Pius&apos;s public work — with cited evidence, not guesses.
              </p>
              <ul className="pf-assistant-hints">
                <li>“What has Pius built with FastAPI?”</li>
                <li>“Show his fintech experience.”</li>
                <li>“Which projects use NLP or retrieval?”</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
