// Deterministic production-build size reporter for initial-load measurement.
// Reads apps/web/build/client after a production build and writes:
//   build/client/performance/build-report.json
// Also prints a concise size summary for CI logs.
//
// Run: npm run perf:report  (from apps/web)

import { gzipSync } from "node:zlib";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const clientDir = join(webRoot, "build", "client");
const outDir = join(clientDir, "performance");
const outFile = join(outDir, "build-report.json");

function gzipSize(buffer) {
  return gzipSync(buffer, { level: 9 }).byteLength;
}

function walkFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function assetType(filePath) {
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "js";
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".html")) return "html";
  if (filePath.endsWith(".map")) return "map";
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(filePath)) return "image";
  if (/\.(woff2?|ttf|otf|eot)$/i.test(filePath)) return "font";
  return "other";
}

function extractAttrs(tag, attr) {
  const re = new RegExp(`${attr}=["']([^"']+)["']`, "i");
  const match = tag.match(re);
  return match ? match[1] : null;
}

function parseHomepageCriticalPath(html, assetByRel) {
  const stylesheets = [];
  const scripts = [];
  const modulepreloads = [];

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = (extractAttrs(tag, "rel") || "").toLowerCase();
    const href = extractAttrs(tag, "href");
    if (!href) continue;
    const normalized = href.replace(/^\.\//, "").replace(/^\//, "");
    const asset = assetByRel.get(normalized);
    const item = {
      href: normalized,
      rawBytes: asset?.rawBytes ?? null,
      gzipBytes: asset?.gzipBytes ?? null,
    };
    if (rel === "stylesheet") stylesheets.push(item);
    if (rel === "modulepreload" || rel === "preload") {
      modulepreloads.push({ ...item, rel });
    }
  }

  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    const tag = match[0];
    const src = extractAttrs(tag, "src");
    if (!src) continue;
    const normalized = src.replace(/^\.\//, "").replace(/^\//, "");
    const asset = assetByRel.get(normalized);
    scripts.push({
      src: normalized,
      type: extractAttrs(tag, "type"),
      rawBytes: asset?.rawBytes ?? null,
      gzipBytes: asset?.gzipBytes ?? null,
    });
  }

  return { stylesheets, scripts, modulepreloads };
}

function referencedModuleUrls(source, selfFile) {
  const targets = new Set();
  for (const match of source.matchAll(/["'](\.?\/?assets\/[^"']+\.js)["']/g)) {
    const rel = match[1].replace(/^\.\//, "");
    if (rel.startsWith("assets/") && rel !== selfFile) targets.add(rel);
  }
  return [...targets].sort();
}

function formatBytes(n) {
  if (n == null) return "n/a";
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KiB`;
}

function main() {
  if (!existsSync(clientDir)) {
    throw new Error(
      "build/client/ not found. Run a production build before npm run perf:report."
    );
  }

  const indexPath = join(clientDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      "build/client/index.html not found. Production build looks incomplete."
    );
  }

  const files = walkFiles(clientDir).filter((filePath) => {
    const rel = relative(clientDir, filePath).replace(/\\/g, "/");
    // Keep the report focused on shipped assets; skip prior report/analysis outputs.
    return !rel.startsWith("performance/");
  });

  const assets = [];
  for (const filePath of files) {
    const rel = relative(clientDir, filePath).replace(/\\/g, "/");
    const buffer = readFileSync(filePath);
    const rawBytes = buffer.byteLength;
    assets.push({
      file: rel,
      type: assetType(rel),
      rawBytes,
      gzipBytes: gzipSize(buffer),
    });
  }

  assets.sort((a, b) => a.file.localeCompare(b.file));
  const assetByRel = new Map(assets.map((a) => [a.file, a]));

  const html = readFileSync(indexPath, "utf8");
  const homepageCriticalPath = parseHomepageCriticalPath(html, assetByRel);
  const criticalFiles = new Set([
    "index.html",
    ...homepageCriticalPath.stylesheets.map((s) => s.href),
    ...homepageCriticalPath.scripts.map((s) => s.src),
    ...homepageCriticalPath.modulepreloads.map((s) => s.href),
  ]);

  const jsChunks = [];
  for (const asset of assets.filter((a) => a.type === "js")) {
    const source = readFileSync(join(clientDir, asset.file), "utf8");
    jsChunks.push({
      file: asset.file,
      rawBytes: asset.rawBytes,
      gzipBytes: asset.gzipBytes,
      role: criticalFiles.has(asset.file) ? "homepage-critical" : "deferred-or-async",
      referencedModules: referencedModuleUrls(source, asset.file),
    });
  }

  const totals = assets.reduce(
    (acc, asset) => {
      acc.rawBytes += asset.rawBytes;
      acc.gzipBytes += asset.gzipBytes;
      return acc;
    },
    { rawBytes: 0, gzipBytes: 0 }
  );

  const criticalAssets = assets.filter((a) => criticalFiles.has(a.file));
  const criticalTotals = criticalAssets.reduce(
    (acc, asset) => {
      acc.rawBytes += asset.rawBytes;
      acc.gzipBytes += asset.gzipBytes;
      return acc;
    },
    { rawBytes: 0, gzipBytes: 0 }
  );

  const report = {
    schemaVersion: 1,
    purpose: "Deterministic production build-output sizes for initial-load baselining.",
    distDir: "build/client",
    assetCount: assets.length,
    totals,
    homepageCriticalPath: {
      document: "index.html",
      ...homepageCriticalPath,
      totals: criticalTotals,
    },
    assets,
    jsChunks,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Production build size report");
  console.log(`Wrote ${relative(webRoot, outFile).replace(/\\/g, "/")}`);
  console.log(
    `All assets: ${formatBytes(totals.rawBytes)} raw / ${formatBytes(totals.gzipBytes)} gzip (${assets.length} files)`
  );
  console.log(
    `Homepage critical path: ${formatBytes(criticalTotals.rawBytes)} raw / ${formatBytes(criticalTotals.gzipBytes)} gzip`
  );
  for (const asset of [...criticalAssets].sort((a, b) => b.gzipBytes - a.gzipBytes)) {
    console.log(
      `  - ${asset.file}: ${formatBytes(asset.rawBytes)} raw / ${formatBytes(asset.gzipBytes)} gzip`
    );
  }
  console.log("JS chunks (role / gzip):");
  for (const chunk of [...jsChunks].sort((a, b) => b.gzipBytes - a.gzipBytes)) {
    const refs =
      chunk.referencedModules.length > 0
        ? `; refs ${chunk.referencedModules.length} module URL(s)`
        : "";
    console.log(
      `  - ${chunk.file}: ${chunk.role}; ${formatBytes(chunk.gzipBytes)} gzip${refs}`
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
