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
  readonly rules: readonly LedgerRule[];
}

interface ResolvedConfig {
  readonly rules?: Record<string, readonly [number, ...unknown[]]>;
}

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const MEASURED_RULE_COUNT = 51;
const MINIMUM_REASON_LENGTH = 20;
const ledger = JSON.parse(
  readFileSync(`${REPO_ROOT}scripts/vitest-rule-ledger.json`, "utf8"),
) as Ledger;

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
