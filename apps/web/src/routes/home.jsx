import { Home } from "../pages/Home";
import { RouteHydrationSignal } from "../components/SiteLayout";

export default function HomeRoute() {
  return (
    <>
      <Home />
      <RouteHydrationSignal />
    </>
  );
}
