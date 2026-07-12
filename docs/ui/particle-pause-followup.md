# Particle pause - follow-up (device-capability driven)

Parked future work, not scheduled. Captures the idea so it is not lost.

## Current state

`ParticleEffect.jsx` runs a `requestAnimationFrame` canvas loop (drifting particles behind
the hero). It already pauses on `document.hidden` (tab not visible) and skips entirely under
`prefers-reduced-motion: reduce`. A branch, `ab/particles-pause`, additionally pauses the loop
below a **600px viewport** and restarts it on breakpoint change. That branch is not merged.

## Why viewport width is the wrong signal

Screen width does not measure device weakness. A 320px-wide phone can be a current flagship
with plenty of GPU/CPU headroom, and a wide window can sit on a weak/throttled machine. Pausing
by breakpoint therefore both over-pauses (capable phones lose the effect for no reason) and
under-pauses (weak wide devices keep paying for it). The thing we actually want to protect is
the main thread on *low-capability* devices, whatever their screen size.

## Proposed direction

Drive the pause/throttle from **device capability + user preference**, not layout:

- `navigator.deviceMemory` - pause (or reduce particle count / spawn rate) below a small RAM
  threshold (e.g. `<= 4`).
- `navigator.hardwareConcurrency` - same idea below a low core count (e.g. `<= 4`).
- `prefers-reduced-motion: reduce` - already honoured; keep it as a hard off.
- Optionally `navigator.connection.saveData` - respect data-saver as an off signal.

Shape it as a capability check on mount that decides one of: full effect / reduced effect
(fewer particles, lower spawn rate) / off. Keep the existing `visibilitychange` pause. Treat
the signals as progressive enhancement - all are optional/absent on some browsers, so default
to running the effect when nothing indicates a weak device (fail open, since reduced-motion
already covers the accessibility case).

## Notes

- This supersedes the viewport-breakpoint approach on `ab/particles-pause`; if adopted, that
  branch's change would be reframed rather than merged as-is.
- Verify with the real-constraints harness (`tools/verify`, CPU throttle) that the reduced/off
  paths actually cut main-thread frame cost on a weak profile, not just on paper.
- No dependency needed; all signals are platform APIs (with graceful fallback when absent).
