// On-demand loader for full project detail payloads.
//
// Home never imports this module. ProjectDetail (and any future detail consumer)
// loads one canonical project JSON at a time via the generated fail-closed
// loader map (literal dynamic imports for approved ids only). Unknown ids
// resolve to null without constructing arbitrary import paths.

import { use } from "react";
import manifest from "../generated/project-manifest.json";
import { projectDetailLoaders } from "../generated/project-detail-loaders.js";
import { toGalleryImageDelivery } from "../../lib/imageDelivery";

const knownIds = new Set(manifest.projects.map((entry) => entry.id));

// Request-time lookup is Object.hasOwn / property get only. User-supplied ids
// never interpolate into import paths; only generated literal importers run.
const loadersById = new Map();
for (const id of knownIds) {
  const importer = projectDetailLoaders[id];
  if (typeof importer === "function") {
    loadersById.set(id, importer);
  }
}

const resolveContentCards = (contentCards = []) =>
  contentCards.map((card) =>
    card.gallery
      ? {
          ...card,
          gallery: {
            ...card.gallery,
            // src = untransformed original (lightbox); thumb* = responsive delivery.
            images: card.gallery.images.map((img) => toGalleryImageDelivery(img)),
          },
        }
      : card
  );

const toPresentation = (project) => {
  const { card, detail } = project;
  return {
    id: project.id,
    header: {
      title: card.title,
      subtitle: card.subtitle,
      overview: detail.overview,
      links: detail.links || [],
      badge: detail.badge,
    },
    focus: detail.focus || null,
    technologies: card.technologies || [],
    metrics: detail.metrics || [],
    contentCards: resolveContentCards(detail.contentCards),
    problemSolutions: detail.problemSolutions || [],
    timeline: detail.timeline || [],
  };
};

// Cache settled promises so Back/Forward reuses the same payload without a
// re-import, and so navigating away and back cannot flash a different project.
const detailPromiseCache = new Map();
// Stable unknown result: a fresh Promise.resolve(null) each render would
// re-suspend React use() indefinitely.
const UNKNOWN_DETAIL = Promise.resolve(null);

/**
 * Returns a promise of the presentation-ready detail object, or null when the
 * id is unknown / not in the public-safe manifest.
 */
export function loadProjectDetail(id) {
  if (typeof id !== "string" || !loadersById.has(id)) {
    return UNKNOWN_DETAIL;
  }

  let pending = detailPromiseCache.get(id);
  if (!pending) {
    const importer = loadersById.get(id);
    pending = importer()
      .then((mod) => {
        const project = mod?.default ?? mod;
        if (!project || project.id !== id) return null;
        return toPresentation(project);
      })
      .catch(() => null);
    detailPromiseCache.set(id, pending);
  }
  return pending;
}

/** True when id is a known public-safe manifest project with a generated importer. */
export function isKnownProjectId(id) {
  return typeof id === "string" && loadersById.has(id);
}

/**
 * Suspend until the selected project's detail payload is ready. Unknown ids
 * resolve immediately to null (NotFound). Uses the route-level Suspense
 * boundary (fallback={null}); no visible loading UI.
 */
export function useProjectDetail(id) {
  return use(loadProjectDetail(id));
}
