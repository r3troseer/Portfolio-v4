// Idempotent cached preload for the assistant dialog chunk.
// Reused by idle scheduling, launcher intent (hover/focus/pointer-down),
// Cmd/Ctrl+K, click/open events, and resume-from-Playground navigation.
//
// Chromium caches a failed module specifier after a network abort, so clearing
// the promise and re-importing the same identity does not fetch again. Bound a
// few statically analyzable alternate import identities (query suffixes) so
// Retry can start a fresh deferred request without reload or Vite config.
// Vite should still share GroundedAnswer / answer / Ajv chunks across facades.

const DIALOG_IMPORTERS = [
  () => import("../components/AssistantDialog"),
  () => import("../components/AssistantDialog?pa3-retry=1"),
  () => import("../components/AssistantDialog?pa3-retry=2"),
];

let dialogImportPromise = null;
let importerIndex = 0;

export function preloadAssistantDialog() {
  if (!dialogImportPromise) {
    const load =
      DIALOG_IMPORTERS[Math.min(importerIndex, DIALOG_IMPORTERS.length - 1)];
    dialogImportPromise = load()
      .then((mod) => mod.AssistantDialog ?? mod.default)
      .catch((err) => {
        dialogImportPromise = null;
        if (importerIndex < DIALOG_IMPORTERS.length - 1) {
          importerIndex += 1;
        }
        throw err;
      });
  }
  return dialogImportPromise;
}

// Adaptive idle gate: visible tab, no save-data, not heavily constrained.
// Missing Network Information or requestIdleCallback must not break loading.
export function canIdlePreloadAssistantDialog() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return false;
  }
  const connection =
    typeof navigator !== "undefined"
      ? navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection
      : undefined;
  if (!connection) return true;
  if (connection.saveData) return false;
  const effectiveType = connection.effectiveType;
  if (effectiveType === "slow-2g" || effectiveType === "2g") return false;
  return true;
}

export function scheduleIdleAssistantDialogPreload() {
  if (!canIdlePreloadAssistantDialog()) return () => {};
  if (
    typeof window === "undefined" ||
    typeof window.requestIdleCallback !== "function" ||
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")
  ) {
    // Without both a critical-paint signal and a real idle signal, stay
    // intent-only. Temporary thread idleness alone can occur before LCP.
    return () => {};
  }

  let cancelled = false;
  let firstFrame = 0;
  let secondFrame = 0;
  let idleId = 0;

  const scheduleAfterCriticalPaint = () => {
    if (cancelled) return;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (cancelled || !canIdlePreloadAssistantDialog()) return;
        idleId = window.requestIdleCallback(() => {
          if (cancelled || !canIdlePreloadAssistantDialog()) return;
          preloadAssistantDialog().catch(() => {
            // Idle warm-up failures stay silent; open/retry paths surface them.
          });
        });
      });
    });
  };

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    if (cancelled || entries.length === 0) return;
    observer.disconnect();
    const pendingAnimations = document.getAnimations().filter(
      (animation) =>
        animation.playState === "running" &&
        Number.isFinite(animation.effect?.getTiming().iterations),
    );

    if (pendingAnimations.length === 0) {
      scheduleAfterCriticalPaint();
      return;
    }

    Promise.allSettled(pendingAnimations.map((animation) => animation.finished)).then(
      scheduleAfterCriticalPaint,
    );
  });
  observer.observe({ type: "largest-contentful-paint", buffered: true });

  return () => {
    cancelled = true;
    observer.disconnect();
    if (firstFrame) window.cancelAnimationFrame(firstFrame);
    if (secondFrame) window.cancelAnimationFrame(secondFrame);
    if (idleId && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleId);
    }
  };
}
