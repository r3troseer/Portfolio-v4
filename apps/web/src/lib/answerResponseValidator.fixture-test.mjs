// Shared served-answer contract fixture runner for CI.
// Loads packages/contracts schema + fixtures and exits non-zero on disagreement.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateAnswerResponse } from "./answerResponseValidator.js";

const here = dirname(fileURLToPath(import.meta.url));
const contractsDir = join(
  here,
  "..",
  "..",
  "..",
  "..",
  "packages",
  "contracts",
);
const manifest = JSON.parse(
  readFileSync(join(contractsDir, "fixtures", "manifest.json"), "utf8"),
);

const failures = [];

const loadFixture = (relativePath) =>
  JSON.parse(
    readFileSync(join(contractsDir, "fixtures", relativePath), "utf8"),
  );

for (const relativePath of manifest.valid) {
  const result = validateAnswerResponse(loadFixture(relativePath));
  if (!result.ok) {
    failures.push(`expected valid: ${relativePath}`);
  }
}

for (const relativePath of manifest.invalid) {
  const result = validateAnswerResponse(loadFixture(relativePath));
  if (result.ok) {
    failures.push(`expected invalid: ${relativePath}`);
  }
}

if (failures.length) {
  console.error("answer contract fixture validation failed:");
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}

console.log(
  `answer contract fixtures ok (${manifest.valid.length} valid, ${manifest.invalid.length} invalid)`,
);
