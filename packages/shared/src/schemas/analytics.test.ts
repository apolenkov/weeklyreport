import { describe, expect, it } from "vitest";

import {
  periodComparisonInputSchema,
  trafficLightHistoryInputSchema,
} from "./analytics";

/**
 * `isoDateOnly` is not exported, so it is exercised through the public input
 * schemas that alias it. The refine must reject impossible calendar dates that
 * the format regex alone would accept, before they flow into `new Date(...)`
 * and produce a wrong or Invalid Date query boundary.
 */
describe("isoDateOnly real-date validation", () => {
  it("accepts a real calendar date", () => {
    expect(
      trafficLightHistoryInputSchema.safeParse({
        periodFrom: "2026-06-26",
        periodTo: "2026-06-30",
      }).success,
    ).toBe(true);
  });

  it("rejects a day that overflows the month (2026-02-30)", () => {
    expect(
      trafficLightHistoryInputSchema.safeParse({
        periodFrom: "2026-02-30",
        periodTo: "2026-06-30",
      }).success,
    ).toBe(false);
  });

  it("rejects an impossible month and day (2026-13-45)", () => {
    expect(
      trafficLightHistoryInputSchema.safeParse({
        periodFrom: "2026-13-45",
        periodTo: "2026-06-30",
      }).success,
    ).toBe(false);
  });

  it("rejects a value that is not a date at all", () => {
    expect(
      periodComparisonInputSchema.safeParse({
        periodA: "not-a-date",
        periodB: "2026-06-30",
      }).success,
    ).toBe(false);
  });

  it("rejects a well-formed-but-impossible date on the periodComparison side", () => {
    expect(
      periodComparisonInputSchema.safeParse({
        periodA: "2026-06-26",
        periodB: "2026-04-31",
      }).success,
    ).toBe(false);
  });
});
