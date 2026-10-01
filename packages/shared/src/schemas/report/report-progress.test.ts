import { describe, expect, it } from "vitest";

import { computeReportProgress } from "./report-progress.js";

describe("computeReportProgress", () => {
  const sections = [
    { authorId: "a", status: "submitted" },
    { authorId: "b", status: "draft" },
    { authorId: "x", status: "submitted" },
  ];

  it("gives head and admin the same figure from the same org-wide inputs", () => {
    expect(computeReportProgress(["a", "b", "c"], sections)).toEqual({
      submitted: 1,
      total: 3,
    });
  });

  it("differs only when the expected lead set is narrowed (the 8 vs 10 gap)", () => {
    expect(computeReportProgress(["a", "b"], sections).total).toBe(2);
    expect(computeReportProgress(["a", "b", "c"], sections).total).toBe(3);
  });

  it("ignores submissions from authors outside the expected set", () => {
    expect(computeReportProgress(["b"], sections)).toEqual({
      submitted: 0,
      total: 1,
    });
  });

  it("counts a lead once even with several submitted sections", () => {
    expect(
      computeReportProgress(
        ["a"],
        [
          { authorId: "a", status: "submitted" },
          { authorId: "a", status: "submitted" },
        ],
      ),
    ).toEqual({ submitted: 1, total: 1 });
  });
});
