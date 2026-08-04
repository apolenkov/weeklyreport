import { describe, expect, it } from "vitest";

import type { ReportContentSummary } from "./report-content";
import { reportHasContent } from "./report-content";

function makeSummary(
  overrides: Partial<ReportContentSummary> = {},
): ReportContentSummary {
  return {
    needsAttention: undefined,
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
    priorities: [],
    ...overrides,
  };
}

describe("reportHasContent — publish-gate contract", () => {
  it("returns false when every content field is empty", () => {
    expect(reportHasContent(makeSummary())).toBe(false);
  });

  it.each([
    ["needsAttention", { needsAttention: "SLA breach" }],
    ["currentWeek", { currentWeek: [{}] }],
    ["nextWeek", { nextWeek: [{}] }],
    ["risks", { risks: [{}] }],
    ["decisions", { decisions: [{}] }],
    ["priorities", { priorities: [{}] }],
  ] as const)(
    "returns true when only the %s field carries content",
    (_field, overrides) => {
      expect(reportHasContent(makeSummary({ ...overrides }))).toBe(true);
    },
  );

  it("treats whitespace-only needsAttention as no attention", () => {
    expect(
      reportHasContent(makeSummary({ needsAttention: " ".repeat(3) })),
    ).toBe(false);
  });

  it("treats an empty-string needsAttention as no attention", () => {
    expect(reportHasContent(makeSummary({ needsAttention: "" }))).toBe(false);
  });
});
