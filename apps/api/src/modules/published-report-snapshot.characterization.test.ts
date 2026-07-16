import { describe, expect, it } from "vitest";

import { computeWorstStatus } from "./published-report-snapshot";

/**
 * dedupe-severity-floor-ranking: pins `computeWorstStatus`'s current output
 * (the snapshot module's own worst-of fold, historically backed by a local
 * `statusSeverity` rank table) over the traffic-light permutation grid
 * BEFORE it is re-expressed over the shared domain fold. Frozen — do not
 * edit assertions after the move lands; a diff here means a behavior
 * change.
 */
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
