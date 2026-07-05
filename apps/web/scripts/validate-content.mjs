// Layer S content validation. Pure Node (no deps): parses the canonical public
// project JSON plus the registry and enforces the governance rules that were,
// until now, only documented (docs/agent/layer-s-policy.md and
// docs/agent/pre-layer1-validation-plan.md). Exit non-zero on any violation so CI
// fails the build.
//
// Run: npm run validate:content  (from apps/web)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectsDir = join(here, "..", "src", "content", "public", "projects");

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

const errors = [];
const infos = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

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

// --- Report -----------------------------------------------------------------
for (const line of infos) console.log(`info  ${line}`);

if (errors.length > 0) {
  for (const line of errors) console.error(`ERROR ${line}`);
  console.error(`\nContent validation failed: ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `\nContent validation passed: ${files.length} project file(s), ${registeredIds.size} registered.`
);
