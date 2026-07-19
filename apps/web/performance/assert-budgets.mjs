// Fail-closed Branch A budget assertion.
// Consumes build/client/performance/build-report.json and lighthouse/summary.json
// plus performance/budgets.json. Hard breaches and malformed evidence exit
// nonzero; advisory breaches print warnings and exit zero.

import {
  existsSync,
  readFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

const DEFAULT_BUILD_REPORT = join(
  webRoot,
  "build",
  "client",
  "performance",
  "build-report.json"
);
const DEFAULT_SUMMARY = join(
  webRoot,
  "build",
  "client",
  "performance",
  "lighthouse",
  "summary.json"
);
const DEFAULT_BUDGETS = join(here, "budgets.json");

function readJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `Malformed ${label} (invalid JSON) at ${path}: ${error instanceof Error ? error.message : error}`
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Malformed ${label}: expected a JSON object at ${path}`);
  }
  return parsed;
}

function finiteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number (got ${String(value)}).`);
  }
  return value;
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function totalJavaScriptGzipBytes(buildReport) {
  const assets = Array.isArray(buildReport.assets) ? buildReport.assets : null;
  if (!assets) {
    throw new Error("build-report.assets must be an array.");
  }
  let total = 0;
  for (const asset of assets) {
    if (asset?.type === "js") {
      total += finiteNumber(asset.gzipBytes, `assets[${asset.file}].gzipBytes`);
    }
  }
  return total;
}

function projectDetailGzipBytes(buildReport) {
  const chunks = Array.isArray(buildReport.jsChunks) ? buildReport.jsChunks : null;
  if (!chunks) {
    throw new Error("build-report.jsChunks must be an array.");
  }
  const matches = chunks.filter((chunk) =>
    typeof chunk?.file === "string" &&
    /(?:ProjectDetail|project-detail)/i.test(chunk.file)
  );
  if (matches.length === 0) {
    throw new Error(
      "build-report.jsChunks contains no project-detail chunk to assert against."
    );
  }
  // Prefer the route shell chunk (smallest matching file when several exist).
  matches.sort((a, b) => a.gzipBytes - b.gzipBytes);
  return finiteNumber(matches[0].gzipBytes, `${matches[0].file}.gzipBytes`);
}

function validateBudgetShape(budgets) {
  const hard = requireObject(budgets.hard, "budgets.hard");
  const advisory = requireObject(budgets.advisory, "budgets.advisory");

  finiteNumber(
    hard.homepageCriticalPathGzipBytes?.max,
    "budgets.hard.homepageCriticalPathGzipBytes.max"
  );
  finiteNumber(hard.cls?.max, "budgets.hard.cls.max");
  if (hard.cls?.everyRun !== true) {
    throw new Error("budgets.hard.cls.everyRun must be true.");
  }
  finiteNumber(hard.accessibilityScore?.min, "budgets.hard.accessibilityScore.min");
  if (hard.accessibilityScore?.everyRun !== true) {
    throw new Error("budgets.hard.accessibilityScore.everyRun must be true.");
  }
  const structural = requireObject(
    hard.structuralAudits,
    "budgets.hard.structuralAudits"
  );
  if (structural.everyRun !== true) {
    throw new Error("budgets.hard.structuralAudits.everyRun must be true.");
  }
  if (!Array.isArray(structural.required) || structural.required.length === 0) {
    throw new Error("budgets.hard.structuralAudits.required must be a non-empty array.");
  }
  for (const id of structural.required) {
    if (typeof id !== "string" || !id.trim()) {
      throw new Error("budgets.hard.structuralAudits.required entries must be non-empty strings.");
    }
  }

  finiteNumber(
    advisory.performanceScoreMedian?.min,
    "budgets.advisory.performanceScoreMedian.min"
  );
  finiteNumber(advisory.lcpMsMedian?.max, "budgets.advisory.lcpMsMedian.max");
  finiteNumber(advisory.tbtMsMedian?.max, "budgets.advisory.tbtMsMedian.max");
  finiteNumber(
    advisory.speedIndexMsMedian?.max,
    "budgets.advisory.speedIndexMsMedian.max"
  );
  finiteNumber(
    advisory.totalJavaScriptGzipBytes?.max,
    "budgets.advisory.totalJavaScriptGzipBytes.max"
  );
  finiteNumber(
    advisory.projectDetailGzipBytes?.max,
    "budgets.advisory.projectDetailGzipBytes.max"
  );

  // Reject unknown top-level keys beyond the approved shape.
  const allowedTop = new Set([
    "schemaVersion",
    "programme",
    "description",
    "hard",
    "advisory",
    "linkCoverage",
  ]);
  for (const key of Object.keys(budgets)) {
    if (!allowedTop.has(key)) {
      throw new Error(`Unrecognized budgets key "${key}".`);
    }
  }
}

/**
 * @returns {{ ok: boolean, hardFailures: string[], advisories: string[] }}
 */
export function assertBudgets({ buildReport, summary, budgets }) {
  const hardFailures = [];
  const advisories = [];

  validateBudgetShape(budgets);

  const hard = budgets.hard;
  const advisory = budgets.advisory;

  const criticalGzip = finiteNumber(
    buildReport?.homepageCriticalPath?.totals?.gzipBytes,
    "build-report.homepageCriticalPath.totals.gzipBytes"
  );
  if (criticalGzip > hard.homepageCriticalPathGzipBytes.max) {
    hardFailures.push(
      `Homepage critical-path gzip ${criticalGzip} exceeds hard max ${hard.homepageCriticalPathGzipBytes.max}.`
    );
  }

  const runs = Array.isArray(summary?.runs) ? summary.runs : null;
  if (!runs || runs.length === 0) {
    throw new Error("lighthouse summary.runs must be a non-empty array.");
  }

  for (const run of runs) {
    const runLabel = `run ${run?.run ?? "?"}`;
    const cls = finiteNumber(run.cls, `${runLabel}.cls`);
    if (cls > hard.cls.max) {
      hardFailures.push(
        `${runLabel}: CLS ${cls} exceeds hard max ${hard.cls.max}.`
      );
    }

    const a11y = finiteNumber(
      run.accessibilityScore,
      `${runLabel}.accessibilityScore`
    );
    if (a11y < hard.accessibilityScore.min) {
      hardFailures.push(
        `${runLabel}: accessibility score ${a11y} is below hard min ${hard.accessibilityScore.min}.`
      );
    }

    const structural = requireObject(
      run.structuralAudits,
      `${runLabel}.structuralAudits`
    );
    for (const auditId of hard.structuralAudits.required) {
      const result = structural[auditId];
      if (!result || typeof result !== "object") {
        hardFailures.push(
          `${runLabel}: missing structural audit evidence for "${auditId}".`
        );
        continue;
      }
      if (result.score !== null && !Number.isFinite(result.score)) {
        hardFailures.push(
          `${runLabel}: structural audit "${auditId}" has a non-finite score.`
        );
        continue;
      }
      if (result.passed !== true) {
        hardFailures.push(
          `${runLabel}: structural audit "${auditId}" did not pass.`
        );
      }
    }
  }

  const aggregates = requireObject(summary.aggregates, "summary.aggregates");

  const perfMedian = finiteNumber(
    aggregates.performanceScore?.median,
    "aggregates.performanceScore.median"
  );
  if (perfMedian < advisory.performanceScoreMedian.min) {
    advisories.push(
      `Median performance score ${perfMedian} is below advisory min ${advisory.performanceScoreMedian.min}.`
    );
  }

  const lcpMedian = finiteNumber(
    aggregates.lcpMs?.median,
    "aggregates.lcpMs.median"
  );
  if (lcpMedian > advisory.lcpMsMedian.max) {
    advisories.push(
      `Median LCP ${lcpMedian} ms exceeds advisory max ${advisory.lcpMsMedian.max} ms.`
    );
  }

  const tbtMedian = finiteNumber(
    aggregates.tbtMs?.median,
    "aggregates.tbtMs.median"
  );
  if (tbtMedian > advisory.tbtMsMedian.max) {
    advisories.push(
      `Median TBT ${tbtMedian} ms exceeds advisory max ${advisory.tbtMsMedian.max} ms.`
    );
  }

  const siMedian = finiteNumber(
    aggregates.speedIndexMs?.median,
    "aggregates.speedIndexMs.median"
  );
  if (siMedian > advisory.speedIndexMsMedian.max) {
    advisories.push(
      `Median Speed Index ${siMedian} ms exceeds advisory max ${advisory.speedIndexMsMedian.max} ms.`
    );
  }

  const totalJs = totalJavaScriptGzipBytes(buildReport);
  if (totalJs > advisory.totalJavaScriptGzipBytes.max) {
    advisories.push(
      `Total JavaScript gzip ${totalJs} exceeds advisory max ${advisory.totalJavaScriptGzipBytes.max}.`
    );
  }

  const projectDetail = projectDetailGzipBytes(buildReport);
  if (projectDetail > advisory.projectDetailGzipBytes.max) {
    advisories.push(
      `ProjectDetail gzip ${projectDetail} exceeds advisory max ${advisory.projectDetailGzipBytes.max}.`
    );
  }

  return {
    ok: hardFailures.length === 0,
    hardFailures,
    advisories,
    measurements: {
      homepageCriticalPathGzipBytes: criticalGzip,
      totalJavaScriptGzipBytes: totalJs,
      projectDetailGzipBytes: projectDetail,
      performanceScoreMedian: perfMedian,
      lcpMsMedian: lcpMedian,
      tbtMsMedian: tbtMedian,
      speedIndexMsMedian: siMedian,
    },
  };
}

function parseArgs(argv) {
  const options = {
    buildReport: DEFAULT_BUILD_REPORT,
    summary: DEFAULT_SUMMARY,
    budgets: DEFAULT_BUDGETS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--build-report") {
      options.buildReport = resolve(argv[++i] ?? "");
    } else if (arg === "--lighthouse-summary") {
      options.summary = resolve(argv[++i] ?? "");
    } else if (arg === "--budgets") {
      options.budgets = resolve(argv[++i] ?? "");
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(
      "Usage: node performance/assert-budgets.mjs [--build-report path] [--lighthouse-summary path] [--budgets path]"
    );
    return 0;
  }

  const budgets = readJson(options.budgets, "budgets file");
  const buildReport = readJson(options.buildReport, "build report");
  const summary = readJson(options.summary, "lighthouse summary");

  const result = assertBudgets({ buildReport, summary, budgets });

  console.log("Branch A budget assertion");
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        measurements: result.measurements,
        hardFailureCount: result.hardFailures.length,
        advisoryCount: result.advisories.length,
      },
      null,
      2
    )
  );

  for (const message of result.advisories) {
    console.warn(`ADVISORY: ${message}`);
  }
  for (const message of result.hardFailures) {
    console.error(`HARD FAIL: ${message}`);
  }

  if (!result.ok) {
    console.error(
      `Budget assertion failed with ${result.hardFailures.length} hard failure(s).`
    );
    return 1;
  }

  console.log(
    result.advisories.length > 0
      ? `Budget assertion passed with ${result.advisories.length} advisory warning(s).`
      : "Budget assertion passed with no advisory warnings."
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
