import { describe, expect, it } from "vitest";

import {
  adminUpdatePeriodManualSchema,
  MAX_WEEK_LABEL_LENGTH,
  reportPeriodSchema,
} from "./period.schema";

const REPORT_ID = "123e4567-e89b-42d3-a456-426614174000";
const PUBLISHER_ID = "123e4567-e89b-42d3-a456-426614174001";

describe("MAX_WEEK_LABEL_LENGTH — single source of truth", () => {
  it("exports the week-label cap as the one shared constant", () => {
    expect(MAX_WEEK_LABEL_LENGTH).toBe(64);
  });
});

const validPeriod = {
  id: REPORT_ID,
  periodStart: new Date("2026-07-06T00:00:00.000Z"),
  periodEnd: new Date("2026-07-12T23:59:59.999Z"),
  deadline: new Date("2026-07-13T12:00:00.000Z"),
  status: "draft" as const,
  periodState: "open" as const,
  periodStatus: "open" as const,
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

describe("reportPeriodSchema — publishedById", () => {
  it("rejects a non-UUID publisher id", () => {
    const baseline = {
      ...validPeriod,
      status: "published" as const,
      periodState: "published" as const,
      periodStatus: "published" as const,
      publishedAt: new Date("2026-07-13T18:00:00.000Z"),
      publishedById: PUBLISHER_ID,
    };
    expect(reportPeriodSchema.safeParse(baseline).success).toBe(true);

    const result = reportPeriodSchema.safeParse({
      ...baseline,
      publishedById: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["publishedById"] }),
      );
    }
  });

  it("accepts a UUID publisher id", () => {
    const parsed = reportPeriodSchema.parse({
      ...validPeriod,
      status: "published",
      periodState: "published",
      periodStatus: "published",
      publishedAt: new Date("2026-07-13T18:00:00.000Z"),
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

  it("rejects an absent publisher id", () => {
    const { publishedById: _publishedById, ...withoutPublisher } = validPeriod;
    expect(() => reportPeriodSchema.parse(withoutPublisher)).toThrow();
  });
});

describe("adminUpdatePeriodManualSchema — three-state deadline", () => {
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

describe("reportPeriodSchema — nullable deadline", () => {
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
