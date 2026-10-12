import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

void test("focus diagnostics preserve original wait identity and success/cancellation paths", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--test",
      "--test-reporter=tap",
      "--test-concurrency=1",
      new URL("./focus-diagnostic.probe.ts", import.meta.url).pathname,
    ],
    {
      encoding: "utf8",
      timeout: 15_000,
      env: { ...process.env, NODE_TEST_CONTEXT: undefined },
    },
  );
  assert.equal(result.error, undefined);
  assert.match(
    result.stdout,
    /^# tests 6$/mu,
    "all six fixture cases must execute",
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
