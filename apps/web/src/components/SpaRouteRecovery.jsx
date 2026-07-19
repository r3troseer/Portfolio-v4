import { Component, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { focusRouteDestination } from "../lib/routeCompletion";
import {
  getSpaRouteRecoveryState,
  isRouteModuleLoadFailure,
  reportSpaRouteModuleFailure,
  retrySpaRouteRecovery,
  SPA_ROUTE_FAILURE_CATEGORY,
  SPA_ROUTE_RECOVERY_COPY,
  subscribeSpaRouteRecovery,
} from "../lib/spaRouteRecovery";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "../styles/spa-route-recovery.css";

/**
 * Error boundary for rejected lazy route-module / chunk loads.
 * Non-module errors are rethrown so they are not converted into PC2 recovery.
 */
export class RouteModuleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { moduleFailed: false, passthrough: null };
  }

  static getDerivedStateFromError(error) {
    if (isRouteModuleLoadFailure(error)) {
      return { moduleFailed: true, passthrough: null };
    }
    return { moduleFailed: false, passthrough: error };
  }

  componentDidCatch(error) {
    if (!isRouteModuleLoadFailure(error)) return;
    const destinationPath =
      typeof this.props.destinationPath === "string"
        ? this.props.destinationPath
        : typeof window !== "undefined"
          ? window.location.pathname
          : "/";
    reportSpaRouteModuleFailure(destinationPath);
  }

  render() {
    if (this.state.passthrough) {
      throw this.state.passthrough;
    }
    if (this.state.moduleFailed) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

/**
 * Compact recovery surface for terminal SPA route-module failures.
 */
export function SpaRouteRecovery() {
  const headingRef = useRef(null);
  const [liveMessage, setLiveMessage] = useState("");
  const recovery = useSyncExternalStore(
    subscribeSpaRouteRecovery,
    getSpaRouteRecoveryState,
    getSpaRouteRecoveryState
  );
  const previousPath = recovery.previousPath;
  const showGoBack = Boolean(previousPath && previousPath !== "/");
  const copy = SPA_ROUTE_RECOVERY_COPY;

  useDocumentTitle(`${copy.title} - Pius Agboola`);

  useLayoutEffect(() => {
    if (recovery.status !== "failed") return undefined;
    const heading = headingRef.current;
    if (!heading) return undefined;
    focusRouteDestination(heading);
    setLiveMessage(copy.title);
    return undefined;
  }, [recovery.status, recovery.destinationPath, copy.title]);

  const onTryAgain = () => {
    retrySpaRouteRecovery();
  };

  const onGoBack = () => {
    if (!previousPath) return;
    window.location.assign(previousPath);
  };

  const onBackHome = () => {
    window.location.assign("/");
  };

  return (
    <section
      className="pf-spa-recovery"
      data-spa-failure={SPA_ROUTE_FAILURE_CATEGORY}
    >
      <p className="pf-spa-recovery-sr" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        data-route-focus="spa-recovery"
      >
        {copy.title}
      </h1>
      <p>{copy.body}</p>
      <div className="pf-spa-recovery-actions">
        <button type="button" className="pf-btn-primary" onClick={onTryAgain}>
          {copy.tryAgain}
        </button>
        {showGoBack ? (
          <button type="button" className="pf-btn-ghost" onClick={onGoBack}>
            {copy.goBack}
          </button>
        ) : null}
        <button type="button" className="pf-btn-ghost" onClick={onBackHome}>
          {copy.backHome}
        </button>
      </div>
    </section>
  );
}
