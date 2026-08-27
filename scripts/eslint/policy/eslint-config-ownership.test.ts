import assert from "node:assert/strict";
import test from "node:test";

import { ESLint, type Linter } from "eslint";

import { default as eslintConfig } from "../../../eslint.config.ts";
import { boundaryConfig } from "../../../eslint-config/boundaries.ts";
import { coreConfig } from "../../../eslint-config/core.ts";
import {
  exemplaryStructureConfig,
  MAINTAINED_PRODUCT_STRUCTURAL_FILES,
} from "../../../eslint-config/exemplary-structure.ts";
import { immutabilityConfig } from "../../../eslint-config/immutability.ts";
import { jsdocConfig } from "../../../eslint-config/jsdoc.ts";
import { nextConfig } from "../../../eslint-config/next.ts";
import { overrideConfig } from "../../../eslint-config/overrides.ts";
import { sonarjsConfig } from "../../../eslint-config/sonarjs.ts";
import { strictStructuralRuleGaps } from "../../quality/exemplary/exemplary-structure-contract.ts";

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
    id: "exemplary-structure",
    module: exemplaryStructureConfig,
    files: MAINTAINED_PRODUCT_STRUCTURAL_FILES,
    rule: "max-lines-per-function",
  },
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const effectiveRules = async (
  eslint: ESLint,
  file: string,
): Promise<Partial<Record<string, unknown>>> => {
  const config: unknown = await eslint.calculateConfigForFile(file);
  if (!isRecord(config) || !isRecord(config.rules)) return {};
  return config.rules;
};

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
    exemplaryStructureConfig,
  ];

  assert.equal(eslintConfig.length, expected.length);
  expected.forEach((config, index) => {
    assert.strictEqual(eslintConfig[index], config, `config index ${index}`);
  });
});

void test("maintained-product scope cannot leak test, fixture or generated roles", async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  assert.deepEqual(
    strictStructuralRuleGaps(
      await effectiveRules(eslint, "packages/shared/src/index.ts"),
    ),
    [],
  );
  for (const separatelyMeasured of [
    "packages/shared/src/schemas/report/report.test.ts",
    "packages/shared/src/test-utils/report.ts",
    "packages/shared/src/schemas/report/report.fixture.ts",
    "packages/shared/src/generated/client.ts",
  ]) {
    assert.ok(
      strictStructuralRuleGaps(await effectiveRules(eslint, separatelyMeasured))
        .length > 0,
      `${separatelyMeasured}: remains separately measured`,
    );
  }
  assert.deepEqual(
    strictStructuralRuleGaps(
      await effectiveRules(
        eslint,
        "packages/shared/src/schemas/report/fixture-service.ts",
      ),
    ),
    [],
  );
});
