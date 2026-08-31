import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { getVitestReporters } from "../../../vitest.base.config.ts";

void test("Vitest keeps human output and opts into JSON only when requested", () => {
  const outputFile = "ci-report.json";

  assert.deepEqual(getVitestReporters({}), ["default"]);

  assert.deepEqual(
    getVitestReporters({ VITEST_JSON_OUTPUT_FILE: outputFile }),
    ["default", ["json", { outputFile }]],
  );

  assert.deepEqual(
    getVitestReporters({
      GITHUB_ACTIONS: "true",
      VITEST_JSON_OUTPUT_FILE: outputFile,
    }),
    [
      "default",
      [
        "github-actions",
        { displayAnnotations: true, jobSummary: { enabled: false } },
      ],
      ["json", { outputFile }],
    ],
  );
});

void test("every repository Vitest runner inherits the shared reporter contract", () => {
  for (const path of [
    "apps/api/vitest.config.ts",
    "apps/api/vitest.coverage.config.ts",
    "apps/api/vitest.integration.config.ts",
    "apps/web/vitest.config.ts",
    "vitest.prisma.config.ts",
  ]) {
    const config = readFileSync(resolve(path), "utf8");
    assert.match(config, /vitest\.base\.config\.ts/u, path);
    assert.match(config, /mergeConfig/u, path);
  }
});

void test("CI executes the combined API coverage contour exactly once", () => {
  const workflow = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");
  assert.equal(
    [...workflow.matchAll(/@customreport\/api test:coverage/gu)].length,
    1,
  );
  const apiJob = workflow.slice(
    workflow.indexOf("\n  api-integration:"),
    workflow.indexOf("\n  coverage:"),
  );
  assert.match(apiJob, /@customreport\/api test:coverage/u);
  assert.doesNotMatch(apiJob, /@customreport\/api test:integration/u);
});

void test("API verification summary fails closed when evidence is unusable", () => {
  const workflow = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");
  const summaryStep = workflow.slice(
    workflow.indexOf("- name: Publish API verification summary"),
    workflow.indexOf(
      "\n  coverage:",
      workflow.indexOf("- name: Publish API verification summary"),
    ),
  );

  assert.match(summaryStep, /if \[ ! -s "\$json_file" \]; then/u);
  assert.match(summaryStep, /API Vitest JSON artifact is missing or empty/u);
  assert.match(summaryStep, /API coverage summary is missing or empty/u);
  assert.match(summaryStep, /exit 1/u);
  assert.match(summaryStep, /if ! jq -e/u);
  assert.match(summaryStep, /invalid or missing test counts/u);
  assert.match(summaryStep, /\.total\.statements\.pct/u);
  assert.doesNotMatch(summaryStep, /(?:total|passed|failed)=0/u);
  assert.doesNotMatch(summaryStep, /\|\| 0/u);
  assert.match(summaryStep, /\$GITHUB_SHA/u);
});

void test("coverage summary fails closed and reports the exact commit", () => {
  const workflow = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");
  const summaryStep = workflow.slice(
    workflow.indexOf("- name: Publish coverage summary"),
    workflow.indexOf(
      "\n  migrate-reset:",
      workflow.indexOf("- name: Publish coverage summary"),
    ),
  );

  assert.match(summaryStep, /coverage summary is missing or empty/u);
  assert.match(summaryStep, /Vitest JSON artifact is missing or empty/u);
  assert.match(summaryStep, /\.total\.statements\.pct/u);
  assert.match(summaryStep, /exit 1/u);
  assert.match(summaryStep, /\$GITHUB_SHA/u);
  assert.doesNotMatch(summaryStep, /unavailable/u);
});
