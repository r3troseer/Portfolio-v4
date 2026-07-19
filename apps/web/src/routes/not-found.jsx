import { NotFound } from "../pages/NotFound";
import { RouteHydrationSignal } from "../components/SiteLayout";

export default function NotFoundRoute() {
  return (
    <>
      <NotFound />
      <RouteHydrationSignal />
    </>
  );
}
