#!/usr/bin/env node
//
// 34-07 flaky-rate metric for CI.
//
// Reads Playwright's JSON report (apps/web/e2e/.results/results.json),
// computes `passed-on-retry / total` per spec file, emits a Markdown
// summary + JSON artifact. Doesn't fail the build — just surfaces the
// trend so we notice when previously-stable specs start flaking.
//
// Run (after Playwright in CI):
//   node scripts/flaky-rate.mjs
//
// Outputs:
//   apps/web/e2e/.results/flaky-rate.md   — readable summary
//   apps/web/e2e/.results/flaky-rate.json — { totals, perSpec }

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const REPORT = path.join(REPO_ROOT, "apps/web/e2e/.results/results.json");
const OUT_MD = path.join(REPO_ROOT, "apps/web/e2e/.results/flaky-rate.md");
const OUT_JSON = path.join(REPO_ROOT, "apps/web/e2e/.results/flaky-rate.json");

if (!existsSync(REPORT)) {
  console.error(
    `[flaky-rate] no Playwright JSON report at ${REPORT}; skipping`,
  );
  process.exit(0);
}

const data = JSON.parse(readFileSync(REPORT, "utf8"));

const perSpec = new Map();
let totalTests = 0;
let totalPassedOnRetry = 0;
let totalFailed = 0;

function walk(suites) {
  for (const suite of suites ?? []) {
    if (suite.specs?.length) {
      for (const spec of suite.specs) {
        const file = spec.file ?? suite.file ?? "unknown";
        if (!perSpec.has(file)) {
          perSpec.set(file, { tests: 0, passedOnRetry: 0, failed: 0 });
        }
        const bucket = perSpec.get(file);
        for (const test of spec.tests ?? []) {
          bucket.tests++;
          totalTests++;
          // A test "passed on retry" if it has results length > 1 and the
          // last result is `passed`. That matches Playwright's flaky semantics.
          const results = test.results ?? [];
          const lastStatus = results[results.length - 1]?.status;
          if (results.length > 1 && lastStatus === "passed") {
            bucket.passedOnRetry++;
            totalPassedOnRetry++;
          } else if (lastStatus !== "passed" && lastStatus !== "skipped") {
            bucket.failed++;
            totalFailed++;
          }
        }
      }
    }
    if (suite.suites?.length) walk(suite.suites);
  }
}

walk(data.suites);

const totals = {
  tests: totalTests,
  passedOnRetry: totalPassedOnRetry,
  failed: totalFailed,
  flakyRate:
    totalTests === 0 ? 0 : +(totalPassedOnRetry / totalTests).toFixed(4),
};

const perSpecArr = [...perSpec.entries()]
  .map(([file, b]) => ({
    file: file.replace(REPO_ROOT + "/", ""),
    tests: b.tests,
    passedOnRetry: b.passedOnRetry,
    failed: b.failed,
    flakyRate: b.tests === 0 ? 0 : +(b.passedOnRetry / b.tests).toFixed(4),
  }))
  .sort((a, b) => b.flakyRate - a.flakyRate);

writeFileSync(
  OUT_JSON,
  JSON.stringify({ totals, perSpec: perSpecArr }, null, 2),
);

const lines = ["# Playwright Flaky-Rate Metric", ""];
lines.push(`**Total tests:** ${totals.tests}`);
lines.push(`**Failed:** ${totals.failed}`);
lines.push(`**Passed on retry (flaky):** ${totals.passedOnRetry}`);
lines.push(`**Flaky rate:** ${(totals.flakyRate * 100).toFixed(2)}%`);
lines.push("");
lines.push("## Per-spec flaky rate");
lines.push("");
lines.push("| Spec | Tests | Failed | Passed on retry | Flaky rate |");
lines.push("| --- | --: | --: | --: | --: |");
for (const s of perSpecArr) {
  lines.push(
    `| ${s.file} | ${s.tests} | ${s.failed} | ${s.passedOnRetry} | ${(s.flakyRate * 100).toFixed(2)}% |`,
  );
}
writeFileSync(OUT_MD, lines.join("\n"));

console.log(
  `[flaky-rate] ${totals.tests} tests, ${totals.failed} failed, ${totals.passedOnRetry} flaky (${(totals.flakyRate * 100).toFixed(2)}%)`,
);
console.log(`[flaky-rate] wrote ${OUT_MD}`);
