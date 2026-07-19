import { Playground } from "../pages/Playground";
import { RouteHydrationSignal } from "../components/SiteLayout";

export default function PlaygroundRoute() {
  return (
    <>
      <Playground />
      <RouteHydrationSignal />
    </>
  );
}
