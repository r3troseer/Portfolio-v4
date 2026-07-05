import { useRef } from "react";
import { Sparkles, Command } from "lucide-react";
import { useDockFlight } from "../hooks/useDockFlight";

// The single "Ask about Pius" launcher. It flies between the hero action-row
// slot (.pf-ask-slot placeholder) and the persistent bottom-left dock, driven by
// useDockFlight. Clicking it - inline, in flight, or docked - signals intent via
// the pf:open-assistant event; the AssistantShell opens the modal. Shell only:
// no backend, LLM, retrieval, or keys. See docs/ui/ask-launcher-flight.md.
export const AskLauncher = () => {
  const ref = useRef(null);
  const { onHoverIn, onHoverOut, onPressIn, onPressOut } = useDockFlight(ref);

  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent("pf:open-assistant"));
  };

  return (
    <button
      ref={ref}
      type="button"
      className="pf-ask-fly"
      onClick={openAssistant}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      onMouseDown={onPressIn}
      onMouseUp={onPressOut}
      aria-label="Ask about Pius (Command or Control + K)"
    >
      <Sparkles className="pf-ask-fly-ico" size={17} />
      <span className="pf-ask-fly-label">Ask about Pius</span>
      <span className="pf-ask-fly-sub">grounded in his real work</span>
      <span className="pf-ask-fly-kbd">
        <Command size={11} />K
      </span>
    </button>
  );
};
