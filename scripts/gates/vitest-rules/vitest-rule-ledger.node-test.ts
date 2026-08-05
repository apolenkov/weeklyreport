import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ESLint } from "eslint";

interface LedgerRule {
  readonly rule: string;
  readonly count: number;
  readonly ruling: "adopt" | "reject";
  readonly reason: string;
  readonly fixes: number;
  readonly probe: string;
  readonly gate: "error" | "off" | "vacuous";
}

interface Ledger {
  readonly measuredAt: string;
  readonly pluginVersion: string;
  readonly eslintVersion: string;
  readonly files: number;
  readonly productionSettings: boolean;
  readonly alreadyEnabled: number;
  readonly rules: readonly LedgerRule[];
}

interface ResolvedConfig {
  readonly rules?: Record<string, readonly [number, ...unknown[]]>;
}

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const MEASURED_RULE_COUNT = 51;
const MINIMUM_REASON_LENGTH = 20;
const ENTRY_KEYS = [
  "rule",
  "count",
  "ruling",
  "reason",
  "fixes",
  "probe",
  "gate",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean =>
  Object.keys(value)
    .toSorted((left, right) => left.localeCompare(right))
    .join("\0") ===
  [...keys].toSorted((left, right) => left.localeCompare(right)).join("\0");

const isLedgerRule = (value: unknown): value is LedgerRule =>
  isRecord(value) &&
  hasExactKeys(value, ENTRY_KEYS) &&
  typeof value.rule === "string" &&
  typeof value.count === "number" &&
  Number.isInteger(value.count) &&
  (value.ruling === "adopt" || value.ruling === "reject") &&
  typeof value.reason === "string" &&
  typeof value.fixes === "number" &&
  Number.isInteger(value.fixes) &&
  typeof value.probe === "string" &&
  (value.gate === "error" || value.gate === "off" || value.gate === "vacuous");

export const parseLedger = (raw: string): Ledger => {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "measuredAt",
      "pluginVersion",
      "eslintVersion",
      "files",
      "productionSettings",
      "alreadyEnabled",
      "rules",
    ]) ||
    typeof value.measuredAt !== "string" ||
    typeof value.pluginVersion !== "string" ||
    typeof value.eslintVersion !== "string" ||
    typeof value.files !== "number" ||
    !Number.isInteger(value.files) ||
    typeof value.productionSettings !== "boolean" ||
    typeof value.alreadyEnabled !== "number" ||
    !Number.isInteger(value.alreadyEnabled) ||
    !Array.isArray(value.rules) ||
    !value.rules.every(isLedgerRule)
  ) {
    throw new Error("Invalid Vitest rule ledger");
  }
  return {
    measuredAt: value.measuredAt,
    pluginVersion: value.pluginVersion,
    eslintVersion: value.eslintVersion,
    files: value.files,
    productionSettings: value.productionSettings,
    alreadyEnabled: value.alreadyEnabled,
    rules: value.rules,
  };
};

const ledger = parseLedger(
  readFileSync(
    `${REPO_ROOT}scripts/gates/vitest-rules/vitest-rule-ledger.json`,
    "utf8",
  ),
);

const adopted = ledger.rules.filter((entry) => entry.ruling === "adopt");

void test("every measured rule has a complete individual ruling", () => {
  assert.equal(ledger.rules.length, MEASURED_RULE_COUNT);
  assert.equal(
    new Set(ledger.rules.map((entry) => entry.rule)).size,
    MEASURED_RULE_COUNT,
  );
  for (const entry of ledger.rules) {
    assert.ok(Number.isInteger(entry.count) && entry.count >= 0);
    assert.ok(entry.reason.length > MINIMUM_REASON_LENGTH);
    assert.ok(entry.probe.length > 0);
    if (entry.ruling === "adopt") assert.equal(entry.gate, "error");
    else assert.notEqual(entry.gate, "error");
  }
});

void test("malformed ledger entries fail closed", () => {
  assert.throws(
    () =>
      parseLedger(
        JSON.stringify({
          rules: [
            {
              rule: "valid-expect",
              count: 1,
              ruling: "maybe",
              reason: "A deliberately malformed decision fixture.",
              fixes: 0,
              probe: "fixture",
              gate: "off",
              surprise: true,
            },
          ],
        }),
      ),
    /Invalid Vitest rule ledger/,
  );
});

void test("all accepted rules are enabled in the production test config", async () => {
  const eslint = new ESLint({ cwd: REPO_ROOT });
  const config = (await eslint.calculateConfigForFile(
    "apps/web/src/lib/trpc.test.ts",
  )) as ResolvedConfig | undefined;
  for (const entry of adopted)
    assert.equal(config?.rules?.[`vitest/${entry.rule}`]?.[0], 2, entry.rule);
});

void test("planted violations prove every accepted rule fires", async () => {
  const eslint = new ESLint({ cwd: REPO_ROOT });
  const source = `
    import { afterAll, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
    const mock = vi.fn();
    describe("probe", () => {
      afterAll(() => {});
      beforeEach(() => {});
      for (const value of [1, 2]) it(String(value), () => expect(value).toBe(value));
    });
    (mock as Mock).mockReset();
  `;
  const [result] = await eslint.lintText(source, {
    filePath: "apps/web/src/lib/trpc.test.ts",
  });
  const fired = new Set(
    result?.messages
      .map((message) => message.ruleId)
      .filter((rule): rule is string => rule?.startsWith("vitest/") === true),
  );
  for (const entry of adopted)
    assert.ok(fired.has(`vitest/${entry.rule}`), entry.rule);
});
