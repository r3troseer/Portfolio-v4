// Repeatable five-run Lighthouse measurement for Branch A budgets.
// Requires an explicit LIGHTHOUSE_URL and writes only ignored build/client
// artifacts. Captures performance metrics plus accessibility and deterministic
// structural audit evidence used by assert-budgets.mjs.

import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import lighthouse from "lighthouse";

const RUN_COUNT = 5;
const STRUCTURAL_AUDIT_IDS = [
  "viewport",
  "document-title",
  "meta-description",
  "http-status-code",
  "errors-in-console",
];

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const outputDir = join(webRoot, "build", "client", "performance", "lighthouse");
const lighthousePackage = join(
  webRoot,
  "node_modules",
  "lighthouse",
  "package.json"
);

function requiredTargetUrl() {
  const raw = process.env.LIGHTHOUSE_URL?.trim();
  if (!raw) {
    throw new Error(
      "LIGHTHOUSE_URL is required. Set the exact URL to measure; refusing to default to localhost or production."
    );
  }

  const target = new URL(raw);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("LIGHTHOUSE_URL must use http:// or https://.");
  }
  return target.toString();
}

function finiteMetric(value, label, runNumber) {
  if (!Number.isFinite(value)) {
    throw new Error(`Run ${runNumber} did not produce ${label}.`);
  }
  return value;
}

function median(values) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

function metricSummary(runs, key, lowerIsBetter) {
  const values = runs.map((run) => run[key]);
  return {
    median: median(values),
    worst: lowerIsBetter ? Math.max(...values) : Math.min(...values),
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isExpectedLoopbackTelemetryError(item, targetUrl) {
  const target = new URL(targetUrl);
  if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") {
    return false;
  }
  const sourceUrl = item?.sourceLocation?.url;
  if (typeof sourceUrl !== "string") return false;
  let source;
  try {
    source = new URL(sourceUrl);
  } catch {
    return false;
  }
  const expectedPaths = new Set([
    "/_vercel/insights/script.js",
    "/_vercel/speed-insights/script.js",
  ]);
  return (
    item.source === "network" &&
    source.origin === target.origin &&
    expectedPaths.has(source.pathname) &&
    /status of 404/i.test(item.description ?? "")
  );
}

function structuralAuditResult(audits, auditId, runNumber, targetUrl) {
  const audit = audits[auditId];
  if (!audit) {
    throw new Error(`Run ${runNumber} is missing required audit "${auditId}".`);
  }
  const score = audit.score;
  if (score !== null && !Number.isFinite(score)) {
    throw new Error(
      `Run ${runNumber} audit "${auditId}" produced a non-finite score.`
    );
  }
  const items = Array.isArray(audit.details?.items) ? audit.details.items : [];
  const ignoredKnownPreviewErrors =
    auditId === "errors-in-console" &&
    items.length > 0 &&
    items.every((item) => isExpectedLoopbackTelemetryError(item, targetUrl));
  return {
    id: auditId,
    score,
    scoreDisplayMode: audit.scoreDisplayMode ?? null,
    title: audit.title ?? auditId,
    // Hard budgets require an explicit pass (score === 1). null/informative
    // without a pass score is treated as missing evidence by assert-budgets.
    passed: score === 1 || ignoredKnownPreviewErrors,
    ignoredKnownPreviewErrors: ignoredKnownPreviewErrors ? items.length : 0,
  };
}

async function collectRun(targetUrl, runNumber, launchChrome) {
  const runBase = join(outputDir, `run-${String(runNumber).padStart(2, "0")}`);
  const jsonPath = `${runBase}.report.json`;
  const htmlPath = `${runBase}.report.html`;
  const userDataDir = join(outputDir, `chrome-profile-${runNumber}`);
  let chrome;
  let runnerResult;

  try {
    mkdirSync(userDataDir, { recursive: true });
    chrome = await launchChrome({
      chromeFlags: ["--headless"],
      handleSIGINT: false,
      logLevel: "silent",
      userDataDir,
    });
    runnerResult = await lighthouse(targetUrl, {
      logLevel: "silent",
      // performance + a11y + SEO/best-practices structural audits used as hard gates
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      output: ["json", "html"],
      port: chrome.port,
    });
  } finally {
    if (chrome) {
      chrome.kill();
      // Windows can retain Chrome profile handles briefly after taskkill returns.
      await delay(500);
    }
    rmSync(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  }

  if (!runnerResult) {
    throw new Error(`Lighthouse run ${runNumber} returned no result.`);
  }
  const reports = Array.isArray(runnerResult.report)
    ? runnerResult.report
    : [runnerResult.report];
  if (reports.length !== 2) {
    throw new Error(`Lighthouse run ${runNumber} did not produce JSON and HTML output.`);
  }
  writeFileSync(jsonPath, reports[0], "utf8");
  writeFileSync(htmlPath, reports[1], "utf8");

  const report = runnerResult.lhr;
  const audits = report.audits ?? {};
  const requests = audits["network-requests"]?.details?.items ?? [];
  const performanceScore = (report.categories?.performance?.score ?? Number.NaN) * 100;
  const accessibilityScore =
    (report.categories?.accessibility?.score ?? Number.NaN) * 100;

  const structuralAudits = {};
  for (const auditId of STRUCTURAL_AUDIT_IDS) {
    structuralAudits[auditId] = structuralAuditResult(
      audits,
      auditId,
      runNumber,
      targetUrl
    );
  }

  return {
    run: runNumber,
    requestedUrl: report.requestedUrl,
    finalUrl: report.finalUrl,
    fetchTime: report.fetchTime,
    performanceScore: finiteMetric(performanceScore, "a performance score", runNumber),
    accessibilityScore: finiteMetric(
      accessibilityScore,
      "an accessibility score",
      runNumber
    ),
    lcpMs: finiteMetric(
      audits["largest-contentful-paint"]?.numericValue,
      "LCP",
      runNumber
    ),
    cls: finiteMetric(
      audits["cumulative-layout-shift"]?.numericValue,
      "CLS",
      runNumber
    ),
    tbtMs: finiteMetric(
      audits["total-blocking-time"]?.numericValue,
      "TBT",
      runNumber
    ),
    speedIndexMs: finiteMetric(
      audits["speed-index"]?.numericValue,
      "Speed Index",
      runNumber
    ),
    requestCount: requests.length,
    structuralAudits,
    reports: {
      json: jsonPath.slice(webRoot.length + 1).replace(/\\/g, "/"),
      html: htmlPath.slice(webRoot.length + 1).replace(/\\/g, "/"),
    },
  };
}

async function main() {
  const targetUrl = requiredTargetUrl();
  if (!existsSync(lighthousePackage)) {
    throw new Error("Lighthouse is not installed. Run npm ci before npm run perf:lighthouse.");
  }
  const lighthouseRequire = createRequire(lighthousePackage);
  const chromeLauncherModule = lighthouseRequire.resolve("chrome-launcher");
  const { launch: launchChrome } = await import(
    pathToFileURL(chromeLauncherModule).href
  );

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const runs = [];
  for (let runNumber = 1; runNumber <= RUN_COUNT; runNumber += 1) {
    console.log(`Lighthouse run ${runNumber}/${RUN_COUNT}: ${targetUrl}`);
    runs.push(await collectRun(targetUrl, runNumber, launchChrome));
  }

  const summary = {
    schemaVersion: 2,
    tool: "lighthouse@12.6.1",
    methodology: {
      runCount: RUN_COUNT,
      formFactor: "Lighthouse default simulated mobile",
      aggregation: "Median is the middle of five sorted values.",
      categories: ["performance", "accessibility", "best-practices", "seo"],
      structuralAudits: STRUCTURAL_AUDIT_IDS,
      budgetEnforcement: "assert-budgets.mjs (hard vs advisory Branch A ceilings).",
    },
    targetUrl,
    runs,
    aggregates: {
      performanceScore: metricSummary(runs, "performanceScore", false),
      accessibilityScore: metricSummary(runs, "accessibilityScore", false),
      lcpMs: metricSummary(runs, "lcpMs", true),
      cls: metricSummary(runs, "cls", true),
      tbtMs: metricSummary(runs, "tbtMs", true),
      speedIndexMs: metricSummary(runs, "speedIndexMs", true),
      requestCount: metricSummary(runs, "requestCount", true),
    },
  };

  const summaryPath = join(outputDir, "summary.json");
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Wrote ${summaryPath.slice(webRoot.length + 1).replace(/\\/g, "/")}`);
  console.log(JSON.stringify(summary.aggregates, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
