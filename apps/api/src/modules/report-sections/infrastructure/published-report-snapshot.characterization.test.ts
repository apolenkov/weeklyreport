import { computeWorstStatus } from "@customreport/report-persistence";
import { describe, expect, it } from "vitest";

// Pins computeWorstStatus over the traffic-light permutation grid — a diff in
// these assertions means a behavior change.
describe("computeWorstStatus — characterization grid", () => {
  it("returns null for an empty input", () => {
    expect(computeWorstStatus([])).toBeNull();
  });

  it.each([
    { statuses: ["green"], expected: "green" },
    { statuses: ["yellow"], expected: "yellow" },
    { statuses: ["red"], expected: "red" },
    { statuses: ["green", "yellow"], expected: "yellow" },
    { statuses: ["yellow", "red"], expected: "red" },
    { statuses: ["green", "red"], expected: "red" },
    { statuses: ["green", "yellow", "red"], expected: "red" },
    { statuses: ["red", "yellow", "green"], expected: "red" },
    { statuses: ["green", "green"], expected: "green" },
  ] as const)("resolves $statuses to $expected", ({ statuses, expected }) => {
    expect(computeWorstStatus(statuses)).toBe(expected);
  });
});
