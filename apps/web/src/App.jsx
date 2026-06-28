import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router";
import { Navigation } from "./components/Navigation";
import { Footer } from "./components/Footer";
import { ParticleEffect } from "./components/ParticleEffect";
import { Home } from "./pages/Home";
import { ScrollToTop } from "./components/ScrollToTop";
// import { ProjectList } from './pages/ProjectList';
import { ProjectDetail } from "./pages/ProjectDetail";
import { NotFound } from "./pages/NotFound";

function Layout() {
  return (
    <>
      <Navigation />
      <main>
        <Outlet />
      </main>
      <Footer />
      <ParticleEffect />
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
          {/* <Route path="projects" element={<ProjectList />} />*/}
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
