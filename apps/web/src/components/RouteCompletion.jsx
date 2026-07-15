import { useLayoutEffect, useEffect, useState } from "react";
import { useLocation } from "react-router";
import {
  notifyRouteReady,
  setRouteAnnouncementHandler,
} from "../lib/routeCompletion";

/**
 * Persistent polite live region for route-completion announcements that are
 * not already conveyed by focusing a heading or labelled container.
 */
export function RouteCompletion() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRouteAnnouncementHandler(setMessage);
    return () => setRouteAnnouncementHandler(null);
  }, []);

  return (
    <div className="pf-route-sr" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

/**
 * Destination pages register their settled focus owner. Settlement is driven by
 * the destination mount (lazy-safe), not by URL change alone, so stale route
 * content cannot announce completion.
 */
export function useRouteDestination(targetRef, announcement, enabled = true) {
  const location = useLocation();

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    notifyRouteReady({
      location,
      target: targetRef?.current ?? null,
      announcement,
      locationKey: location.key,
    });
    return undefined;
  }, [location, location.key, targetRef, announcement, enabled]);
}
