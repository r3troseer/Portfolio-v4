import { useEffect, useRef } from "react";

/*
 * useDialogA11y — shared modal-dialog accessibility for the assistant panel and
 * the media lightbox. While `open`, it:
 *   - moves focus into the panel (first focusable, else the panel itself),
 *   - traps Tab / Shift+Tab inside the panel,
 *   - closes on Escape,
 *   - restores focus to the previously-focused element (the trigger) on close.
 *
 * The owner still renders role="dialog"/aria-modal and handles overlay-click close;
 * this hook only manages focus + keyboard. Pass the panel element ref.
 */
export const useDialogA11y = (open, onClose, panelRef) => {
  const restoreRef = useRef(null);
  // Keep the latest onClose in a ref so an inline callback identity change does
  // not re-run the effect (which would steal/restore focus mid-open).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    // Remember what had focus so we can hand it back on close.
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Visible, enabled, focusable descendants. getClientRects() (not offsetParent)
    // so position:fixed panels aren't wrongly treated as hidden.
    const focusables = () =>
      Array.from(
        panel.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getClientRects().length > 0);

    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      panel.setAttribute("tabindex", "-1");
      panel.focus();
    }

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    panel.addEventListener("keydown", onKey);
    return () => {
      panel.removeEventListener("keydown", onKey);
      const el = restoreRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open, panelRef]);
};
