// Shared post-critical scheduling for work that must not compete with the
// first meaningful paint.
// - Particles: buffered paint (FCP) evidence when supported, else load+frames.
// - Telemetry: LCP, finite document animations, two frames, then idle when
//   available (PA3-shaped), with cancelable load/frame fallback.

function cancelAnimationFrames(...ids) {
  for (const id of ids) {
    if (id) cancelAnimationFrame(id);
  }
}

function runAfterTwoFrames(task) {
  let outer = 0;
  let inner = 0;
  outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(() => {
      task();
    });
  });
  return () => cancelAnimationFrames(outer, inner);
}

function paintObserverSupported() {
  return (
    typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes?.includes("paint")
  );
}

function lcpObserverSupported() {
  return (
    typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")
  );
}

function hasFirstContentfulPaint() {
  if (typeof performance === "undefined" || !performance.getEntriesByType) {
    return false;
  }
  return performance
    .getEntriesByType("paint")
    .some((entry) => entry.name === "first-contentful-paint");
}

function waitForFiniteDocumentAnimations() {
  if (typeof document === "undefined" || typeof document.getAnimations !== "function") {
    return Promise.resolve();
  }
  const pending = document.getAnimations().filter((animation) => {
    if (animation.playState !== "running") return false;
    const timing = animation.effect?.getComputedTiming?.();
    // Infinite decorative loops must not block post-critical work.
    return timing?.iterations !== Infinity;
  });
  if (pending.length === 0) return Promise.resolve();
  return Promise.all(pending.map((animation) => animation.finished.catch(() => {})));
}

/**
 * Run `task` after first-contentful-paint when the paint timeline is available.
 * Falls back to window load + two frames. Always cancelable.
 */
export function scheduleAfterFirstPaint(task) {
  let cancelled = false;
  let done = false;
  let observer = null;
  let cancelFrames = () => {};
  let loadHandler = null;

  const cleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    cancelFrames();
    cancelFrames = () => {};
    if (loadHandler) {
      window.removeEventListener("load", loadHandler);
      loadHandler = null;
    }
  };

  const run = () => {
    if (cancelled || done) return;
    done = true;
    cleanup();
    task();
  };

  const runAfterPaintFrames = () => {
    if (cancelled || done) return;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    cancelFrames();
    cancelFrames = runAfterTwoFrames(run);
  };

  const armLoadFallback = () => {
    const start = () => runAfterPaintFrames();
    if (document.readyState === "complete") {
      start();
      return;
    }
    loadHandler = start;
    window.addEventListener("load", loadHandler, { once: true });
  };

  if (paintObserverSupported()) {
    if (hasFirstContentfulPaint()) {
      runAfterPaintFrames();
    } else {
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === "first-contentful-paint") {
              runAfterPaintFrames();
              return;
            }
          }
        });
        observer.observe({ type: "paint", buffered: true });
        // Race: FCP may land between the getEntries check and observe().
        if (hasFirstContentfulPaint()) {
          runAfterPaintFrames();
        }
      } catch {
        armLoadFallback();
      }
    }
  } else {
    armLoadFallback();
  }

  return () => {
    cancelled = true;
    cleanup();
  };
}

/**
 * Run `task` after critical rendering settles: LCP (when supported), currently
 * running finite document animations, two frames, then a real idle callback
 * when available. Cancelable load + frame fallback keeps telemetry enabled
 * when LCP/idle signals are missing.
 */
export function scheduleAfterCriticalIdle(task, idleOptions = { timeout: 2000 }) {
  let cancelled = false;
  let done = false;
  let settling = false;
  let observer = null;
  let idleId = null;
  let cancelFrames = () => {};
  let loadHandler = null;

  const cleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    cancelFrames();
    cancelFrames = () => {};
    if (
      idleId !== null &&
      typeof window !== "undefined" &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(idleId);
      idleId = null;
    }
    if (loadHandler) {
      window.removeEventListener("load", loadHandler);
      loadHandler = null;
    }
  };

  const run = () => {
    if (cancelled || done) return;
    done = true;
    cleanup();
    task();
  };

  const afterIdle = () => {
    if (cancelled || done) return;
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(() => run(), idleOptions);
      return;
    }
    run();
  };

  const afterTwoFrames = () => {
    if (cancelled || done) return;
    cancelFrames();
    cancelFrames = runAfterTwoFrames(afterIdle);
  };

  const afterFiniteAnimations = () => {
    if (cancelled || done || settling) return;
    settling = true;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    waitForFiniteDocumentAnimations().then(() => {
      if (!cancelled && !done) afterTwoFrames();
    });
  };

  const armLoadFallback = () => {
    const start = () => afterFiniteAnimations();
    if (document.readyState === "complete") {
      start();
      return;
    }
    loadHandler = start;
    window.addEventListener("load", loadHandler, { once: true });
  };

  if (lcpObserverSupported()) {
    try {
      observer = new PerformanceObserver(() => {
        // Any LCP entry (buffered or live) means critical content has painted;
        // finite entrance animations still gate the idle warm-up.
        afterFiniteAnimations();
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      const prior = performance.getEntriesByType("largest-contentful-paint");
      if (prior.length > 0) {
        afterFiniteAnimations();
      } else if (document.readyState === "complete") {
        armLoadFallback();
      } else {
        loadHandler = () => {
          if (done || cancelled || settling) return;
          const entries = performance.getEntriesByType("largest-contentful-paint");
          if (entries.length === 0) afterFiniteAnimations();
        };
        window.addEventListener("load", loadHandler, { once: true });
      }
    } catch {
      armLoadFallback();
    }
  } else {
    armLoadFallback();
  }

  return () => {
    cancelled = true;
    cleanup();
  };
}
