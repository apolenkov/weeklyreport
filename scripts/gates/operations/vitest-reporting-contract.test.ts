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
  const gitlab = readFileSync(resolve(".gitlab-ci.yml"), "utf8");
  assert.equal(
    [...gitlab.matchAll(/@customreport\/api test:coverage/gu)].length,
    1,
  );
  const gitlabApiJob = gitlab.slice(
    gitlab.indexOf("\napi-integration:"),
    gitlab.indexOf("\nmigrate-reset:"),
  );
  assert.match(gitlabApiJob, /@customreport\/api test:coverage/u);
  assert.doesNotMatch(gitlabApiJob, /@customreport\/api test:integration/u);
});

void test("API verification summary fails closed when evidence is unusable", () => {
  const gitlab = readFileSync(resolve(".gitlab-ci.yml"), "utf8");
  const gitlabApiJob = gitlab.slice(
    gitlab.indexOf("\napi-integration:"),
    gitlab.indexOf("\nmigrate-reset:"),
  );
  assert.match(gitlabApiJob, /api-verification-vitest\.json/u);
  assert.match(gitlabApiJob, /coverage-summary\.json/u);
  assert.match(gitlabApiJob, /numTotalTests/u);
  assert.match(gitlabApiJob, /statements\?\.pct/u);
  assert.match(gitlabApiJob, /throw new Error/u);
  assert.match(gitlabApiJob, /CI_COMMIT_SHA/u);
  assert.doesNotMatch(gitlabApiJob, /\|\| 0/u);
});

void test("coverage summary fails closed and reports the exact commit", () => {
  const gitlab = readFileSync(resolve(".gitlab-ci.yml"), "utf8");
  const gitlabCoverageJob = gitlab.slice(
    gitlab.indexOf("\ncoverage:"),
    gitlab.indexOf("\napi-integration:"),
  );
  assert.match(gitlabCoverageJob, /web-coverage-vitest\.json/u);
  assert.match(gitlabCoverageJob, /coverage-summary\.json/u);
  assert.match(gitlabCoverageJob, /statements\?\.pct/u);
  assert.match(gitlabCoverageJob, /throw new Error/u);
  assert.match(gitlabCoverageJob, /CI_COMMIT_SHA/u);
  assert.doesNotMatch(gitlabCoverageJob, /\|\| 0/u);
});
