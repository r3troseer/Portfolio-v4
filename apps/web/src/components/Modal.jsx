import { X } from "lucide-react";

// Media lightbox, aligned with the assistant modal surfaces.
export const Modal = ({ data, onClose }) => {
  if (!data) return null;
  return (
    <div
      className="pf-pd-lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={data.title || "Image modal"}
    >
      <div className="pf-pd-lightbox-inner" onClick={(e) => e.stopPropagation()}>
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
