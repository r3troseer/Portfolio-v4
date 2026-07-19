import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useRouteError } from "react-router";
import {
  RECOVERY_COPY,
  ROUTE_FAILURE_CATEGORY,
  assignSafeInternalDestination,
  categorizeRouteFailure,
  dismissModuleRecovery,
  getRecoveryBackPath,
  getRecoveryDestinationPath,
  notifyRouteRecoveryActive,
  toSafeInternalPath,
} from "../lib/frameworkRouteRecovery";
import { focusRouteDestination } from "../lib/routeCompletion";
import "../styles/framework-route-recovery.css";

/**
 * Shared bounded recovery surface. `variant="boundary"` is mounted from the
 * root ErrorBoundary (loader/.data). `variant="module"` is mounted in-layout
 * when SPA route-module reload conversion activates.
 */
export function FrameworkRouteRecovery({ variant = "boundary" }) {
  const isModuleVariant = variant === "module";
  // Hook is safe when no route error is active; returns undefined.
  const routeError = useRouteError();
  const location = useLocation();
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const didFocusRef = useRef(false);
  const [liveMessage, setLiveMessage] = useState("");

  const category = isModuleVariant
    ? ROUTE_FAILURE_CATEGORY.MODULE
    : categorizeRouteFailure(routeError);

  const locationPath = toSafeInternalPath(
    `${location.pathname}${location.search}`
  );
  const retryDestination =
    (isModuleVariant ? getRecoveryDestinationPath() : null) || locationPath;
  const backPath = getRecoveryBackPath();
  const showGoBack = Boolean(backPath && backPath !== locationPath);

  useLayoutEffect(() => {
    notifyRouteRecoveryActive();
    document.getElementById("main")?.removeAttribute("aria-busy");

    if (didFocusRef.current) return;
    didFocusRef.current = true;
    focusRouteDestination(headingRef.current);
    setLiveMessage(RECOVERY_COPY.title);
  }, []);

  useEffect(() => {
    document.title = `${RECOVERY_COPY.title} - Pius Agboola`;
  }, []);

  const handleTryAgain = () => {
    const dest = retryDestination || "/";
    if (isModuleVariant) {
      // Hard assign clears RR's hung lazy promise after swallowed chunk failure.
      dismissModuleRecovery();
      assignSafeInternalDestination(dest);
      return;
    }
    navigate(dest, { replace: true });
  };

  const handleGoBack = () => {
    if (!showGoBack || !backPath) return;
    if (isModuleVariant) {
      dismissModuleRecovery();
      assignSafeInternalDestination(backPath);
      return;
    }
    navigate(backPath);
  };

  const handleBackHome = (event) => {
    if (!isModuleVariant) return;
    event.preventDefault();
    dismissModuleRecovery();
    if (location.pathname !== "/" || location.search) {
      assignSafeInternalDestination("/");
    }
  };

  return (
    <section
      className="pf-route-recovery"
      data-framework-route-recovery=""
      data-failure-category={category}
      data-recovery-variant={variant}
    >
      <h1
        ref={headingRef}
        className="pf-route-recovery__title"
        tabIndex={-1}
        data-route-focus="recovery"
      >
        {RECOVERY_COPY.title}
      </h1>
      <p className="pf-route-recovery__body">{RECOVERY_COPY.body}</p>
      <div className="pf-route-recovery__actions">
        <button
          type="button"
          className="pf-btn-primary"
          onClick={handleTryAgain}
        >
          {RECOVERY_COPY.tryAgain}
        </button>
        {showGoBack ? (
          <button
            type="button"
            className="pf-btn-ghost"
            onClick={handleGoBack}
          >
            {RECOVERY_COPY.goBack}
          </button>
        ) : null}
        <Link to="/" className="pf-btn-ghost" onClick={handleBackHome}>
          {RECOVERY_COPY.backHome}
        </Link>
      </div>
      <div
        className="pf-route-sr"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveMessage}
      </div>
    </section>
  );
}

/** Root ErrorBoundary entry: committed URL + Framework route error lifecycle. */
export function FrameworkRouteErrorBoundaryRecovery() {
  return (
    <main id="main" tabIndex={-1}>
      <FrameworkRouteRecovery variant="boundary" />
    </main>
  );
}
