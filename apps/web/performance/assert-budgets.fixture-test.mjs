// Fixture-driven checks for assert-budgets.mjs.
// Hard failures must exit nonzero; advisory-only breaches exit zero with warnings;
// the accepted PA5-shaped evidence must pass.

import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertBudgets } from "./assert-budgets.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");
const budgetsPath = join(here, "budgets.json");
const tmpDir = join(fixturesDir, ".tmp-assert");

function loadJson(name) {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function runCli(args) {
  return spawnSync(process.execPath, [join(here, "assert-budgets.mjs"), ...args], {
    encoding: "utf8",
    cwd: join(here, ".."),
  });
}

let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

mkdirSync(tmpDir, { recursive: true });

const budgets = JSON.parse(readFileSync(budgetsPath, "utf8"));
const buildPass = loadJson("build-report.pass.json");
const summaryPass = loadJson("summary.pass.json");
const summaryClsFail = loadJson("summary.hard-cls-fail.json");
const summaryAdvisoryLcp = loadJson("summary.advisory-lcp.json");
const budgetsBad = loadJson("budgets.unrecognized.json");

const passResult = assertBudgets({
  buildReport: buildPass,
  summary: summaryPass,
  budgets,
});
check(
  "PA5-shaped evidence passes with no hard failures",
  passResult.ok && passResult.hardFailures.length === 0,
  JSON.stringify(passResult.hardFailures)
);

const frameworkBuildPass = structuredClone(buildPass);
const projectDetailChunk = frameworkBuildPass.jsChunks.find((chunk) =>
  /ProjectDetail/i.test(chunk.file)
);
projectDetailChunk.file = projectDetailChunk.file.replace(
  /ProjectDetail/i,
  "project-detail"
);
const frameworkPassResult = assertBudgets({
  buildReport: frameworkBuildPass,
  summary: summaryPass,
  budgets,
});
check(
  "Framework project-detail chunk is measured",
  frameworkPassResult.measurements.projectDetailGzipBytes ===
    passResult.measurements.projectDetailGzipBytes,
  JSON.stringify(frameworkPassResult.measurements)
);

const clsResult = assertBudgets({
  buildReport: buildPass,
  summary: summaryClsFail,
  budgets,
});
check(
  "CLS hard breach fails",
  !clsResult.ok && clsResult.hardFailures.some((m) => /CLS/i.test(m)),
  JSON.stringify(clsResult.hardFailures)
);

const advisoryResult = assertBudgets({
  buildReport: buildPass,
  summary: summaryAdvisoryLcp,
  budgets,
});
check(
  "Advisory LCP breach does not hard-fail",
  advisoryResult.ok &&
    advisoryResult.advisories.some((m) => /LCP/i.test(m)) &&
    advisoryResult.hardFailures.length === 0,
  JSON.stringify(advisoryResult)
);

let threwUnrecognized = false;
try {
  assertBudgets({
    buildReport: buildPass,
    summary: summaryPass,
    budgets: budgetsBad,
  });
} catch (error) {
  threwUnrecognized = /Unrecognized budgets key/i.test(
    error instanceof Error ? error.message : String(error)
  );
}
check("Unrecognized budget shape throws", threwUnrecognized);

const summaryMissingAudit = structuredClone(summaryPass);
delete summaryMissingAudit.runs[0].structuralAudits.viewport;
const missingAuditResult = assertBudgets({
  buildReport: buildPass,
  summary: summaryMissingAudit,
  budgets,
});
check(
  "Missing structural audit is a hard failure",
  !missingAuditResult.ok &&
    missingAuditResult.hardFailures.some((m) => /viewport/i.test(m)),
  JSON.stringify(missingAuditResult.hardFailures)
);

let threwNonFinite = false;
const summaryNonFinite = structuredClone(summaryPass);
summaryNonFinite.runs[0].cls = Number.NaN;
try {
  assertBudgets({
    buildReport: buildPass,
    summary: summaryNonFinite,
    budgets,
  });
} catch (error) {
  threwNonFinite = /finite number/i.test(
    error instanceof Error ? error.message : String(error)
  );
}
check("Non-finite CLS throws", threwNonFinite);

const buildOverCritical = structuredClone(buildPass);
buildOverCritical.homepageCriticalPath.totals.gzipBytes = 101641;
const criticalResult = assertBudgets({
  buildReport: buildOverCritical,
  summary: summaryPass,
  budgets,
});
check(
  "Critical-path gzip hard breach fails",
  !criticalResult.ok &&
    criticalResult.hardFailures.some((m) => /critical-path gzip/i.test(m)),
  JSON.stringify(criticalResult.hardFailures)
);

const cliPass = runCli([
  "--build-report",
  join(fixturesDir, "build-report.pass.json"),
  "--lighthouse-summary",
  join(fixturesDir, "summary.pass.json"),
  "--budgets",
  budgetsPath,
]);
check(
  "CLI PA5-shaped evidence exits 0",
  cliPass.status === 0,
  `status=${cliPass.status}\n${cliPass.stderr}`
);

const cliHard = runCli([
  "--build-report",
  join(fixturesDir, "build-report.pass.json"),
  "--lighthouse-summary",
  join(fixturesDir, "summary.hard-cls-fail.json"),
  "--budgets",
  budgetsPath,
]);
check(
  "CLI CLS hard breach exits nonzero",
  cliHard.status !== 0,
  `status=${cliHard.status}`
);
check(
  "CLI CLS hard breach prints HARD FAIL",
  /HARD FAIL:.*CLS/i.test(`${cliHard.stdout}\n${cliHard.stderr}`),
  cliHard.stderr
);

const cliAdvisory = runCli([
  "--build-report",
  join(fixturesDir, "build-report.pass.json"),
  "--lighthouse-summary",
  join(fixturesDir, "summary.advisory-lcp.json"),
  "--budgets",
  budgetsPath,
]);
check(
  "CLI advisory LCP exits 0",
  cliAdvisory.status === 0,
  `status=${cliAdvisory.status}\n${cliAdvisory.stderr}`
);
check(
  "CLI advisory LCP prints ADVISORY",
  /ADVISORY:.*LCP/i.test(`${cliAdvisory.stdout}\n${cliAdvisory.stderr}`)
);

const cliMissing = runCli([
  "--build-report",
  join(tmpDir, "does-not-exist.json"),
  "--lighthouse-summary",
  join(fixturesDir, "summary.pass.json"),
  "--budgets",
  budgetsPath,
]);
check(
  "CLI missing build report exits nonzero",
  cliMissing.status !== 0 && /Missing build report/i.test(cliMissing.stderr),
  cliMissing.stderr
);

rmSync(tmpDir, { recursive: true, force: true });

if (failed > 0) {
  console.error(`\nassert-budgets fixture tests failed: ${failed}`);
  process.exitCode = 1;
} else {
  console.log("\nassert-budgets fixture tests passed.");
}
