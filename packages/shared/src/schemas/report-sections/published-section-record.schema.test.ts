import { describe, expect, it } from "vitest";

import {
  publishedDecisionReadModelSchema,
  publishedItemReadModelSchema,
  publishedRiskReadModelSchema,
} from "./published-section-record.schema";

const ID = "10000000-0000-4000-8000-000000000001";
const STABLE_ID = "10000000-0000-4000-8000-000000000002";
const PROJECT_ID = "10000000-0000-4000-8000-000000000003";

const identity = { id: ID, stableId: STABLE_ID };
const parent = {
  projectId: PROJECT_ID,
  activityId: null,
  stageNames: ["Development"],
};

describe("published record identity", () => {
  it("requires both row id and stable lineage id", () => {
    const item = {
      ...identity,
      ...parent,
      type: "current",
      text: "Published item",
      tag: "general",
      workflowStatus: "in_progress",
      carriedOver: false,
    };

    expect(publishedItemReadModelSchema.safeParse(item).success).toBe(true);
    expect(
      publishedItemReadModelSchema.safeParse({ ...item, id: undefined })
        .success,
    ).toBe(false);
    expect(
      publishedItemReadModelSchema.safeParse({ ...item, stableId: undefined })
        .success,
    ).toBe(false);
  });

  it("applies the identity requirement to risks and decisions", () => {
    expect(
      publishedRiskReadModelSchema.safeParse({
        ...identity,
        ...parent,
        risk: "Risk",
        impact: "Impact",
        mitigation: "Mitigation",
        severity: "at-risk",
      }).success,
    ).toBe(true);
    expect(
      publishedDecisionReadModelSchema.safeParse({
        ...identity,
        productId: PROJECT_ID,
        activityId: null,
        text: "Decision",
        owner: "Owner",
        impact: "Impact",
        stageNames: ["Development"],
      }).success,
    ).toBe(true);
    expect(
      publishedDecisionReadModelSchema.safeParse({
        productId: PROJECT_ID,
        activityId: null,
        text: "Decision",
        owner: "Owner",
        impact: "Impact",
        stageNames: ["Development"],
      }).success,
    ).toBe(false);
  });
});
