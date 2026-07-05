import { useState } from "react";

// A single media thumbnail. If the image fails to load (missing local file or
// CDN miss) the item removes itself and reports up so an all-failed gallery can
// hide its header too - no broken-image icons, no empty section.
export const GalleryItem = ({ img, setModalData, onFail }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <button
      type="button"
      className="pf-pd-shot"
      onClick={() => setModalData(img)}
      aria-label={`View ${img.title}`}
    >
      <img
        src={img.src}
        alt={img.title}
        onError={() => {
          setFailed(true);
          onFail?.();
        }}
      />
      <span className="pf-pd-shot-label">{img.title}</span>
    </button>
  );
};
