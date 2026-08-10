import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { REPO_ROOT, resolveRepoPath } from "./repo-root.ts";

void test("resolves the repository independently of the process cwd", () => {
  const packageJson = JSON.parse(
    readFileSync(resolveRepoPath("package.json"), "utf8"),
  ) as { readonly name?: unknown };

  assert.equal(packageJson.name, "customreport");
  assert.equal(resolveRepoPath(), REPO_ROOT);
});
