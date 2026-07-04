# Ask launcher — hero → dock flight (dev-only motion polish)

## Locked decision
The ⌘K "Ask about Pius" launcher is a **single element that flies** between its hero
action-row slot and a persistent bottom-left dock, driven by scroll progress — replacing
the previous two-element (inline pill + separate `.pf-fab`) crossfade. Locked design
combination: **variant E** (Ask is the row's sole primary action) · path **Triggered** ·
style **Solid teal**. High-fidelity: the colours, timings, easings, and sizes below are final.

> This is presentation polish only. The assistant is still a **shell** — no backend, LLM,
> retrieval, or keys. The launcher animation does **not** mean the grounded assistant is
> production-ready; that remains future backend work (see `docs/ui/profile-ui-refresh.md`).

## Source prototype (reference, not shipped)
Design handoff, extracted locally (gitignored, never committed):
`.notes/prototypes/cmdk-launcher-flight/design_handoff_ask_launcher_flight/`
- `ask-launcher-flight.md` — the authoritative spec.
- `CmdK Hero Dock Exploration.dc.html` (+ `support.js`) — reference motion controller and
  exact values only. The `class Component extends DCLogic` `_apply(p)` / rAF loop / `_styleDef`
  carry the numbers.

## Intended behaviour
- Scroll down past the hero → the pill commits to the dock and flies to the bottom-left corner.
- Scroll back up → it flies home to the row and re-glues to the action row.
- Click the launcher (inline, in flight, or docked) → dispatch `pf:open-assistant` (unchanged);
  the Cmd/Ctrl+K handler and modal are unchanged.
- Pages without a hero (`#home` absent, e.g. project detail) → render docked immediately, no flight.

## Motion values that matter
- Scroll span: `START 0 → END 340`. Hysteresis thresholds: **UP 0.62** (commit dock),
  **DOWN 0.38** (commit row); hold between.
- Flight: time-based, `easeInOutCubic` for progress; `DUR = clamp(430, 560, 560 - scrollVel*26)`.
  `scrollVel` = EMA `0.6*prev + 0.4*(|Δy|/Δt)`, decay `*0.85` when idle > 120ms.
- Position eases: `eOut = 1-(1-p)³` (left, radius, padding), `eInOut` cubic (top).
- Corner inset: **24px** desktop, **16px** mobile. `dockTop = innerHeight - edge - pillHeight`.
- Rest→dock shape (× eOut): radius `14 → 999px`, h-padding `20 → 15`, font `1 → 0.9rem`,
  v-padding `13 → 11`, icon `17 → 15px`. Sub-label collapses by `p` (maxWidth `220 → 0`).
- Colour: rest teal sheen `linear-gradient(180deg,#7dffe6,#64ffda 58%,#50e7ce)`, border
  `#64ffda`, ink `#08131f` (only `p < 0.05`); then rgba lerp `ec = clamp(p/0.85)`,
  `ece = 1-(1-ec)²` → dock `bg rgba(17,22,34,0.60)`, border `rgba(255,255,255,0.14)`, text
  `rgb(233,238,245)`, icon `#64ffda`, `backdrop-filter: blur(8px)`.
- Docked hover (`p > 0.6` only): border `rgba(100,255,218,0.55)` + glow
  `0 12px 34px rgba(0,0,0,.45), 0 0 0 3px rgba(100,255,218,.12)`; press `brightness(0.94)`.
  No lift.
- Mobile (`≤600px`): hide sub-descriptor + `⌘K`; in-flight morph `m = eOut` → 52px circle,
  h-padding `20 → (52-17)/2`, gap `11 → 0`, icon anchored left, label collapse `min(1, m/0.5)`.
  True rest leaves the pill fully natural (no width lock — prevents label clipping).
- `prefers-reduced-motion: reduce` → no travel; render inline at rest, docked when committed.

## Implementation boundaries
- New: `components/AskLauncher.jsx` (single launcher), `hooks/useDockFlight.js` (rAF controller).
- `Hero.jsx` keeps a `visibility:hidden` placeholder (`.pf-ask-slot`) reserving the slot; the
  hook reads its live rect as the rest anchor and collapses it as the pill leaves.
- `AssistantShell.jsx` renders the one real launcher and keeps modal + key handling; the old
  `.pf-fab` crossfade + IntersectionObserver are removed.
- Most of the look is applied inline by the hook every frame (refs, not React state); CSS keeps
  only the base pill + placeholder + modal.
- Single rAF owner; cancel on unmount.

## Do NOT port from the prototype
- No bundled prototype HTML, `<x-dc>` / `support.js` runtime, or the Row/Path/Style switcher.
- No Google Fonts / unpkg `lucide` CDN tags — icons come from the app's `lucide-react`.
- No exploration-only style variants (gradientTeal, sky, tint, outline, emerald) — Solid teal only.
- No backend, LLM, retrieval, keys, or fake answer generation. No content changes beyond the
  approved variant-E row copy ("View selected work" → "View work", arrow-down dropped).
