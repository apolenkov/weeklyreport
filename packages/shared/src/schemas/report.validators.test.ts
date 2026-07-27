import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decisionWriteSchema,
  type DraftSaveInput,
  itemWriteSchema,
  type ReportSectionReadModel,
  riskWriteSchema,
  type SubmitSectionPayload,
  validateRecordActivityIds,
  validateSubmitInput,
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
  // stageIds is required (min 1) on the write contract.
  stageIds: ["Development"],
});

const validRisk = () => ({
  projectId: uuid(),
  risk: "Deadline may slip",
  impact: "Revenue loss",
  mitigation: "Hire contractor",
  // severity is required (no default) on the write contract.
  severity: "at-risk" as const,
  // stageIds is required (min 1) on the write contract.
  stageIds: ["Development"],
});

const validDecision = () => ({
  // XOR parent: a decision is product- or activity-parented. The fixture sets
  // a product so the write-path XOR superRefine accepts it.
  productId: uuid(),
  text: "Upgrade to PostgreSQL 16",
  owner: "Alice",
  impact: "Better performance",
  // stageIds is required (min 1) on the write contract.
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

// ---------------------------------------------------------------------------
// draftSaveSchema boundaries
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
    expect(errors[0]?.code).toBe("SECTION_ALREADY_SUBMITTED");
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

  // Every attached activity must carry a traffic light at submit —
  // server-authoritative (a schema `.min` can't catch an OMITTED entry).
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
// XOR parent + conditional stage + activityId write guard
// (validateRecordActivityIds)
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
      severity: "at-risk" as const,
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
// periodStatusSchema
// ---------------------------------------------------------------------------
