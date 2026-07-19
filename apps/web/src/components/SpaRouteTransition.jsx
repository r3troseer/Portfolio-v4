import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { setRouteSettlementCoordinator } from "../lib/routeCompletion";
import { clearSpaRouteRecoveryOnSuccess } from "../lib/spaRouteRecovery";
import {
  beginSpaRouteTransition,
  endSpaRouteTransition,
  getSpaRouteTransitionState,
  getTrackedPathname,
  setTrackedPathname,
  shouldBeginFromLinkClick,
  subscribeSpaRouteTransition,
} from "../lib/spaRouteTransition";
import "../styles/spa-route-transition.css";

/**
 * Owns the Branch A SPA pending lifecycle: capture cross-path Link clicks and
 * Back/Forward, delay restrained progress/status feedback, and clear through
 * the existing route-settlement coordinator when destinations become ready.
 */
export function SpaRouteTransition() {
  const location = useLocation();
  const transition = useSyncExternalStore(
    subscribeSpaRouteTransition,
    getSpaRouteTransitionState,
    getSpaRouteTransitionState
  );

  useLayoutEffect(() => {
    setRouteSettlementCoordinator((descriptor, settle) => {
      endSpaRouteTransition(descriptor);
      clearSpaRouteRecoveryOnSuccess();
      return settle();
    });
    return () => setRouteSettlementCoordinator(null);
  }, []);

  useLayoutEffect(() => {
    setTrackedPathname(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (event) => {
      const destinationPath = shouldBeginFromLinkClick(
        event,
        getTrackedPathname()
      );
      if (!destinationPath) return;
      beginSpaRouteTransition(destinationPath, getTrackedPathname());
    };

    const onPopState = () => {
      const previousPath = getTrackedPathname();
      const nextPath = window.location.pathname;
      beginSpaRouteTransition(nextPath, previousPath);
      setTrackedPathname(nextPath);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return (
    <>
      <div
        className={`pf-spa-progress${transition.showProgress ? " is-visible" : ""}`}
        aria-hidden="true"
      >
        <div className="pf-spa-progress__bar" />
      </div>
      <div
        className={`pf-spa-status${transition.statusMessage ? " is-visible" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {transition.statusMessage}
      </div>
    </>
  );
}
