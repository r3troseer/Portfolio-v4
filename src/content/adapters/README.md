# Content adapters

Adapters translate the **canonical Layer 0 content** (`src/content/public/...`) into the
shapes each consumer needs. Canonical files are the single source of truth; consumers never
read them directly. UI and AI concerns use **separate adapters** over the same files.

Currently implemented: **`projectsAdapter.js`** (UI adapter for projects).

## Canonical project shape (`public/projects/<id>.json`)

Strict JSON only: no JSX, functions, comments, template literals, imports, `process.env`,
or computed values. Image base-URL resolution happens in the adapter, not in JSON.

```jsonc
{
  "id": "mealsync",
  "visibility": "public",          // public | public_summary_only | limited | private | blocked
  "status": "live",                // display only: live | mvp | prototype | case-study | archived | honourable-mention | in-progress
  "sensitivity": "safe",           // safe | sensitive
  "repo": { "visibility": "public" },
  // NOTE: displayOrder + featured are NOT here; they live only in index.json (presentation registry).

  "card": {                        // homepage card: single source of truth for title/summary/tech
    "title": "MealSync",
    "subtitle": "...",
    "summary": "...",
    "technologies": ["FastAPI", "React"]
  },

  "detail": {                      // project detail page
    "overview": "...",
    "links": [{ "icon": "github", "text": "...", "href": "..." }],
    "badge": { "text": "Live", "type": "live", "size": "small" },   // optional
    "metrics": [{ "number": "...", "label": "..." }],
    "contentCards": [{ "markdown": "...", "type": "Architecture|Features", "tags": [], "gallery": {} }],
    "problemSolutions": [{ "problem": {}, "solution": {} }],
    "timeline": [{ "title": "...", "description": "..." }]
  },

  "ai": {                          // scaffolding for the future AI/RAG adapter (unused by UI)
    "publicSummary": "...",
    "roleLenses": ["backend", "ai-nlp"],   // controlled vocab (see below)
    "evidenceSkills": ["FastAPI"],
    "safeTalkingPoints": [],
    "sensitivity": "safe"
  }
}
```

`index.json` is a **presentation registry only** (`id`, `displayOrder`, `featured`); it never
duplicates card/detail content and holds no governance fields. Governance (`visibility`,
`status`, `sensitivity`, `repo`) lives in the per-project files. This split keeps a single
source of truth: presentation/order in `index.json`, content + governance per file.

### Controlled vocabularies
- `ai.roleLenses`: `backend`, `python-django`, `dotnet`, `ai-nlp`, `document-intelligence`,
  `data-pipelines`, `fintech`, `fullstack`.
- `status` (display only, never a privacy signal): see list above.

## `projectsAdapter.js` API

| Function | Returns |
|---|---|
| `getAllProjectCards()` | All projects sorted by `displayOrder`, as `{ id, title, description, technologies }` (ProjectCard props; `description` = `card.summary`). |
| `getFeaturedProjects()` | Registry `featured: true` entries (card shape). |
| `getRestProjects()` | Registry `featured: false` entries (card shape). |
| `getProjectById(id)` | Legacy-compatible detail object `{ id, header, metrics, contentCards, problemSolutions, timeline }`, or `null` if unknown. Gallery image `src` values are base-URL resolved here. |

### Image resolution
`gallery.images[].src` rules (applied in the adapter):
- starts with `http`: used as-is;
- starts with `/`: used as-is (e.g. `/images/...` in `public/`);
- otherwise: prefixed with `process.env.REACT_APP_IMAGE_BASE` + `/`.

## Adding a project
1. Add a strict-JSON file under `public/projects/<id>.json` using the shape above.
2. Add a registry entry to `public/projects/index.json`.
3. Register the import in `projectsAdapter.js` (`projectsById`).

## Markdown layer (`public/markdown/`, AI-facing)

`about.md` and `role-lenses/*.md` are AI-facing prose for the future AI/RAG adapter; the CRA
UI does not import them. Each carries YAML front matter for machine-readable governance, at
parity with the JSON content:

```yaml
---
title: Backend Engineer
type: role-lens          # about | role-lens
roleLens: backend        # role-lenses only; controlled vocab (see above)
visibility: public       # only public / public_summary_only may enter the agent index
sensitivity: safe        # safe | sensitive
source: profile.json     # optional provenance / UI-truth link (used on about.md)
---
```

No dates (git is the record of "when"). No front matter on the JSON files — they are already
structured.

## `profileAdapter.js` API

Profile content silos live as strict JSON directly under `public/` and are read by
`profileAdapter.js` (UI adapter for the non-project content).

| Function | Returns (canonical file) |
|---|---|
| `getProfile()` | `profile.json`: `{ name, tagline, location, bio: [] }` (feeds Hero, About, Footer, Navigation). |
| `getSkills()` | `skills.json`: `{ groups: [{ title, subskill }] }` (feeds Skill). |
| `getExperience()` | `experience.json`: `{ roles: [{ title, company, date, location, responsibilities: [] }] }` (feeds Experience). |
| `getEducation()` | `education.json`: `{ entries: [{ institution, qualification, detail }] }` (no UI consumer yet; future Education section + AI). |
| `getLinks()` | `links.json`: `{ email, profiles: [{ label, value, href, external }] }` (feeds Contact). |
