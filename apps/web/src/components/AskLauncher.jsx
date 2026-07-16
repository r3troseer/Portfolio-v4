import { forwardRef, useImperativeHandle, useRef } from "react";
import { Sparkles, Command } from "lucide-react";
import { useDockFlight } from "../hooks/useDockFlight";

// Motion-only: this component does not call the backend. Clicking - inline, in flight,
// or docked - dispatches pf:open-assistant; AssistantShell opens the modal and runs
// retrieval. See docs/ui/ask-launcher-flight.md.
export const AskLauncher = forwardRef(function AskLauncher(_props, ref) {
  const launcherRef = useRef(null);
  const {
    prepareForRouteExit,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  } = useDockFlight(launcherRef);

  useImperativeHandle(ref, () => ({ prepareForRouteExit }), [prepareForRouteExit]);

  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent("pf:open-assistant"));
  };

  return (
    <button
      ref={launcherRef}
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
});
