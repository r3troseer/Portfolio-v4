import { Home } from "../pages/Home";
import { RouteHydrationSignal } from "../components/SiteLayout";
import { homeMetaDescriptors } from "../lib/routeMetadata";

export function meta() {
  return homeMetaDescriptors();
}

export default function HomeRoute() {
  return (
    <>
      <Home />
      <RouteHydrationSignal />
    </>
  );
}
