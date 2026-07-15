import { describe, expect, it } from "vitest";

import { reportPeriodSchema } from "./period.schema";

const REPORT_ID = "123e4567-e89b-42d3-a456-426614174000";
const PUBLISHER_ID = "123e4567-e89b-42d3-a456-426614174001";

const validPeriod = {
  id: REPORT_ID,
  periodStart: new Date("2026-07-06T00:00:00.000Z"),
  periodEnd: new Date("2026-07-12T23:59:59.999Z"),
  deadline: new Date("2026-07-13T12:00:00.000Z"),
  status: "draft" as const,
};

describe("reportPeriodSchema — publishedById", () => {
  it("rejects a non-UUID publisher id", () => {
    expect(() =>
      reportPeriodSchema.parse({
        ...validPeriod,
        publishedById: "not-a-uuid",
      }),
    ).toThrow();
  });

  it("accepts a UUID publisher id", () => {
    const parsed = reportPeriodSchema.parse({
      ...validPeriod,
      publishedById: PUBLISHER_ID,
    });

    expect(parsed.publishedById).toBe(PUBLISHER_ID);
  });

  it("accepts a null publisher id", () => {
    const parsed = reportPeriodSchema.parse({
      ...validPeriod,
      publishedById: null,
    });

    expect(parsed.publishedById).toBeNull();
  });

  it("accepts an absent publisher id", () => {
    const parsed = reportPeriodSchema.parse(validPeriod);

    expect(parsed.publishedById).toBeUndefined();
  });
});
