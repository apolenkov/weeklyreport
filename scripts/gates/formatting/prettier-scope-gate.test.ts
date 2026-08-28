import assert from "node:assert/strict";
import test from "node:test";

import { getFileInfo } from "prettier";

const maintainedFiles = [
  "prisma/seed.ts",
  "prisma/seeds/simple/seed-simple.ts",
  "prisma/seeds/support/seed-constants.ts",
] as const;

void test("Prettier owns maintained seed files", async () => {
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
