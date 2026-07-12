# Ask launcher performance work - learnings

What the mobile-flight / CLS pass actually taught us, backed by measurement. This is
a learnings doc, not a decision log - it captures the transferable lessons and where
intuition (and the harness) were wrong, so the next perf pass starts smarter. Numbers
come from `tools/verify/cls-audit.mjs` and `load-drift.mjs` (Pixel profile, CPU 6x for
CLS, 4x for load-drift, medians of 3 runs). The tooling is gitignored dev-only.

## The measurement arc (evidence)

| Branch | What it adds | CLS (median) | Hero-row CLS | Load drift (mobile) | Non-composited flags |
|---|---|---|---|---|---|
| magnetic base | none (the "before") | 0.159 | 0.38 | 5.6px | box-shadow x22, width/height |
| + shadow drop + reserve | pin row height | 0.0164 (stable) | 0.054 | 3.3px | width/height |
| + FLIP buttons | transform tidy-up | 0.0024 | 0 | 6.3px | (none of note) |
| + reparent (winner) | load-reveal glue | 0.0083 | 0 | **0px** | (none of note) |
| compositor (rejected) | transition-driven travel | 0.178 | 0.50 | n/a | color x8, width/height |
| triggered + CLS | timed flight + fixes | 0.0018 | 0 | ~4px | (none of note) |

CLS "good" is <= 0.1. Every shipped variant is an order of magnitude under it.

## Insights

**1. CLS is area x distance, so the biggest box dominates - fix the cause, not the motion.**
The launcher's own movement was never the problem: the dominant shift was the facts card
(372x453px) jumping 37px when the wrapped action row un-wrapped as the slot collapsed -
~98% of the score. Reserving the row height (preventing the reflow) took CLS 0.159 -> 0.016
by itself; no amount of animating the launcher would have touched it. Measure *which element*
moves and by how much before optimizing anything.

**2. A "potential root cause" in a trace is a correlation, not a verdict.**
DevTools flagged `box-shadow` as a CLS culprit. Removing it left CLS unchanged (0.159 ->
0.159): a shadow is paint-only and cannot move layout, so it was a co-conspirator that merely
animated *during* the shift cluster. The one-change-at-a-time loop is what proved it - isolate
a fix and watch whether the number it targets actually moves.

**3. Transform vs layout: identical motion, different bill - and CLS can be gamed.**
The button tidy-up as a `width` reflow is a layout shift; as a FLIP (`transform`) it is free and
uncounted. That is a genuine win (less main-thread work, the width/height flags vanished), but
it is worth being honest that CLS excludes transforms *by design*, so transform motion can hide
real interaction harm. It is legitimate only when the motion is wanted, which here it was.

**4. A metric only sees what its scenario exercises - mind the window.**
The 4-6px load-reveal drift never appeared in `cls-audit`'s CLS number, because the reveal
happens before the scripted flings and falls outside the session window the score sums. It took
a *separate* `load-drift` driver (per-frame pill-vs-slot sampling through the reveal) to see it
at all. When a symptom does not show in your headline metric, suspect the metric's window before
concluding the symptom is gone.

**5. Synthetic input cannot reproduce input-coupled failures - this is the humbling one.**
The compositor variant rubber-banded on a real phone (overshoots, jarring). I built a velocity
sign-reversal metric and claimed it "would auto-fail compositor." It does not: under the
harness's decaying-fling, compositor measures **1 reversal - clean**. The fling is too smooth;
the rubber-band only manifests under a real continuous scroll stream (many discrete scroll events
each restarting the 480ms ease from zero velocity). What *did* flag compositor was the CLS axis
(0.178, launcher 0.12 from the settle box-snap, `color` x8 non-composited). Lesson: automated
drivers validate structure, geometry, and CLS; they do **not** validate feel under real input.
Real-device human eyes caught this, and nothing in the harness did. Correcting my own earlier
overclaim here on purpose.

**6. Deterministic vs stochastic residue decides how you compare.**
Reserve's residual CLS was rock-steady (0.0164 three times) because it is a fixed button reflow.
Post-FLIP the only residue is fling-dependent jitter (0.0015-0.0083). Comparing single runs of a
sub-0.01 metric is meaningless; use median-of-N, and know whether what remains is deterministic
(compare directly) or stochastic (compare distributions, not points).

**7. When you are fighting to synchronize two things, delete the synchronization.**
The load-drift fix took four tries. Three (settle-sampling re-glue, hide-until-settled, a matched
CSS/WAAPI entrance animation) tried to make a JS-positioned pill track a compositor-animated row;
the animation attempts came out *worse* (~10-16px) because the two elements do not mount on the
same frame, so their timelines never lock. The fix that worked (parent the pill inside the row for
the reveal) removed the chase entirely - it inherits the row's transform natively, nothing to sync.
If a problem is "keep A in step with B," the strongest fix is often "make A part of B."

**8. A fixed-duration transition cannot scrub a continuously-driven input.**
Compositor drove pill travel with a 480ms ease restarted on every scroll event; an ease-in-out
starts at zero velocity, so continuous scrolling perpetually re-launched it from a standstill.
Magnetic couples step size to live scroll velocity and tracks the finger. Transitions fit discrete
state changes (the FLIP tidy-up, a one-shot); they are the wrong tool for scroll-linked scrubbing.

## What the harness grew (and what it still can't do)

Each blind spot forced a new check: `load-drift.mjs` (reveal glue, from insight 4), the velocity
metric (insight 5 - useful for structure but *not* a feel oracle), `slide-check.mjs` (confirming
the FLIP transforms actually fire), and median-of-N discipline (insight 6). The standing limit,
per insight 5: the harness cannot judge motion feel under real input. That remains a human,
real-device job - budget for it rather than trusting a green automated run.

## Consolidation

The winner is settled (magnetic mobile / triggered desktop + shadow-drop + reserve + FLIP +
reparent, on `ab/mobile-reveal-reparent`). The other `ab/*` branches were preview vehicles; the
compositor branch is kept only as the cautionary example behind insight 5 and 8. Folding the
winner into `feature` is a separate step with a desktop smoke test, done on request.
