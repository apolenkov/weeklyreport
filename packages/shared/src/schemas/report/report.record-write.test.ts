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
  const currentStatuses = ["in_progress", "paused", "done"] as const;
  const nextStatuses = ["planned", "postponed"] as const;

  it.each(currentStatuses)("accepts %s on a current item", (workflowStatus) => {
    expect(
      itemWriteSchema.safeParse({ ...validItem(), workflowStatus }).success,
    ).toBe(true);
  });

  it.each(nextStatuses)("accepts %s on a next item", (workflowStatus) => {
    expect(
      itemWriteSchema.safeParse({
        ...validItem(),
        type: "next",
        workflowStatus,
      }).success,
    ).toBe(true);
  });

  it.each(nextStatuses)(
    "rejects next-only status %s on a current item",
    (workflowStatus) => {
      expect(
        itemWriteSchema.safeParse({ ...validItem(), workflowStatus }).success,
      ).toBe(false);
    },
  );

  it.each(currentStatuses)(
    "rejects current-only status %s on a next item",
    (workflowStatus) => {
      expect(
        itemWriteSchema.safeParse({
          ...validItem(),
          type: "next",
          workflowStatus,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects blocked as a progress value", () => {
    expect(
      itemWriteSchema.safeParse({
        ...validItem(),
        workflowStatus: "blocked",
      }).success,
    ).toBe(false);
  });

  it("strips the removed completed flag", () => {
    const parsed = itemInputSchema.safeParse({
      ...validItem(),
      completed: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("completed" in parsed.data).toBe(false);
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

  it("keeps legacy stage-less records readable", () => {
    const { stageNames: _itemStages, ...item } = validItem();
    const { stageNames: _riskStages, ...risk } = validRisk();
    const { stageNames: _decisionStages, ...decision } = validDecision();
    const parsed = reportSectionReadModelSchema.parse({
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
    expect(parsed.items).toHaveLength(1);
    expect(parsed.risks).toHaveLength(1);
    expect(parsed.decisions).toHaveLength(1);
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
