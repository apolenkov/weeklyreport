import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  appSettingsSchema,
  appSettingsUpdateSchema,
  archiveReportSummarySchema,
  assembledReportSchema,
  carryOverStatusSchema,
  compiledHistoryEntrySchema,
  compiledHistoryInputSchema,
  compiledHistoryResultSchema,
  decisionInputSchema,
  draftSaveSchema,
  escalationSchema,
  groupProductEdgeInputSchema,
  groupProductSchema,
  itemInputSchema,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  myHistoryEntrySchema,
  periodListBucketSchema,
  periodListItemSchema,
  periodStateSchema,
  periodStatusSchema,
  portfolioOverviewSchema,
  portfolioProductOverviewSchema,
  projectStatusInputSchema,
  type ReportSectionReadModel,
  reportPeriodSchema,
  reportSectionStatusSchema,
  reportStatusSchema,
  riskInputSchema,
  riskSeveritySchema,
  type SubmitSectionPayload,
  stageAssignmentSchema,
  stageSchema,
  submitSectionSchema,
  trafficLightStatusSchema,
  validateSubmitInput,
  versionSnapshotSchema,
  weeklyReportReadModelSchema,
} from "./report";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const uuid = () => randomUUID();
const PROJECT_UUID = uuid();

const validItem = () => ({
  projectId: uuid(),
  type: "current" as const,
  text: "Ship feature X",
  tag: "feature",
  workflowStatus: "in_progress" as const,
});

const validRisk = () => ({
  projectId: uuid(),
  risk: "Deadline may slip",
  impact: "Revenue loss",
  mitigation: "Hire contractor",
});

const validDecision = () => ({
  text: "Upgrade to PostgreSQL 16",
  owner: "Alice",
  impact: "Better performance",
});

const validDraft = () => ({
  reportSectionId: uuid(),
  projectStatuses: [{ projectId: PROJECT_UUID, status: "green" as const }],
  items: [validItem()],
  risks: [validRisk()],
  decisions: [validDecision()],
});

const validSubmit = () => ({
  ...validDraft(),
  confirmed: true as const,
});

// Helper to generate arrays of a given size
const makeItems = (count: number) =>
  Array.from({ length: count }, () => validItem());

const makeRisks = (count: number) =>
  Array.from({ length: count }, () => validRisk());

const makeDecisions = (count: number) =>
  Array.from({ length: count }, () => validDecision());

// ---------------------------------------------------------------------------
// Group 1: draftSaveSchema boundaries
// ---------------------------------------------------------------------------

describe("draftSaveSchema", () => {
  it("accepts a valid minimal draft input", () => {
    const result = draftSaveSchema.safeParse(validDraft());
    expect(result.success).toBe(true);
  });

  it("accepts items array with 0 elements (empty draft OK)", () => {
    const draft = { ...validDraft(), items: [] };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it("accepts items array with exactly 100 elements (at boundary)", () => {
    const draft = { ...validDraft(), items: makeItems(100) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it("rejects items array with 101 elements (exceeds max)", () => {
    const draft = { ...validDraft(), items: makeItems(101) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(false);
  });

  it("accepts risks array with 100 elements (at boundary)", () => {
    const draft = { ...validDraft(), risks: makeRisks(100) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it("rejects risks array with 101 elements", () => {
    const draft = { ...validDraft(), risks: makeRisks(101) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(false);
  });

  it("accepts decisions array with 100 elements (at boundary)", () => {
    const draft = { ...validDraft(), decisions: makeDecisions(100) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it("rejects decisions array with 101 elements", () => {
    const draft = { ...validDraft(), decisions: makeDecisions(101) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(false);
  });

  it("defaults status to draft when not provided", () => {
    const result = draftSaveSchema.safeParse(validDraft());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
    }
  });
});

// ---------------------------------------------------------------------------
// Group 2: itemInputSchema — safeText boundaries
// ---------------------------------------------------------------------------

describe("itemInputSchema — safeText", () => {
  it("accepts item text with exactly 1 visible character", () => {
    const item = { ...validItem(), text: "A" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("rejects item text with 0 characters (empty string)", () => {
    const item = { ...validItem(), text: "" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("accepts item text at max length (500 chars)", () => {
    const item = { ...validItem(), text: "A".repeat(500) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("rejects item text exceeding max length (501 chars)", () => {
    const item = { ...validItem(), text: "A".repeat(501) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("rejects item text containing null byte \\u0000", () => {
    const item = { ...validItem(), text: "Hello\u0000World" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must not contain null bytes");
    }
  });

  it("rejects item text that is only zero-width spaces \\u200B", () => {
    const item = { ...validItem(), text: "\u200B\u200B\u200B" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must contain visible characters");
    }
  });

  it("accepts item text with zero-width space mixed with real text", () => {
    const item = { ...validItem(), text: "\u200BHello" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("rejects item text that is only whitespace", () => {
    const item = { ...validItem(), text: "   " };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("rejects item text that is only \\uFEFF (BOM)", () => {
    const item = { ...validItem(), text: "\uFEFF" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("accepts tag with exactly 1 character", () => {
    const item = { ...validItem(), tag: "X" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("rejects tag with 51 characters (exceeds max 50)", () => {
    const item = { ...validItem(), tag: "A".repeat(51) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("rejects tag containing null byte", () => {
    const item = { ...validItem(), tag: "bug\u0000fix" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 3: riskInputSchema — safeText on risk/impact/mitigation
// ---------------------------------------------------------------------------

describe("riskInputSchema — safeText", () => {
  it("accepts a valid risk", () => {
    const result = riskInputSchema.safeParse(validRisk());
    expect(result.success).toBe(true);
  });

  it("accepts explicit blocked severity", () => {
    const result = riskInputSchema.safeParse({
      ...validRisk(),
      severity: "blocked",
    });
    expect(result.success).toBe(true);
    expect(result.data?.severity).toBe("blocked");
  });

  it("rejects unknown severity", () => {
    const result = riskSeveritySchema.safeParse("critical");
    expect(result.success).toBe(false);
  });

  it("rejects risk text with null byte", () => {
    const risk = { ...validRisk(), risk: "Risk\u0000here" };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it("rejects impact text with null byte", () => {
    const risk = { ...validRisk(), impact: "Impact\u0000here" };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it("rejects mitigation text with null byte", () => {
    const risk = { ...validRisk(), mitigation: "Mitigate\u0000here" };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it("rejects risk text that is only zero-width spaces", () => {
    const risk = { ...validRisk(), risk: "\u200B\u200C\u200D" };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 4: decisionInputSchema — safeText
// ---------------------------------------------------------------------------

describe("decisionInputSchema — safeText", () => {
  it("accepts a valid decision", () => {
    const result = decisionInputSchema.safeParse(validDecision());
    expect(result.success).toBe(true);
  });

  it("rejects decision text with null byte", () => {
    const d = { ...validDecision(), text: "Decide\u0000this" };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it("rejects owner with null byte", () => {
    const d = { ...validDecision(), owner: "Bob\u0000Smith" };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it("rejects owner exceeding 200 chars", () => {
    const d = { ...validDecision(), owner: "A".repeat(201) };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it("accepts deadline as null", () => {
    const d = { ...validDecision(), deadline: null };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
  });

  it("accepts resolvedAt as null", () => {
    const d = { ...validDecision(), resolvedAt: null };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
  });

  it("coerces deadline string to Date", () => {
    const d = { ...validDecision(), deadline: "2026-04-15" };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
    if (result.success && result.data.deadline) {
      expect(result.data.deadline).toBeInstanceOf(Date);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 5: submitSectionSchema boundaries
// ---------------------------------------------------------------------------

describe("submitSectionSchema", () => {
  it("accepts valid submit", () => {
    const result = submitSectionSchema.safeParse(validSubmit());
    expect(result.success).toBe(true);
  });

  it("accepts valid traffic light values (green/yellow/red)", () => {
    for (const status of ["green", "yellow", "red"] as const) {
      const submit = {
        ...validSubmit(),
        projectStatuses: [{ projectId: PROJECT_UUID, status }],
      };
      const result = submitSectionSchema.safeParse(submit);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid traffic light value", () => {
    const submit = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: "blue" }],
    };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it("rejects submit with no traffic light status (BUG-020)", () => {
    const submit = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID }],
    };
    // In submitSectionSchema, status is required (not optional)
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it("requires confirmed to be true", () => {
    const submit = { ...validSubmit(), confirmed: false };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it("requires at least 1 projectStatus", () => {
    const submit = { ...validSubmit(), projectStatuses: [] };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 6: itemInputSchema — priorityRank field
// ---------------------------------------------------------------------------

describe("itemInputSchema priorityRank", () => {
  it("accepts item without priorityRank", () => {
    const result = itemInputSchema.safeParse(validItem());
    expect(result.success).toBe(true);
  });

  it("accepts item with priorityRank null", () => {
    const result = itemInputSchema.safeParse({
      ...validItem(),
      priorityRank: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts item with priorityRank 1", () => {
    const result = itemInputSchema.safeParse({
      ...validItem(),
      priorityRank: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts item with priorityRank 99 (no upper limit)", () => {
    const result = itemInputSchema.safeParse({
      ...validItem(),
      priorityRank: 99,
    });
    expect(result.success).toBe(true);
  });

  it("rejects priorityRank 0 (below min)", () => {
    const result = itemInputSchema.safeParse({
      ...validItem(),
      priorityRank: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer priorityRank (1.5)", () => {
    const result = itemInputSchema.safeParse({
      ...validItem(),
      priorityRank: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 7: Enum schemas
// ---------------------------------------------------------------------------

describe("enum schemas", () => {
  it("trafficLightStatusSchema accepts green/yellow/red", () => {
    expect(trafficLightStatusSchema.safeParse("green").success).toBe(true);
    expect(trafficLightStatusSchema.safeParse("yellow").success).toBe(true);
    expect(trafficLightStatusSchema.safeParse("red").success).toBe(true);
  });

  it("trafficLightStatusSchema rejects unknown value", () => {
    expect(trafficLightStatusSchema.safeParse("blue").success).toBe(false);
    expect(trafficLightStatusSchema.safeParse("").success).toBe(false);
  });

  it("itemTypeSchema accepts current/next", () => {
    expect(itemTypeSchema.safeParse("current").success).toBe(true);
    expect(itemTypeSchema.safeParse("next").success).toBe(true);
  });

  it("itemTypeSchema rejects unknown value", () => {
    expect(itemTypeSchema.safeParse("previous").success).toBe(false);
  });

  it("itemWorkflowStatusSchema accepts done/in_progress/blocked", () => {
    expect(itemWorkflowStatusSchema.safeParse("done").success).toBe(true);
    expect(itemWorkflowStatusSchema.safeParse("in_progress").success).toBe(
      true,
    );
    expect(itemWorkflowStatusSchema.safeParse("blocked").success).toBe(true);
  });

  it("itemWorkflowStatusSchema rejects unknown value", () => {
    expect(itemWorkflowStatusSchema.safeParse("cancelled").success).toBe(false);
  });

  it("reportSectionStatusSchema accepts draft/submitted", () => {
    expect(reportSectionStatusSchema.safeParse("draft").success).toBe(true);
    expect(reportSectionStatusSchema.safeParse("submitted").success).toBe(true);
  });

  it("reportStatusSchema accepts draft/published", () => {
    expect(reportStatusSchema.safeParse("draft").success).toBe(true);
    expect(reportStatusSchema.safeParse("published").success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 8: carryOverStatusSchema (BUG-006)
// ---------------------------------------------------------------------------

describe("carryOverStatusSchema (BUG-006)", () => {
  it('accepts "completed"', () => {
    expect(carryOverStatusSchema.safeParse("completed").success).toBe(true);
  });

  it('accepts "pending" (newly added)', () => {
    expect(carryOverStatusSchema.safeParse("pending").success).toBe(true);
  });

  it('accepts "failed" (newly added)', () => {
    expect(carryOverStatusSchema.safeParse("failed").success).toBe(true);
  });

  it('rejects "unknown"', () => {
    expect(carryOverStatusSchema.safeParse("unknown").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(carryOverStatusSchema.safeParse("").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 9: Date validation — reportDate() (BUG-016)
// ---------------------------------------------------------------------------

describe("reportDate via assembledReportSchema (BUG-016)", () => {
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

  it("accepts dates in year 2026", () => {
    const result = assembledReportSchema.safeParse(validAssembled());
    expect(result.success).toBe(true);
  });

  it("accepts date at boundary year 2000", () => {
    const input = {
      ...validAssembled(),
      periodStart: "2000-01-01",
    };
    const result = assembledReportSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects date in year 1999 (before 2000)", () => {
    const input = {
      ...validAssembled(),
      periodStart: "1999-12-31",
    };
    const result = assembledReportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects date in year 1969 (pre-epoch)", () => {
    const input = {
      ...validAssembled(),
      periodStart: "1969-07-20",
    };
    const result = assembledReportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects epoch 0 date (1970-01-01, before 2000)", () => {
    const input = {
      ...validAssembled(),
      periodStart: "1970-01-01",
    };
    const result = assembledReportSchema.safeParse(input);
    expect(result.success).toBe(false);
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
// Group 10: projectStatusInputSchema
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
// Group 11: portfolioOverviewSchema
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
// Group 12: archiveReportSummarySchema — reportDate usage
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
// Group 13: validateSubmitInput function
// ---------------------------------------------------------------------------

describe("validateSubmitInput", () => {
  const makeSection = (
    overrides: Partial<ReportSectionReadModel> = {},
  ): ReportSectionReadModel => ({
    reportSectionId: uuid(),
    reportId: uuid(),
    authorId: uuid(),
    authorName: "Test Lead",
    authorRole: "lead",
    status: "draft",
    submittedAt: null,
    projects: [
      {
        projectId: PROJECT_UUID,
        projectName: "Project Alpha",
        trafficLight: null,
        ownedStages: [],
      },
    ],
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  });

  it("returns SECTION_ALREADY_SUBMITTED for submitted section", () => {
    const section = makeSection({ status: "submitted" });
    const input = validSubmit();
    const errors = validateSubmitInput(section, input as SubmitSectionPayload);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("SECTION_ALREADY_SUBMITTED");
  });

  it("returns MISSING_TRAFFIC_LIGHT when project has no status", () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID }],
      items: [
        { ...validItem(), projectId: PROJECT_UUID, type: "current" as const },
      ],
    };
    const errors = validateSubmitInput(section, input as SubmitSectionPayload);
    expect(errors.some((e) => e.code === "MISSING_TRAFFIC_LIGHT")).toBe(true);
  });

  it("returns MISSING_CURRENT_ITEM when project has no current items", () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: "green" as const }],
      items: [],
    };
    const errors = validateSubmitInput(section, input as SubmitSectionPayload);
    expect(errors.some((e) => e.code === "MISSING_CURRENT_ITEM")).toBe(true);
  });

  it("returns no errors for valid input", () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: "green" as const }],
      items: [
        { ...validItem(), projectId: PROJECT_UUID, type: "current" as const },
      ],
    };
    const errors = validateSubmitInput(section, input as SubmitSectionPayload);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Group 14: periodStatusSchema (v4.0)
// ---------------------------------------------------------------------------

describe("periodStatusSchema", () => {
  it('accepts "open"', () => {
    expect(periodStatusSchema.safeParse("open").success).toBe(true);
  });

  it('accepts "published"', () => {
    expect(periodStatusSchema.safeParse("published").success).toBe(true);
  });

  it('accepts "reopened"', () => {
    expect(periodStatusSchema.safeParse("reopened").success).toBe(true);
  });

  it('rejects unknown value "closed"', () => {
    expect(periodStatusSchema.safeParse("closed").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(periodStatusSchema.safeParse("").success).toBe(false);
  });

  it("rejects null", () => {
    expect(periodStatusSchema.safeParse(null).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 14b: periodStateSchema (UFB-053 / Phase 51-C)
// ---------------------------------------------------------------------------

describe("periodStateSchema (UFB-053)", () => {
  it('accepts "scheduled"', () => {
    expect(periodStateSchema.safeParse("scheduled").success).toBe(true);
  });

  it('accepts "open"', () => {
    expect(periodStateSchema.safeParse("open").success).toBe(true);
  });

  it('accepts "published"', () => {
    expect(periodStateSchema.safeParse("published").success).toBe(true);
  });

  it('accepts "archived"', () => {
    expect(periodStateSchema.safeParse("archived").success).toBe(true);
  });

  it('rejects "reopened" (lives on periodStatusSchema, not periodStateSchema)', () => {
    expect(periodStateSchema.safeParse("reopened").success).toBe(false);
  });

  it("rejects unknown value", () => {
    expect(periodStateSchema.safeParse("closed").success).toBe(false);
  });

  it("rejects screaming-snake casing", () => {
    expect(periodStateSchema.safeParse("OPEN").success).toBe(false);
  });

  it("reportPeriodSchema: periodState is optional (back-compat)", () => {
    const parsed = reportPeriodSchema.safeParse({
      id: randomUUID(),
      periodStart: "2026-05-11",
      periodEnd: "2026-05-17",
      deadline: "2026-05-15",
      status: "draft",
    });
    expect(parsed.success).toBe(true);
  });

  it("reportPeriodSchema: periodState carries through when supplied", () => {
    const parsed = reportPeriodSchema.parse({
      id: randomUUID(),
      periodStart: "2026-05-11",
      periodEnd: "2026-05-17",
      deadline: "2026-05-15",
      status: "draft",
      periodState: "open",
    });
    expect(parsed.periodState).toBe("open");
  });

  it("reportPeriodSchema: the full governed lifecycle set is optional (back-compat)", () => {
    // fix-snapshot-lifecycle-restore: a legacy snapshot (only the date
    // envelope + status) must still parse so old admin exports restore.
    const parsed = reportPeriodSchema.safeParse({
      id: randomUUID(),
      periodStart: "2026-05-11",
      periodEnd: "2026-05-17",
      deadline: "2026-05-15",
      status: "published",
    });
    expect(parsed.success).toBe(true);
  });

  it("reportPeriodSchema: the full governed lifecycle set carries through", () => {
    // fix-snapshot-lifecycle-restore: a reopened period keeps three distinct
    // values; the schema must round-trip them verbatim.
    const parsed = reportPeriodSchema.parse({
      id: randomUUID(),
      periodStart: "2026-05-11",
      periodEnd: "2026-05-17",
      deadline: "2026-05-15",
      status: "published",
      periodState: "open",
      periodStatus: "reopened",
      archived: false,
      autoPublished: true,
      autoArchived: false,
      publishedAt: "2026-05-16T10:00:00.000Z",
      publishedById: randomUUID(),
      reopenedAt: "2026-05-18T09:00:00.000Z",
    });
    expect(parsed.periodState).toBe("open");
    expect(parsed.periodStatus).toBe("reopened");
    expect(parsed.status).toBe("published");
    expect(parsed.autoPublished).toBe(true);
    expect(parsed.publishedAt).toBeInstanceOf(Date);
    expect(parsed.reopenedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Group 14c: periodListBucketSchema + periodListItemSchema (UFB-052 / Phase 51-B)
// ---------------------------------------------------------------------------

describe("periodListBucketSchema (UFB-052)", () => {
  it.each([
    "active",
    "archive",
    "scheduled",
    "open",
    "published",
    "archived",
  ])("accepts %s", (bucket) => {
    expect(periodListBucketSchema.safeParse(bucket).success).toBe(true);
  });

  it('rejects "reopened" (not a state, lives on periodStatus)', () => {
    expect(periodListBucketSchema.safeParse("reopened").success).toBe(false);
  });

  it("rejects unknown bucket", () => {
    expect(periodListBucketSchema.safeParse("all").success).toBe(false);
  });
});

describe("periodListItemSchema (UFB-052)", () => {
  const baseRow = {
    id: randomUUID(),
    periodStart: "2026-05-11",
    periodEnd: "2026-05-17",
    deadline: "2026-05-15",
    publishedAt: null,
    periodState: "open" as const,
    periodStatus: "open" as const,
    archived: false,
    autoPublished: false,
    autoArchived: false,
    submittedCount: 3,
    totalCount: 6,
    canReopen: false,
    canArchive: false,
  };

  it("accepts a minimally-valid active row", () => {
    expect(periodListItemSchema.safeParse(baseRow).success).toBe(true);
  });

  it("coerces publishedAt from ISO string to Date", () => {
    const parsed = periodListItemSchema.parse({
      ...baseRow,
      periodState: "published",
      periodStatus: "published",
      publishedAt: "2026-05-15T10:00:00Z",
      canReopen: true,
      canArchive: true,
    });
    expect(parsed.publishedAt).toBeInstanceOf(Date);
  });

  it("rejects negative submittedCount", () => {
    const parsed = periodListItemSchema.safeParse({
      ...baseRow,
      submittedCount: -1,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects "reopened" on periodState (but accepts on periodStatus)', () => {
    expect(
      periodListItemSchema.safeParse({ ...baseRow, periodState: "reopened" })
        .success,
    ).toBe(false);
    expect(
      periodListItemSchema.safeParse({ ...baseRow, periodStatus: "reopened" })
        .success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 15: stageSchema (v4.0 D-63)
// ---------------------------------------------------------------------------

describe("stageSchema", () => {
  it("accepts valid stage", () => {
    const result = stageSchema.safeParse({
      id: uuid(),
      name: "Development",
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = stageSchema.safeParse({
      id: uuid(),
      name: "",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = stageSchema.safeParse({
      id: uuid(),
      name: "Testing",
      sortOrder: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sortOrder", () => {
    const result = stageSchema.safeParse({
      id: uuid(),
      name: "Testing",
      sortOrder: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID id", () => {
    const result = stageSchema.safeParse({
      id: "not-a-uuid",
      name: "Dev",
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 16: stageAssignmentSchema (v4.0 D-63)
// ---------------------------------------------------------------------------

describe("stageAssignmentSchema", () => {
  it("accepts valid assignment with all fields", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      userId: uuid(),
      stageId: uuid(),
      projectId: uuid(),
      stageName: "Development",
      userName: "Alice",
    });
    expect(result.success).toBe(true);
  });

  it("accepts assignment without optional userName", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      userId: uuid(),
      stageId: uuid(),
      projectId: uuid(),
      stageName: "Testing",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty stageName", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      userId: uuid(),
      stageId: uuid(),
      projectId: uuid(),
      stageName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID userId", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      userId: "not-uuid",
      stageId: uuid(),
      projectId: uuid(),
      stageName: "Dev",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = stageAssignmentSchema.safeParse({
      id: uuid(),
      stageName: "Dev",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 17: versionSnapshotSchema (v4.0 D-67)
// ---------------------------------------------------------------------------

describe("versionSnapshotSchema", () => {
  it("accepts valid version snapshot", () => {
    const result = versionSnapshotSchema.safeParse({
      id: uuid(),
      reportSectionId: uuid(),
      version: 1,
      createdAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("coerces string date to Date", () => {
    const result = versionSnapshotSchema.safeParse({
      id: uuid(),
      reportSectionId: uuid(),
      version: 3,
      createdAt: "2026-04-20T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
    }
  });

  it("rejects version 0 (must be positive)", () => {
    const result = versionSnapshotSchema.safeParse({
      id: uuid(),
      reportSectionId: uuid(),
      version: 0,
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative version", () => {
    const result = versionSnapshotSchema.safeParse({
      id: uuid(),
      reportSectionId: uuid(),
      version: -1,
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = versionSnapshotSchema.safeParse({
      id: uuid(),
      reportSectionId: uuid(),
      version: 1.5,
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID reportSectionId", () => {
    const result = versionSnapshotSchema.safeParse({
      id: uuid(),
      reportSectionId: "not-uuid",
      version: 1,
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 18: appSettingsSchema (v4.0 D-68)
// ---------------------------------------------------------------------------

describe("appSettingsSchema", () => {
  it("accepts valid settings", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects defaultDeadlineDays below 1", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: true,
      defaultDeadlineDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects defaultDeadlineDays above 30", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: true,
      defaultDeadlineDays: 31,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean autoCreatePeriods", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: "yes",
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts max boundary values", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: true,
      defaultDeadlineDays: 30,
    });
    expect(result.success).toBe(true);
  });

  // -------------------------------------------------------------------
  // UFB-048 (Phase 48-B): 9 new configurable fields. Each has `.default()`
  // so the original 2-key fixture above still parses; these tests assert
  // the defaults are applied AND that the new constraints reject garbage.
  // (Phase 49-01: legacy `departmentName` field removed from this schema.)
  // -------------------------------------------------------------------

  it("UFB-048: applies defaults for the 9 new fields when omitted", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.periodLengthDays).toBe(7);
    expect(result.data.workingDays).toBe("mon-fri");
    expect(result.data.gracePeriodHours).toBe(24);
    expect(result.data.defaultTimezone).toBe("Europe/Moscow");
    expect(result.data.defaultReminderAudience).toBe("lead-with-draft");
    expect(result.data.notificationFromEmail).toBeNull();
    expect(result.data.allowLateSubmissions).toBe(true);
    expect(result.data.autoPublishAfterDeadline).toBe(false);
    expect(result.data.autoArchiveWeeksAfterPublish).toBe(0);
  });

  it("UFB-048: rejects periodLengthDays out of [1..31]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        periodLengthDays: 0,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        periodLengthDays: 32,
      }).success,
    ).toBe(false);
  });

  it("UFB-048: rejects unknown workingDays enum value", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        workingDays: "mon-thu",
      }).success,
    ).toBe(false);
  });

  it("UFB-048: rejects gracePeriodHours out of [0..168]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        gracePeriodHours: -1,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        gracePeriodHours: 169,
      }).success,
    ).toBe(false);
  });

  it("UFB-048: rejects autoArchiveWeeksAfterPublish > 52", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        autoArchiveWeeksAfterPublish: 53,
      }).success,
    ).toBe(false);
  });

  it("UFB-048: accepts notificationFromEmail null and a valid address", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: null,
      }).success,
    ).toBe(true);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: "reports@example.com",
      }).success,
    ).toBe(true);
  });

  it("UFB-048: rejects malformed notificationFromEmail", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("UFB-048: rejects unknown defaultReminderAudience", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        defaultReminderAudience: "everyone",
      }).success,
    ).toBe(false);
  });

  // -------------------------------------------------------------------
  // UFB-051 (Phase 51-A): 8 new period-cycle fields on AppSettings.
  // Same pattern as the 48-B block above — each has `.default()` so
  // partial PATCH payloads keep working and constraints reject garbage.
  // -------------------------------------------------------------------

  it("UFB-051: applies defaults for the 8 new period-cycle fields when omitted", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.firstDayOfWeek).toBe(1);
    expect(result.data.deadlineDayOfWeek).toBe(5);
    expect(result.data.deadlineTime).toBe("18:00");
    expect(result.data.maxOpenPeriods).toBe(1);
    expect(result.data.requireAllSectionsToPublish).toBe(true);
    expect(result.data.allowReopenAfterPublish).toBe(true);
    expect(result.data.reopenWindowHours).toBe(72);
  });

  it("UFB-051: rejects firstDayOfWeek out of [1..7]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        firstDayOfWeek: 0,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        firstDayOfWeek: 8,
      }).success,
    ).toBe(false);
  });

  it("UFB-051: rejects deadlineDayOfWeek out of [1..7]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineDayOfWeek: 0,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineDayOfWeek: 8,
      }).success,
    ).toBe(false);
  });

  it("UFB-051: rejects malformed deadlineTime (must be HH:MM 24h)", () => {
    // Hour out of range
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "25:00",
      }).success,
    ).toBe(false);
    // Missing leading zero
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "9:30",
      }).success,
    ).toBe(false);
    // Garbage
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "noon",
      }).success,
    ).toBe(false);
    // Valid corner cases pass
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "00:00",
      }).success,
    ).toBe(true);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        deadlineTime: "23:59",
      }).success,
    ).toBe(true);
  });

  // UFB-068: periodCadence removed — no validation test needed.

  it("UFB-051: rejects maxOpenPeriods out of [1..12]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        maxOpenPeriods: 0,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        maxOpenPeriods: 13,
      }).success,
    ).toBe(false);
  });

  it("UFB-051: rejects reopenWindowHours out of [0..168]", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        reopenWindowHours: -1,
      }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        reopenWindowHours: 169,
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 19: appSettingsUpdateSchema (partial)
// ---------------------------------------------------------------------------

describe("appSettingsUpdateSchema", () => {
  it("accepts partial update with one field", () => {
    const result = appSettingsUpdateSchema.safeParse({
      defaultDeadlineDays: 7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no fields)", () => {
    const result = appSettingsUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates field constraints on partial", () => {
    const result = appSettingsUpdateSchema.safeParse({
      defaultDeadlineDays: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 20: weeklyReportReadModelSchema (v4.0 D-58)
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
// Group 21: portfolioProductOverviewSchema
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
// Group 22: escalationSchema
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
// UFB-054 (Phase 56): GroupProduct schemas
// ---------------------------------------------------------------------------

describe("groupProductSchema (UFB-054)", () => {
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

describe("groupProductEdgeInputSchema (UFB-054)", () => {
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
      versionCount: 2,
      latestVersion: 2,
      latestVersionAt: "2026-05-15T17:33:11.222Z",
      trafficLights: { green: 2, yellow: 0, red: 1 },
    });

    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.lastEditAt).toBeInstanceOf(Date);
    expect(parsed.latestVersionAt).toBeInstanceOf(Date);
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

describe("compiledHistoryResultSchema", () => {
  it("requires a non-negative archiveCount", () => {
    const parsed = compiledHistoryResultSchema.parse({
      entries: [],
      archiveCount: 4,
    });

    expect(parsed.archiveCount).toBe(4);
  });
});
