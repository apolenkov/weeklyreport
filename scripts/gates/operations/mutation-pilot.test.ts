import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";

const read = (path: string): string => readFileSync(resolve(path), "utf8");
const stryker = JSON.parse(read("apps/api/stryker.config.json")) as Record<
  string,
  unknown
>;
const gitlab = read(".gitlab-ci.yml");

test("the mutation pilot mutates exactly the period transition owner", () => {
  assert.deepEqual(stryker.mutate, [
    "src/modules/period/domain/period-transition.ts",
  ]);
});

test("the pilot is serial, per-test, Vitest-only and breaks below 70", () => {
  assert.equal(stryker.testRunner, "vitest");
  assert.equal(stryker.coverageAnalysis, "perTest");
  assert.equal(stryker.concurrency, 1);
  // The configs reach `../../`, which a sandbox copy of apps/api would not carry.
  assert.equal(stryker.inPlace, true);
  const thresholds = stryker.thresholds as { break: number };
  assert.ok(thresholds.break >= 70, "break must be at least 70");
  assert.deepEqual(stryker.vitest, { configFile: "vitest.mutation.config.ts" });
});

test("mutant workers run only the pure unit suite", () => {
  const config = read("apps/api/vitest.mutation.config.ts");
  assert.match(
    config,
    /include: \["src\/modules\/period\/domain\/period-transition\.test\.ts"\]/u,
  );
  assert.doesNotMatch(config, /globalSetup|\.integration\./u);
});

test("the pilot suite is flat so Stryker can select tests by name", () => {
  // Stryker 10 joins suite names with a space; Vitest 5 matches `a > b`.
  const suite = read(
    "apps/api/src/modules/period/domain/period-transition.test.ts",
  );
  assert.doesNotMatch(suite, /\b(?:describe|suite)(?:\.\w+)*\(/u);
});

test("CI runs the pilot as a blocking job", () => {
  const start = gitlab.indexOf("\nmutation-period:\n");
  assert.ok(start !== -1, "mutation-period job must exist");
  const job = gitlab.slice(start + 1).split(/\n(?=\S)/u)[0] ?? "";
  assert.doesNotMatch(job, /allow_failure|when: manual|when: never/u);
  assert.match(job, /pnpm --filter @weeklyreport\/api test:mutation/u);
});
