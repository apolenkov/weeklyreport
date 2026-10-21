import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";

import { getVitestReporters } from "../../../vitest.base.config.ts";

test("Vitest keeps human output and opts into JSON only when requested", () => {
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

test("every repository Vitest runner inherits the shared reporter contract", () => {
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
