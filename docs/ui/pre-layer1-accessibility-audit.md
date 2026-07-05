# Pre-Layer-1 Accessibility Audit

**Date:** 2026-07-05 · **Branch:** `chore/pre-layer1-review-items` · **Scope:** the whole
`apps/web` SPA on `dev` (home sections, project detail, 404, nav, launcher, assistant shell,
lightbox), keyboard + screen-reader + reduced-motion + responsive.

> Audit only - this document records findings and recommendations. Code fixes land in a
> separate slice (`fix(web): improve pre-layer1 accessibility`) after checkpoint-3 approval.
> The assistant shell is inert (no backend/LLM); its dialog a11y is required before it goes
> live and cheap to fix now.

## Method
- Read every component/page and its CSS; traced keyboard operability and focus.
- Verified landmarks/roles, heading outline, `prefers-reduced-motion` coverage (CSS **and**
  the canvas rAF), image alt text, dialog semantics, and control labelling.

## What already passes (no action)
- **Landmarks:** `<nav>` / `<main>` / `<footer>` in `App.jsx` Layout; `index.html` has
  `lang="en"`, a descriptive `<title>`, viewport without `user-scalable=no`, JSON-LD, noscript.
- **Interactive elements are real controls:** nav links & section links are `<a>`; hero
  actions, "View more", mobile toggle, launcher, gallery thumbnails, modal close are `<button>`;
  featured card and project rows are `<Link>` (whole-card, keyboard-focusable). No click-only
  divs remain (the review's `GalleryItem` div -> button is already fixed on `dev`).
- **Dialog semantics present:** assistant + lightbox both set `role="dialog"`,
  `aria-modal="true"`, `aria-label`; close buttons have `aria-label`; overlay-click closes.
- **Images:** gallery + lightbox `img` carry `alt={title}`; `ParticleEffect` canvas is
  `aria-hidden="true"`; social icon links wrap decorative icons in `aria-label`led `<a>`.
- **Reduced motion (CSS):** `index.css` collapses animations/transitions globally; the
  launcher flight (`useDockFlight`) snaps under reduced motion.
- **Mobile toggle** exposes `aria-label` + `aria-expanded`.

## Findings (severity -> fix-now / defer)

### HIGH
1. **No visible focus indicator app-wide.** Only `:focus`/`outline` rule in `src` is
   `assistant.css:137 outline:none` (on the disabled input). Everything else relies on the UA
   default outline, which is low-contrast and inconsistent on this dark theme.
   - *Files:* `index.css` (global). *Fix:* add a global `:focus-visible` outline (2px accent +
     offset, honoring `--primary-accent`). **Fix now** - highest-leverage keyboard win, low risk.
2. **Assistant dialog has no focus management.** `AssistantShell.jsx` sets role/aria-modal and
   closes on Escape/overlay, but focus is **not** moved into the dialog on open, **not**
   restored to the launcher on close, and **not** trapped (Tab escapes to the page behind).
   - *Files:* `AssistantShell.jsx`. *Fix:* on open, move focus into the dialog (Close button,
     since input/suggestions are `disabled`); trap Tab/Shift+Tab; restore focus to the trigger
     on close. **Fix now.**
3. **Lightbox has no Escape and no focus management.** `Modal.jsx` closes only via overlay/close
   click; no Escape handler; focus not moved in or restored; no trap.
   - *Files:* `Modal.jsx` (+ `ContentCard.jsx` owner). *Fix:* Escape closes; focus to Close on
     open; restore to the invoking thumbnail on close; trap Tab. **Fix now.**

### MEDIUM
4. **No skip link.** Keyboard users must tab through the nav on every load.
   - *Files:* `App.jsx` Layout + `index.css`; needs `id` on `<main>`. *Fix:* add a visually
     hidden "Skip to content" link that reveals on focus. **Fix now** (small).
5. **`ParticleEffect` ignores `prefers-reduced-motion`.** The canvas rAF loop keeps animating
   under reduced motion (global CSS can't stop JS).
   - *Files:* `ParticleEffect.jsx`. *Fix:* if `matchMedia('(prefers-reduced-motion: reduce)')`
     matches, skip the animation loop (render nothing / a static frame). **Fix now** (small).
6. **Heading-order skip in Capabilities.** `About.jsx` renders `<h2>Capabilities</h2>`, then the
   niche tile heading is `<h4>` (`Capabilities.jsx`) - jumps h2->h4; the category labels
   (LANGUAGES/...) are non-heading `<div>`s.
   - *Files:* `Capabilities.jsx` (+ `capabilities.css` selector). *Fix:* make the niche label an
     `<h3>` (keep the styling). **Fix now** (small) - or defer if the visual weight is a concern.

### LOW
7. **Mobile menu:** no Escape-to-close and focus isn't moved/trapped into the open menu (links
   work; overlay closes; `aria-expanded` present). *Files:* `Navigation.jsx`. **Defer** - low
   stakes; revisit with a broader nav pass.
8. **SPA route titles don't update.** `document.title` stays the home title on `/projects/:id`
   and 404. *Files:* route components / a small title effect. **Defer** - needs a title strategy;
   low impact for a mostly single-page site.
9. **404 page starts at `<h2>`** (no `<h1>`). *Files:* `NotFound.jsx`. **Fix now** (trivial:
   `h2`->`h1`) - bundle with the slice.
10. **Decorative lucide icons lack `aria-hidden`.** Mostly adjacent to visible text or inside
    labelled links, so low impact. *Files:* various. **Defer** - optional polish sweep.
11. **Touch targets:** hero social icon links may be `<44px`. *Files:* `hero.css`. **Defer** -
    verify and pad if needed.
12. **Contrast spot-check:** small `--text-muted` text (`.pf-cap-note`, `.pf-list-tech`) on the
    dark surfaces should be checked against 4.5:1. **Defer/verify** - measure before changing tokens.

## Recommended "fix now" set (this branch)
`:focus-visible` (1) · assistant focus mgmt (2) · lightbox Escape + focus mgmt (3) · skip link
(4) · ParticleEffect reduced-motion (5) · Capabilities heading h3 (6) · 404 `<h1>` (9).

Implementation note: (2) and (3) share the same needs - **one small reusable dialog hook**
(`useDialogA11y(open, onClose, panelRef, { restoreFocus })`) handling focus-in, restore, trap,
and Escape - used by both `AssistantShell` and `Modal`, rather than duplicating logic.

## Deferred (with reason)
Mobile-menu Escape/trap (7, low stakes) · SPA route titles (8, needs strategy) · decorative-icon
`aria-hidden` sweep (10, low impact) · touch-target padding (11, verify first) · contrast tokens
(12, measure first). None are blockers; all are safe to schedule after Layer 1 groundwork.

## Manual keyboard checklist (to run after fixes)
- [ ] Tab from top -> skip link appears and jumps to `<main>`.
- [ ] Focus ring visible on every link/button along the tab order.
- [ ] `Cmd/Ctrl+K` opens assistant; focus lands inside; Tab/Shift+Tab stay trapped; Escape closes;
      focus returns to the launcher.
- [ ] Open a project gallery thumbnail by keyboard; Escape closes the lightbox; focus returns to
      the thumbnail.
- [ ] With OS "reduce motion" on: particles do not animate; launcher does not fly.
