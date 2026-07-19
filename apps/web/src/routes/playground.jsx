import { Playground } from "../pages/Playground";
import { RouteHydrationSignal } from "../components/SiteLayout";
import { playgroundMetaDescriptors } from "../lib/routeMetadata";

export function meta() {
  return playgroundMetaDescriptors();
}

export default function PlaygroundRoute() {
  return (
    <>
      <Playground />
      <RouteHydrationSignal />
    </>
  );
}
