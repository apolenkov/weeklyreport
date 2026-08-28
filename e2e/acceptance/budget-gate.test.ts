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
        budget: { measurements: {} },
        commandKind: "smoke",
        durationMs: 1,
      }),
    ).toThrow(/teardown duration/u);
  });
});
