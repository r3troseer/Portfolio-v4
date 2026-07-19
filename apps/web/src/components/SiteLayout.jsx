import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";
import { ParticleEffect } from "./ParticleEffect";
import { DeferredTelemetry } from "./DeferredTelemetry";
import { AssistantShell } from "./AssistantShell";
import { ScrollToTop } from "./ScrollToTop";
import { RouteCompletion } from "./RouteCompletion";
import { FrameworkRouteTransition } from "./FrameworkRouteTransition";
import { FrameworkRouteRecovery } from "./FrameworkRouteRecovery";
import { subscribeModuleRecovery } from "../lib/frameworkRouteRecovery";

const MarkRouteHydratedContext = createContext(null);

/**
 * Non-blocking signal rendered by every direct route module. Marks the initial
 * matched route as client-hydrated so AssistantShell can mount. Does not wrap
 * route content in Suspense (keeps prerendered HTML visible inside main).
 */
export function RouteHydrationSignal() {
  const setRouteHydrated = useContext(MarkRouteHydratedContext);
  useEffect(() => {
    setRouteHydrated?.(true);
  }, [setRouteHydrated]);
  return null;
}

function SkipLink({ mainRef }) {
  const activate = (event) => {
    event.preventDefault();
    const main = mainRef.current;
    if (!main) return;
    main.focus();
    const { pathname, search } = window.location;
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${search}#main`
    );
  };

  return (
    <a href="#main" className="pf-skip-link" onClick={activate}>
      Skip to content
    </a>
  );
}

/**
 * Shared site chrome for Framework Mode routes. Playground stays chromeless:
 * no skip link, nav, footer, particles, or Ask launcher. DeferredTelemetry
 * still mounts on every route.
 */
export function SiteLayout() {
  const location = useLocation();
  const mainRef = useRef(null);
  const [routeHydrated, setRouteHydrated] = useState(false);
  const [moduleRecovery, setModuleRecovery] = useState(false);
  const evidenceMode = location.pathname.startsWith("/playground");

  useEffect(() => subscribeModuleRecovery(setModuleRecovery), []);

  return (
    <MarkRouteHydratedContext.Provider value={setRouteHydrated}>
      <ScrollToTop />
      <RouteCompletion />
      <FrameworkRouteTransition mainRef={mainRef} />
      {!evidenceMode && <SkipLink mainRef={mainRef} />}
      {!evidenceMode && <Navigation />}
      <main id="main" ref={mainRef} tabIndex={-1}>
        {moduleRecovery ? (
          <FrameworkRouteRecovery variant="module" />
        ) : (
          <Outlet />
        )}
      </main>
      {!evidenceMode && (
        <>
          <Footer />
          <ParticleEffect />
          {routeHydrated && <AssistantShell />}
        </>
      )}
      <DeferredTelemetry />
    </MarkRouteHydratedContext.Provider>
  );
}
