import { X } from "lucide-react";
export const Modal = ({ data, children, onClose }) => {
  if (!data && !children) return null;
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={data.title || "Image modal"}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X />
        </button>
        {data ? (
          <div className="modal-inner">
            <img
              src={data.src}
              alt={data.alt}
              onClick={(e) => e.stopPropagation()}
              className="modal-image"
            />
            <div className="modal-info">
              <h3 className="modal-title">{data.title}</h3>
              <p className="modal-descriptions">{data.description}</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
