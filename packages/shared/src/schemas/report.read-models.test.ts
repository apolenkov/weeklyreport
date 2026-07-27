import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  archiveReportSummarySchema,
  assembledReportSchema,
  carryOverStatusSchema,
  compiledHistoryEntrySchema,
  compiledHistoryInputSchema,
  compiledHistoryResultSchema,
  escalationSchema,
  groupProductEdgeInputSchema,
  groupProductSchema,
  myHistoryEntrySchema,
  portfolioOverviewSchema,
  portfolioProductOverviewSchema,
  projectStatusInputSchema,
  reportPeriodSchema,
  weeklyReportReadModelSchema,
} from "./report";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const uuid = () => randomUUID();
// ---------------------------------------------------------------------------
// draftSaveSchema boundaries
// ---------------------------------------------------------------------------

describe("carryOverStatusSchema", () => {
  it('accepts "completed"', () => {
    expect(carryOverStatusSchema.safeParse("completed").success).toBe(true);
  });

  // Carry-over is synchronous: the service writes only `completed` (or throws,
  // persisting nothing). The enum collapses to that single live value —
  // `pending`/`failed` are not accepted.
  it('rejects "pending" (removed dead state)', () => {
    expect(carryOverStatusSchema.safeParse("pending").success).toBe(false);
  });

  it('rejects "failed" (removed dead state)', () => {
    expect(carryOverStatusSchema.safeParse("failed").success).toBe(false);
  });

  it('rejects "unknown"', () => {
    expect(carryOverStatusSchema.safeParse("unknown").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(carryOverStatusSchema.safeParse("").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Date validation — reportDate()
// ---------------------------------------------------------------------------

describe("reportDate via assembledReportSchema", () => {
  const validAssembled = () => ({
    reportId: uuid(),
    periodStart: "2026-04-01",
    periodEnd: "2026-04-07",
    deadline: "2026-04-05",
    status: "draft" as const,
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
});

describe("reportDate via reportPeriodSchema", () => {
  const validPeriod = () => ({
    id: uuid(),
    periodStart: "2026-04-01",
    periodEnd: "2026-04-07",
    deadline: "2026-04-05",
    status: "draft" as const,
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

// ---------------------------------------------------------------------------
// projectStatusInputSchema
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// portfolioOverviewSchema
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// archiveReportSummarySchema — reportDate usage
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// validateSubmitInput function
// ---------------------------------------------------------------------------

describe("compiledHistoryResultSchema", () => {
  it("requires a non-negative archiveCount", () => {
    const parsed = compiledHistoryResultSchema.parse({
      entries: [],
      archiveCount: 4,
    });

    expect(parsed.archiveCount).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// safeText — noInvisibleOnly validator
//
// Guards the alternation form of the invisible-only check in
// report-primitives.schema.ts so single-character escapes cannot slip through
// a broken pattern.
// ---------------------------------------------------------------------------

describe("weeklyReportReadModelSchema", () => {
  const validWeeklyReport = () => ({
    reportId: uuid(),
    periodStart: "2026-04-14",
    periodEnd: "2026-04-18",
    deadline: "2026-04-17T15:00:00.000Z",
    periodStatus: "open" as const,
    weekLabel: "W16-2026",
    submissionCount: 3,
    totalLeads: 6,
    hasActiveReminderRule: true,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
  });

  it("accepts valid weekly report", () => {
    const result = weeklyReportReadModelSchema.safeParse(validWeeklyReport());
    expect(result.success).toBe(true);
  });

  it("accepts report with null weekLabel", () => {
    const result = weeklyReportReadModelSchema.safeParse({
      ...validWeeklyReport(),
      weekLabel: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts missing hasActiveReminderRule as false for legacy fixtures", () => {
    const { hasActiveReminderRule: _hasRule, ...report } = validWeeklyReport();
    const result = weeklyReportReadModelSchema.parse(report);
    expect(result.hasActiveReminderRule).toBe(false);
  });

  it("defaults archived to false so an omitted flag never reads as archived", () => {
    const result = weeklyReportReadModelSchema.parse(validWeeklyReport());
    expect(result.archived).toBe(false);
  });

  it("carries archived=true through for an archived report", () => {
    const result = weeklyReportReadModelSchema.parse({
      ...validWeeklyReport(),
      archived: true,
    });
    expect(result.archived).toBe(true);
  });

  it("rejects negative submissionCount", () => {
    const result = weeklyReportReadModelSchema.safeParse({
      ...validWeeklyReport(),
      submissionCount: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative totalLeads", () => {
    const result = weeklyReportReadModelSchema.safeParse({
      ...validWeeklyReport(),
      totalLeads: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all periodStatus values", () => {
    for (const status of ["open", "published", "reopened"] as const) {
      const result = weeklyReportReadModelSchema.safeParse({
        ...validWeeklyReport(),
        periodStatus: status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid periodStatus", () => {
    const result = weeklyReportReadModelSchema.safeParse({
      ...validWeeklyReport(),
      periodStatus: "closed",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = weeklyReportReadModelSchema.safeParse({
      reportId: uuid(),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// portfolioProductOverviewSchema
// ---------------------------------------------------------------------------

describe("portfolioProductOverviewSchema", () => {
  it("accepts valid product overview", () => {
    const result = portfolioProductOverviewSchema.safeParse({
      productId: uuid(),
      productName: "CRM Platform",
      worstStatus: "red",
      stageCount: 3,
      leadNames: ["Alice", "Bob"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts null worstStatus (no stages reported)", () => {
    const result = portfolioProductOverviewSchema.safeParse({
      productId: uuid(),
      productName: "New Product",
      worstStatus: null,
      stageCount: 0,
      leadNames: ["Alice"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty productName", () => {
    const result = portfolioProductOverviewSchema.safeParse({
      productId: uuid(),
      productName: "",
      worstStatus: "green",
      stageCount: 1,
      leadNames: ["Alice"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative stageCount", () => {
    const result = portfolioProductOverviewSchema.safeParse({
      productId: uuid(),
      productName: "X",
      worstStatus: "green",
      stageCount: -1,
      leadNames: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// escalationSchema
// ---------------------------------------------------------------------------

describe("escalationSchema", () => {
  it("accepts valid escalation with stageName", () => {
    const result = escalationSchema.safeParse({
      type: "blocked",
      productName: "CRM",
      stageName: "Dev",
      leadName: "Alice",
      description: "ETL memory leak",
    });
    expect(result.success).toBe(true);
  });

  it("accepts escalation with null stageName", () => {
    const result = escalationSchema.safeParse({
      type: "at_risk",
      productName: "Mobile",
      stageName: null,
      leadName: "Bob",
      description: "Design tokens pending",
    });
    expect(result.success).toBe(true);
  });

  it("accepts unresolved_risk type", () => {
    const result = escalationSchema.safeParse({
      type: "unresolved_risk",
      productName: "Cloud",
      stageName: "DevOps",
      leadName: "Charlie",
      description: "PgBouncer migration window",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown type", () => {
    const result = escalationSchema.safeParse({
      type: "warning",
      productName: "X",
      stageName: null,
      leadName: "Y",
      description: "Something",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty productName", () => {
    const result = escalationSchema.safeParse({
      type: "blocked",
      productName: "",
      stageName: null,
      leadName: "Alice",
      description: "Issue",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GroupProduct schemas
// ---------------------------------------------------------------------------

describe("groupProductSchema", () => {
  it("accepts a well-formed row and coerces createdAt to Date", () => {
    const row = groupProductSchema.parse({
      id: uuid(),
      groupId: uuid(),
      productId: uuid(),
      createdAt: "2026-05-11T00:00:00.000Z",
    });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("rejects non-uuid groupId / productId", () => {
    expect(
      groupProductSchema.safeParse({
        id: uuid(),
        groupId: "not-a-uuid",
        productId: uuid(),
        createdAt: new Date(),
      }).success,
    ).toBe(false);
    expect(
      groupProductSchema.safeParse({
        id: uuid(),
        groupId: uuid(),
        productId: "also-not-a-uuid",
        createdAt: new Date(),
      }).success,
    ).toBe(false);
  });
});

describe("groupProductEdgeInputSchema", () => {
  it("accepts a {groupId, productId} pair of uuids", () => {
    const groupId = uuid();
    const productId = uuid();
    const parsed = groupProductEdgeInputSchema.parse({ groupId, productId });
    expect(parsed).toEqual({ groupId, productId });
  });

  it("rejects missing fields", () => {
    expect(
      groupProductEdgeInputSchema.safeParse({ groupId: uuid() }).success,
    ).toBe(false);
    expect(
      groupProductEdgeInputSchema.safeParse({ productId: uuid() }).success,
    ).toBe(false);
  });

  it("rejects non-uuid values", () => {
    expect(
      groupProductEdgeInputSchema.safeParse({
        groupId: "nope",
        productId: uuid(),
      }).success,
    ).toBe(false);
  });
});

describe("myHistoryEntrySchema", () => {
  it("accepts projected aggregates and coerces timestamp strings", () => {
    const parsed = myHistoryEntrySchema.parse({
      sectionId: uuid(),
      reportId: uuid(),
      periodStart: "2026-05-11T00:00:00.000Z",
      periodEnd: "2026-05-17T23:59:59.000Z",
      reportStatus: "draft",
      sectionStatus: "draft",
      archived: false,
      submittedAt: null,
      publishedAt: null,
      createdAt: "2026-05-15T17:33:11.159Z",
      updatedAt: "2026-05-15T17:35:11.159Z",
      lastEditAt: "2026-05-15T17:36:11.159Z",
      itemCount: 5,
      riskCount: 1,
      decisionCount: 2,
      priorityCount: 3,
      productCount: 3,
      trafficLights: { green: 2, yellow: 0, red: 1 },
    });

    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.lastEditAt).toBeInstanceOf(Date);
    expect(parsed.itemCount).toBe(5);
    expect(parsed.riskCount).toBe(1);
    expect(parsed.archived).toBe(false);
    expect(parsed.trafficLights).toEqual({ green: 2, yellow: 0, red: 1 });
  });
});

describe("compiledHistoryInputSchema", () => {
  it("accepts omitted includeArchive", () => {
    expect(compiledHistoryInputSchema.parse({})).toEqual({});
  });

  it("accepts includeArchive", () => {
    expect(compiledHistoryInputSchema.parse({ includeArchive: true })).toEqual({
      includeArchive: true,
    });
  });
});

describe("compiledHistoryEntrySchema", () => {
  it("accepts a compiled history entry", () => {
    const parsed = compiledHistoryEntrySchema.parse({
      reportId: uuid(),
      periodStart: "2026-04-06T00:00:00.000Z",
      periodEnd: "2026-04-12T23:59:59.000Z",
      publishedAt: "2026-04-13T09:00:00.000Z",
      archived: true,
      publishedByName: "Head User",
      trafficLights: { green: 3, yellow: 1, red: 0 },
      itemCount: 4,
      riskCount: 1,
      decisionCount: 2,
      priorityCount: 1,
      sectionCount: 2,
      productCount: 3,
    });

    expect(parsed.publishedAt).toBeInstanceOf(Date);
    expect(parsed.archived).toBe(true);
    expect(parsed.trafficLights.yellow).toBe(1);
  });

  it("rejects negative aggregate counts", () => {
    expect(() =>
      compiledHistoryEntrySchema.parse({
        reportId: uuid(),
        periodStart: "2026-04-06T00:00:00.000Z",
        periodEnd: "2026-04-12T23:59:59.000Z",
        publishedAt: null,
        archived: false,
        publishedByName: "Head User",
        trafficLights: { green: 0, yellow: 0, red: 0 },
        itemCount: -1,
        riskCount: 0,
        decisionCount: 0,
        priorityCount: 0,
        sectionCount: 0,
        productCount: 0,
      }),
    ).toThrow();
  });
});
