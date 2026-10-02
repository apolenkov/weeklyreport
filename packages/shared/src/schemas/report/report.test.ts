import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { draftSaveSchema } from "../report.js";

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
  carriedOver: false,
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
  status: "draft" as const,
  projectStatuses: [{ projectId: PROJECT_UUID, status: "green" as const }],
  stageStatuses: [],
  activityStatuses: [],
  items: [validItem()],
  risks: [validRisk()],
  decisions: [validDecision()],
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

  it("rejects submitted status on a draft save", () => {
    const result = draftSaveSchema.safeParse({
      ...validDraft(),
      status: "submitted",
    });
    expect(result.success).toBe(false);
  });
});
