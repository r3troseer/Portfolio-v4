import { isRouteErrorResponse } from "react-router";

/** Stable privacy-safe failure categories. Never derived from Error message/stack. */
export const ROUTE_FAILURE_CATEGORY = Object.freeze({
  MODULE: "route-module",
  DATA: "route-data",
  UNKNOWN: "route-unknown",
});

const RECOVERY_TITLE = "Page unavailable";
const RECOVERY_BODY =
  "This page could not be loaded. Try again, go back, or return home.";
const RECOVERY_TRY_AGAIN = "Try again";
const RECOVERY_GO_BACK = "Go back";
const RECOVERY_BACK_HOME = "Back home";

export const RECOVERY_COPY = Object.freeze({
  title: RECOVERY_TITLE,
  body: RECOVERY_BODY,
  tryAgain: RECOVERY_TRY_AGAIN,
  goBack: RECOVERY_GO_BACK,
  backHome: RECOVERY_BACK_HOME,
});

/**
 * React Router production SPA `loadRouteModule` catch path (chunk-KS7C4IRE):
 * on import failure it logs, calls `window.location.reload()`, and returns a
 * Promise that never resolves - so the URL does not commit and no route
 * ErrorBoundary runs. We convert that reload into bounded recovery while a
 * cross-path navigation is pending.
 */

/** Controller-recorded same-origin internal path to offer as Go back. */
let recoveryBackPath = null;

/** Safe internal destination of the in-flight cross-path navigation. */
let recoveryDestinationPath = null;

/** True while Framework navigation is cross-path pending. */
let crossPathPending = false;

/** In-layout recovery for SPA route-module reload conversion. */
let moduleRecoveryActive = false;

const pendingClearListeners = new Set();
const moduleRecoveryListeners = new Set();

/**
 * Accept only same-origin internal path+search strings for recovery navigation.
 * Rejects protocol-relative and absolute URLs.
 */
export function toSafeInternalPath(pathWithSearch) {
  if (typeof pathWithSearch !== "string") return null;
  const trimmed = pathWithSearch.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;

  try {
    const url = new URL(trimmed, "https://portfolio.invalid");
    if (url.origin !== "https://portfolio.invalid") return null;
    const pathname = url.pathname || "/";
    return `${pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Record the settled origin path when a cross-path navigation begins.
 * Used only for the Go back action after a terminal destination failure.
 */
export function noteNavigationOrigin(pathname, search = "") {
  const path = typeof pathname === "string" ? pathname : "";
  const query = typeof search === "string" ? search : "";
  recoveryBackPath = toSafeInternalPath(`${path}${query}`);
}

export function getRecoveryBackPath() {
  return recoveryBackPath;
}

export function clearRecoveryBackPath() {
  recoveryBackPath = null;
}

/** Record/clear the in-flight destination for Try again after module failure. */
export function setCrossPathNavigationPending(isPending, pathname, search = "") {
  if (isPending) {
    crossPathPending = true;
    const path = typeof pathname === "string" ? pathname : "";
    const query = typeof search === "string" ? search : "";
    recoveryDestinationPath = toSafeInternalPath(`${path}${query}`);
    return;
  }

  crossPathPending = false;
  if (!moduleRecoveryActive) {
    recoveryDestinationPath = null;
  }
}

export function getRecoveryDestinationPath() {
  return recoveryDestinationPath;
}

export function isModuleRecoveryActive() {
  return moduleRecoveryActive;
}

/**
 * Map a Framework route error to a stable category without reading message,
 * stack, chunk names, asset URLs, or loader payloads.
 */
export function categorizeRouteFailure(error) {
  if (isRouteErrorResponse(error)) {
    return ROUTE_FAILURE_CATEGORY.DATA;
  }

  if (error && typeof error === "object") {
    const name = typeof error.name === "string" ? error.name : "";
    if (name === "ChunkLoadError" || name === "CSSChunkLoadError") {
      return ROUTE_FAILURE_CATEGORY.MODULE;
    }
  }

  if (typeof TypeError !== "undefined" && error instanceof TypeError) {
    return ROUTE_FAILURE_CATEGORY.MODULE;
  }

  return ROUTE_FAILURE_CATEGORY.UNKNOWN;
}

/** Subscribe PC1 pending chrome so terminal recovery can force-clear it. */
export function subscribeRouteRecoveryActive(listener) {
  if (typeof listener !== "function") return () => {};
  pendingClearListeners.add(listener);
  return () => {
    pendingClearListeners.delete(listener);
  };
}

export function notifyRouteRecoveryActive() {
  for (const listener of pendingClearListeners) {
    try {
      listener();
    } catch {
      // Listeners must not break recovery rendering.
    }
  }
}

export function subscribeModuleRecovery(listener) {
  if (typeof listener !== "function") return () => {};
  moduleRecoveryListeners.add(listener);
  listener(moduleRecoveryActive);
  return () => {
    moduleRecoveryListeners.delete(listener);
  };
}

function emitModuleRecovery() {
  for (const listener of moduleRecoveryListeners) {
    try {
      listener(moduleRecoveryActive);
    } catch {
      // Listeners must not break recovery rendering.
    }
  }
}

export function activateModuleFailureRecovery() {
  if (!recoveryDestinationPath) return false;
  moduleRecoveryActive = true;
  crossPathPending = false;
  notifyRouteRecoveryActive();
  emitModuleRecovery();
  return true;
}

export function dismissModuleRecovery() {
  if (!moduleRecoveryActive) return;
  moduleRecoveryActive = false;
  crossPathPending = false;
  emitModuleRecovery();
}

/**
 * User-initiated load of a safe internal destination. Hard navigation resets
 * React Router's hung per-route lazy promise after a swallowed module failure.
 */
export function assignSafeInternalDestination(pathWithSearch) {
  const dest = toSafeInternalPath(pathWithSearch);
  if (!dest || typeof window === "undefined") return false;
  window.location.assign(dest);
  return true;
}

function shouldConvertReloadToModuleRecovery() {
  return Boolean(
    crossPathPending && recoveryDestinationPath && !moduleRecoveryActive
  );
}

/**
 * Install once: convert RR SPA `loadRouteModule` failure reloads into recovery
 * while a cross-path navigation is pending. Other reloads stay unchanged.
 */
export function installSpaRouteModuleFailureGuard() {
  if (typeof window === "undefined") return;
  if (installSpaRouteModuleFailureGuard.installed) return;

  const proto = window.Location && window.Location.prototype;
  if (!proto || typeof proto.reload !== "function") return;

  const originalReload = proto.reload;
  try {
    proto.reload = function reload() {
      if (shouldConvertReloadToModuleRecovery()) {
        activateModuleFailureRecovery();
        return;
      }
      return originalReload.call(this);
    };
    installSpaRouteModuleFailureGuard.installed = true;
  } catch {
    // Location.prototype.reload may be non-configurable in some engines.
  }
}

installSpaRouteModuleFailureGuard.installed = false;
