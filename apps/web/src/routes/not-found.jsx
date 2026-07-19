import { NotFound } from "../pages/NotFound";
import { RouteHydrationSignal } from "../components/SiteLayout";
import { notFoundMetaDescriptors } from "../lib/routeMetadata";

export function meta() {
  return notFoundMetaDescriptors();
}

export default function NotFoundRoute() {
  return (
    <>
      <NotFound />
      <RouteHydrationSignal />
    </>
  );
}
