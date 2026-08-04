import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  compiledHistoryResultSchema,
  escalationSchema,
  paginationInputSchema,
  portfolioProductOverviewSchema,
  weeklyReportReadModelSchema,
} from "./report";

const uuid = () => randomUUID();

const validWeeklyReport = () => ({
  reportId: uuid(),
  periodStart: "2026-04-14",
  periodEnd: "2026-04-18",
  deadline: "2026-04-17T15:00:00.000Z",
  periodStatus: "open" as const,
  archived: false,
  weekLabel: "W16-2026",
  submissionCount: 3,
  totalLeads: 6,
  hasActiveReminderRule: true,
  portfolioOverview: [],
  leadSections: [],
  escalations: [],
});

describe("compiledHistoryResultSchema", () => {
  it("requires a non-negative archive count", () => {
    expect(
      compiledHistoryResultSchema.parse({ entries: [], archiveCount: 4 })
        .archiveCount,
    ).toBe(4);
  });
});

describe("weeklyReportReadModelSchema", () => {
  it("accepts a valid weekly report", () => {
    expect(
      weeklyReportReadModelSchema.safeParse(validWeeklyReport()).success,
    ).toBe(true);
  });

  it("accepts a null week label", () => {
    expect(
      weeklyReportReadModelSchema.safeParse({
        ...validWeeklyReport(),
        weekLabel: null,
      }).success,
    ).toBe(true);
  });

  it("requires reminder availability", () => {
    const { hasActiveReminderRule: _hasRule, ...report } = validWeeklyReport();
    expect(weeklyReportReadModelSchema.safeParse(report).success).toBe(false);
  });

  it("requires the archived lifecycle fact", () => {
    const { archived: _archived, ...report } = validWeeklyReport();
    expect(weeklyReportReadModelSchema.safeParse(report).success).toBe(false);
  });

  it("preserves an archived report", () => {
    expect(
      weeklyReportReadModelSchema.parse({
        ...validWeeklyReport(),
        archived: true,
      }).archived,
    ).toBe(true);
  });

  it.each([
    ["submission count", { submissionCount: -1 }],
    ["lead count", { totalLeads: -1 }],
  ])("rejects a negative %s", (_label, invalidCount) => {
    expect(
      weeklyReportReadModelSchema.safeParse({
        ...validWeeklyReport(),
        ...invalidCount,
      }).success,
    ).toBe(false);
  });

  it.each(["open", "published", "reopened"] as const)(
    "accepts period status %s",
    (periodStatus) => {
      expect(
        weeklyReportReadModelSchema.safeParse({
          ...validWeeklyReport(),
          periodStatus,
        }).success,
      ).toBe(true);
    },
  );

  it("rejects an invalid period status", () => {
    expect(
      weeklyReportReadModelSchema.safeParse({
        ...validWeeklyReport(),
        periodStatus: "closed",
      }).success,
    ).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(
      weeklyReportReadModelSchema.safeParse({ reportId: uuid() }).success,
    ).toBe(false);
  });
});

describe("paginationInputSchema", () => {
  it("requires an explicit page size", () => {
    expect(paginationInputSchema.safeParse({}).success).toBe(false);
  });

  it("accepts an explicit bounded page size", () => {
    expect(paginationInputSchema.parse({ limit: 20 })).toEqual({ limit: 20 });
  });
});

describe("portfolioProductOverviewSchema", () => {
  const validOverview = () => ({
    productId: uuid(),
    productName: "CRM Platform",
    worstStatus: "red" as const,
    stageCount: 3,
    leadNames: ["Alice", "Bob"],
    leadIds: [
      "5ccd4f78-2a3d-58e4-889a-e9ad6be0b941",
      "d4b211c1-c97a-5853-b0e3-68e82c3c1bd7",
    ],
  });

  it("accepts a valid product overview", () => {
    expect(
      portfolioProductOverviewSchema.safeParse(validOverview()).success,
    ).toBe(true);
  });

  it("accepts a product without a reported status", () => {
    expect(
      portfolioProductOverviewSchema.safeParse({
        ...validOverview(),
        worstStatus: null,
        stageCount: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects an empty product name", () => {
    expect(
      portfolioProductOverviewSchema.safeParse({
        ...validOverview(),
        productName: "",
      }).success,
    ).toBe(false);
  });

  it("rejects a negative stage count", () => {
    expect(
      portfolioProductOverviewSchema.safeParse({
        ...validOverview(),
        stageCount: -1,
      }).success,
    ).toBe(false);
  });
});

describe("escalationSchema", () => {
  const validEscalation = () => ({
    type: "blocked" as const,
    productName: "CRM",
    stageName: "Development",
    leadName: "Alice",
    description: "ETL memory leak",
  });

  it("accepts an escalation with a stage", () => {
    expect(escalationSchema.safeParse(validEscalation()).success).toBe(true);
  });

  it("accepts an escalation without a stage", () => {
    expect(
      escalationSchema.safeParse({
        ...validEscalation(),
        stageName: null,
      }).success,
    ).toBe(true);
  });

  it("accepts an unresolved-risk escalation", () => {
    expect(
      escalationSchema.safeParse({
        ...validEscalation(),
        type: "unresolved_risk",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown escalation type", () => {
    expect(
      escalationSchema.safeParse({
        ...validEscalation(),
        type: "warning",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty product name", () => {
    expect(
      escalationSchema.safeParse({
        ...validEscalation(),
        productName: "",
      }).success,
    ).toBe(false);
  });
});
