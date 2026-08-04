import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decisionWriteSchema,
  type DraftSaveInput,
  itemWriteSchema,
  reportSectionReadModelSchema,
  riskWriteSchema,
  validateRecordActivityIds,
} from "./report";

const uuid = () => randomUUID();
const attachedActivityId = uuid();

const validItem = () => ({
  projectId: uuid(),
  type: "current" as const,
  text: "Ship feature X",
  tag: "feature",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  stageNames: ["Development"],
});

const activityItem = () => ({
  activityId: uuid(),
  type: "current" as const,
  text: "Rotate on-call",
  tag: "ops",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  stageNames: [] as string[],
});

const validDraft = (): DraftSaveInput => ({
  reportSectionId: uuid(),
  version: 1,
  status: "draft",
  projectStatuses: [],
  stageStatuses: [],
  activityStatuses: [],
  items: [validItem()],
  risks: [],
  decisions: [],
});

const section = reportSectionReadModelSchema.parse({
  reportSectionId: uuid(),
  reportId: uuid(),
  authorId: uuid(),
  authorName: "Test Lead",
  authorRole: "lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  late: false,
  projects: [],
  referencedProjects: [],
  items: [],
  risks: [],
  decisions: [],
  activities: [
    {
      activityId: attachedActivityId,
      activityName: "Ops rotation",
      status: null,
      linkedProducts: [],
      derivedStatus: null,
      alarmFloor: null,
    },
  ],
  reviews: [],
});

const withActivityItem = (activityId: string): DraftSaveInput => ({
  ...validDraft(),
  items: [
    {
      ...validItem(),
      projectId: undefined,
      activityId,
      stageNames: [],
    },
  ],
});

describe("record write parent validation", () => {
  it("accepts a product-parented item with a stage", () => {
    expect(itemWriteSchema.safeParse(validItem()).success).toBe(true);
  });

  it("accepts an activity-parented item without a stage", () => {
    expect(itemWriteSchema.safeParse(activityItem()).success).toBe(true);
  });

  it("rejects an item with both parent types", () => {
    expect(
      itemWriteSchema.safeParse({ ...validItem(), activityId: uuid() }).success,
    ).toBe(false);
  });

  it("rejects an item without a parent", () => {
    const { projectId: _projectId, ...itemWithoutParent } = validItem();
    expect(itemWriteSchema.safeParse(itemWithoutParent).success).toBe(false);
  });

  it("rejects an activity-parented item with a stage", () => {
    expect(
      itemWriteSchema.safeParse({
        ...activityItem(),
        stageNames: ["Development"],
      }).success,
    ).toBe(false);
  });

  it("applies the activity stage rule to risks", () => {
    const risk = {
      activityId: uuid(),
      risk: "On-call fatigue",
      impact: "Slower response",
      mitigation: "Rotate weekly",
      severity: "at-risk" as const,
      stageNames: [] as string[],
    };

    expect(riskWriteSchema.safeParse(risk).success).toBe(true);
    expect(
      riskWriteSchema.safeParse({ ...risk, stageNames: ["Development"] })
        .success,
    ).toBe(false);
  });

  it("applies the parent rule to decisions", () => {
    const decision = {
      activityId: uuid(),
      text: "Adopt weekly rotation",
      owner: "Alice",
      impact: "Fairer load",
      stageNames: [] as string[],
    };

    expect(decisionWriteSchema.safeParse(decision).success).toBe(true);
    expect(
      decisionWriteSchema.safeParse({ ...decision, productId: uuid() }).success,
    ).toBe(false);
  });
});

describe("validateRecordActivityIds", () => {
  it("rejects a record whose activity is not attached", () => {
    const errors = validateRecordActivityIds(section, withActivityItem(uuid()));
    expect(errors.some(({ code }) => code === "ACTIVITY_NOT_ATTACHED")).toBe(
      true,
    );
  });

  it("accepts a record parented to an attached activity", () => {
    expect(
      validateRecordActivityIds(section, withActivityItem(attachedActivityId)),
    ).toHaveLength(0);
  });

  it("ignores product-parented records", () => {
    expect(validateRecordActivityIds(section, validDraft())).toHaveLength(0);
  });
});
