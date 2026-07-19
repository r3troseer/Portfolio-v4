import { useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigation } from "react-router";
import {
  installSpaRouteModuleFailureGuard,
  noteNavigationOrigin,
  setCrossPathNavigationPending,
  subscribeRouteRecoveryActive,
} from "../lib/frameworkRouteRecovery";
import "../styles/framework-route-transition.css";

const PROGRESS_MS = 200;
const LABEL_MS = 800;

/**
 * Destination-aware polite copy for long pending navigations.
 * Short transitions never reach this text (800 ms gate).
 */
function destinationPendingLabel(pathname) {
  if (typeof pathname !== "string" || !pathname) return "Loading page...";
  if (pathname === "/") return "Loading home...";
  if (pathname === "/playground" || pathname.startsWith("/playground/")) {
    return "Opening Playground...";
  }
  if (pathname.startsWith("/projects/")) return "Loading project...";
  return "Loading page...";
}

/**
 * Non-blocking adaptive feedback for unresolved Framework navigations.
 * Owns useNavigation + delayed feedback timers so SiteLayout does not rerender
 * for progress/label-only state. Marks route main busy via mainRef while the
 * real router pending lifecycle is active (Link, programmatic, Back, Forward).
 */
export function FrameworkRouteTransition({ mainRef }) {
  const location = useLocation();
  const navigation = useNavigation();
  const [showProgress, setShowProgress] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [recoveryCleared, setRecoveryCleared] = useState(false);

  const nextLocation =
    navigation.state === "idle" ? null : navigation.location ?? null;
  const isPending = Boolean(
    nextLocation && nextLocation.pathname !== location.pathname
  );
  const pendingKey = isPending
    ? `${nextLocation.key ?? ""}:${nextLocation.pathname}`
    : null;
  const label = isPending
    ? destinationPendingLabel(nextLocation.pathname)
    : "";

  useEffect(() => {
    installSpaRouteModuleFailureGuard();
  }, []);

  useEffect(() => {
    return subscribeRouteRecoveryActive(() => {
      setShowProgress(false);
      setShowLabel(false);
      setRecoveryCleared(true);
      const main = mainRef?.current;
      if (main) main.removeAttribute("aria-busy");
    });
  }, [mainRef]);

  useEffect(() => {
    if (!isPending) {
      setCrossPathNavigationPending(false);
      setShowProgress(false);
      setShowLabel(false);
      return undefined;
    }

    // Capture settled origin (Go back) and in-flight destination (Try again).
    noteNavigationOrigin(location.pathname, location.search);
    setCrossPathNavigationPending(
      true,
      nextLocation.pathname,
      nextLocation.search
    );
    setRecoveryCleared(false);

    let cancelled = false;
    setShowProgress(false);
    setShowLabel(false);

    const progressTimer = window.setTimeout(() => {
      if (!cancelled) setShowProgress(true);
    }, PROGRESS_MS);
    const labelTimer = window.setTimeout(() => {
      if (!cancelled) setShowLabel(true);
    }, LABEL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(progressTimer);
      window.clearTimeout(labelTimer);
    };
  }, [
    isPending,
    pendingKey,
    location.pathname,
    location.search,
    nextLocation?.pathname,
    nextLocation?.search,
  ]);

  // Imperative busy mark keeps SiteLayout free of pending-state props/renders
  // while still exposing aria-busy on the real route main element.
  useLayoutEffect(() => {
    const main = mainRef?.current;
    if (!main) return undefined;

    if (isPending && !recoveryCleared) {
      main.setAttribute("aria-busy", "true");
    } else {
      main.removeAttribute("aria-busy");
    }

    return () => {
      main.removeAttribute("aria-busy");
    };
  }, [isPending, recoveryCleared, mainRef]);

  const visibleProgress = isPending && !recoveryCleared && showProgress;
  const visibleLabel = isPending && !recoveryCleared && showLabel && label;

  return (
    <>
      {visibleProgress ? (
        <div
          className="pf-route-progress"
          aria-hidden="true"
          data-framework-route-progress=""
        >
          <div className="pf-route-progress__bar" />
        </div>
      ) : null}
      {visibleLabel ? (
        <div
          className="pf-route-pending-label"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-framework-route-pending-label=""
        >
          {label}
        </div>
      ) : null}
    </>
  );
}
