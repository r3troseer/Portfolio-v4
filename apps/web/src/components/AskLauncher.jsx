import { useRef } from "react";
import { Sparkles, Command } from "lucide-react";
import { useDockFlight } from "../hooks/useDockFlight";

// Motion-only: this component does not call the backend. Clicking - inline, in flight,
// or docked - dispatches pf:open-assistant; AssistantShell opens the modal and runs
// retrieval. See docs/ui/ask-launcher-flight.md.
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
