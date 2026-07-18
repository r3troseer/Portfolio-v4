import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(
  here,
  "src",
  "content",
  "generated",
  "project-manifest.json"
);

// Fail-closed public project id shape. Manifest generation already gates on
// visibility/sensitivity; this rejects anything that cannot be a safe path
// segment so unknown/unsafe ids never enter the prerender list.
const SAFE_PROJECT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Canonical public-safe prerender paths from the generated manifest.
 * No hardcoded project ids - only Home, Playground, and approved project paths.
 * Missing/unreadable manifest fails the build (fail closed).
 */
function publicSafePrerenderPaths() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const projects = Array.isArray(manifest?.projects) ? manifest.projects : [];
  const paths = ["/", "/playground"];

  for (const entry of projects) {
    const id = entry?.id;
    if (typeof id !== "string" || !SAFE_PROJECT_ID.test(id)) {
      continue;
    }
    paths.push(`/projects/${id}`);
  }

  return paths;
}

/** @type {import("@react-router/dev/config").Config} */
export default {
  appDirectory: "src",
  ssr: false,
  prerender: publicSafePrerenderPaths,
};
