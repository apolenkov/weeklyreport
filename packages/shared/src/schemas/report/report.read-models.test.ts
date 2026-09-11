import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  archiveReportSummarySchema,
  assembledReportSchema,
  carryOverStatusSchema,
  portfolioOverviewSchema,
  projectStatusInputSchema,
  reportPeriodSchema,
} from "../report";

// Fixtures

const uuid = () => randomUUID();
describe("carryOverStatusSchema", () => {
  it('accepts "completed"', () => {
    expect(carryOverStatusSchema.safeParse("completed").success).toBe(true);
  });

  // Carry-over is synchronous: the service writes only `completed` (or throws,
  // persisting nothing). The enum collapses to that single live value —
  // `pending`/`failed` are not accepted.
  it('rejects unsupported "pending" state', () => {
    expect(carryOverStatusSchema.safeParse("pending").success).toBe(false);
  });

  it('rejects unsupported "failed" state', () => {
    expect(carryOverStatusSchema.safeParse("failed").success).toBe(false);
  });

  it('rejects "unknown"', () => {
    expect(carryOverStatusSchema.safeParse("unknown").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(carryOverStatusSchema.safeParse("").success).toBe(false);
  });
});

// Date validation — reportDate()

describe("reportDate via assembledReportSchema", () => {
  const validAssembled = () => ({
    reportId: uuid(),
    periodStart: "2026-04-01",
    periodEnd: "2026-04-07",
    deadline: "2026-04-05",
    status: "draft" as const,
    publishedAt: null,
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green" as const,
      totals: { green: 3, yellow: 1, red: 0 },
    },
    sections: [],
  });

  it.each([
    {
      label: "year 2026",
      periodStart: "2026-04-01",
      success: true,
    },
    {
      label: "boundary year 2000",
      periodStart: "2000-01-01",
      success: true,
    },
    {
      label: "year 1999 (before 2000)",
      periodStart: "1999-12-31",
      success: false,
    },
    {
      label: "year 1969 (pre-epoch)",
      periodStart: "1969-07-20",
      success: false,
    },
    {
      label: "epoch 0 (1970-01-01, before 2000)",
      periodStart: "1970-01-01",
      success: false,
    },
  ] as const)("$success for periodStart $label", ({ periodStart, success }) => {
    const result = assembledReportSchema.safeParse({
      ...validAssembled(),
      periodStart,
    });
    expect(result.success).toBe(success);
  });

  it("rejects a published report without publishedAt", () => {
    expect(
      assembledReportSchema.safeParse({
        ...validAssembled(),
        status: "published",
      }).success,
    ).toBe(false);
  });
});

describe("reportDate via reportPeriodSchema", () => {
  const validPeriod = () => ({
    id: uuid(),
    periodStart: "2026-04-01",
    periodEnd: "2026-04-07",
    deadline: "2026-04-05",
    status: "draft" as const,
    periodState: "open" as const,
    periodStatus: "open" as const,
    archived: false,
    autoPublished: false,
    autoArchived: false,
    publishedAt: null,
    publishedById: null,
    reopenedAt: null,
  });

  it("accepts valid period with dates in 2026", () => {
    const result = reportPeriodSchema.safeParse(validPeriod());
    expect(result.success).toBe(true);
  });

  it("rejects periodStart before 2000", () => {
    const input = { ...validPeriod(), periodStart: "1998-01-01" };
    const result = reportPeriodSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects periodEnd before 2000", () => {
    const input = { ...validPeriod(), periodEnd: "1995-06-15" };
    const result = reportPeriodSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects deadline before 2000", () => {
    const input = { ...validPeriod(), deadline: "1990-01-01" };
    const result = reportPeriodSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// projectStatusInputSchema

describe("projectStatusInputSchema", () => {
  it("accepts valid projectId with optional status", () => {
    const result = projectStatusInputSchema.safeParse({ projectId: uuid() });
    expect(result.success).toBe(true);
  });

  it("accepts valid projectId with status", () => {
    const result = projectStatusInputSchema.safeParse({
      projectId: uuid(),
      status: "yellow",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID projectId", () => {
    const result = projectStatusInputSchema.safeParse({
      projectId: "not-a-uuid",
      status: "green",
    });
    expect(result.success).toBe(false);
  });
});

// portfolioOverviewSchema

describe("portfolioOverviewSchema", () => {
  it("accepts valid overview", () => {
    const result = portfolioOverviewSchema.safeParse({
      status: "green",
      totals: { green: 5, yellow: 2, red: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative totals", () => {
    const result = portfolioOverviewSchema.safeParse({
      status: "green",
      totals: { green: -1, yellow: 0, red: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer totals", () => {
    const result = portfolioOverviewSchema.safeParse({
      status: "red",
      totals: { green: 1.5, yellow: 0, red: 0 },
    });
    expect(result.success).toBe(false);
  });
});

// archiveReportSummarySchema — reportDate usage

describe("archiveReportSummarySchema", () => {
  it("accepts valid archive summary", () => {
    const result = archiveReportSummarySchema.safeParse({
      reportId: uuid(),
      periodStart: "2026-01-01",
      periodEnd: "2026-01-07",
      publishedAt: "2026-01-08",
      publishedByName: "Alice",
      portfolioStatus: "green",
    });
    expect(result.success).toBe(true);
  });

  it("rejects publishedAt before 2000", () => {
    const result = archiveReportSummarySchema.safeParse({
      reportId: uuid(),
      periodStart: "2026-01-01",
      periodEnd: "2026-01-07",
      publishedAt: "1999-12-31",
      publishedByName: "Alice",
      portfolioStatus: "green",
    });
    expect(result.success).toBe(false);
  });
});
