import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { countFileScopedConfigEntries } from "./eslint-config-scope-counter.ts";

const POLICY_MODULES = [
  "eslint-config/core.ts",
  "eslint-config/boundaries.ts",
  "eslint-config/immutability.ts",
  "eslint-config/overrides.ts",
] as const;

void test("counts direct file-scoped entries independently of formatting", () => {
  const source = `const config = [
    { files: ["a.ts"], rules: {} },
    {
      files: ["b.ts"],
      rules: { nested: ["error", { files: ["not-an-entry.ts"] }] },
    },
    { rules: {} },
  ];`;

  assert.equal(countFileScopedConfigEntries(source, "fixture.ts"), 2);
});

void test("the modular policy surface preserves the ratcheted override count", () => {
  const count = POLICY_MODULES.reduce(
    (sum, path) =>
      sum + countFileScopedConfigEntries(readFileSync(path, "utf8"), path),
    0,
  );

  assert.equal(count, 23);
});
