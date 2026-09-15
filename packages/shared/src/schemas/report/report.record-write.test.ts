import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decisionWriteSchema,
  draftSaveSchema,
  itemInputSchema,
  itemWriteSchema,
  reportSectionReadModelSchema,
  riskInputSchema,
  riskWriteSchema,
} from "../report";

const uuid = () => randomUUID();
const projectId = uuid();

const validItem = () => ({
  projectId,
  type: "current" as const,
  text: "Ship feature X",
  tag: "feature",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  stageNames: ["Development"],
});

const validRisk = () => ({
  projectId,
  risk: "Deadline may slip",
  impact: "Revenue loss",
  mitigation: "Hire contractor",
  severity: "at-risk" as const,
  stageNames: ["Development"],
});

const validDecision = () => ({
  productId: projectId,
  text: "Upgrade to PostgreSQL 16",
  owner: "Alice",
  impact: "Better performance",
  stageNames: ["Development"],
});

const validDraft = () => ({
  reportSectionId: uuid(),
  version: 1,
  status: "draft" as const,
  projectStatuses: [{ projectId, status: "green" as const }],
  stageStatuses: [],
  activityStatuses: [],
  items: [validItem()],
  risks: [validRisk()],
  decisions: [validDecision()],
});

describe("itemWriteSchema progress vocabulary", () => {
  it("preserves a next step separately from the current result", () => {
    const value = itemWriteSchema.parse({
      ...validItem(),
      nextStepText: "Test the delivered API",
    });
    expect(value.text).toBe("Ship feature X");
    expect(value.nextStepText).toBe("Test the delivered API");
  });

  it.each([
    { type: "next", workflowStatus: "planned" },
    { type: "current", workflowStatus: "done" },
  ])("rejects a second plan on terminal or next-only work: %j", (state) => {
    expect(
      itemWriteSchema.safeParse({
        ...validItem(),
        ...state,
        nextStepText: "Another step",
      }).success,
    ).toBe(false);
  });
  it.each([
    ["current", "planned"],
    ["current", "in_progress"],
    ["current", "paused"],
    ["current", "postponed"],
    ["current", "done"],
    ["next", "planned"],
    ["next", "in_progress"],
    ["next", "paused"],
    ["next", "postponed"],
    ["next", "done"],
  ] as const)("accepts %s/%s", (type, workflowStatus) => {
    expect(
      itemWriteSchema.safeParse({
        ...validItem(),
        type,
        workflowStatus,
        ...(workflowStatus === "paused" ? { pausedReason: "Waiting" } : {}),
      }).success,
    ).toBe(true);
  });

  it("rejects blocked as a progress value", () => {
    expect(
      itemWriteSchema.safeParse({
        ...validItem(),
        workflowStatus: "blocked",
      }).success,
    ).toBe(false);
  });

  it("strips the unsupported completed flag", () => {
    const parsed = itemInputSchema.safeParse({
      ...validItem(),
      completed: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("completed" in parsed.data).toBe(false);
  });

  it("requires a non-blank reason for paused items", () => {
    expect(
      itemWriteSchema.safeParse({ ...validItem(), workflowStatus: "paused" })
        .success,
    ).toBe(false);
    expect(
      itemWriteSchema.safeParse({
        ...validItem(),
        workflowStatus: "paused",
        pausedReason: "  waiting on a dependency  ",
      }).success,
    ).toBe(true);
  });

  it("rejects stale pause reasons on non-paused items", () => {
    expect(
      itemWriteSchema.safeParse({
        ...validItem(),
        pausedReason: "stale reason",
      }).success,
    ).toBe(false);
  });
});

describe("record write stage requirements", () => {
  it.each([
    ["risk", riskWriteSchema, validRisk],
    ["item", itemWriteSchema, validItem],
    ["decision", decisionWriteSchema, validDecision],
  ] as const)(
    "rejects %s without stageNames",
    (_label, schema, createInput) => {
      const { stageNames: _stageNames, ...input } = createInput();
      expect(schema.safeParse(input).success).toBe(false);
    },
  );

  it.each([
    ["risk", riskWriteSchema, validRisk],
    ["item", itemWriteSchema, validItem],
    ["decision", decisionWriteSchema, validDecision],
  ] as const)(
    "rejects %s with empty stageNames",
    (_label, schema, createInput) => {
      expect(
        schema.safeParse({ ...createInput(), stageNames: [] }).success,
      ).toBe(false);
    },
  );

  it("accepts a risk with one stage", () => {
    expect(
      riskInputSchema.safeParse({
        ...validRisk(),
        stageNames: ["Testing"],
      }).success,
    ).toBe(true);
  });

  it.each([
    ["risk", "risks", validRisk],
    ["item", "items", validItem],
    ["decision", "decisions", validDecision],
  ] as const)(
    "rejects a draft containing a stage-less %s",
    (_label, collection, createInput) => {
      const { stageNames: _stageNames, ...input } = createInput();
      expect(
        draftSaveSchema.safeParse({
          ...validDraft(),
          [collection]: [input],
        }).success,
      ).toBe(false);
    },
  );

  it("rejects records without the current structured stage field", () => {
    const { stageNames: _itemStages, ...item } = validItem();
    const { stageNames: _riskStages, ...risk } = validRisk();
    const { stageNames: _decisionStages, ...decision } = validDecision();
    const parsed = reportSectionReadModelSchema.safeParse({
      reportSectionId: uuid(),
      reportId: uuid(),
      authorId: uuid(),
      authorName: "Test Lead",
      version: 1,
      status: "draft",
      submittedAt: null,
      projects: [],
      items: [item],
      risks: [risk],
      decisions: [decision],
    });
    expect(parsed.success).toBe(false);
  });

  it("carries an optional human-readable live reporting-group label", () => {
    const parsed = reportSectionReadModelSchema.parse({
      reportSectionId: uuid(),
      reportId: uuid(),
      authorId: uuid(),
      authorName: "Test Lead",
      version: 1,
      status: "draft",
      submittedAt: null,
      projects: [],
      items: [],
      risks: [],
      decisions: [],
      groupId: uuid(),
      groupName: "Finance Platforms",
    });

    expect(parsed.groupName).toBe("Finance Platforms");
  });
});
