import { useEffect, useRef, useState } from "react";
import {
  GALLERY_THUMB_HEIGHT,
  GALLERY_THUMB_SIZES,
  GALLERY_THUMB_WIDTH,
} from "../lib/imageDelivery";

// Conservative pre-load band: load shortly before the shot enters view, but far
// tighter than Chromium's native lazy distance (which still fetched EPrep
// gallery thumbs at route entry on 390x844).
const THUMB_ROOT_MARGIN = "200px 0px";

// A single media thumbnail. If the image fails to load (missing local file or
// CDN miss) the item removes itself and reports up so an all-failed gallery can
// hide its header too - no broken-image icons, no empty section.
// Thumbnails use responsive Cloudinary candidates; img.src (untransformed) is
// reserved for the lightbox via setModalData and is not requested here.
// src/srcset attach only after a component-local IntersectionObserver fires
// (or immediately when IO is unavailable).
export const GalleryItem = ({ img, setModalData, onFail }) => {
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  const buttonRef = useRef(null);

  useEffect(() => {
    if (active) return undefined;
    const node = buttonRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: THUMB_ROOT_MARGIN, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  if (failed) return null;

  const thumbSrc = img.thumbSrc || img.src;
  const thumbSrcSet = img.thumbSrcSet;

  return (
    <button
      ref={buttonRef}
      type="button"
      className="pf-pd-shot"
      onClick={() => setModalData(img)}
      aria-label={`View ${img.title}`}
    >
      <img
        src={active ? thumbSrc : undefined}
        srcSet={active && thumbSrcSet ? thumbSrcSet : undefined}
        sizes={active && thumbSrcSet ? GALLERY_THUMB_SIZES : undefined}
        width={GALLERY_THUMB_WIDTH}
        height={GALLERY_THUMB_HEIGHT}
        loading="lazy"
        decoding="async"
        alt={img.title}
        onError={() => {
          // Absent src before activation must not count as a delivery failure.
          if (!active) return;
          setFailed(true);
          onFail?.();
        }}
      />
      <span className="pf-pd-shot-label">{img.title}</span>
    </button>
  );
};
