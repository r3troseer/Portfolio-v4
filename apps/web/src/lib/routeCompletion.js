/**
 * Route destination focus and completion announcements (F-15 / FE-A4).
 *
 * Owns destination focus targets and completion semantics. Performance Branch C
 * owns *when* settlement runs: call setRouteSettlementCoordinator() to intercept
 * notifyRouteReady, then invoke settle only after the destination is authoritative.
 */

let announceHandler = null;
let settlementCoordinator = null;
let lastHandledLocationKey = null;
let deferredDialogObserver = null;

function clearDeferredDialogObserver() {
  deferredDialogObserver?.disconnect();
  deferredDialogObserver = null;
}

function hasOpenDialogOwner() {
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
}

export function setRouteAnnouncementHandler(handler) {
  announceHandler = typeof handler === "function" ? handler : null;
}

/**
 * Branch C coordination point. Pass a function `(descriptor, settle) => ...`
 * that decides when to call settle(). Pass null to restore immediate settlement.
 */
export function setRouteSettlementCoordinator(coordinator) {
  settlementCoordinator =
    typeof coordinator === "function" ? coordinator : null;
}

export function getRouteSettlementCoordinator() {
  return settlementCoordinator;
}

function normalizeLabel(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function accessibleName(el) {
  if (!(el instanceof HTMLElement)) return "";
  const labelled = el.getAttribute("aria-label");
  if (labelled) return labelled;
  return (el.textContent || "").trim();
}

function isHeading(el) {
  return el instanceof HTMLElement && /^H[1-6]$/.test(el.tagName);
}

export function isNestedInteractionOwnerActive(target) {
  if (hasOpenDialogOwner()) {
    return true;
  }

  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) {
    return false;
  }

  if (active.classList?.contains("pf-skip-link")) {
    return true;
  }

  if (
    active.matches?.(".pf-ask-fly, .mobile-menu-toggle, .pf-pd-shot")
  ) {
    return true;
  }

  const tag = active.tagName;
  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    active.isContentEditable
  ) {
    return true;
  }

  // Same-route control activation (e.g. Playground submit) keeps focus on a
  // control inside the destination; do not yank it to the route owner.
  if (
    target instanceof HTMLElement &&
    target.contains(active) &&
    (tag === "BUTTON" ||
      active.getAttribute("role") === "button" ||
      tag === "A")
  ) {
    return true;
  }

  return false;
}

export function shouldSkipGenericRouteCompletion(location) {
  if (!location) return true;

  if (
    typeof location.hash === "string" &&
    location.hash &&
    location.hash !== "#" &&
    location.hash !== "#main"
  ) {
    return true;
  }

  const state = location.state;
  if (state && typeof state === "object") {
    if (typeof state.scrollTo === "string" && state.scrollTo) return true;
    if (state.resumeAssistant) return true;
  }

  return false;
}

function announceCompletion(message) {
  if (!announceHandler || !message) return;
  // Clear then set so polite live regions re-announce identical consecutive labels.
  announceHandler("");
  announceHandler(message);
}

function shouldAnnounceAlongsideFocus(target, announcement) {
  if (!announcement) return false;
  if (!target) return true;
  // Focusing a heading already announces its text to assistive tech.
  if (isHeading(target)) return false;
  const name = accessibleName(target);
  if (name && normalizeLabel(name) === normalizeLabel(announcement)) {
    return false;
  }
  return true;
}

export function focusRouteDestination(target) {
  if (!(target instanceof HTMLElement) || !document.contains(target)) {
    return false;
  }

  if (!target.hasAttribute("tabindex") && target.tabIndex < 0) {
    target.tabIndex = -1;
  }

  const programmaticFocusAttribute = "data-route-programmatic-focus";
  const clearProgrammaticFocus = () => {
    target.removeAttribute(programmaticFocusAttribute);
  };

  target.setAttribute(programmaticFocusAttribute, "");
  target.addEventListener("blur", clearProgrammaticFocus, { once: true });
  target.focus({ preventScroll: true });
  if (document.activeElement !== target) {
    target.removeEventListener("blur", clearProgrammaticFocus);
    clearProgrammaticFocus();
    return false;
  }

  return true;
}

/**
 * Apply destination focus and completion announcement for a settled route.
 * Branch C should call this only after the destination owns the view.
 */
export function settleRouteCompletion({
  location,
  target,
  announcement,
  locationKey,
} = {}) {
  const key =
    locationKey ??
    (location && typeof location.key === "string" ? location.key : null);

  if (key && lastHandledLocationKey === key) {
    return { status: "already-handled", key };
  }

  const markHandled = () => {
    if (key) lastHandledLocationKey = key;
  };

  if (shouldSkipGenericRouteCompletion(location)) {
    markHandled();
    return { status: "skipped", reason: "hash-or-section-or-resume", key };
  }

  if (!(target instanceof HTMLElement) || !document.contains(target)) {
    return { status: "skipped", reason: "missing-target", key };
  }

  // Never treat the skip link or #main as a generic destination owner.
  if (target.classList?.contains("pf-skip-link") || target.id === "main") {
    markHandled();
    return { status: "skipped", reason: "skip-link-or-main", key };
  }

  if (hasOpenDialogOwner()) {
    return { status: "deferred", reason: "open-dialog", key };
  }

  if (isNestedInteractionOwnerActive(target)) {
    markHandled();
    return {
      status: "skipped",
      reason: "nested-owner-authoritative",
      key,
    };
  }

  const focused = focusRouteDestination(target);
  if (!focused) {
    return { status: "skipped", reason: "focus-failed", key };
  }

  if (shouldAnnounceAlongsideFocus(target, announcement)) {
    announceCompletion(announcement);
  }

  markHandled();
  return { status: "completed", key };
}

/**
 * Destination pages call this when settled content is mounted. By default
 * settlement runs immediately; Branch C may intercept via
 * setRouteSettlementCoordinator.
 */
export function notifyRouteReady(descriptor) {
  clearDeferredDialogObserver();

  const settle = () => {
    const result = settleRouteCompletion(descriptor);
    if (result.status !== "deferred" || result.reason !== "open-dialog") {
      clearDeferredDialogObserver();
      return result;
    }

    if (typeof MutationObserver === "undefined" || !document.body) {
      return result;
    }

    deferredDialogObserver = new MutationObserver(() => {
      if (hasOpenDialogOwner()) return;
      clearDeferredDialogObserver();
      queueMicrotask(settle);
    });
    deferredDialogObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    return result;
  };

  if (settlementCoordinator) {
    return settlementCoordinator(descriptor, settle);
  }
  return settle();
}

/** Test/helper seam: reset handled-key tracking between isolated checks. */
export function resetRouteCompletionState() {
  clearDeferredDialogObserver();
  lastHandledLocationKey = null;
}
