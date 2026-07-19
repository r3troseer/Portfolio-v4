/**
 * Bounded privacy-safe SPA route-module recovery (PC2).
 *
 * Owns only terminal lazy route-module / chunk-load failures. Never stores or
 * exposes raw Error text, stacks, chunk names, or asset URLs.
 */

import {
  endSpaRouteTransition,
  getSpaTransitionOriginPath,
  normalizePathname,
} from "./spaRouteTransition";

export const SPA_ROUTE_FAILURE_CATEGORY = "route-module";

export const SPA_ROUTE_RECOVERY_COPY = Object.freeze({
  title: "Page unavailable",
  body: "This page could not be loaded. Try again, go back, or return home.",
  tryAgain: "Try again",
  goBack: "Go back",
  backHome: "Back home",
});

const listeners = new Set();

let state = {
  status: "idle",
  category: null,
  destinationPath: null,
  previousPath: null,
};

export function getSpaRouteRecoveryState() {
  return state;
}

export function subscribeSpaRouteRecovery(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener(state));
}

function isSafeInternalPath(pathname) {
  const path = normalizePathname(pathname);
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  return true;
}

/**
 * Classify a thrown value as a lazy route-module / chunk load failure.
 * Inspection is local only - never log or render the raw error.
 */
export function isRouteModuleLoadFailure(error) {
  if (!error || typeof error !== "object") return false;
  const name = typeof error.name === "string" ? error.name : "";
  if (name === "ChunkLoadError") return true;
  const message = typeof error.message === "string" ? error.message : "";
  if (!message) return false;
  if (/Failed to fetch dynamically imported module/i.test(message)) return true;
  if (/error loading dynamically imported module/i.test(message)) return true;
  if (/Importing a module script failed/i.test(message)) return true;
  if (/Loading chunk [\w-]+ failed/i.test(message)) return true;
  if (/Loading CSS chunk [\w-]+ failed/i.test(message)) return true;
  return false;
}

function resolvePreviousPath(destinationPath) {
  const origin = getSpaTransitionOriginPath();
  if (!origin || !isSafeInternalPath(origin)) return null;
  if (origin === destinationPath) return null;
  return origin;
}

/**
 * Enter the terminal recovery surface for the current destination.
 * Clears PC1 pending/busy feedback immediately.
 */
export function reportSpaRouteModuleFailure(
  destinationPath = typeof window !== "undefined"
    ? window.location.pathname
    : "/"
) {
  const destination = normalizePathname(destinationPath);
  endSpaRouteTransition();

  state = {
    status: "failed",
    category: SPA_ROUTE_FAILURE_CATEGORY,
    destinationPath: destination,
    previousPath: resolvePreviousPath(destination),
  };
  emit();
}

/**
 * Explicit user-initiated retry of the same destination.
 * Browser-cached module failures are not recoverable via remounted import();
 * a same-URL document reload is the accepted recovery for this failure class.
 * No timer, loop, cache-busting URL, or automatic reload.
 */
export function retrySpaRouteRecovery() {
  if (state.status !== "failed") return false;
  if (typeof window === "undefined") return false;
  window.location.reload();
  return true;
}

/** Dismiss recovery after safe navigation away from the failed destination. */
export function dismissSpaRouteRecovery() {
  if (state.status === "idle") return false;
  state = {
    status: "idle",
    category: null,
    destinationPath: null,
    previousPath: null,
  };
  emit();
  return true;
}

/** Successful destination settlement clears any failure phase. */
export function clearSpaRouteRecoveryOnSuccess() {
  return dismissSpaRouteRecovery();
}

export function getSpaRouteRecoveryPreviousPath() {
  return state.previousPath;
}

/** Test/helper seam. */
export function resetSpaRouteRecoveryState() {
  state = {
    status: "idle",
    category: null,
    destinationPath: null,
    previousPath: null,
  };
  emit();
}
