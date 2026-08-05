import { describe, expect, it } from "vitest";

import {
  compactFailedCellSummary,
  compactFailureSummary,
} from "./failure-summary.ts";

describe("runtime failure summaries", () => {
  it("keeps failed-cell assertions bounded while retaining IDs and reasons", () => {
    const summary = compactFailedCellSummary([
      { cellId: "cell-a", verdict: "fail", reasons: ["axe: contrast"] },
      {
        cellId: "cell-b",
        verdict: "blocked",
        reasons: ["control: Submit did not settle"],
      },
      ...Array.from({ length: 100 }, (_, index) => ({
        cellId: `cell-${index + 2}`,
        verdict: "fail",
        reasons: ["x".repeat(100_000)],
      })),
    ]);

    expect(summary).toContain("cell-a");
    expect(summary).toContain("axe: contrast");
    expect(summary.length).toBeLessThanOrEqual(4096);
  });

  it("bounds arbitrary issue output before assertion formatting", () => {
    const summary = compactFailureSummary([
      `issue-a: ${"x".repeat(100_000)}`,
      ...Array.from({ length: 100 }, (_, index) => `issue-${index + 1}`),
    ]);

    expect(summary).toContain("issue-a");
    expect(summary.length).toBeLessThanOrEqual(4096);
  });
});
