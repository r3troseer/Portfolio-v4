import { useEffect, useRef } from "react";

/*
 * useDockFlight — drives the single "Ask about Pius" launcher on a scroll-linked
 * flight between its hero action-row slot and the persistent bottom-left dock.
 *
 * Re-authored from the locked design prototype (variant E · Triggered · Solid
 * teal). See docs/ui/ask-launcher-flight.md for the spec and exact values; the
 * reference controller is the gitignored `_apply(p)` / rAF loop in
 * `.notes/prototypes/cmdk-launcher-flight/.../CmdK Hero Dock Exploration.dc.html`.
 *
 * The look is applied imperatively to the launcher element and the hero
 * placeholder every frame (via refs/selectors) — never through React state, so
 * the flight never triggers a re-render. The hook returns hover/press setters
 * the component wires to its mouse handlers.
 */

// Scroll span the flight scrubs across, and the hysteresis dead-band.
const START = 0;
const END = 340;
const UP = 0.62; // commit to dock
const DOWN = 0.38; // commit to row

// Colour endpoints (Solid teal → dark dock). [r, g, b, a].
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

export const useDockFlight = (
  launcherRef,
  { slotSelector = ".pf-ask-slot" } = {}
) => {
  // Hover/press live in refs so feedback repaints on the next frame without a re-render.
  const hoverRef = useRef(false);
  const pressRef = useRef(false);

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

    // Cached rest anchor + measurements (re-measured at rest; mobile clip fix).
    let rest = { left: 48, top: 560, h: 48 };
    let slotFullW = null;
    let slotFullH = null;
    let pillW = null;
    let pillH = null;
    let labelW = null;
    let subFullW = null;

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
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const apply = (p) => {
      // Revealed on the first painted frame — avoids a flash before it's measured.
      if (fly.style.visibility !== "visible") fly.style.visibility = "visible";
      const slot = document.querySelector(slotSelector);
      // No hero placeholder on this page → the launcher lives docked (no flight).
      const hasSlot = !!slot;

      if (slot) {
        const r = slot.getBoundingClientRect();
        if (r.width) rest = { left: r.left, top: r.top, h: r.height };
      }
      const vh = window.innerHeight;
      const eOut = 1 - Math.pow(1 - p, 3);
      const eInOut = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      // Collapse the reserved slot as the pill leaves so the row reflows cleanly;
      // re-expands on the way back. Reserve the pill's real footprint (+2px safety).
      if (slot) {
        if (slotFullW == null || p < 0.02) {
          const fr = fly.getBoundingClientRect();
          if (fr.width) {
            slotFullW = fr.width + 2;
            slotFullH = fr.height;
          }
        }
        slot.style.overflow = "hidden";
        slot.style.boxSizing = "border-box";
        slot.style.padding = "0";
        if (slotFullW) {
          const w = slotFullW * (1 - eOut);
          slot.style.display = w < 1 ? "none" : "inline-flex";
          slot.style.width = Math.max(0, w) + "px";
          slot.style.height = Math.max(0, slotFullH * (1 - eOut)) + "px";
        }
      }

      // Anchor the dock to the pill's OWN height (rest.h collapses during flight).
      const flyH = fly.getBoundingClientRect().height || rest.h;
      const edge = window.innerWidth <= 600 ? 16 : 24;
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
      const dsz = eOut; // 0 rest → 1 docked
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
        // than assume a fixed 220px — the app's system font (Segoe UI on Windows)
        // is wider than the prototype's Inter, so a hard cap clips "…real work".
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

      // Colour settles to the dark dock chrome by p≈0.85. Solid teal has dark ink.
      const ec = Math.min(1, p / 0.85);
      const ece = 1 - Math.pow(1 - ec, 2);
      const L = (a, b) =>
        `rgba(${Math.round(a[0] + (b[0] - a[0]) * ece)},${Math.round(
          a[1] + (b[1] - a[1]) * ece
        )},${Math.round(a[2] + (b[2] - a[2]) * ece)},${(
          a[3] +
          (b[3] - a[3]) * ece
        ).toFixed(3)})`;

      const hover = hoverRef.current;
      const press = pressRef.current;
      if (p < 0.05) {
        // Gradient rest look (solid teal ≈ gradient base, so the seam is imperceptible).
        paintRest(fly, ico, hover, press);
      } else {
        fly.style.background = L(FROM.bg, TO.bg);
        fly.style.color = L(FROM.tx, TO.tx);
        if (ico) ico.style.color = L(FROM.ic, TO.ic);
        // Docked hover/press feedback — only once settled enough to read as the
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

      // Sub-label divider + ⌘K: dark ink on the teal fill, resolving to the
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

      // Mobile: full pill at rest; collapse to a 52px icon-only circle as it docks.
      const mobile = window.innerWidth <= 600;
      const labelEl = fly.querySelector(".pf-ask-fly-label");
      if (sub) sub.style.display = mobile ? "none" : "";
      if (kbd) kbd.style.display = mobile ? "none" : "";
      if (mobile) {
        const D = 52; // FAB diameter (≥ 44px touch target)
        const m = eOut; // 0 rest → 1 docked, front-loaded like the position
        if (hasSlot && p < 0.02) {
          // TRUE REST: leave the pill natural so the label can't be pixel-clipped
          // by a stale measurement; constraints only apply once a flight starts.
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
          pillW = null;
          pillH = null;
          labelW = null;
        } else {
          // Measure the full pill ONCE, while width is still natural.
          if (pillW == null) {
            fly.style.width = "";
            fly.style.height = "";
            const b = fly.getBoundingClientRect();
            if (b.width) {
              pillW = b.width;
              pillH = b.height;
            }
          }
          if (labelW == null && labelEl) labelW = (labelEl.scrollWidth || 96) + 4;
          fly.style.overflow = "hidden";
          // Anchor the icon on the LEFT; the pill closes in from the right onto it.
          fly.style.justifyContent = "flex-start";
          fly.style.width = (pillW || 220) + (D - (pillW || 220)) * m + "px";
          fly.style.height = (pillH || 46) + (D - (pillH || 46)) * m + "px";
          const padRest = 20;
          const padDock = (D - 17) / 2; // centre the ~17px icon in the circle
          const pad = padRest + (padDock - padRest) * m;
          fly.style.paddingLeft = pad + "px";
          fly.style.paddingRight = pad + "px";
          fly.style.gap = 11 * (1 - m) + "px";
          if (labelEl) {
            const lc = Math.min(1, m / 0.5); // label gone by half-morph
            labelEl.style.overflow = "hidden";
            labelEl.style.maxWidth = (labelW || 96) * (1 - lc) + "px";
            labelEl.style.opacity = String(1 - lc);
          }
        }
      } else {
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
      }
    };

    // Claim ownership; kill any prior loop.
    const myId = ++ownerSeq;
    let rafId = 0;

    const loop = () => {
      if (ownerSeq !== myId) return; // superseded — stop painting
      const now = performance.now();
      if (now - lastScrollT > 120) scrollVel *= 0.85; // decay when idle

      const slotPresent = !!document.querySelector(slotSelector);
      if (!slotPresent) {
        // No hero on this page → dock immediately, no flight.
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
        }
        if (reduce) {
          // Reduced motion: snap to the committed end — no travel.
          animP = committed;
        } else {
          const DUR = Math.max(430, Math.min(560, 560 - scrollVel * 26));
          const t = Math.max(0, Math.min(1, (now - flightStart) / DUR));
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          animP = flightFrom + (flightTo - flightFrom) * e;
        }
      }
      apply(animP);
      rafId = requestAnimationFrame(loop);
    };

    // Seed the scroll state and start.
    onScroll();
    rafId = requestAnimationFrame(loop);

    return () => {
      if (myId === ownerSeq) ownerSeq++; // relinquish ownership
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [launcherRef, slotSelector]);

  return {
    onHoverIn: () => {
      hoverRef.current = true;
    },
    onHoverOut: () => {
      hoverRef.current = false;
      pressRef.current = false;
    },
    onPressIn: () => {
      pressRef.current = true;
    },
    onPressOut: () => {
      pressRef.current = false;
    },
  };
};
