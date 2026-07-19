/**
 * Measured adaptive SPA route-transition feedback (PC1).
 *
 * Cross-path Link, approved programmatic, and Back/Forward navigations enter a
 * pending lifecycle. Same-route query/hash operations do not. Visible feedback
 * is delayed (200 ms progress, 800 ms polite status) and clears immediately at
 * the existing route-ready settlement seam - no minimum duration.
 */

export const SPA_PROGRESS_MS = 200;
export const SPA_ANNOUNCE_MS = 800;

const listeners = new Set();

let generation = 0;
let progressTimer = null;
let announceTimer = null;
let trackedPathname =
  typeof window !== "undefined"
    ? normalizePathname(window.location.pathname)
    : "/";

/** Same-origin path left when the latest cross-path pending transition began. */
let transitionOriginPath = null;

let state = {
  pending: false,
  showProgress: false,
  statusMessage: "",
  destinationPath: null,
  generation: 0,
};

export function normalizePathname(pathname) {
  if (typeof pathname !== "string" || !pathname) return "/";
  const bare = pathname.split("?")[0].split("#")[0] || "/";
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare;
}

export function resolvePathname(to) {
  if (typeof to === "string") {
    try {
      return normalizePathname(new URL(to, window.location.href).pathname);
    } catch {
      return normalizePathname(to);
    }
  }
  if (to && typeof to === "object" && typeof to.pathname === "string") {
    return normalizePathname(to.pathname);
  }
  return null;
}

export function isCrossPathNavigation(fromPathname, toPathname) {
  return normalizePathname(fromPathname) !== normalizePathname(toPathname);
}

export function destinationLoadingMessage(pathname) {
  const path = normalizePathname(pathname);
  if (path.startsWith("/projects/")) return "Loading project...";
  if (path === "/playground" || path.startsWith("/playground/")) {
    return "Opening Playground...";
  }
  if (path === "/") return "Loading home...";
  return "Loading page...";
}

export function getTrackedPathname() {
  return trackedPathname;
}

export function setTrackedPathname(pathname) {
  trackedPathname = normalizePathname(pathname);
}

export function getSpaTransitionOriginPath() {
  return transitionOriginPath;
}

export function getSpaRouteTransitionState() {
  return state;
}

export function subscribeSpaRouteTransition(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener(state));
}

function clearTimers() {
  if (progressTimer != null) {
    window.clearTimeout(progressTimer);
    progressTimer = null;
  }
  if (announceTimer != null) {
    window.clearTimeout(announceTimer);
    announceTimer = null;
  }
}

function setMainPending(pending) {
  const main = document.getElementById("main");
  if (!main) return;
  if (pending) {
    main.setAttribute("aria-busy", "true");
    main.setAttribute("data-spa-pending", "true");
  } else {
    main.removeAttribute("aria-busy");
    main.removeAttribute("data-spa-pending");
  }
}

function resetState(nextGeneration = generation) {
  state = {
    pending: false,
    showProgress: false,
    statusMessage: "",
    destinationPath: null,
    generation: nextGeneration,
  };
}

/**
 * Begin pending feedback for a cross-path navigation. No-ops for same-route
 * query/hash operations. Restarts timers when already pending for a new path.
 */
export function beginSpaRouteTransition(
  to,
  fromPathname = typeof window !== "undefined"
    ? window.location.pathname
    : trackedPathname
) {
  const destinationPath = resolvePathname(to);
  if (!destinationPath) return false;
  if (!isCrossPathNavigation(fromPathname, destinationPath)) return false;

  clearTimers();
  generation += 1;
  const currentGeneration = generation;
  transitionOriginPath = normalizePathname(fromPathname);

  state = {
    pending: true,
    showProgress: false,
    statusMessage: "",
    destinationPath,
    generation: currentGeneration,
  };
  setMainPending(true);
  emit();

  progressTimer = window.setTimeout(() => {
    if (generation !== currentGeneration || !state.pending) return;
    state = { ...state, showProgress: true };
    emit();
  }, SPA_PROGRESS_MS);

  announceTimer = window.setTimeout(() => {
    if (generation !== currentGeneration || !state.pending) return;
    state = {
      ...state,
      statusMessage: destinationLoadingMessage(destinationPath),
    };
    emit();
  }, SPA_ANNOUNCE_MS);

  return true;
}

/**
 * Clear pending feedback immediately. When a route-ready descriptor is
 * provided, ignore completions that do not match the pending destination.
 */
export function endSpaRouteTransition(descriptor) {
  if (!state.pending) return false;

  const readyPath =
    descriptor?.location && typeof descriptor.location.pathname === "string"
      ? normalizePathname(descriptor.location.pathname)
      : null;

  if (
    readyPath &&
    state.destinationPath &&
    readyPath !== state.destinationPath
  ) {
    return false;
  }

  clearTimers();
  resetState(generation);
  setMainPending(false);
  emit();
  return true;
}

/** Test/helper seam: drop timers and pending flags between isolated checks. */
export function resetSpaRouteTransitionState() {
  clearTimers();
  generation += 1;
  resetState(generation);
  setMainPending(false);
  transitionOriginPath = null;
  trackedPathname =
    typeof window !== "undefined"
      ? normalizePathname(window.location.pathname)
      : "/";
  emit();
}

/**
 * True when a document click on an anchor should start the SPA pending lifecycle.
 */
export function shouldBeginFromLinkClick(event, fromPathname = trackedPathname) {
  if (!(event instanceof Event)) return null;
  if (event.defaultPrevented) return null;
  if (typeof event.button === "number" && event.button !== 0) return null;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
    return null;
  }

  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  let anchor = null;
  for (const node of path) {
    if (node instanceof HTMLAnchorElement) {
      anchor = node;
      break;
    }
  }
  if (!anchor) {
    const target = event.target;
    anchor =
      target instanceof Element ? target.closest("a[href]") : null;
  }
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "" && anchor.target !== "_self") {
    return null;
  }

  let url;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;

  const destinationPath = normalizePathname(url.pathname);
  if (!isCrossPathNavigation(fromPathname, destinationPath)) return null;
  return destinationPath;
}
