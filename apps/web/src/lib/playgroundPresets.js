// Safe, whitelisted preset prompts for the evidence playground. The preset `id`
// is the ONLY query-derived token ever allowed in the URL (`/playground?p=<id>`);
// the raw query text itself never goes in the URL (it travels via navigation
// state, so it stays out of history, edge logs, and analytics).
//
// Shared by the assistant shell (the Cmd/Ctrl+K entry point) and the Playground
// page. Kept data-only and dependency-free so importing it into the always-mounted
// shell does not pull the lazy-loaded page into the home bundle.
// See docs/agent/layer1-playground.md.

// `roleLens` (optional) maps to the backend's soft +2 ranking boost - it never
// filters, so lens-less records still rank. Values match the content role lenses
// (backend / ai-nlp / fintech / fullstack).
// Labels use the handoff's terse lowercase chip style; content is the task's safe
// preset set. (Merge of the two, per decision.)
export const PRESETS = [
  { id: "ai-work", label: "AI work", query: "AI and NLP work", roleLens: "ai-nlp" },
  {
    id: "backend-depth",
    label: "backend depth",
    query: "backend systems and APIs",
    roleLens: "backend",
  },
  {
    id: "fintech-experience",
    label: "fintech experience",
    query: "fintech payments experience",
    roleLens: "fintech",
  },
  {
    id: "strongest-evidence",
    label: "strongest evidence",
    query: "strongest evidence and impact",
  },
  {
    id: "project-proof",
    label: "project proof",
    query: "project proof and outcomes",
  },
];

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
