# Content adapters

Adapters translate the **canonical Layer 0 content** (`src/content/public/...`) into the
shapes each consumer needs. Canonical files are the single source of truth; consumers never
read them directly. UI and AI concerns use **separate adapters** over the same files.

Currently implemented: **`projectsAdapter.js`** (Home summaries), **`projectDetailLoader.js`**
(on-demand detail), and **`profileAdapter.js`** (UI adapters).

## Canonical project shape (`public/projects/<id>.json`)

Strict JSON only: no JSX, functions, comments, template literals, imports, runtime environment access,
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
    "contentCards": [{
      "type": "Architecture|Features",
      "title": "Architecture & Backend",
      "blocks": [
        { "type": "paragraph", "spans": [{ "text": "..." }, { "text": "emphasized", "bold": true }] },
        { "type": "list", "items": [
          { "spans": [{ "text": "Label", "bold": true }, { "text": ": detail with " }, { "text": "code", "code": true }],
            "items": [{ "spans": [{ "text": "nested item" }] }] }
        ]},
        { "type": "subsection", "title": "Core Capabilities:", "blocks": [
          { "type": "list", "items": [{ "spans": [{ "text": "..." }] }] }
        ]}
      ],
      "tags": [],
      "gallery": {}
    }],
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

## Generated outputs (`generated/`)

Build-time script `content/generate-project-manifest.mjs` reads the registry plus each
registered canonical file and writes two deterministic public-safe outputs:

1. **`project-manifest.json`** - Home summary + routing discovery. Only
   `visibility: public | public_summary_only` with `sensitivity: safe` projects are
   included. Order and featured registry flags are preserved. Excludes overview prose,
   content cards, galleries, problem/solution data, timelines, AI metadata, and any
   limited / private / blocked / sensitive / unregistered project (registry membership
   and governance fields drive inclusion; no hardcoded project-id deny list).
2. **`project-detail-loaders.js`** - fail-closed ID-to-`import()` map containing
   **exactly** those same approved ids in the same order. Each literal dynamic import
   becomes its own deferred Vite chunk. Unregistered or unsafe files never appear, so
   they cannot become downloadable detail chunks.

`npm run generate:project-manifest` writes both files. `npm run validate:content`
regenerates the expected outputs in memory and fails on stale committed drift,
manifest/loader id-order mismatch, missing registered files, duplicate registry
ids/orders, or unsafe surfaced projects. Production `npm run build` regenerates before
Vite so committed outputs stay aligned.

Manifest entry fields (Home + routing discovery only):

| Field | Use |
|---|---|
| `id`, `displayOrder`, `featured` | Registry order, featured selection, known-id routing |
| `title`, `subtitle`, `summary`, `technologies` | Featured showcase + selected-work rows |
| `listTech` (optional) | Curated tech line for list rows when present |
| `metrics` (max 4, top showcase only) | Present only on the single top ordered Home featured entry; omitted from list-only entries |

## `projectsAdapter.js` API (Home only)

Imports **only** `generated/project-manifest.json`. Never imports canonical per-project JSON.

| Function | Returns |
|---|---|
| `getFeaturedProject()` | The single top project by `displayOrder` as `{ id, title, subtitle, description, technologies, metrics }` (home "featured showcase"). |
| `getProjectListItems()` | The remaining projects as numbered rows `{ id, idx, title, subtitle, techLine }` (`idx` continues from the featured card at `02`; `techLine` prefers a curated `listTech`). |

## `projectDetailLoader.js` API (detail route)

Loads **one** canonical `public/projects/<id>.json` on demand through the generated
`project-detail-loaders.js` map. Ids are validated against the generated manifest before
lookup; unknown ids resolve to `null` without arbitrary path construction. Each approved
project JSON is its own deferred Vite chunk by construction of the literal `import()`
entries. Promises are cached so browser Back/Forward reuses the payload.

| Function | Returns |
|---|---|
| `loadProjectDetail(id)` | Promise of the presentation-ready detail object, or `null` if unknown. |
| `useProjectDetail(id)` | Same payload via React `use()` (suspends on the route-level Suspense boundary). |
| `isKnownProjectId(id)` | Whether `id` is a public-safe manifest project with a generated importer. |

Presentation shape matches the former `getProjectById` contract:
`{ id, header, focus, technologies, metrics, contentCards, problemSolutions, timeline }`.
`contentCards` keep structured blocks; gallery image `src` values are base-URL resolved here.

### Image resolution
`gallery.images[].src` rules (applied in the detail loader):
- starts with `http`: used as-is;
- starts with `/`: used as-is (e.g. `/images/...` in `public/`);
- otherwise: prefixed with `import.meta.env.VITE_IMAGE_BASE` + `/`.

## Adding a project
1. Add a strict-JSON file under `public/projects/<id>.json` using the shape above.
2. Add a registry entry to `public/projects/index.json` (and ensure visibility/sensitivity
   allow surfacing).
3. Run `npm run generate:project-manifest` (and `npm run validate:content`) so both the
   Home manifest and the detail loader map include the new public-safe project. Do **not**
   hand-edit either generated file or maintain a separate id map.

Omit step 2 to keep a file on disk but out of the UI. Unregistered files are excluded from
both generated outputs by construction and never become deferred detail chunks.

## Markdown layer (`public/markdown/`, AI-facing)

`about.md` and `role-lenses/*.md` are AI-facing prose for the future AI/RAG adapter; the React
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

No dates (git is the record of "when"). No front matter on the JSON files - they are already
structured.

## `profileAdapter.js` API

Profile content silos live as strict JSON directly under `public/` and are read by
`profileAdapter.js` (UI adapter for the non-project content). Each silo carries the same
top-level governance fields as projects (`visibility`, `sensitivity`; all currently
`public` / `safe`) so the Layer 1 evidence index (`apps/api/core/layer1/`) can gate them
fail-closed. The UI adapter ignores these fields.

| Function | Returns (canonical file) |
|---|---|
| `getProfile()` | `profile.json`: `{ name, role, headline, headlineHighlight, intro, availability, location, facts: [], bioShort, bio: [] }` (feeds Hero, About, Navigation). |
| `getCapabilities()` | `skills.json`: `{ niche, categories: [] }` (feeds the Capabilities bento). |
| `getExperience()` | `experience.json`: `{ roles: [{ title, company, date, location, responsibilities: [{ t, m? }] }] }` (feeds Experience). |
| `getEducation()` | `education.json`: `{ entries: [{ institution, qualification, detail }] }` (no UI consumer yet; future Education section + AI). |
| `getLinks()` | `links.json`: `{ email, profiles: [{ label, value, href, external, showInUi?, showInContact? }] }`; the UI adapter removes entries with `showInUi: false`, while individual surfaces may additionally honour `showInContact: false`. |
