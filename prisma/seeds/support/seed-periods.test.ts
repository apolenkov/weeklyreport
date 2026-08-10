import { describe, expect, it } from "vitest";

import { SEED_REPORTS } from "./seed-periods.ts";

describe("seed reporting-period boundaries", () => {
  it("uses the same inclusive end-of-day precision as the period factory", () => {
    Object.values(SEED_REPORTS).forEach(({ periodEnd }) => {
      const boundary = new Date(periodEnd);

      expect(boundary.getUTCHours()).toBe(23);
      expect(boundary.getUTCMinutes()).toBe(59);
      expect(boundary.getUTCSeconds()).toBe(59);
      expect(boundary.getUTCMilliseconds()).toBe(999);
    });
  });
});
