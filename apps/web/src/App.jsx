import { lazy, Suspense, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from "react-router";
import { Navigation } from "./components/Navigation";
import { Footer } from "./components/Footer";
import { ParticleEffect } from "./components/ParticleEffect";
import { DeferredTelemetry } from "./components/DeferredTelemetry";
import { AssistantShell } from "./components/AssistantShell";
import { Home } from "./pages/Home";
import { ScrollToTop } from "./components/ScrollToTop";
import { RouteCompletion } from "./components/RouteCompletion";

// Route-split: lazy-load the project detail and 404 routes to keep their
// weight off the home bundle.
const ProjectDetail = lazy(() =>
  import("./pages/ProjectDetail").then((m) => ({ default: m.ProjectDetail }))
);
const NotFound = lazy(() =>
  import("./pages/NotFound").then((m) => ({ default: m.NotFound }))
);
const Playground = lazy(() =>
  import("./pages/Playground").then((m) => ({ default: m.Playground }))
);

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

function Layout() {
  const location = useLocation();
  const mainRef = useRef(null);
  // The evidence playground is a distinct full-screen mode: it hides the shared
  // site chrome and renders its own results-only footer and navigation strip.
  const evidenceMode = location.pathname.startsWith("/playground");

  return (
    <>
      {!evidenceMode && <SkipLink mainRef={mainRef} />}
      {!evidenceMode && <Navigation />}
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      {!evidenceMode && (
        <>
          <Footer />
          <ParticleEffect />
          <AssistantShell />
        </>
      )}
      <DeferredTelemetry />
    </>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <RouteCompletion />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="playground" element={<Playground />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
