// UI adapter for Layer 0 canonical project content.
//
// Reads the strict-JSON canonical files under ../public/projects and exposes
// UI-shaped data to the React components. This is the ONLY place that knows the
// canonical shape; components stay decoupled from the on-disk format. A future
// AI/RAG layer will add a SEPARATE adapter over the same canonical files.
//
// CRA/webpack resolves JSON imports at build time, so each canonical file is
// imported statically and registered by id.

import index from "../public/projects/index.json";
import gfaExchange from "../public/projects/gfa-exchange.json";
import mealsync from "../public/projects/mealsync.json";
import studybud from "../public/projects/studybud.json";
import trainBooking from "../public/projects/train-booking.json";
import ticketsage from "../public/projects/ticketsage.json";
import eprep from "../public/projects/eprep.json";
import printingService from "../public/projects/printing-service.json";
import ukShiftCalculator from "../public/projects/uk-shift-calculator.json";
import pactguard from "../public/projects/pactguard.json";
import esgGreenwashing from "../public/projects/esg-greenwashing.json";

const baseUrl = process.env.REACT_APP_IMAGE_BASE;

const projectsById = {
  "gfa-exchange": gfaExchange,
  mealsync,
  studybud,
  "train-booking": trainBooking,
  ticketsage,
  eprep,
  "printing-service": printingService,
  "uk-shift-calculator": ukShiftCalculator,
  pactguard,
  "esg-greenwashing": esgGreenwashing,
};

// Registry (index.json) sorted by displayOrder. Registry holds presentation
// routing only (id, displayOrder, featured); never card/detail content and never
// governance fields (visibility/status/sensitivity live in the per-project files).
const orderedRegistry = [...index.projects].sort(
  (a, b) => a.displayOrder - b.displayOrder
);

// Image base-URL resolution lives in the adapter, not in JSON. Absolute paths
// ("/...") and full URLs ("http...") pass through; bare names get the base prefix.
const resolveImageSrc = (src) => {
  if (!src) return src;
  if (src.startsWith("http") || src.startsWith("/")) return src;
  return `${baseUrl}/${src}`;
};

const resolveContentCards = (contentCards = []) =>
  contentCards.map((card) =>
    card.gallery
      ? {
          ...card,
          gallery: {
            ...card.gallery,
            images: card.gallery.images.map((img) => ({
              ...img,
              src: resolveImageSrc(img.src),
            })),
          },
        }
      : card
  );

// Map a registry entry to the props ProjectCard expects.
const toCard = (entry) => {
  const project = projectsById[entry.id];
  return {
    id: project.id,
    title: project.card.title,
    description: project.card.summary,
    technologies: project.card.technologies,
  };
};

export const getAllProjectCards = () => orderedRegistry.map(toCard);

export const getFeaturedProjects = () =>
  orderedRegistry.filter((entry) => entry.featured).map(toCard);

export const getRestProjects = () =>
  orderedRegistry.filter((entry) => !entry.featured).map(toCard);

// Returns a legacy-compatible object so ProjectDetail.jsx renders unchanged:
// { id, header: { title, subtitle, overview, links, badge }, metrics,
//   contentCards, problemSolutions, timeline }. Returns null when not found.
export const getProjectById = (id) => {
  const project = projectsById[id];
  if (!project) return null;

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
    metrics: detail.metrics || [],
    contentCards: resolveContentCards(detail.contentCards),
    problemSolutions: detail.problemSolutions || [],
    timeline: detail.timeline || [],
  };
};
