import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router";
import { Navigation } from "./components/Navigation";
import { Footer } from "./components/Footer";
import { ParticleEffect } from "./components/ParticleEffect";
import { AssistantShell } from "./components/AssistantShell";
import { Home } from "./pages/Home";
import { ScrollToTop } from "./components/ScrollToTop";

// Route-split: the detail page pulls in react-markdown, so lazy-load it (and the
// 404) to keep that weight off the home bundle.
const ProjectDetail = lazy(() =>
  import("./pages/ProjectDetail").then((m) => ({ default: m.ProjectDetail }))
);
const NotFound = lazy(() =>
  import("./pages/NotFound").then((m) => ({ default: m.NotFound }))
);

function Layout() {
  return (
    <>
      <Navigation />
      <main>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <ParticleEffect />
      <AssistantShell />
    </>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
