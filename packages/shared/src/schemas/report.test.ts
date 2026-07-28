import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decisionWriteSchema,
  draftSaveSchema,
  itemInputSchema,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  itemWriteSchema,
  reportSectionReadModelSchema,
  reportSectionStatusSchema,
  reportStatusSchema,
  riskInputSchema,
  riskWriteSchema,
  submitSectionSchema,
  trafficLightStatusSchema,
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
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
});

const validRisk = () => ({
  projectId: uuid(),
  risk: "Deadline may slip",
  impact: "Revenue loss",
  mitigation: "Hire contractor",
  // severity is required (no default) on the write contract.
  severity: "at-risk" as const,
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
});

const validDecision = () => ({
  // XOR parent: a decision is product- or activity-parented. The fixture sets
  // a product so the write-path XOR superRefine accepts it.
  productId: uuid(),
  text: "Upgrade to PostgreSQL 16",
  owner: "Alice",
  impact: "Better performance",
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
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
// itemInputSchema — safeText boundaries
// ---------------------------------------------------------------------------

describe("record write schemas — required stageNames", () => {
  it("rejects a risk with missing stageNames", () => {
    const { stageNames: _stageNames, ...riskWithoutStages } = validRisk();
    const result = riskWriteSchema.safeParse(riskWithoutStages);
    expect(result.success).toBe(false);
  });

  it("rejects a risk with empty stageNames", () => {
    const result = riskWriteSchema.safeParse({
      ...validRisk(),
      stageNames: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a risk with one concrete stage", () => {
    const result = riskInputSchema.safeParse({
      ...validRisk(),
      stageNames: ["Testing"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a draft-save payload containing a stage-less risk", () => {
    const { stageNames: _stageNames, ...riskWithoutStages } = validRisk();
    const result = draftSaveSchema.safeParse({
      ...validDraft(),
      risks: [riskWithoutStages],
    });
    expect(result.success).toBe(false);
  });

  // Items + decisions match risks: a stage-less write is rejected; only the
  // read model stays tolerant.
  it("rejects an item with missing stageNames", () => {
    const { stageNames: _stageNames, ...itemWithoutStages } = validItem();
    const result = itemWriteSchema.safeParse(itemWithoutStages);
    expect(result.success).toBe(false);
  });

  it("rejects an item with empty stageNames", () => {
    const result = itemWriteSchema.safeParse({
      ...validItem(),
      stageNames: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a decision with missing stageNames", () => {
    const { stageNames: _stageNames, ...decisionWithoutStages } =
      validDecision();
    const result = decisionWriteSchema.safeParse(decisionWithoutStages);
    expect(result.success).toBe(false);
  });

  it("rejects a decision with empty stageNames", () => {
    const result = decisionWriteSchema.safeParse({
      ...validDecision(),
      stageNames: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a draft-save payload containing a stage-less item or decision", () => {
    const { stageNames: _i, ...itemWithoutStages } = validItem();
    const { stageNames: _d, ...decisionWithoutStages } = validDecision();
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

  it("read model still parses a stage-less legacy risk row", () => {
    const { stageNames: _stageNames, ...legacyRisk } = validRisk();
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
    const { stageNames: _i, ...legacyItem } = {
      ...validItem(),
      projectId: PROJECT_UUID,
    };
    const { stageNames: _d, ...legacyDecision } = validDecision();
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
// decisionInputSchema — safeText
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
    // Submit no longer requires >=1 product status at the schema level — an
    // activity-only section (0 products) submits. The per-product / per-activity
    // status requirement is server-authoritative (validateSubmitInput), not a
    // schema `.min`.
    const submit = { ...validSubmit(), projectStatuses: [] };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// itemInputSchema — priorityRank field
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
// Enum schemas
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
