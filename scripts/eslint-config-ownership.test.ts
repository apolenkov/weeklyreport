import assert from "node:assert/strict";
import test from "node:test";

import type { Linter } from "eslint";

import { default as eslintConfig } from "../eslint.config.ts";
import { boundaryConfig } from "../eslint-config/boundaries.ts";
import { coreConfig } from "../eslint-config/core.ts";
import { immutabilityConfig } from "../eslint-config/immutability.ts";
import { jsdocConfig } from "../eslint-config/jsdoc.ts";
import { nextConfig } from "../eslint-config/next.ts";
import { overrideConfig } from "../eslint-config/overrides.ts";
import { sonarjsConfig } from "../eslint-config/sonarjs.ts";

// Ownership test for the eslint-config/ modules (STYLE-CONFIG-001): each
// cohesive rule family exports one typed flat-config fragment, and the hub
// composes exactly those fragments — no family is inlined a second time.

interface ModuleCase {
  readonly id: string;
  readonly module: Linter.Config;
  readonly files: readonly string[];
  readonly rule: string;
}

const CASES: readonly ModuleCase[] = [
  {
    id: "sonar",
    module: sonarjsConfig,
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rule: "sonarjs/cognitive-complexity",
  },
  {
    id: "jsdoc",
    module: jsdocConfig,
    files: ["packages/shared/src/**/*.ts", "packages/ui/src/**/*.{ts,tsx}"],
    rule: "jsdoc/require-jsdoc",
  },
  {
    id: "next",
    module: nextConfig,
    files: ["apps/web/**/*.{ts,tsx}"],
    rule: "@next/next/no-img-element",
  },
];

void test("each config module is a typed flat-config fragment owning its family", () => {
  for (const { id, module, files, rule } of CASES) {
    assert.ok(Array.isArray(module.files), `${id}: files selector present`);
    assert.deepEqual(module.files, files, `${id}: files selector`);
    assert.ok(module.rules?.[rule] !== undefined, `${id}: owns ${rule}`);
  }
});

void test("the hub composes every module exactly once", () => {
  const scoped = eslintConfig.filter(
    (item): item is Linter.Config & { files: string[] } =>
      Array.isArray(item.files),
  );
  for (const { id, module } of CASES) {
    const count = scoped.filter((item) => item === module).length;
    assert.equal(count, 1, `${id}: composed exactly once in eslint.config.ts`);
  }
});

void test("the hub preserves the complete flat-config module order", () => {
  const expected = [
    ...coreConfig,
    sonarjsConfig,
    jsdocConfig,
    nextConfig,
    ...boundaryConfig,
    ...immutabilityConfig,
    ...overrideConfig,
  ];

  assert.equal(eslintConfig.length, expected.length);
  expected.forEach((config, index) => {
    assert.strictEqual(eslintConfig[index], config, `config index ${index}`);
  });
});
