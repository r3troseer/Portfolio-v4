import { ProjectDetail } from "../pages/ProjectDetail";
import { RouteHydrationSignal } from "../components/SiteLayout";
import { loadProjectDetail } from "../content/adapters/projectDetailLoader";

/**
 * Build-time and client loader for one public-safe project. Unknown ids resolve
 * to null (fail closed); only the matched route's payload is serialized into
 * prerender output - never the full project catalog.
 */
export async function loader({ params }) {
  return loadProjectDetail(params.id);
}

export default function ProjectDetailRoute() {
  return (
    <>
      <ProjectDetail />
      <RouteHydrationSignal />
    </>
  );
}
