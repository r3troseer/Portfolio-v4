import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from "react-router";
import { Navigation } from "./components/Navigation";
import { Footer } from "./components/Footer";
import { ParticleEffect } from "./components/ParticleEffect";
import { AssistantShell } from "./components/AssistantShell";
import { Home } from "./pages/Home";
import { ScrollToTop } from "./components/ScrollToTop";
import { RouteCompletion } from "./components/RouteCompletion";

// Route-split: the detail page pulls in react-markdown, so lazy-load it (and the
// 404) to keep that weight off the home bundle.
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
    main.id = "main";
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

  // #main exists only after deliberate skip-link activation or an explicit
  // #main hash journey. Generic route completion never creates or focuses it.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (location.hash === "#main") {
      main.id = "main";
    } else if (main.id === "main") {
      main.removeAttribute("id");
    }
  }, [location.pathname, location.search, location.hash, location.key]);

  return (
    <>
      <SkipLink mainRef={mainRef} />
      {!evidenceMode && <Navigation />}
      <main ref={mainRef} tabIndex={-1}>
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
