// UI adapter for Layer 0 canonical profile content.
//
// Reads the strict-JSON canonical files under ../public and exposes profile,
// skills, experience, education, and links to the React components. Same role as
// projectsAdapter.js, for the non-project content silos. A future AI/RAG layer
// will read the same canonical files through a separate adapter.

import profile from "../public/profile.json";
import skills from "../public/skills.json";
import experience from "../public/experience.json";
import education from "../public/education.json";
import links from "../public/links.json";

export const getProfile = () => profile;

export const getSkills = () => skills;

export const getExperience = () => experience;

export const getEducation = () => education;

export const getLinks = () => links;
