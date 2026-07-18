// Gallery image delivery helpers for project detail.
// Thumbnails use Cloudinary transforms (responsive width + f_auto/q_auto + 16:10
// fill). The untransformed resolved URL is kept for the lightbox only.
// Canonical project content stores provider-neutral public IDs. This module owns
// their public Cloudinary delivery URLs in every environment.

/** Intrinsic 16:10 hints matching .pf-pd-shot aspect-ratio (CLS reservation). */
export const GALLERY_THUMB_WIDTH = 640;
export const GALLERY_THUMB_HEIGHT = 400;

/** Bounded Cloudinary width candidates for srcset (CSS pixels). */
export const GALLERY_THUMB_WIDTHS = [320, 480, 640, 800, 960];

/**
 * sizes aligned to .pf-pd-media-grid: auto-fit minmax(200px, 1fr).
 * Approximate column width without a runtime probe.
 */
export const GALLERY_THUMB_SIZES =
  "(max-width: 640px) 92vw, (max-width: 960px) 45vw, 30vw";

export const CLOUDINARY_UPLOAD_BASE =
  "https://res.cloudinary.com/dyzzyrfdq/image/upload";
const CLOUDINARY_UPLOAD_RE =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;

/**
 * Resolve the untransformed delivery URL used by the lightbox.
 * - http(s) absolute: unchanged
 * - root-relative application assets: unchanged
 * - bare public id: delivered from the portfolio's public Cloudinary cloud
 */
export function resolveOriginalSrc(src) {
  if (!src) return src;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/")) return src;
  return `${CLOUDINARY_UPLOAD_BASE}/${src}`;
}

function thumbTransform(width) {
  // Center fill to 16:10 matches object-fit: cover on the reserved shot box.
  return `f_auto,q_auto,c_fill,ar_16:10,w_${width}`;
}

/**
 * Insert Cloudinary delivery transforms ahead of the public id.
 * Absolute Cloudinary upload URLs are transformed; anything else is unchanged.
 */
export function withCloudinaryTransforms(originalSrc, transforms) {
  if (!originalSrc || !transforms) return originalSrc;

  const match = originalSrc.match(CLOUDINARY_UPLOAD_RE);
  if (match) {
    const [, prefix, rest] = match;
    return `${prefix}${transforms}/${rest}`;
  }

  return originalSrc;
}

export function buildGalleryThumbSrc(originalSrc, width = GALLERY_THUMB_WIDTH) {
  return withCloudinaryTransforms(originalSrc, thumbTransform(width));
}

export function buildGalleryThumbSrcSet(originalSrc) {
  return GALLERY_THUMB_WIDTHS.map(
    (width) => `${buildGalleryThumbSrc(originalSrc, width)} ${width}w`,
  ).join(", ");
}

/** Enrich a gallery image record: src stays the untransformed original. */
export function toGalleryImageDelivery(img) {
  const originalSrc = resolveOriginalSrc(img.src);
  return {
    ...img,
    src: originalSrc,
    thumbSrc: buildGalleryThumbSrc(originalSrc),
    thumbSrcSet: buildGalleryThumbSrcSet(originalSrc),
  };
}
