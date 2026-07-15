// Layer S content validation. Pure Node (no deps): parses the canonical public
// project JSON plus the registry and enforces the governance rules that were,
// until now, only documented (docs/agent/layer-s-policy.md and
// docs/agent/pre-layer1-validation-plan.md). Exit non-zero on any violation so CI
// fails the build.
//
// Also enforces the FE-B12 structured content-card schema (no markdown fields)
// and checks that projectsAdapter.js registration matches index.json.
//
// Run: npm run validate:content  (from apps/web)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "src", "content", "public");
const projectsDir = join(publicDir, "projects");
const adapterPath = join(here, "..", "src", "content", "adapters", "projectsAdapter.js");
const fixturesDir = join(here, "fixtures", "project-content");

// Controlled vocabularies (single source for the validator). Keep in step with
// docs/agent/layer-s-policy.md.
const VISIBILITY = new Set([
  "public",
  "public_summary_only",
  "limited",
  "private",
  "blocked",
]);
const SENSITIVITY = new Set(["safe", "sensitive"]);
const REPO_VISIBILITY = new Set(["public", "private"]);
// Only these may be surfaced in the UI / enter the future agent index.
const INDEXABLE = new Set(["public", "public_summary_only"]);
const CARD_TYPES = new Set(["Architecture", "Features"]);
const BLOCK_TYPES = new Set(["paragraph", "list", "subsection"]);
const SPAN_KEYS = new Set(["text", "bold", "italic", "code"]);
const MARKDOWN_FIELD = "markdown";
// Accidental leftover Markdown constructs in structured string fields.
const ACCIDENTAL_MD = /(?:^|\n)\s{0,3}#{1,6}\s|(?:^|\n)\s*[-*]\s+\S|\*\*[^*]+\*\*|`[^`]+`/;

const errors = [];
const infos = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

const isNonEmptyString = (v) => typeof v === "string" && v.trim() !== "";
const isPresentString = (v) => typeof v === "string" && v.length > 0;

const validateSpans = (file, label, spans) => {
  if (!Array.isArray(spans) || spans.length === 0) {
    err(file, `${label}: spans must be a non-empty array`);
    return;
  }
  let combined = "";
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const slabel = `${label}.spans[${i}]`;
    if (!span || typeof span !== "object" || Array.isArray(span)) {
      err(file, `${slabel}: must be an object`);
      continue;
    }
    for (const key of Object.keys(span)) {
      if (!SPAN_KEYS.has(key)) err(file, `${slabel}: unsupported key "${key}"`);
    }
    if (!isPresentString(span.text)) {
      err(file, `${slabel}: text must be a non-empty string`);
    } else {
      // Whitespace-only spans are allowed (spacing between adjacent code/emphasis).
      if (span.text.trim() !== "" && ACCIDENTAL_MD.test(span.text)) {
        err(file, `${slabel}: text looks like accidental Markdown`);
      }
      combined += span.text;
    }
    for (const flag of ["bold", "italic", "code"]) {
      if (span[flag] !== undefined && span[flag] !== true) {
        err(file, `${slabel}: ${flag} must be true when present`);
      }
    }
  }
  if (combined.trim() === "") {
    err(file, `${label}: spans combine to empty text`);
  }
};

const validateListItems = (file, label, items) => {
  if (!Array.isArray(items) || items.length === 0) {
    err(file, `${label}: list items must be a non-empty array`);
    return;
  }
  items.forEach((item, i) => {
    const ilabel = `${label}[${i}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      err(file, `${ilabel}: must be an object`);
      return;
    }
    if (item[MARKDOWN_FIELD] !== undefined) {
      err(file, `${ilabel}: accidental markdown field`);
    }
    validateSpans(file, `${ilabel}`, item.spans);
    if (item.items !== undefined) {
      validateListItems(file, `${ilabel}.items`, item.items);
    }
    for (const key of Object.keys(item)) {
      if (!["spans", "items"].includes(key)) {
        err(file, `${ilabel}: unsupported key "${key}"`);
      }
    }
  });
};

const validateBlocks = (file, label, blocks) => {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    err(file, `${label}: blocks must be a non-empty array`);
    return;
  }
  blocks.forEach((block, i) => {
    const blabel = `${label}[${i}]`;
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      err(file, `${blabel}: must be an object`);
      return;
    }
    if (block[MARKDOWN_FIELD] !== undefined) {
      err(file, `${blabel}: accidental markdown field`);
    }
    if (!BLOCK_TYPES.has(block.type)) {
      err(file, `${blabel}: unsupported block type "${block.type}"`);
      return;
    }
    if (block.type === "paragraph") {
      validateSpans(file, blabel, block.spans);
      for (const key of Object.keys(block)) {
        if (!["type", "spans"].includes(key)) {
          err(file, `${blabel}: unsupported key "${key}"`);
        }
      }
    } else if (block.type === "list") {
      validateListItems(file, `${blabel}.items`, block.items);
      for (const key of Object.keys(block)) {
        if (!["type", "items"].includes(key)) {
          err(file, `${blabel}: unsupported key "${key}"`);
        }
      }
    } else if (block.type === "subsection") {
      if (!isNonEmptyString(block.title)) {
        err(file, `${blabel}: subsection title must be a non-empty string`);
      } else if (ACCIDENTAL_MD.test(block.title)) {
        err(file, `${blabel}: subsection title looks like Markdown`);
      }
      validateBlocks(file, `${blabel}.blocks`, block.blocks);
      for (const key of Object.keys(block)) {
        if (!["type", "title", "blocks"].includes(key)) {
          err(file, `${blabel}: unsupported key "${key}"`);
        }
      }
    }
  });
};

const validateGallery = (file, label, gallery) => {
  if (!gallery || typeof gallery !== "object" || Array.isArray(gallery)) {
    err(file, `${label}: gallery must be an object`);
    return;
  }
  if (gallery.title !== undefined && typeof gallery.title !== "string") {
    err(file, `${label}: gallery.title must be a string when present`);
  }
  if (!Array.isArray(gallery.images) || gallery.images.length === 0) {
    err(file, `${label}: gallery.images must be a non-empty array`);
    return;
  }
  gallery.images.forEach((img, i) => {
    const ilabel = `${label}.images[${i}]`;
    if (!img || typeof img !== "object" || Array.isArray(img)) {
      err(file, `${ilabel}: must be an object`);
      return;
    }
    if (!isNonEmptyString(img.src)) err(file, `${ilabel}: src must be a non-empty string`);
    if (!isNonEmptyString(img.title)) err(file, `${ilabel}: title must be a non-empty string`);
    if (img.description !== undefined && typeof img.description !== "string") {
      err(file, `${ilabel}: description must be a string when present`);
    }
  });
};

/** Validate one structured content card. Exported shape used by live projects + fixtures. */
export const validateContentCard = (file, card, index) => {
  const label = `contentCards[${index}]`;
  if (!card || typeof card !== "object" || Array.isArray(card)) {
    err(file, `${label}: must be an object`);
    return;
  }
  if (card[MARKDOWN_FIELD] !== undefined) {
    err(file, `${label}: accidental markdown field (structured cards only)`);
  }
  if (!isNonEmptyString(card.title)) {
    err(file, `${label}: missing title`);
  } else if (ACCIDENTAL_MD.test(card.title)) {
    err(file, `${label}: title looks like Markdown`);
  }
  if (!CARD_TYPES.has(card.type)) {
    err(file, `${label}: type must be Architecture or Features (got "${card.type}")`);
  }
  validateBlocks(file, `${label}.blocks`, card.blocks);
  if (card.tags !== undefined) {
    if (!Array.isArray(card.tags) || card.tags.some((t) => typeof t !== "string")) {
      err(file, `${label}: tags must be an array of strings`);
    }
  }
  if (card.gallery !== undefined) {
    validateGallery(file, `${label}.gallery`, card.gallery);
  }
  for (const key of Object.keys(card)) {
    if (!["type", "title", "blocks", "tags", "gallery"].includes(key)) {
      err(file, `${label}: unsupported key "${key}"`);
    }
  }
};

// --- Load every per-project file (everything except the registry) -----------
const files = readdirSync(projectsDir).filter(
  (f) => f.endsWith(".json") && f !== "index.json"
);

const byId = new Map();
for (const file of files) {
  const expectedId = basename(file, ".json");
  let data;
  try {
    data = JSON.parse(readFileSync(join(projectsDir, file), "utf8"));
  } catch (e) {
    err(file, `invalid JSON (${e.message})`);
    continue;
  }

  if (data.id !== expectedId) {
    err(file, `id "${data.id}" does not match filename "${expectedId}"`);
  }
  if (!VISIBILITY.has(data.visibility)) {
    err(file, `visibility "${data.visibility}" not in controlled vocabulary`);
  }
  if (!SENSITIVITY.has(data.sensitivity)) {
    err(file, `sensitivity "${data.sensitivity}" not in controlled vocabulary`);
  }
  if (typeof data.status !== "string" || data.status.trim() === "") {
    err(file, "status must be a non-empty string");
  }
  if (
    data.repo &&
    data.repo.visibility !== undefined &&
    !REPO_VISIBILITY.has(data.repo.visibility)
  ) {
    err(file, `repo.visibility "${data.repo.visibility}" not in {public, private}`);
  }

  // Structured content-card schema (registered public projects only validated
  // deeply below after registry load; unregistered files may still be private).
  if (Array.isArray(data.detail?.contentCards)) {
    data.detail.contentCards.forEach((card, i) => {
      // Always reject leftover markdown on any project file we can read.
      if (card && typeof card === "object" && card[MARKDOWN_FIELD] !== undefined) {
        // ESG and other unregistered files are out of worker write scope; still
        // flag markdown so a future migration cannot silently leave the bridge.
        // Unregistered private files are reported as info-only if not indexable.
        if (INDEXABLE.has(data.visibility)) {
          validateContentCard(file, card, i);
        } else if (card[MARKDOWN_FIELD] !== undefined) {
          infos.push(
            `${file}: contentCards[${i}] still has markdown (unregistered / non-indexable; not surfaced)`
          );
        }
      } else if (INDEXABLE.has(data.visibility)) {
        validateContentCard(file, card, i);
      }
    });
  }

  if (data.id) byId.set(data.id, { file, data });
}

// --- Registry integrity + index gating --------------------------------------
let registry;
try {
  registry = JSON.parse(readFileSync(join(projectsDir, "index.json"), "utf8"));
} catch (e) {
  err("index.json", `invalid JSON (${e.message})`);
}

const registeredIds = new Set();
if (registry) {
  const entries = registry.projects;
  if (!Array.isArray(entries)) {
    err("index.json", "projects must be an array");
  } else {
    const seenIds = new Set();
    const seenOrders = new Set();
    for (const entry of entries) {
      const label = entry && entry.id ? `index.json (${entry.id})` : "index.json";

      if (!entry || typeof entry.id !== "string") {
        err("index.json", "each entry needs a string id");
        continue;
      }
      registeredIds.add(entry.id);

      if (seenIds.has(entry.id)) err(label, `duplicate registry id "${entry.id}"`);
      seenIds.add(entry.id);

      if (!Number.isInteger(entry.displayOrder) || entry.displayOrder < 1) {
        err(label, `displayOrder must be a positive integer`);
      } else if (seenOrders.has(entry.displayOrder)) {
        err(label, `duplicate displayOrder ${entry.displayOrder}`);
      }
      seenOrders.add(entry.displayOrder);

      if (typeof entry.featured !== "boolean") {
        err(label, "featured must be a boolean");
      }

      const project = byId.get(entry.id);
      if (!project) {
        err(label, `registered id "${entry.id}" has no matching project file`);
        continue;
      }

      // Index gating: a surfaced project must be publicly indexable.
      if (!INDEXABLE.has(project.data.visibility)) {
        err(
          label,
          `registered project is "${project.data.visibility}"; only ${[...INDEXABLE].join(
            " / "
          )} may be surfaced`
        );
      }

      // Registered projects must use structured cards (re-validate explicitly).
      const cards = project.data.detail?.contentCards;
      if (!Array.isArray(cards) || cards.length === 0) {
        err(project.file, "registered project must have non-empty detail.contentCards");
      }
    }
  }
}

// Present-but-unregistered files are allowed by design (e.g. esg-greenwashing);
// report them as information, not failure.
for (const [id, { file }] of byId) {
  if (!registeredIds.has(id)) {
    infos.push(`${file}: present but unregistered (not surfaced) - visibility "${byId.get(id).data.visibility}"`);
  }
}

// --- Adapter registration must match the registry ---------------------------
try {
  const adapterSrc = readFileSync(adapterPath, "utf8");
  const byIdMatch = adapterSrc.match(/const projectsById = \{([\s\S]*?)\n\};/);
  if (!byIdMatch) {
    err("projectsAdapter.js", "could not find projectsById registration object");
  } else {
    const body = byIdMatch[1];
    const adapterIds = new Set();
    // Matches "id-with-dashes": ref  OR  bareIdentifier,
    for (const m of body.matchAll(/["']([a-z0-9-]+)["']\s*:/g)) {
      adapterIds.add(m[1]);
    }
    for (const m of body.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*,?\s*$/gm)) {
      // bare shorthand keys (mealsync, studybud, ...) — id equals import binding
      // when the JSON id has no dashes. Map known camelCase imports below.
      const name = m[1];
      const dashed = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      // Only accept if it matches a known project file id.
      if (byId.has(name)) adapterIds.add(name);
      else if (byId.has(dashed)) adapterIds.add(dashed);
    }
    for (const id of registeredIds) {
      if (!adapterIds.has(id)) {
        err(
          "projectsAdapter.js",
          `stale adapter registration: registry id "${id}" missing from projectsById`
        );
      }
    }
    for (const id of adapterIds) {
      if (!registeredIds.has(id)) {
        err(
          "projectsAdapter.js",
          `stale adapter registration: projectsById id "${id}" not in index.json`
        );
      }
    }
  }
} catch (e) {
  err("projectsAdapter.js", `could not read adapter (${e.message})`);
}

// --- Embedded reject/pass card checks (fixtures dir may be gitignored) ------
{
  const cases = [
    {
      name: "embedded/valid-simple",
      expect: "pass",
      card: {
        type: "Architecture",
        title: "Architecture",
        blocks: [
          {
            type: "list",
            items: [
              {
                spans: [
                  { text: "Clean Architecture", bold: true },
                  { text: ": layered core." },
                ],
              },
            ],
          },
        ],
        tags: ["API"],
      },
    },
    {
      name: "embedded/missing-title",
      expect: "fail",
      card: {
        type: "Features",
        title: "",
        blocks: [{ type: "paragraph", spans: [{ text: "Hello" }] }],
      },
    },
    {
      name: "embedded/empty-text",
      expect: "fail",
      card: {
        type: "Features",
        title: "Features",
        blocks: [{ type: "paragraph", spans: [{ text: "   " }] }],
      },
    },
    {
      name: "embedded/unsupported-type",
      expect: "fail",
      card: {
        type: "Wizard",
        title: "Wizard",
        blocks: [{ type: "paragraph", spans: [{ text: "Nope" }] }],
      },
    },
    {
      name: "embedded/markdown-field",
      expect: "fail",
      card: {
        type: "Architecture",
        title: "Architecture",
        markdown: "### Architecture\n- item",
        blocks: [{ type: "paragraph", spans: [{ text: "x" }] }],
      },
    },
    {
      name: "embedded/bad-gallery",
      expect: "fail",
      card: {
        type: "Features",
        title: "Features",
        blocks: [{ type: "list", items: [{ spans: [{ text: "One" }] }] }],
        gallery: { title: "Gallery", images: [{ src: "", title: "" }] },
      },
    },
    {
      name: "embedded/unsupported-block",
      expect: "fail",
      card: {
        type: "Architecture",
        title: "Architecture",
        blocks: [{ type: "html", spans: [{ text: "x" }] }],
      },
    },
  ];

  for (const fixture of cases) {
    const before = errors.length;
    validateContentCard(fixture.name, fixture.card, 0);
    const failed = errors.length > before;
    if (fixture.expect === "pass" && failed) {
      // keep recorded errors
    } else if (fixture.expect === "fail") {
      if (!failed) {
        err(fixture.name, "expected validation failure but card passed");
      } else {
        errors.length = before;
      }
    }
  }
}

// --- Optional on-disk fixtures (same schema; path allowed but may be gitignored)
if (existsSync(fixturesDir)) {
  const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
  for (const file of fixtureFiles) {
    const path = join(fixturesDir, file);
    let fixture;
    try {
      fixture = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      err(`fixtures/${file}`, `invalid JSON (${e.message})`);
      continue;
    }
    const before = errors.length;
    validateContentCard(`fixtures/${file}`, fixture.card, 0);
    const failed = errors.length > before;
    if (fixture.expect === "pass" && failed) {
      // errors already recorded
    } else if (fixture.expect === "fail") {
      if (!failed) {
        err(`fixtures/${file}`, "expected validation failure but card passed");
      } else {
        // Drop the expected failure errors — fixture is documenting reject cases.
        errors.length = before;
      }
    } else if (fixture.expect !== "pass") {
      err(`fixtures/${file}`, `expect must be "pass" or "fail"`);
    }
  }
}

// --- Profile silos -----------------------------------------------------------
// The non-project silos carry the same top-level governance fields as projects
// (added for the Layer 1 evidence index; the index builder in
// apps/api/core/layer1/ fail-closes on a missing/unknown visibility).
const SILO_FILES = [
  "profile.json",
  "skills.json",
  "experience.json",
  "education.json",
  "links.json",
];

for (const file of SILO_FILES) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(publicDir, file), "utf8"));
  } catch (e) {
    err(file, `invalid JSON (${e.message})`);
    continue;
  }
  if (!VISIBILITY.has(data.visibility)) {
    err(file, `visibility "${data.visibility}" not in controlled vocabulary`);
  }
  if (!SENSITIVITY.has(data.sensitivity)) {
    err(file, `sensitivity "${data.sensitivity}" not in controlled vocabulary`);
  }
}

// --- Report -----------------------------------------------------------------
for (const line of infos) console.log(`info  ${line}`);

if (errors.length > 0) {
  for (const line of errors) console.error(`ERROR ${line}`);
  console.error(`\nContent validation failed: ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `\nContent validation passed: ${files.length} project file(s), ${registeredIds.size} registered, ${SILO_FILES.length} profile silo(s).`
);
