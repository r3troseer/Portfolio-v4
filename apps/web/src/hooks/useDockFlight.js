import { useEffect, useRef } from "react";

/*
 * useDockFlight - drives the single "Ask about Pius" launcher on a scroll-linked
 * flight between its hero action-row slot and the persistent bottom-left dock.
 *
 * Re-authored from the locked design prototype (variant E · Triggered · Solid
 * teal). See docs/ui/ask-launcher-flight.md for the spec and exact values; the
 * reference controller is the gitignored `_apply(p)` / rAF loop in
 * `.notes/prototypes/cmdk-launcher-flight/.../CmdK Hero Dock Exploration.dc.html`.
 *
 * The look is applied imperatively to the launcher element and the hero
 * placeholder every frame (via refs/selectors) - never through React state, so
 * the flight never triggers a re-render. The hook returns hover/press setters
 * the component wires to its mouse handlers.
 *
 * Two paint paths share the same triggered/committed motion model:
 * - Desktop (> 600px): the original per-frame path, unchanged.
 * - Mobile (<= 600px): a lighter path for phone GPUs/reflow cost. Slot and
 *   pill geometry are measured once at flight boundaries (never per frame),
 *   travel is transform: translate3d from a fixed origin, the label collapses
 *   via opacity (the shrinking overflow-hidden pill does the clipping), the
 *   sub-label/kbd are hidden by CSS, will-change: transform applies only while
 *   flying, and the loop idles entirely once the pill settles at rest or dock.
 */

// Scroll span the flight scrubs across, and the hysteresis dead-band.
const START = 0;
const END = 340;
const UP = 0.62; // commit to dock
const DOWN = 0.38; // commit to row

// Mobile geometry: docked FAB diameter (>= 44px touch target) and corner inset.
const FAB = 52;
const MOBILE_EDGE = 16;

// Colour endpoints (Solid teal -> dark dock). [r, g, b, a].
const FROM = {
  bg: [100, 255, 218, 1],
  bd: [100, 255, 218, 1],
  tx: [10, 14, 26, 1],
  ic: [10, 14, 26, 1],
};
const TO = {
  bg: [17, 22, 34, 0.6],
  bd: [255, 255, 255, 0.14],
  tx: [233, 238, 245, 1],
  ic: [100, 255, 218, 1],
};

// Only one rAF may paint: the newest mount claims ownership; any older loop
// (StrictMode double-invoke / fast-refresh) sees it's no longer the owner and dies.
let ownerSeq = 0;

// Paint the at-rest Solid-teal look (gradient sheen, dark ink) with hover/press feedback.
const paintRest = (fly, ico, hover, press) => {
  fly.style.background = "linear-gradient(180deg, #7dffe6, #64ffda 58%, #50e7ce)";
  fly.style.border = "1px solid #64ffda";
  fly.style.color = "#08131f";
  if (ico) ico.style.color = "#08131f";
  fly.style.filter = press ? "brightness(0.95)" : hover ? "brightness(1.06)" : "none";
  fly.style.boxShadow = press
    ? "0 3px 12px rgba(100,255,218,0.20), inset 0 1px 2px rgba(0,0,0,0.16)"
    : hover
      ? "0 12px 34px rgba(100,255,218,0.42), 0 2px 7px rgba(0,0,0,0.28)"
      : "0 7px 24px rgba(100,255,218,0.26), 0 1px 3px rgba(0,0,0,0.20)";
};

// rgba lerp between the FROM/TO endpoints at eased colour progress.
const lerpColor = (a, b, ece) =>
  `rgba(${Math.round(a[0] + (b[0] - a[0]) * ece)},${Math.round(
    a[1] + (b[1] - a[1]) * ece
  )},${Math.round(a[2] + (b[2] - a[2]) * ece)},${(
    a[3] +
    (b[3] - a[3]) * ece
  ).toFixed(3)})`;

export const useDockFlight = (
  launcherRef,
  { slotSelector = ".pf-ask-slot" } = {}
) => {
  // Hover/press live in refs so feedback repaints on the next frame without a
  // re-render; the dirty flag lets the idle mobile loop wake for one repaint.
  const hoverRef = useRef(false);
  const pressRef = useRef(false);
  const dirtyRef = useRef(true);

  useEffect(() => {
    const fly = launcherRef.current;
    if (!fly) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // --- motion state ---
    let targetP = 0;
    let animP = 0;
    let committed = 0;
    let flightFrom = 0;
    let flightTo = 0;
    let flightStart = -9999;
    let scrollVel = 0; // px/ms, smoothed
    let lastScrollT = 0;
    let lastY = null;
    let lastYT = null;

    // --- environment cache (never read per frame) ---
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let mobile = vw <= 600;

    // Cached rest anchor + measurements (desktop path; re-measured at rest).
    let rest = { left: 48, top: 560, h: 48 };
    let slotFullW = null;
    let slotFullH = null;
    let subFullW = null;

    // --- mobile path state ---
    // "rest" | "flight" | "docked" | null (null = not yet painted)
    let mState = null;
    // Boundary measurements: viewport rest anchor, document rest anchor, and
    // the pill's natural (uncollapsed) footprint. Measured at rest entry /
    // flight start / resize - plus a scroll-driven refresh DURING flights (see
    // mFlightFrame): the handoff warns that freezing the anchor "decoupled the
    // return and caused the overshoot", so while airborne the anchor follows
    // any scroll instead of staying stale.
    let mMeas = null; // { restLeft, restTop, restDocLeft, restDocTop }
    let mOrigin = null; // fixed left/top the flight transform is relative to
    let mAnchorDirty = false; // a scroll happened; refresh the anchor in flight
    let mPillW = null;
    let mPillH = null;
    let slotEl = null;
    // Settle detection for the rest glue: the hero rows animate in (fadeInUp
    // translates ancestors ~30px over ~1.3s), so a rect measured during the
    // reveal parks the pill mid-animation. While "unsettled" the rest branch
    // re-glues every frame (riding the reveal like the desktop path does) and
    // goes idle only once the anchor's document coords hold still for a few
    // consecutive frames. Re-armed by resize/orientation, window load, and
    // font readiness - the events that legitimately move the row later.
    const STABLE_FRAMES = 6;
    const STABLE_EPSILON = 0.5; // px; the reveal's ease tail is sub-pixel
    let mRestSettled = false;
    let mStableFrames = 0;
    let mLastDoc = null;

    const slot = () => {
      if (!slotEl || !slotEl.isConnected) {
        slotEl = document.querySelector(slotSelector);
      }
      return slotEl;
    };

    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      const tnow = performance.now();
      const dt = tnow - (lastYT ?? tnow);
      const dy = y - (lastY != null ? lastY : y);
      if (dt > 0) scrollVel = 0.6 * scrollVel + 0.4 * (Math.abs(dy) / dt);
      lastY = y;
      lastYT = tnow;
      targetP = Math.max(0, Math.min(1, (y - START) / (END - START)));
      lastScrollT = tnow;
      mAnchorDirty = true; // in-flight frames re-glue the rest anchor
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      const wasMobile = mobile;
      mobile = vw <= 600;
      // Invalidate cached geometry; the next frame re-measures and repaints.
      mMeas = null;
      slotFullW = null;
      slotFullH = null;
      subFullW = null;
      if (mobile !== wasMobile) {
        // Crossing the breakpoint swaps paint paths (and the CSS-hidden
        // sub/kbd), so the pill's natural footprint changes: full reset. The
        // slot also drops any mobile transition so desktop's per-frame width
        // writes are not smeared by it.
        mPillW = null;
        mPillH = null;
        fly.removeAttribute("style");
        fly.style.visibility = "visible";
        const slotNode = slot();
        if (slotNode) slotNode.removeAttribute("style");
      }
      mState = null; // force the settled state to re-finalize
      mRestSettled = false;
      mStableFrames = 0;
      mLastDoc = null;
      dirtyRef.current = true;
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    // Late layout movers re-arm the sampling so the rest glue corrects, then
    // idles again: images finishing (load), web fonts swapping in, and - the
    // hero reveal case - CSS animations starting/ending anywhere on the page.
    // animationstart matters as much as animationend: fadeInUp holds its
    // from-state through a 0.1-0.35s animation-delay ("backwards" fill), so
    // the row is perfectly STILL before it starts moving - stillness alone
    // would settle the glue right before the row takes off. Infinite
    // animations only fire animationstart once, so they cost one brief
    // sampling burst, not a permanent wake-up.
    let alive = true;
    const rearmRestGlue = () => {
      if (!alive) return;
      mRestSettled = false;
      mStableFrames = 0;
      mLastDoc = null;
    };
    window.addEventListener("load", rearmRestGlue);
    document.addEventListener("animationstart", rearmRestGlue, true);
    document.addEventListener("animationend", rearmRestGlue, true);
    if (document.fonts?.ready) {
      document.fonts.ready.then(rearmRestGlue).catch(() => {});
    }

    /* ------------------------- desktop path (unchanged) ------------------ */

    const applyDesktop = (p) => {
      // Revealed on the first painted frame - avoids a flash before it's measured.
      if (fly.style.visibility !== "visible") fly.style.visibility = "visible";
      const slotNode = slot();
      // No hero placeholder on this page -> the launcher lives docked (no flight).
      const hasSlot = !!slotNode;

      if (slotNode) {
        const r = slotNode.getBoundingClientRect();
        if (r.width) rest = { left: r.left, top: r.top, h: r.height };
      }
      const eOut = 1 - Math.pow(1 - p, 3);
      const eInOut = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      // Collapse the reserved slot as the pill leaves so the row reflows cleanly;
      // re-expands on the way back. Reserve the pill's real footprint (+2px safety).
      if (slotNode) {
        if (slotFullW == null || p < 0.02) {
          const fr = fly.getBoundingClientRect();
          if (fr.width) {
            slotFullW = fr.width + 2;
            slotFullH = fr.height;
          }
        }
        slotNode.style.overflow = "hidden";
        slotNode.style.boxSizing = "border-box";
        slotNode.style.padding = "0";
        if (slotFullW) {
          const w = slotFullW * (1 - eOut);
          slotNode.style.display = w < 1 ? "none" : "inline-flex";
          slotNode.style.width = Math.max(0, w) + "px";
          slotNode.style.height = Math.max(0, slotFullH * (1 - eOut)) + "px";
        }
      }

      // Anchor the dock to the pill's OWN height (rest.h collapses during flight).
      const flyH = fly.getBoundingClientRect().height || rest.h;
      const edge = 24;
      const dockLeft = edge;
      const dockTop = vh - edge - flyH;

      if (hasSlot && p < 0.02) {
        // REST: document-space absolute so the pill scrolls natively glued to
        // the row (a fixed element nudged by JS drifts a frame late on phones).
        fly.style.position = "absolute";
        fly.style.left = rest.left + window.scrollX + "px";
        fly.style.top = rest.top + window.scrollY + "px";
      } else {
        // FLIGHT / DOCK: fixed, interpolated from the row to the corner.
        fly.style.position = "fixed";
        fly.style.left = rest.left + (dockLeft - rest.left) * eOut + "px";
        fly.style.top = rest.top + (dockTop - rest.top) * eInOut + "px";
      }

      fly.style.borderRadius = 14 + (999 - 14) * eOut + "px";
      const padH = 20 + (15 - 20) * eOut;
      fly.style.paddingLeft = padH + "px";
      fly.style.paddingRight = padH + "px";
      // Docked pill is slightly smaller than the rest pill.
      const dsz = eOut; // 0 rest -> 1 docked
      fly.style.fontSize = 1 + (0.9 - 1) * dsz + "rem";
      fly.style.paddingTop = 13 + (11 - 13) * dsz + "px";
      fly.style.paddingBottom = 13 + (11 - 13) * dsz + "px";
      const ico = fly.querySelector(".pf-ask-fly-ico");
      if (ico) {
        const isz = 17 + (15 - 17) * dsz;
        ico.style.width = isz + "px";
        ico.style.height = isz + "px";
      }

      const sub = fly.querySelector(".pf-ask-fly-sub");
      if (sub) {
        const c = Math.max(0, Math.min(1, p / 0.4));
        // Measure the descriptor's natural width (re-measured at rest) rather
        // than assume a fixed 220px - the app's system font (Segoe UI on Windows)
        // is wider than the prototype's Inter, so a hard cap clips "...real work".
        if (subFullW == null || p < 0.02) {
          sub.style.maxWidth = "none";
          subFullW = sub.getBoundingClientRect().width || 220;
        }
        // Clip only while collapsing; visible at rest so descenders aren't shaved.
        sub.style.overflow = p < 0.02 ? "visible" : "hidden";
        sub.style.maxWidth = subFullW * (1 - c) + "px";
        sub.style.opacity = String(1 - c);
        sub.style.paddingLeft = 12 * (1 - c) + "px";
      }

      // Colour settles to the dark dock chrome by p~0.85. Solid teal has dark ink.
      const ec = Math.min(1, p / 0.85);
      const ece = 1 - Math.pow(1 - ec, 2);
      const L = (a, b) => lerpColor(a, b, ece);

      const hover = hoverRef.current;
      const press = pressRef.current;
      if (p < 0.05) {
        // Gradient rest look (solid teal ~ gradient base, so the seam is imperceptible).
        paintRest(fly, ico, hover, press);
      } else {
        fly.style.background = L(FROM.bg, TO.bg);
        fly.style.color = L(FROM.tx, TO.tx);
        if (ico) ico.style.color = L(FROM.ic, TO.ic);
        // Docked hover/press feedback - only once settled enough to read as the
        // launcher (p>0.6). No lift (per the project's micro-interaction rules).
        const dockHover = hover && p > 0.6;
        const dockPress = press && p > 0.6;
        fly.style.border =
          "1px solid " +
          (dockHover ? "rgba(100,255,218,0.55)" : L(FROM.bd, TO.bd));
        fly.style.filter = dockPress ? "brightness(0.94)" : "none";
        fly.style.boxShadow = dockHover
          ? "0 12px 34px rgba(0,0,0,0.45), 0 0 0 3px rgba(100,255,218,0.12)"
          : "0 " +
            (12 - 4 * ece) +
            "px " +
            (40 - 12 * ece) +
            "px rgba(0,0,0," +
            (0.45 - 0.05 * ece).toFixed(3) +
            ")";
      }

      // Sub-label divider + CmdK: dark ink on the teal fill, resolving to the
      // light launcher styling by the time it docks.
      const cc = Math.max(0, Math.min(1, p / 0.4));
      if (sub) {
        sub.style.color = L([10, 14, 26, 0.78], [142, 162, 182, 1]);
        sub.style.borderLeftColor = `rgba(10,14,26,${(0.3 * (1 - cc)).toFixed(
          3
        )})`;
      }
      const kbd = fly.querySelector(".pf-ask-fly-kbd");
      if (kbd) {
        kbd.style.color = L([10, 14, 26, 0.85], [148, 163, 184, 1]);
        kbd.style.background = L([10, 14, 26, 0.13], [255, 255, 255, 0.06]);
        kbd.style.borderColor = L([10, 14, 26, 0.26], [255, 255, 255, 0.1]);
      }

      const labelEl = fly.querySelector(".pf-ask-fly-label");
      if (sub) sub.style.display = "";
      if (kbd) kbd.style.display = "";
      if (labelEl) {
        labelEl.style.overflow = "";
        labelEl.style.maxWidth = "";
        labelEl.style.opacity = "";
      }
      fly.style.overflow = "";
      fly.style.justifyContent = "";
      fly.style.gap = "11px";
      fly.style.width = "";
      fly.style.height = "";
    };

    /* --------------------------- mobile path ----------------------------- */
    // Same flight concept, cheaper per frame: geometry measured only at
    // boundaries, travel via translate3d, label collapse via opacity, and a
    // fully idle loop once settled. Sub/kbd are display:none via CSS <= 600px.

    // Measure the rest anchor and (when natural) the pill footprint. One
    // forced layout per boundary, never per frame.
    const mMeasure = () => {
      const slotNode = slot();
      if (slotNode) {
        const r = slotNode.getBoundingClientRect();
        if (r.width || r.height || r.top || r.left) {
          mMeas = {
            restLeft: r.left,
            restTop: r.top,
            restDocLeft: r.left + window.scrollX,
            restDocTop: r.top + window.scrollY,
          };
        }
      }
      if (mPillW == null) {
        // Natural footprint: only trustworthy while width/height are unset.
        const locked = fly.style.width !== "";
        if (locked) {
          fly.style.width = "";
          fly.style.height = "";
        }
        const b = fly.getBoundingClientRect();
        if (b.width) {
          mPillW = b.width;
          mPillH = b.height;
        }
        if (locked) {
          // Restore; the caller re-applies exact geometry right after.
          fly.style.width = mPillW ? mPillW + "px" : "";
          fly.style.height = mPillH ? mPillH + "px" : "";
        }
      }
    };

    // Paint fill/ink/border/shadow for a progress p (sub/kbd are CSS-hidden).
    const mPaintColors = (p) => {
      const ico = fly.querySelector(".pf-ask-fly-ico");
      const hover = hoverRef.current;
      const press = pressRef.current;
      if (p < 0.05) {
        paintRest(fly, ico, hover, press);
        return;
      }
      const ec = Math.min(1, p / 0.85);
      const ece = 1 - Math.pow(1 - ec, 2);
      fly.style.background = lerpColor(FROM.bg, TO.bg, ece);
      fly.style.color = lerpColor(FROM.tx, TO.tx, ece);
      if (ico) ico.style.color = lerpColor(FROM.ic, TO.ic, ece);
      const dockHover = hover && p > 0.6;
      const dockPress = press && p > 0.6;
      fly.style.border =
        "1px solid " +
        (dockHover ? "rgba(100,255,218,0.55)" : lerpColor(FROM.bd, TO.bd, ece));
      fly.style.filter = dockPress ? "brightness(0.94)" : "none";
      fly.style.boxShadow = dockHover
        ? "0 12px 34px rgba(0,0,0,0.45), 0 0 0 3px rgba(100,255,218,0.12)"
        : "0 " +
          (12 - 4 * ece) +
          "px " +
          (40 - 12 * ece) +
          "px rgba(0,0,0," +
          (0.45 - 0.05 * ece).toFixed(3) +
          ")";
    };

    // Collapse/expand the reserved hero slot with a one-shot CSS transition
    // instead of per-frame width writes.
    const mSlotTo = (collapsed) => {
      const slotNode = slot();
      if (!slotNode) return;
      if (slotFullW == null && !collapsed) {
        // Unknown natural size: just clear our overrides and let CSS lay it out.
        slotNode.style.transition = "";
        slotNode.style.width = "";
        slotNode.style.height = "";
        slotNode.style.overflow = "";
        slotNode.style.padding = "";
        return;
      }
      if (slotFullW == null && mPillW != null) {
        slotFullW = mPillW + 2;
        slotFullH = mPillH;
      }
      slotNode.style.overflow = "hidden";
      slotNode.style.boxSizing = "border-box";
      slotNode.style.padding = "0";
      slotNode.style.display = "inline-flex";
      slotNode.style.transition =
        "width 0.42s cubic-bezier(0.2, 0.7, 0.2, 1), height 0.42s cubic-bezier(0.2, 0.7, 0.2, 1)";
      slotNode.style.width = collapsed ? "0px" : (slotFullW || 0) + "px";
      slotNode.style.height = collapsed ? "0px" : (slotFullH || 0) + "px";
    };

    // Enter the flight: one measurement + one-time base style setup, then
    // frames only write transform/size/opacity/colours.
    const mStartFlight = () => {
      mMeasure();
      mAnchorDirty = false; // just measured
      const from = mMeas || { restLeft: MOBILE_EDGE, restTop: vh };
      // The transform is computed against this fixed origin; the rest anchor
      // itself may keep moving with scroll (mFlightFrame re-glues it).
      mOrigin = { left: from.restLeft, top: from.restTop };
      fly.style.visibility = "visible";
      fly.style.position = "fixed";
      fly.style.left = from.restLeft + "px";
      fly.style.top = from.restTop + "px";
      fly.style.willChange = "transform";
      fly.style.overflow = "hidden";
      fly.style.justifyContent = "flex-start";
      fly.style.gap = "11px";
      fly.style.fontSize = "1rem";
      fly.style.paddingTop = "13px";
      fly.style.paddingBottom = "13px";
      const ico = fly.querySelector(".pf-ask-fly-ico");
      if (ico) {
        ico.style.width = "17px";
        ico.style.height = "17px";
      }
      mSlotTo(committed === 1);
    };

    const mFlightFrame = (p) => {
      // Re-glue the rest anchor when a scroll moved the row under the flight
      // (one rect read, only on frames where a scroll actually happened) - a
      // frozen anchor is exactly what the handoff says caused the overshoot.
      if (mAnchorDirty) {
        mAnchorDirty = false;
        const slotNode = slot();
        if (slotNode) {
          const r = slotNode.getBoundingClientRect();
          if (r.width || r.height || r.top || r.left) {
            mMeas = {
              restLeft: r.left,
              restTop: r.top,
              restDocLeft: r.left + window.scrollX,
              restDocTop: r.top + window.scrollY,
            };
          }
        }
      }
      const from = mMeas || { restLeft: MOBILE_EDGE, restTop: vh };
      const origin = mOrigin || { left: from.restLeft, top: from.restTop };
      const eOut = 1 - Math.pow(1 - p, 3);
      const eInOut = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const dockLeft = MOBILE_EDGE;
      const dockTop = vh - MOBILE_EDGE - FAB;
      // Target position in viewport space (tracks the live anchor), expressed
      // as a translation from the fixed origin the pill was parked at.
      const dx = from.restLeft + (dockLeft - from.restLeft) * eOut - origin.left;
      const dy = from.restTop + (dockTop - from.restTop) * eInOut - origin.top;
      fly.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

      const w = (mPillW || 220) + (FAB - (mPillW || 220)) * eOut;
      const h = (mPillH || 46) + (FAB - (mPillH || 46)) * eOut;
      fly.style.width = w + "px";
      fly.style.height = h + "px";
      fly.style.borderRadius = 14 + (999 - 14) * eOut + "px";
      const pad = 20 + ((FAB - 17) / 2 - 20) * eOut;
      fly.style.paddingLeft = pad + "px";
      fly.style.paddingRight = pad + "px";

      const labelEl = fly.querySelector(".pf-ask-fly-label");
      if (labelEl) {
        // Fade only; the shrinking overflow-hidden pill clips the text.
        labelEl.style.opacity = String(1 - Math.min(1, eOut / 0.5));
      }
      mPaintColors(p);
    };

    // Settle at rest: natural pill glued to the row in document space.
    const mFinalizeRest = () => {
      const labelEl = fly.querySelector(".pf-ask-fly-label");
      if (labelEl) labelEl.style.opacity = "";
      fly.style.transform = "";
      fly.style.willChange = "";
      fly.style.overflow = "";
      fly.style.justifyContent = "";
      fly.style.width = "";
      fly.style.height = "";
      fly.style.borderRadius = "14px";
      fly.style.paddingLeft = "20px";
      fly.style.paddingRight = "20px";
      mSlotTo(false);
      mMeasure();
      const at = mMeas || { restDocLeft: MOBILE_EDGE, restDocTop: 0 };
      fly.style.position = "absolute";
      fly.style.left = at.restDocLeft + "px";
      fly.style.top = at.restDocTop + "px";
      fly.style.visibility = "visible";
      // The row may still be moving (hero reveal, slot expand transition,
      // late images/fonts): keep the settle-sampling glue running until the
      // anchor's document coords hold still, then idle.
      mRestSettled = false;
      mStableFrames = 0;
      mLastDoc = null;
    };

    // One settle-sampling step at rest: a single rect read per frame, only
    // while the anchor is still moving. Idles (mRestSettled) after the doc
    // coords hold still for STABLE_FRAMES consecutive frames, restoring the
    // zero-reads steady state.
    const mRestGlueStep = () => {
      const slotNode = slot();
      if (!slotNode) {
        mRestSettled = true;
        return;
      }
      const r = slotNode.getBoundingClientRect();
      if (!(r.width || r.height || r.top || r.left)) return;
      const doc = {
        left: r.left + window.scrollX,
        top: r.top + window.scrollY,
      };
      const still =
        mLastDoc &&
        Math.abs(doc.left - mLastDoc.left) <= STABLE_EPSILON &&
        Math.abs(doc.top - mLastDoc.top) <= STABLE_EPSILON;
      mLastDoc = doc;
      if (still) {
        mStableFrames += 1;
        if (mStableFrames >= STABLE_FRAMES) mRestSettled = true;
        return;
      }
      mStableFrames = 0;
      mMeas = {
        restLeft: r.left,
        restTop: r.top,
        restDocLeft: doc.left,
        restDocTop: doc.top,
      };
      fly.style.left = doc.left + "px";
      fly.style.top = doc.top + "px";
    };

    // Settle docked: bake the corner position and drop the transform.
    const mFinalizeDock = () => {
      const labelEl = fly.querySelector(".pf-ask-fly-label");
      if (labelEl) labelEl.style.opacity = "0";
      fly.style.transform = "";
      fly.style.willChange = "";
      fly.style.position = "fixed";
      fly.style.left = MOBILE_EDGE + "px";
      fly.style.top = vh - MOBILE_EDGE - FAB + "px";
      fly.style.width = FAB + "px";
      fly.style.height = FAB + "px";
      fly.style.borderRadius = "999px";
      const pad = (FAB - 17) / 2;
      fly.style.paddingLeft = pad + "px";
      fly.style.paddingRight = pad + "px";
      fly.style.overflow = "hidden";
      fly.style.justifyContent = "flex-start";
      fly.style.visibility = "visible";
      mSlotTo(true);
    };

    const applyMobile = () => {
      const settled = animP === committed;
      if (!settled) {
        if (mState !== "flight") {
          mStartFlight();
          mState = "flight";
        }
        mFlightFrame(animP);
        return;
      }
      const want = committed === 1 ? "docked" : "rest";
      if (mState !== want) {
        if (want === "rest") mFinalizeRest();
        else mFinalizeDock();
        mState = want;
        mPaintColors(committed);
        dirtyRef.current = false;
        return;
      }
      // At rest, ride any residual row movement (hero reveal, late images/
      // fonts) until the anchor settles; then the loop is fully idle.
      if (want === "rest" && !mRestSettled) mRestGlueStep();
      // Idle: repaint colours only when hover/press (or a resize) flips dirty.
      if (dirtyRef.current) {
        mPaintColors(committed);
        dirtyRef.current = false;
      }
    };

    /* ------------------------------ loop ---------------------------------- */

    // Claim ownership; kill any prior loop.
    const myId = ++ownerSeq;
    let rafId = 0;

    const loop = () => {
      if (ownerSeq !== myId) return; // superseded - stop painting
      const now = performance.now();
      if (now - lastScrollT > 120) scrollVel *= 0.85; // decay when idle

      const slotPresent = !!slot();
      if (!slotPresent) {
        // No hero on this page -> dock immediately, no flight.
        committed = 1;
        animP = 1;
      } else {
        // Triggered model: crossing a threshold COMMITS a state, then a
        // fixed-duration eased flight plays on its own timeline (decoupled from
        // scroll). The hysteresis dead-band stops flip-flop near the midpoint.
        let want = committed;
        if (targetP >= UP) want = 1;
        else if (targetP <= DOWN) want = 0;
        if (want !== committed) {
          committed = want;
          flightFrom = animP;
          flightTo = want;
          flightStart = now;
          // Mobile: retarget the slot transition when a flight reverses.
          if (mobile && mState === "flight") mSlotTo(committed === 1);
        }
        if (reduce) {
          // Reduced motion: snap to the committed end - no travel.
          animP = committed;
        } else if (mobile) {
          // MAGNETIC travel (prototype pathMode 'magnetic'): same decisive
          // hysteresis commits, but the travel is a physical drag whose speed
          // tracks scroll velocity, springing the rest of the way home the
          // instant the scroll goes idle (>90ms). Deliberate mobile-only
          // deviation from the locked Triggered path - a timed autonomous
          // flight fights touch momentum; see docs/ui/ask-launcher-flight.md.
          const idle = now - lastScrollT > 90;
          const step = idle
            ? 0.1
            : Math.max(0.03, Math.min(0.24, scrollVel * 0.024));
          const d = committed - animP;
          animP += Math.abs(d) <= step ? d : Math.sign(d) * step;
        } else {
          const DUR = Math.max(430, Math.min(560, 560 - scrollVel * 26));
          const t = Math.max(0, Math.min(1, (now - flightStart) / DUR));
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          animP = flightFrom + (flightTo - flightFrom) * e;
        }
      }
      if (mobile) applyMobile();
      else applyDesktop(animP);
      rafId = requestAnimationFrame(loop);
    };

    // Seed the scroll state and start.
    onScroll();
    rafId = requestAnimationFrame(loop);

    return () => {
      alive = false;
      if (myId === ownerSeq) ownerSeq++; // relinquish ownership
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("load", rearmRestGlue);
      document.removeEventListener("animationstart", rearmRestGlue, true);
      document.removeEventListener("animationend", rearmRestGlue, true);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [launcherRef, slotSelector]);

  return {
    onHoverIn: () => {
      hoverRef.current = true;
      dirtyRef.current = true;
    },
    onHoverOut: () => {
      hoverRef.current = false;
      pressRef.current = false;
      dirtyRef.current = true;
    },
    onPressIn: () => {
      pressRef.current = true;
      dirtyRef.current = true;
    },
    onPressOut: () => {
      pressRef.current = false;
      dirtyRef.current = true;
    },
  };
};
