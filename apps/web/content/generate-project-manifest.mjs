// Build-time generator for the public-safe Home project summary manifest and
// the fail-closed project detail loader map.
//
// Reads the presentation registry (index.json) plus each registered canonical
// project file, keeps only public / public_summary_only projects with
// sensitivity: safe, and writes:
//   - project-manifest.json  (Home summary + routing discovery)
//   - project-detail-loaders.js (literal dynamic imports for approved ids only)
//
// Unregistered or unsafe files never enter either output. Full detail payloads
// stay in per-project JSON and load on demand via projectDetailLoader.js.
//
// Run: npm run generate:project-manifest  (from apps/web)
// Also imported by validate-content.mjs to detect stale committed output.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectsDir = join(here, "..", "src", "content", "public", "projects");
const generatedDir = join(here, "..", "src", "content", "generated");
export const MANIFEST_PATH = join(generatedDir, "project-manifest.json");
export const LOADERS_PATH = join(generatedDir, "project-detail-loaders.js");

const INDEXABLE = new Set(["public", "public_summary_only"]);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/**
 * Resolve approved public-safe projects from the registry + canonical files.
 * Throws on missing registered files, duplicate ids/orders, or unsafe surfacing.
 * Returns entries sorted by displayOrder (Home featured showcase is index 0).
 */
export function buildApprovedProjects() {
  const registry = readJson(join(projectsDir, "index.json"));
  if (!registry || !Array.isArray(registry.projects)) {
    throw new Error("index.json: projects must be an array");
  }

  const seenIds = new Set();
  const seenOrders = new Set();
  const approved = [];

  for (const entry of registry.projects) {
    if (!entry || typeof entry.id !== "string") {
      throw new Error("index.json: each entry needs a string id");
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`index.json: duplicate registry id "${entry.id}"`);
    }
    seenIds.add(entry.id);

    if (!Number.isInteger(entry.displayOrder) || entry.displayOrder < 1) {
      throw new Error(`index.json (${entry.id}): displayOrder must be a positive integer`);
    }
    if (seenOrders.has(entry.displayOrder)) {
      throw new Error(
        `index.json (${entry.id}): duplicate displayOrder ${entry.displayOrder}`
      );
    }
    seenOrders.add(entry.displayOrder);

    const filePath = join(projectsDir, `${entry.id}.json`);
    if (!existsSync(filePath)) {
      throw new Error(
        `index.json (${entry.id}): registered id has no matching project file`
      );
    }

    const project = readJson(filePath);
    if (project.id !== entry.id) {
      throw new Error(
        `${entry.id}.json: id "${project.id}" does not match filename`
      );
    }

    // Only registered public / public_summary_only + safe projects are approved.
    if (!INDEXABLE.has(project.visibility)) {
      throw new Error(
        `index.json (${entry.id}): visibility "${project.visibility}" cannot be surfaced`
      );
    }
    if (project.sensitivity !== "safe") {
      throw new Error(
        `index.json (${entry.id}): sensitivity "${project.sensitivity}" cannot be surfaced`
      );
    }

    approved.push({
      id: project.id,
      displayOrder: entry.displayOrder,
      featured: Boolean(entry.featured),
      card: project.card || {},
      detail: project.detail || {},
    });
  }

  approved.sort((a, b) => a.displayOrder - b.displayOrder);
  return approved;
}

/**
 * Build the Home-safe summary manifest. Metrics (max four) appear only on the
 * single top ordered featured showcase; list-only entries omit metrics.
 */
export function buildProjectManifest(approved = buildApprovedProjects()) {
  const summaries = approved.map((entry, index) => {
    const card = entry.card;
    const summary = {
      id: entry.id,
      displayOrder: entry.displayOrder,
      featured: entry.featured,
      title: card.title,
      subtitle: card.subtitle,
      summary: card.summary,
      technologies: Array.isArray(card.technologies) ? [...card.technologies] : [],
    };
    if (Array.isArray(card.listTech) && card.listTech.length > 0) {
      summary.listTech = [...card.listTech];
    }
    // Home featured showcase only (orderedProjects[0]); list rows ignore metrics.
    if (index === 0) {
      const metrics = Array.isArray(entry.detail.metrics)
        ? entry.detail.metrics.slice(0, 4).map((m) => ({
            number: m.number,
            label: m.label,
          }))
        : [];
      summary.metrics = metrics;
    }
    return summary;
  });

  return {
    // Routing / prerender discovery: ordered public project ids for Home,
    // known-id validation in the detail loader, and react-router.config.js
    // canonical public-safe prerender paths. No overview, content cards,
    // galleries, problem/solution, timeline, or ai metadata.
    projects: summaries,
  };
}

/** Deterministic JSON serialization (stable key order from object insertion). */
export function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * ASCII deterministic module: ID -> literal dynamic import for approved ids only.
 * Vite splits each import() into its own deferred chunk. Unregistered/unsafe
 * files are absent by construction (no glob, no request-time path build).
 */
export function serializeDetailLoaders(approved = buildApprovedProjects()) {
  const lines = [
    "// Generated by content/generate-project-manifest.mjs - do not edit by hand.",
    "// Fail-closed map of public-safe project detail importers. Only registry",
    "// members that pass visibility/sensitivity gates are included; unregistered",
    "// or unsafe canonical files never appear here.",
    "",
    "export const projectDetailLoaders = {",
  ];
  for (const entry of approved) {
    lines.push(
      `  "${entry.id}": () => import("../public/projects/${entry.id}.json"),`
    );
  }
  lines.push("};");
  return `${lines.join("\n")}\n`;
}

export function writeGeneratedProjectOutputs(
  approved = buildApprovedProjects()
) {
  mkdirSync(generatedDir, { recursive: true });
  const manifest = buildProjectManifest(approved);
  const manifestSerialized = serializeManifest(manifest);
  const loadersSerialized = serializeDetailLoaders(approved);
  writeFileSync(MANIFEST_PATH, manifestSerialized, "utf8");
  writeFileSync(LOADERS_PATH, loadersSerialized, "utf8");
  return {
    manifestPath: MANIFEST_PATH,
    loadersPath: LOADERS_PATH,
    projectCount: approved.length,
    manifestSerialized,
    loadersSerialized,
    ids: approved.map((p) => p.id),
  };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const { manifestPath, loadersPath, projectCount } =
      writeGeneratedProjectOutputs();
    console.log(
      `Wrote project manifest (${projectCount} public-safe): ${manifestPath}`
    );
    console.log(`Wrote project detail loaders: ${loadersPath}`);
  } catch (e) {
    console.error(`generate-project-manifest failed: ${e.message}`);
    process.exit(1);
  }
}
