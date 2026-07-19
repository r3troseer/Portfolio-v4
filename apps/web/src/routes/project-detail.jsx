import { ProjectDetail } from "../pages/ProjectDetail";
import { RouteHydrationSignal } from "../components/SiteLayout";
import { loadProjectDetail } from "../content/adapters/projectDetailLoader";
import { projectMetaDescriptors } from "../lib/routeMetadata";

/**
 * Build-time and client loader for one public-safe project. Unknown ids resolve
 * to null (fail closed); only the matched route's payload is serialized into
 * prerender output - never the full project catalog.
 */
export async function loader({ params }) {
  return loadProjectDetail(params.id);
}

export function meta({ loaderData }) {
  return projectMetaDescriptors(loaderData);
}

export default function ProjectDetailRoute() {
  return (
    <>
      <ProjectDetail />
      <RouteHydrationSignal />
    </>
  );
}
