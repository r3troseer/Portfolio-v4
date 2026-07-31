// Gallery image delivery helpers for project detail.
// Thumbnails use Cloudinary transforms (responsive width + f_auto/q_auto + 16:10
// fill). The untransformed resolved URL is kept for the lightbox only.
// Handles /images/... rewrite paths and absolute Cloudinary URLs; does not invent
// a new image service or fetch dimensions at runtime.

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

const IMAGES_PREFIX = "/images/";
const CLOUDINARY_UPLOAD_RE =
  /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

/**
 * Resolve the untransformed delivery URL used by the lightbox.
 * - http(s) absolute: unchanged
 * - root-relative (e.g. /images/...): unchanged
 * - bare public id: prefix with VITE_IMAGE_BASE when set
 */
export function resolveOriginalSrc(src, imageBase = import.meta.env.VITE_IMAGE_BASE) {
  if (!src) return src;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("/")) return src;
  if (!imageBase) return src;
  return `${trimTrailingSlash(imageBase)}/${src}`;
}

function thumbTransform(width) {
  // Center fill to 16:10 matches object-fit: cover on the reserved shot box.
  return `f_auto,q_auto,c_fill,ar_16:10,w_${width}`;
}

/**
 * Insert Cloudinary delivery transforms ahead of the public id.
 * Only /images/... (Vercel rewrite) and res.cloudinary.com upload URLs are
 * rewritten; anything else is returned unchanged.
 */
export function withCloudinaryTransforms(originalSrc, transforms) {
  if (!originalSrc || !transforms) return originalSrc;

  if (originalSrc.startsWith(IMAGES_PREFIX)) {
    const publicId = originalSrc.slice(IMAGES_PREFIX.length);
    if (!publicId) return originalSrc;
    return `${IMAGES_PREFIX}${transforms}/${publicId}`;
  }

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
export function toGalleryImageDelivery(img, imageBase = import.meta.env.VITE_IMAGE_BASE) {
  const originalSrc = resolveOriginalSrc(img.src, imageBase);
  return {
    ...img,
    src: originalSrc,
    thumbSrc: buildGalleryThumbSrc(originalSrc),
    thumbSrcSet: buildGalleryThumbSrcSet(originalSrc),
  };
}
