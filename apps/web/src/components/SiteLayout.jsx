import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";
import { ParticleEffect } from "./ParticleEffect";
import { DeferredTelemetry } from "./DeferredTelemetry";
import { AssistantShell } from "./AssistantShell";
import { ScrollToTop } from "./ScrollToTop";
import { RouteCompletion } from "./RouteCompletion";

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

function RouteHydrationMarker({ setRouteHydrated }) {
  useEffect(() => {
    setRouteHydrated(true);
  }, [setRouteHydrated]);

  return null;
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
  const evidenceMode = location.pathname.startsWith("/playground");

  return (
    <>
      <ScrollToTop />
      <RouteCompletion />
      {!evidenceMode && <SkipLink mainRef={mainRef} />}
      {!evidenceMode && <Navigation />}
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Suspense fallback={null}>
          <Outlet />
          <RouteHydrationMarker setRouteHydrated={setRouteHydrated} />
        </Suspense>
      </main>
      {!evidenceMode && (
        <>
          <Footer />
          <ParticleEffect />
          {routeHydrated && <AssistantShell />}
        </>
      )}
      <DeferredTelemetry />
    </>
  );
}
