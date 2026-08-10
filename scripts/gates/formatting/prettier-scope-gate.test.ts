import assert from "node:assert/strict";
import test from "node:test";

import { getFileInfo } from "prettier";

const maintainedFiles = [
  "e2e/playwright.integration.config.ts",
  "e2e/integration/pdf-export.integration.spec.ts",
  "e2e/catalog/admin.yaml",
  "prisma/seed.ts",
  "prisma/seeds/simple/seed-simple.ts",
  "prisma/seeds/support/seed-constants.ts",
] as const;

void test("Prettier owns maintained E2E, seed, and catalog files", async () => {
  const results = await Promise.all(
    maintainedFiles.map((file) =>
      getFileInfo(file, { ignorePath: ".prettierignore" }),
    ),
  );

  assert.deepEqual(
    results.map(({ ignored }) => ignored),
    maintainedFiles.map(() => false),
  );
});

void test("Prettier still excludes the tool-owned lockfile", async () => {
  const result = await getFileInfo("pnpm-lock.yaml", {
    ignorePath: ".prettierignore",
  });

  assert.equal(result.ignored, true);
});
