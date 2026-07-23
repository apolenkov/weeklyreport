import { describe, expect, it } from "vitest";

import {
  adminUpdatePeriodManualSchema,
  reportPeriodSchema,
} from "./period.schema";

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

describe("adminUpdatePeriodManualSchema — three-state deadline (ruling F16)", () => {
  const base = { reportId: REPORT_ID };

  it("omitting deadline leaves it undefined (untouched)", () => {
    const parsed = adminUpdatePeriodManualSchema.parse(base);
    expect(parsed.deadline).toBeUndefined();
    expect("deadline" in parsed).toBe(false);
  });

  it("explicit null survives parsing (clear)", () => {
    const parsed = adminUpdatePeriodManualSchema.parse({
      ...base,
      deadline: null,
    });
    expect(parsed.deadline).toBeNull();
  });

  it("a value coerces to a Date (set)", () => {
    const parsed = adminUpdatePeriodManualSchema.parse({
      ...base,
      deadline: "2026-07-13T12:00:00.000Z",
    });
    expect(parsed.deadline).toBeInstanceOf(Date);
  });
});

describe("reportPeriodSchema — nullable deadline (ruling F16)", () => {
  it("accepts a null deadline on the read model", () => {
    const parsed = reportPeriodSchema.parse({
      ...validPeriod,
      deadline: null,
    });
    expect(parsed.deadline).toBeNull();
  });

  it("still rejects an ABSENT deadline (null must be explicit)", () => {
    const { deadline: _dropped, ...withoutDeadline } = validPeriod;
    expect(() => reportPeriodSchema.parse(withoutDeadline)).toThrow();
  });
});
