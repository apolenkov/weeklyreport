import { spawnSync } from "node:child_process";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACCEPTANCE_BUDGET,
  evaluateAcceptanceBudget,
  parseAcceptanceRuntimeReceipt,
} from "./budget-gate.ts";

const WITHIN_BUDGET = {
  commandKind: "combined",
  durationMs: ACCEPTANCE_BUDGET.combinedDurationMs,
  fileCount: ACCEPTANCE_BUDGET.fileCount,
  lineCount: ACCEPTANCE_BUDGET.lineCount,
  teardownDurationMs: ACCEPTANCE_BUDGET.teardownDurationMs,
} as const;

const SOURCE = { sha: "a".repeat(40), tree: "b".repeat(40) } as const;
const PASSING_RECEIPT = {
  schemaVersion: 1,
  source: SOURCE,
  cleanup: {
    listenersFree: true,
    ownedFilesRemoved: true,
    status: "PASS",
    teardown: {
      cleanupStatus: "PASS",
      clients: "TRANSIENT_CLIENTS_CLOSED",
      containers: "NONE_CREATED",
      databaseState: "DETERMINISTIC_FULL_SEED",
      redisState: "RESERVED_DB_15_EMPTY",
      sourceUnchanged: true,
      volumes: "NONE_CREATED",
    },
  },
  commandKind: "smoke",
  durationMs: 100,
  overallStatus: "PASS",
  playwrightStatus: "passed",
  budget: {
    status: "PASS",
    violations: [],
    measurements: {
      commandDurationMs: 100,
      fileCount: 14,
      lineCount: 1600,
      teardownDurationMs: 10,
    },
  },
  tests: {
    failed: 0,
    interrupted: 0,
    passed: 1,
    skipped: 0,
    timedOut: 0,
    total: 1,
  },
} as const;

describe("acceptance whole-contour budget", () => {
  it("accepts every exact boundary", () => {
    expect(evaluateAcceptanceBudget(WITHIN_BUDGET)).toEqual({
      status: "PASS",
      violations: [],
    });
  });

  it.each([
    ["fileCount", /file count 26 exceeds 25/u],
    ["lineCount", /line count 4001 exceeds 4000/u],
  ] as const)("rejects a planted %s overage", (field, expected) => {
    const result = evaluateAcceptanceBudget({
      ...WITHIN_BUDGET,
      [field]: WITHIN_BUDGET[field] + 1,
    });
    expect(result.status).toBe("FAIL");
    expect(result.violations.join("\n")).toMatch(expected);
  });

  it("rejects planted smoke, combined, and teardown duration overages", () => {
    const smoke = evaluateAcceptanceBudget({
      ...WITHIN_BUDGET,
      commandKind: "smoke",
      durationMs: ACCEPTANCE_BUDGET.smokeDurationMs + 1,
    });
    const combined = evaluateAcceptanceBudget({
      ...WITHIN_BUDGET,
      durationMs: ACCEPTANCE_BUDGET.combinedDurationMs + 1,
    });
    const teardown = evaluateAcceptanceBudget({
      ...WITHIN_BUDGET,
      teardownDurationMs: ACCEPTANCE_BUDGET.teardownDurationMs + 1,
    });

    expect(smoke.violations.join("\n")).toMatch(/smoke duration/u);
    expect(combined.violations.join("\n")).toMatch(/combined duration/u);
    expect(teardown.violations.join("\n")).toMatch(/teardown duration/u);
  });

  it("rejects a receipt without measured teardown", () => {
    expect(() =>
      parseAcceptanceRuntimeReceipt({
        ...PASSING_RECEIPT,
        budget: {
          ...PASSING_RECEIPT.budget,
          measurements: {
            ...PASSING_RECEIPT.budget.measurements,
            teardownDurationMs: undefined,
          },
        },
      }),
    ).toThrow(/teardown duration/u);
  });

  it("accepts only a source-bound terminal PASS receipt", () => {
    expect(
      parseAcceptanceRuntimeReceipt(PASSING_RECEIPT, SOURCE),
    ).toMatchObject({
      commandKind: "smoke",
      sha: SOURCE.sha,
      tree: SOURCE.tree,
    });
    expect(() =>
      parseAcceptanceRuntimeReceipt(PASSING_RECEIPT, {
        sha: "c".repeat(40),
        tree: SOURCE.tree,
      }),
    ).toThrow(/does not match current SHA\/tree/u);
  });

  it("rejects scalar-only, negative-duration, skipped, and failed receipts", () => {
    expect(() =>
      parseAcceptanceRuntimeReceipt({
        budget: { measurements: { teardownDurationMs: 1 } },
        commandKind: "smoke",
        durationMs: 1,
      }),
    ).toThrow();
    expect(() =>
      parseAcceptanceRuntimeReceipt({
        ...PASSING_RECEIPT,
        durationMs: -1,
      }),
    ).toThrow(/durationMs/u);
    expect(() =>
      parseAcceptanceRuntimeReceipt({
        ...PASSING_RECEIPT,
        tests: { ...PASSING_RECEIPT.tests, skipped: 1 },
      }),
    ).toThrow(/not fully passing/u);
    expect(() =>
      parseAcceptanceRuntimeReceipt({
        ...PASSING_RECEIPT,
        overallStatus: "FAIL_NOT_PROVEN",
      }),
    ).toThrow(/not a terminal passing result/u);
  });

  it("the exact CLI fails when its required receipt is absent", () => {
    const repoRoot = path.resolve(import.meta.dirname, "..", "..");
    const missingReceipt = path.join(
      repoRoot,
      "e2e",
      "acceptance",
      ".results",
      "missing-planted-receipt.json",
    );
    const result = spawnSync(
      process.execPath,
      [
        path.join(import.meta.dirname, "budget-gate.ts"),
        "--require-receipt",
        "--receipt",
        missingReceipt,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `acceptance receipt missing: ${missingReceipt}`,
    );
  });
});
