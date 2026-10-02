import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decisionReadModelSchema,
  decisionWriteSchema,
  type DraftSaveInput,
  itemReadModelSchema,
  itemWriteSchema,
  reportSectionReadModelSchema,
  riskReadModelSchema,
  riskWriteSchema,
  sharedItemReadModelSchema,
  validateRecordActivityIds,
} from "../report.js";

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
      jiraAccounts: [],
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

const issueList = (result: {
  success: boolean;
  error?: {
    issues: { path?: readonly PropertyKey[]; message: string }[];
  };
}) => {
  if (result.success || result.error === undefined) {
    throw new Error("expected the record to fail validation");
  }
  return result.error.issues.map(({ path, message }) => ({ path, message }));
};

// Historical read rows may predate today's write invariants, so read contracts
// stop after the parent XOR issue while write contracts continue into the
// stage-cardinality check. These cases pin the differing issue lists.
describe("read/write parent-stage issue lists", () => {
  const xorMessage =
    "A record must have exactly one parent — a product or an activity.";
  const productStageMessage =
    "A product-parented record requires at least one stage.";
  const activityStageMessage =
    "An activity-parented record must not carry a stage.";

  const decisionBase = () => ({
    productId: uuid(),
    text: "Adopt weekly rotation",
    owner: "Alice",
    impact: "Fairer load",
    stageNames: ["Development"],
  });

  const riskBase = () => ({
    projectId: uuid(),
    risk: "On-call fatigue",
    impact: "Slower response",
    mitigation: "Rotate weekly",
    severity: "at-risk" as const,
    stageNames: ["Development"],
  });

  it.each([
    {
      label: "both parents with a stage",
      record: () => ({ ...validItem(), activityId: uuid() }),
      readIssues: [{ path: ["activityId"], message: xorMessage }],
      writeIssues: [
        { path: ["activityId"], message: xorMessage },
        { path: ["stageNames"], message: activityStageMessage },
      ],
    },
    {
      label: "both parents without a stage",
      record: () => ({ ...validItem(), activityId: uuid(), stageNames: [] }),
      readIssues: [{ path: ["activityId"], message: xorMessage }],
      writeIssues: [
        { path: ["activityId"], message: xorMessage },
        { path: ["stageNames"], message: productStageMessage },
      ],
    },
    {
      label: "no parent with a stage",
      record: () => ({ ...validItem(), projectId: undefined }),
      readIssues: [{ path: ["projectId"], message: xorMessage }],
      writeIssues: [{ path: ["projectId"], message: xorMessage }],
    },
  ])("pins the item $label lists", ({ record, readIssues, writeIssues }) => {
    const input = record();
    expect(issueList(itemReadModelSchema.safeParse(input))).toEqual(readIssues);
    expect(issueList(itemWriteSchema.safeParse(input))).toEqual(writeIssues);
  });

  it("pins the decision productId path when no parent is set", () => {
    const expected = [{ path: ["productId"], message: xorMessage }];
    const record = { ...decisionBase(), productId: undefined };
    expect(issueList(decisionReadModelSchema.safeParse(record))).toEqual(
      expected,
    );
    expect(issueList(decisionWriteSchema.safeParse(record))).toEqual(expected);
  });

  it("pins the divergent decision lists when both parents are set", () => {
    const record = { ...decisionBase(), activityId: uuid() };
    expect(issueList(decisionReadModelSchema.safeParse(record))).toEqual([
      { path: ["activityId"], message: xorMessage },
    ]);
    expect(issueList(decisionWriteSchema.safeParse(record))).toEqual([
      { path: ["activityId"], message: xorMessage },
      { path: ["stageNames"], message: activityStageMessage },
    ]);
  });

  it("pins the divergent risk lists when both parents are set", () => {
    const record = { ...riskBase(), activityId: uuid() };
    expect(issueList(riskReadModelSchema.safeParse(record))).toEqual([
      { path: ["activityId"], message: xorMessage },
    ]);
    expect(issueList(riskWriteSchema.safeParse(record))).toEqual([
      { path: ["activityId"], message: xorMessage },
      { path: ["stageNames"], message: activityStageMessage },
    ]);
  });

  it("keeps the shared lens on the read-only issue list", () => {
    expect(
      issueList(
        sharedItemReadModelSchema.safeParse({
          ...validItem(),
          activityId: uuid(),
        }),
      ),
    ).toEqual([{ path: ["activityId"], message: xorMessage }]);
  });
});
