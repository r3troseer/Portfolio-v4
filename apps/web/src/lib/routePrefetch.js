// Constrained intent prefetch for Framework Mode route links and the
// Assistant -> Playground CTA. Prefetch never runs for every project on
// initial render; optional prefetch respects save-data / constrained network
// without changing the SSR/hydration markup.

import { useEffect, useState } from "react";

/** Stable initial Link prefetch mode (SSR + first client render). */
export const INITIAL_LINK_PREFETCH = "none";

/**
 * True when optional route prefetch is allowed. Missing Network Information
 * API fails open (allow); save-data and heavy constraint fail closed.
 */
export function allowsOptionalRoutePrefetch() {
  if (typeof navigator === "undefined") return false;
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  if (!connection) return true;
  if (connection.saveData) return false;
  const effectiveType = connection.effectiveType;
  if (effectiveType === "slow-2g" || effectiveType === "2g") return false;
  return true;
}

/**
 * Link `prefetch` value that stays "none" through hydration, then upgrades to
 * "intent" only on capable connections. Avoids server/client markup drift.
 */
export function useIntentLinkPrefetch() {
  const [prefetch, setPrefetch] = useState(INITIAL_LINK_PREFETCH);
  useEffect(() => {
    if (allowsOptionalRoutePrefetch()) {
      setPrefetch("intent");
    }
  }, []);
  return prefetch;
}

/**
 * Playground CTA intent gate. Starts disabled (hydration-stable); enables
 * PrefetchPageLinks only after clear hover/focus on a capable connection.
 */
export function usePlaygroundIntentPrefetch() {
  const [enabled, setEnabled] = useState(false);

  const requestPrefetch = () => {
    if (!allowsOptionalRoutePrefetch()) return;
    setEnabled(true);
  };

  return {
    enabled,
    page: "/playground",
    onMouseEnter: requestPrefetch,
    onFocus: requestPrefetch,
  };
}
