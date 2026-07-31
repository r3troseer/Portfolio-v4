// UI adapter for Layer 0 Home project summaries.
//
// Reads only the generated public-safe summary manifest. Full project detail
// JSON is never imported here; ProjectDetail loads one payload at a time via
// projectDetailLoader.js. Components stay decoupled from the on-disk format.

import manifest from "../generated/project-manifest.json";

// Manifest projects are already sorted by displayOrder at generation time.
const orderedProjects = manifest.projects;

// Profile "featured showcase": the single top project by displayOrder.
// Governance: we intentionally feature a public registry project, never
// private/sensitive unregistered research. Includes up to four detail metrics
// for the side-panel (present only on the top manifest entry).
export const getFeaturedProject = () => {
  const project = orderedProjects[0];
  if (!project) return null;
  return {
    id: project.id,
    title: project.title,
    subtitle: project.subtitle,
    description: project.summary,
    technologies: project.technologies || [],
    metrics: (project.metrics || []).slice(0, 4),
  };
};

// Profile "selected work" list: every project after the featured showcase, as
// numbered rows (index + title + subtitle + a short tech line).
export const getProjectListItems = () =>
  orderedProjects.slice(1).map((project, i) => {
    // Featured showcase counts as 01, so the list numbering starts at 02.
    // Prefer the curated distinctive `listTech`, else the first three technologies.
    const techLine = project.listTech
      ? project.listTech.join(" · ")
      : (project.technologies || []).slice(0, 3).join(" · ");
    return {
      id: project.id,
      idx: String(i + 2).padStart(2, "0"),
      title: project.title,
      subtitle: project.subtitle,
      techLine,
    };
  });
