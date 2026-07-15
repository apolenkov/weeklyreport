import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";
import { z } from "zod";

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
  decisionWriteSchema,
  type DraftSaveInput,
  draftSaveSchema,
  escalationSchema,
  groupProductEdgeInputSchema,
  groupProductSchema,
  itemInputSchema,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  itemWriteSchema,
  myHistoryEntrySchema,
  periodListBucketSchema,
  periodListItemSchema,
  periodStateSchema,
  periodStatusSchema,
  portfolioOverviewSchema,
  portfolioProductOverviewSchema,
  projectStatusInputSchema,
  reportPeriodSchema,
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  reportSectionStatusSchema,
  reportStatusSchema,
  riskInputSchema,
  riskSeveritySchema,
  riskWriteSchema,
  safeText,
  stageAssignmentSchema,
  stageSchema,
  type SubmitSectionPayload,
  submitSectionSchema,
  trafficLightStatusSchema,
  validateRecordActivityIds,
  validateSubmitInput,
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
  // enforce-item-decision-stage-schema: stageIds is required (min 1) on write.
  stageIds: ["Development"],
});

const validRisk = () => ({
  projectId: uuid(),
  risk: "Deadline may slip",
  impact: "Revenue loss",
  mitigation: "Hire contractor",
  // require-risk-stage: stageIds is required (min 1) on the write contract.
  stageIds: ["Development"],
});

const validDecision = () => ({
  // activity-first-class XOR parent: a decision is product- or activity-parented.
  // The DB has always required a parent (productId was NOT NULL); the fixture now
  // sets one so the write-path XOR superRefine accepts it.
  productId: uuid(),
  text: "Upgrade to PostgreSQL 16",
  owner: "Alice",
  impact: "Better performance",
  // enforce-item-decision-stage-schema: stageIds is required (min 1) on write.
  stageIds: ["Development"],
});

const validDraft = () => ({
  reportSectionId: uuid(),
  version: 1,
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

const makeProjectStatuses = (count: number) =>
  Array.from({ length: count }, () => ({
    projectId: uuid(),
    status: "green" as const,
  }));

const makeStageStatuses = (count: number) =>
  Array.from({ length: count }, () => ({
    projectId: uuid(),
    stageId: uuid(),
    status: "green" as const,
  }));

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

  it("accepts projectStatuses array with 100 elements (at boundary)", () => {
    const draft = {
      ...validDraft(),
      projectStatuses: makeProjectStatuses(100),
    };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it("rejects projectStatuses array with 101 elements", () => {
    const draft = {
      ...validDraft(),
      projectStatuses: makeProjectStatuses(101),
    };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(false);
  });

  it("accepts stageStatuses array with 100 elements (at boundary)", () => {
    const draft = { ...validDraft(), stageStatuses: makeStageStatuses(100) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it("rejects stageStatuses array with 101 elements", () => {
    const draft = { ...validDraft(), stageStatuses: makeStageStatuses(101) };
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

  it("rejects submitted status on a draft save", () => {
    const result = draftSaveSchema.safeParse({
      ...validDraft(),
      status: "submitted",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// itemWriteSchema — per-type progress vocabulary (rework-item-status-model)
// ---------------------------------------------------------------------------

describe("itemWriteSchema — per-type progress vocabulary", () => {
  const currentLegal = ["in_progress", "paused", "done"] as const;
  const nextLegal = ["planned", "postponed"] as const;

  it.each(currentLegal)("accepts %s on a current item", (status) => {
    const item = { ...validItem(), workflowStatus: status };
    expect(itemWriteSchema.safeParse(item).success).toBe(true);
  });

  it.each(nextLegal)("accepts %s on a next item", (status) => {
    const item = {
      ...validItem(),
      type: "next" as const,
      workflowStatus: status,
    };
    expect(itemWriteSchema.safeParse(item).success).toBe(true);
  });

  it.each(nextLegal)(
    "rejects next-only status %s on a current item",
    (status) => {
      const item = { ...validItem(), workflowStatus: status };
      expect(itemWriteSchema.safeParse(item).success).toBe(false);
    },
  );

  it.each(currentLegal)(
    "rejects current-only status %s on a next item",
    (status) => {
      const item = {
        ...validItem(),
        type: "next" as const,
        workflowStatus: status,
      };
      expect(itemWriteSchema.safeParse(item).success).toBe(false);
    },
  );

  it("blocked is not representable at all", () => {
    const item = { ...validItem(), workflowStatus: "blocked" };
    expect(itemWriteSchema.safeParse(item).success).toBe(false);
  });

  it("the completed flag is gone from the input schema", () => {
    const parsed = itemInputSchema.safeParse({
      ...validItem(),
      completed: true,
    });
    // Unknown keys are stripped, never round-tripped.
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("completed" in parsed.data).toBe(false);
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

  it(String.raw`rejects item text containing null byte \u0000`, () => {
    const item = { ...validItem(), text: "Hello\u0000World" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must not contain null bytes");
    }
  });

  it(
    String.raw`rejects item text that is only zero-width spaces \u200B`,
    () => {
      const item = { ...validItem(), text: "\u200B\u200B\u200B" };
      const result = itemInputSchema.safeParse(item);
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("Text must contain visible characters");
      }
    },
  );

  it("accepts item text with zero-width space mixed with real text", () => {
    const item = { ...validItem(), text: "\u200BHello" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("rejects item text that is only whitespace", () => {
    const item = { ...validItem(), text: " ".repeat(3) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it(String.raw`rejects item text that is only \uFEFF (BOM)`, () => {
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
// Group 3b: require-risk-stage + enforce-item-decision-stage-schema \u2014 risks,
// items, AND decisions must each carry \u22651 concrete SDLC stage on the write
// path; the read model stays tolerant of stage-less legacy rows (rendered as a
// loud "No stage set" warning).
// ---------------------------------------------------------------------------

describe("riskInputSchema \u2014 required stageIds (require-risk-stage)", () => {
  it("rejects a risk with missing stageIds", () => {
    const { stageIds: _stageIds, ...riskWithoutStages } = validRisk();
    const result = riskWriteSchema.safeParse(riskWithoutStages);
    expect(result.success).toBe(false);
  });

  it("rejects a risk with empty stageIds", () => {
    const result = riskWriteSchema.safeParse({ ...validRisk(), stageIds: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a risk with one concrete stage", () => {
    const result = riskInputSchema.safeParse({
      ...validRisk(),
      stageIds: ["Testing"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a draft-save payload containing a stage-less risk", () => {
    const { stageIds: _stageIds, ...riskWithoutStages } = validRisk();
    const result = draftSaveSchema.safeParse({
      ...validDraft(),
      risks: [riskWithoutStages],
    });
    expect(result.success).toBe(false);
  });

  // enforce-item-decision-stage-schema: items + decisions now match risks —
  // a stage-less write is rejected; only the read model stays tolerant.
  it("rejects an item with missing stageIds", () => {
    const { stageIds: _stageIds, ...itemWithoutStages } = validItem();
    const result = itemWriteSchema.safeParse(itemWithoutStages);
    expect(result.success).toBe(false);
  });

  it("rejects an item with empty stageIds", () => {
    const result = itemWriteSchema.safeParse({ ...validItem(), stageIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a decision with missing stageIds", () => {
    const { stageIds: _stageIds, ...decisionWithoutStages } = validDecision();
    const result = decisionWriteSchema.safeParse(decisionWithoutStages);
    expect(result.success).toBe(false);
  });

  it("rejects a decision with empty stageIds", () => {
    const result = decisionWriteSchema.safeParse({
      ...validDecision(),
      stageIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a draft-save payload containing a stage-less item or decision", () => {
    const { stageIds: _i, ...itemWithoutStages } = validItem();
    const { stageIds: _d, ...decisionWithoutStages } = validDecision();
    expect(
      draftSaveSchema.safeParse({
        ...validDraft(),
        items: [itemWithoutStages],
      }).success,
    ).toBe(false);
    expect(
      draftSaveSchema.safeParse({
        ...validDraft(),
        decisions: [decisionWithoutStages],
      }).success,
    ).toBe(false);
  });

  it("read model still parses a stage-less legacy risk row (D2 tolerance)", () => {
    const { stageIds: _stageIds, ...legacyRisk } = validRisk();
    const result = reportSectionReadModelSchema.safeParse({
      reportSectionId: uuid(),
      reportId: uuid(),
      authorId: uuid(),
      authorName: "Test Lead",
      version: 1,
      status: "draft",
      submittedAt: null,
      projects: [],
      items: [],
      risks: [legacyRisk],
      decisions: [],
    });
    expect(result.success).toBe(true);
  });

  it("read model still parses stage-less legacy item and decision rows (tolerance)", () => {
    const { stageIds: _i, ...legacyItem } = {
      ...validItem(),
      projectId: PROJECT_UUID,
    };
    const { stageIds: _d, ...legacyDecision } = validDecision();
    const result = reportSectionReadModelSchema.safeParse({
      reportSectionId: uuid(),
      reportId: uuid(),
      authorId: uuid(),
      authorName: "Test Lead",
      version: 1,
      status: "draft",
      submittedAt: null,
      projects: [],
      items: [legacyItem],
      risks: [],
      decisions: [legacyDecision],
    });
    expect(result.success).toBe(true);
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

  it("rejects submit with no traffic light status", () => {
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

  it("rejects projectStatuses array with 101 elements", () => {
    const submit = {
      ...validSubmit(),
      projectStatuses: makeProjectStatuses(101),
    };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it("rejects activityStatuses array with 101 elements on submit (the extend override must keep the bound)", () => {
    const submit = {
      ...validSubmit(),
      activityStatuses: Array.from({ length: 101 }, () => ({
        activityId: uuid(),
        status: "green" as const,
      })),
    };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it("accepts an activity-only submit with 0 projectStatuses (relaxation)", () => {
    // activity-first-class: submit no longer requires >=1 product status at the
    // schema level — an activity-only section (0 products) submits. The
    // per-product / per-activity status requirement is server-authoritative
    // (validateSubmitInput), not a schema `.min`.
    const submit = { ...validSubmit(), projectStatuses: [] };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(true);
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
    // "amber" exists in this repo only as a Tailwind color token — it has
    // never been a status value (traffic-light-status-type spec).
    expect(trafficLightStatusSchema.safeParse("amber").success).toBe(false);
  });

  it("itemTypeSchema accepts current/next", () => {
    expect(itemTypeSchema.safeParse("current").success).toBe(true);
    expect(itemTypeSchema.safeParse("next").success).toBe(true);
  });

  it("itemTypeSchema rejects unknown value", () => {
    expect(itemTypeSchema.safeParse("previous").success).toBe(false);
  });

  it("itemWorkflowStatusSchema accepts the five progress values", () => {
    for (const status of [
      "planned",
      "in_progress",
      "paused",
      "postponed",
      "done",
    ]) {
      expect(itemWorkflowStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("itemWorkflowStatusSchema rejects alarms and unknowns", () => {
    expect(itemWorkflowStatusSchema.safeParse("blocked").success).toBe(false);
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
// Group 8: carryOverStatusSchema
// ---------------------------------------------------------------------------

describe("carryOverStatusSchema", () => {
  it('accepts "completed"', () => {
    expect(carryOverStatusSchema.safeParse("completed").success).toBe(true);
  });

  // cleanup-dead-enum-states: `pending`/`failed` removed — carry-over is
  // synchronous, the service writes only `completed` (or throws, persisting
  // nothing). The enum collapses to the single live value.
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
// Group 9: Date validation — reportDate()
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
    version: 1,
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
    activities: [],
    ...overrides,
  });

  it("returns SECTION_ALREADY_SUBMITTED for submitted section", () => {
    const section = makeSection({ status: "submitted" });
    const input = validSubmit();
    const errors = validateSubmitInput(section, input);
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
    const errors = validateSubmitInput(section, input);
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
    const errors = validateSubmitInput(section, input);
    expect(errors).toHaveLength(0);
  });

  // activity-first-class: every attached activity must carry a traffic light at
  // submit — server-authoritative (a schema `.min` can't catch an OMITTED entry).
  it("requires a status for every attached activity", () => {
    const activityId = uuid();
    const section = makeSection({
      projects: [],
      activities: [
        {
          activityId,
          activityName: "Ops rotation",
          status: null,
          linkedProducts: [],
          derivedStatus: null,
        },
      ],
    });
    const input = {
      ...validSubmit(),
      projectStatuses: [],
      activityStatuses: [],
      items: [],
      risks: [],
      decisions: [],
    };
    const errors = validateSubmitInput(section, input);
    expect(errors.some((e) => e.code === "MISSING_TRAFFIC_LIGHT")).toBe(true);
  });

  it("passes an activity-only section (0 products) with a status on its activity", () => {
    const activityId = uuid();
    const section = makeSection({
      projects: [],
      activities: [
        {
          activityId,
          activityName: "Ops rotation",
          status: "green",
          linkedProducts: [],
          derivedStatus: "green",
        },
      ],
    });
    const input = {
      ...validSubmit(),
      projectStatuses: [],
      activityStatuses: [{ activityId, status: "green" as const }],
      items: [],
      risks: [],
      decisions: [],
    };
    const errors = validateSubmitInput(section, input);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Group 13b: activity-first-class — XOR parent + conditional stage + activityId
// write guard (validateRecordActivityIds)
// ---------------------------------------------------------------------------

describe("record write schema — XOR parent + conditional stage", () => {
  const activityItem = () => ({
    activityId: uuid(),
    type: "current" as const,
    text: "Rotate on-call",
    tag: "ops",
    workflowStatus: "in_progress" as const,
    stageIds: [] as string[],
  });

  it("accepts a product-parented item (product + >=1 stage)", () => {
    expect(itemWriteSchema.safeParse(validItem()).success).toBe(true);
  });

  it("accepts an activity-parented item (activity + no stage)", () => {
    expect(itemWriteSchema.safeParse(activityItem()).success).toBe(true);
  });

  it("rejects an item with BOTH a product and an activity parent", () => {
    const both = { ...validItem(), activityId: uuid() };
    expect(itemWriteSchema.safeParse(both).success).toBe(false);
  });

  it("rejects an item with NEITHER parent", () => {
    const { projectId: _projectId, ...noParent } = validItem();
    expect(itemWriteSchema.safeParse(noParent).success).toBe(false);
  });

  it("rejects an activity-parented item that carries a stage", () => {
    const withStage = { ...activityItem(), stageIds: ["Development"] };
    expect(itemWriteSchema.safeParse(withStage).success).toBe(false);
  });

  it("applies the same XOR + activity-no-stage rule to risks", () => {
    const activityRisk = {
      activityId: uuid(),
      risk: "On-call fatigue",
      impact: "Slower response",
      mitigation: "Rotate weekly",
      stageIds: [] as string[],
    };
    expect(riskWriteSchema.safeParse(activityRisk).success).toBe(true);
    expect(
      riskWriteSchema.safeParse({ ...activityRisk, stageIds: ["Dev"] }).success,
    ).toBe(false);
  });

  it("gives activities full decision parity (XOR covers Decision)", () => {
    const activityDecision = {
      activityId: uuid(),
      text: "Adopt weekly rotation",
      owner: "Alice",
      impact: "Fairer load",
      stageIds: [] as string[],
    };
    expect(decisionWriteSchema.safeParse(activityDecision).success).toBe(true);
    expect(
      decisionWriteSchema.safeParse({
        ...activityDecision,
        productId: uuid(),
      }).success,
    ).toBe(false);
  });
});

describe("validateRecordActivityIds", () => {
  const attachedId = uuid();
  const section = {
    activities: [
      {
        activityId: attachedId,
        activityName: "Ops rotation",
        status: null,
        linkedProducts: [],
        derivedStatus: null,
      },
    ],
    items: [],
    risks: [],
    decisions: [],
  } as unknown as ReportSectionReadModel;

  const withActivityItem = (activityId: string): DraftSaveInput =>
    ({
      ...validDraft(),
      items: [
        {
          ...validItem(),
          projectId: undefined,
          activityId,
          stageIds: [],
        },
      ],
    }) as unknown as DraftSaveInput;

  it("rejects a record whose activityId is not attached to the section", () => {
    const errors = validateRecordActivityIds(section, withActivityItem(uuid()));
    expect(errors.some((e) => e.code === "ACTIVITY_NOT_ATTACHED")).toBe(true);
  });

  it("accepts a record parented to an attached activity", () => {
    const errors = validateRecordActivityIds(
      section,
      withActivityItem(attachedId),
    );
    expect(errors).toHaveLength(0);
  });

  it("ignores product-parented records (null activityId)", () => {
    const errors = validateRecordActivityIds(
      section,
      validDraft() as unknown as DraftSaveInput,
    );
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
// Group 14b: periodStateSchema
// ---------------------------------------------------------------------------

describe("periodStateSchema", () => {
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
// Group 14c: periodListBucketSchema + periodListItemSchema
// ---------------------------------------------------------------------------

describe("periodListBucketSchema", () => {
  it.each(["active", "archive", "scheduled", "open", "published", "archived"])(
    "accepts %s",
    (bucket) => {
      expect(periodListBucketSchema.safeParse(bucket).success).toBe(true);
    },
  );

  it('rejects "reopened" (not a state, lives on periodStatus)', () => {
    expect(periodListBucketSchema.safeParse("reopened").success).toBe(false);
  });

  it("rejects unknown bucket", () => {
    expect(periodListBucketSchema.safeParse("all").success).toBe(false);
  });
});

describe("periodListItemSchema", () => {
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
  // 9 new configurable fields. Each has `.default()` so the original
  // 2-key fixture above still parses; these tests assert the defaults
  // are applied AND that the new constraints reject garbage.
  // (Legacy `departmentName` field removed from this schema.)
  // -------------------------------------------------------------------

  it("applies defaults for the 9 new fields when omitted", () => {
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

  it("rejects periodLengthDays out of [1..31]", () => {
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

  it("rejects unknown workingDays enum value", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        workingDays: "mon-thu",
      }).success,
    ).toBe(false);
  });

  it("rejects gracePeriodHours out of [0..168]", () => {
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

  it("rejects autoArchiveWeeksAfterPublish > 52", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        autoArchiveWeeksAfterPublish: 53,
      }).success,
    ).toBe(false);
  });

  it("accepts notificationFromEmail null and a valid address", () => {
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

  it("rejects malformed notificationFromEmail", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        notificationFromEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown defaultReminderAudience", () => {
    expect(
      appSettingsSchema.safeParse({
        autoCreatePeriods: false,
        defaultDeadlineDays: 5,
        defaultReminderAudience: "everyone",
      }).success,
    ).toBe(false);
  });

  // -------------------------------------------------------------------
  // 8 new period-cycle fields on AppSettings. Same pattern as the block
  // above — each has `.default()` so partial PATCH payloads keep working
  // and constraints reject garbage.
  // -------------------------------------------------------------------

  it("applies defaults for the period-cycle fields when omitted", () => {
    const result = appSettingsSchema.safeParse({
      autoCreatePeriods: false,
      defaultDeadlineDays: 5,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.deadlineTime).toBe("18:00");
    expect(result.data.allowReopenAfterPublish).toBe(true);
    expect(result.data.reopenWindowHours).toBe(72);
  });

  it("rejects malformed deadlineTime (must be HH:MM 24h)", () => {
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

  // periodCadence removed — no validation test needed.
  // firstDayOfWeek / deadlineDayOfWeek / maxOpenPeriods /
  // requireAllSectionsToPublish removed — bounds tests dropped.

  it("rejects reopenWindowHours out of [0..168]", () => {
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

  it("omits unifiedActivityView from the parsed output when the key is absent", () => {
    // Guards the Zod-4 `.partial()`-keeps-defaults hazard: an update that does
    // not mention the flag must not materialize `false`, or the write path
    // (persists any non-undefined key) would reset a department that enabled it.
    const parsed = appSettingsUpdateSchema.parse({ defaultDeadlineDays: 7 });
    expect("unifiedActivityView" in parsed).toBe(false);
    expect(parsed.unifiedActivityView).toBeUndefined();
  });

  it("keeps an explicit unifiedActivityView value", () => {
    expect(
      appSettingsUpdateSchema.parse({ unifiedActivityView: false })
        .unifiedActivityView,
    ).toBe(false);
    expect(
      appSettingsUpdateSchema.parse({ unifiedActivityView: true })
        .unifiedActivityView,
    ).toBe(true);
  });

  // Every field carrying a Zod `.default()` must be ABSENT from a partial parse
  // that omits it — otherwise the write path (persists any non-undefined key)
  // silently resets an unspecified setting. Hardcoded (not derived from
  // `.shape`) so this guard shares no logic with the schema's strip helper and
  // stays a real oracle rather than a tautology.
  const DEFAULTED_FIELDS = [
    "periodLengthDays",
    "workingDays",
    "gracePeriodHours",
    "allowLateSubmissions",
    "autoPublishAfterDeadline",
    "autoArchiveWeeksAfterPublish",
    "defaultTimezone",
    "defaultReminderAudience",
    "notificationFromEmail",
    "deadlineTime",
    "allowReopenAfterPublish",
    "reopenWindowHours",
    "unifiedActivityView",
  ] as const;

  it("omits every defaulted field from a partial parse that does not mention it", () => {
    const parsed = appSettingsUpdateSchema.parse({ defaultDeadlineDays: 7 });
    for (const field of DEFAULTED_FIELDS) {
      expect(field in parsed).toBe(false);
    }
  });

  it("tripwire: the hardcoded defaulted-field list matches the schema", () => {
    const actual = Object.entries(appSettingsSchema.shape)
      .filter(([, field]) => field instanceof z.ZodDefault)
      .map(([key]) => key)
      .sort();
    expect(actual).toEqual([...DEFAULTED_FIELDS].sort());
  });

  it("keeps explicit values for defaulted fields and still enforces constraints", () => {
    expect(
      appSettingsUpdateSchema.parse({ periodLengthDays: 14 }).periodLengthDays,
    ).toBe(14);
    expect(
      appSettingsUpdateSchema.parse({ notificationFromEmail: null })
        .notificationFromEmail,
    ).toBeNull();
    expect(
      appSettingsUpdateSchema.safeParse({ periodLengthDays: 0 }).success,
    ).toBe(false);
    expect(
      appSettingsUpdateSchema.safeParse({ deadlineTime: "25:00" }).success,
    ).toBe(false);
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
// Group 21: safeText — noInvisibleOnly validator (verify-a11y-recommended-flip)
//
// Targets the regex refactor in report-primitives.schema.ts that changed
// /[\s​‌‍﻿]/g to the alternation /\s|​|‌|‍|﻿/gu. Tests guard against
// single-character escapes slipping through a broken alternation pattern.
// ---------------------------------------------------------------------------

describe("safeText — noInvisibleOnly", () => {
  it("rejects a whitespace-only string (spaces)", () => {
    const result = safeText().safeParse(" ".repeat(3));
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must contain visible characters");
    }
  });

  it("accepts a single visible character", () => {
    const result = safeText().safeParse("A");
    expect(result.success).toBe(true);
  });

  it(
    String.raw`rejects a string containing only \u200B (zero-width space)`,
    () => {
      const result = safeText().safeParse("​");
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("Text must contain visible characters");
      }
    },
  );

  it(
    String.raw`rejects a string containing only \u200C (zero-width non-joiner)`,
    () => {
      // Regression guard: alternation /\s|​|‌|‍|﻿/gu must
      // match ‌ in isolation (broken char-class would miss it).
      const result = safeText().safeParse("‌");
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("Text must contain visible characters");
      }
    },
  );

  it(
    String.raw`rejects a string containing only \u200D (zero-width joiner)`,
    () => {
      // Regression guard: same alternation must also strip ‍ in isolation.
      const result = safeText().safeParse("‍");
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("Text must contain visible characters");
      }
    },
  );

  it(
    String.raw`rejects a string containing only \uFEFF (zero-width no-break space / BOM)`,
    () => {
      const result = safeText().safeParse("﻿");
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("Text must contain visible characters");
      }
    },
  );

  it("rejects a string with only tabs, newlines, and carriage returns", () => {
    const result = safeText().safeParse("\t\n\r");
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must contain visible characters");
    }
  });

  it("rejects a mixed-invisible string (whitespace + zero-width chars)", () => {
    const result = safeText().safeParse(" ​‌‍﻿\t");
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must contain visible characters");
    }
  });

  it("accepts visible text with embedded whitespace ('hello world')", () => {
    const result = safeText().safeParse("hello world");
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 22: schema-level invisible-only rejection gap-fills
// (rows from verify-a11y-recommended-flip that were not yet covered)
//
// Note: catalog names fields "description"/"title"/"rationale" but the actual
// schema fields are riskInputSchema.risk/impact/mitigation and
// decisionInputSchema.text/owner/impact — tests use real field names.
// ---------------------------------------------------------------------------

describe("riskInputSchema — invisible-only gap-fills", () => {
  it("rejects risk.impact containing only whitespace", () => {
    const risk = { ...validRisk(), impact: " ".repeat(3) };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must contain visible characters");
    }
  });

  it("rejects risk.mitigation containing only whitespace", () => {
    const risk = { ...validRisk(), mitigation: " ".repeat(3) };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must contain visible characters");
    }
  });
});

describe("decisionInputSchema — invisible-only gap-fills", () => {
  it("rejects decision.text (title field) containing only whitespace", () => {
    const d = { ...validDecision(), text: " ".repeat(3) };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must contain visible characters");
    }
  });

  it("rejects decision.impact (rationale field) containing only whitespace", () => {
    const d = { ...validDecision(), impact: " ".repeat(3) };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must contain visible characters");
    }
  });
});
