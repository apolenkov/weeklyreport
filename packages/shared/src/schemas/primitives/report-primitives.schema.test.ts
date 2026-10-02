import { describe, expect, it } from "vitest";

import { reportDate } from "./report-primitives.schema.js";

/** Verifies that report dates are evaluated by their UTC calendar year. */
describe("reportDate — UTC calendar-year semantics", () => {
  it("accepts a date in the year 2000 onward (UTC)", () => {
    expect(reportDate().safeParse("2000-01-01T00:00:00.000Z").success).toBe(
      true,
    );
  });

  it("rejects a date whose UTC year is before 2000", () => {
    expect(reportDate().safeParse("1999-12-31T23:59:59.000Z").success).toBe(
      false,
    );
  });

  it("judges by the UTC year, not the offset-locale year", () => {
    // 1999-12-31T12:00:00-12:00 IS 2000-01-01T00:00:00Z; a local-time check in
    // a west-of-UTC server would see 1999 and wrongly reject a valid boundary.
    expect(reportDate().safeParse("1999-12-31T12:00:00-12:00").success).toBe(
      true,
    );
  });
});
