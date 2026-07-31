import { useRef } from "react";
import { X } from "lucide-react";
import { useDialogA11y } from "../hooks/useDialogA11y";

// Media lightbox, aligned with the assistant modal surfaces.
export const Modal = ({ data, onClose }) => {
  const panelRef = useRef(null);
  // Focus into the lightbox on open, trap Tab, Escape to close, restore focus to
  // the invoking thumbnail on close. Hooks run unconditionally (before the guard).
  useDialogA11y(!!data, onClose, panelRef);

  if (!data) return null;
  return (
    <div
      className="pf-pd-lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={data.title || "Image modal"}
    >
      <div
        ref={panelRef}
        className="pf-pd-lightbox-inner"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="pf-pd-lightbox-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <img src={data.src} alt={data.title} onError={onClose} />
        <div className="pf-pd-lightbox-info">
          <h3>{data.title}</h3>
          {data.description && <p>{data.description}</p>}
        </div>
      </div>
    </div>
  );
};
