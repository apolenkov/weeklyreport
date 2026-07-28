import { describe, expect, it } from "vitest";

import type {
  DecisionEntry,
  KanbanItem,
  Product,
  RiskEntry,
} from "../../report-sections";
import {
  mergeActivityStatusDraft,
  mergeDecisionDraft,
  mergeItemsDraft,
  mergeProductDraft,
  mergeRiskDraft,
  patchDraftItem,
} from "./lead-form-draft-merge-helpers";
import {
  ACTIVITY_ID,
  ACTIVITY_ITEM_ID,
  CURRENT_ITEM_ID,
  DECISION_ID,
  makeDraftMergeSection,
  PROJECT_ID,
  RISK_ID,
} from "./lead-form-draft-merge-test-fixtures";

describe("lead form draft merge helpers", () => {
  it("merges item edits while preserving parent semantics, priority, and own-only filtering", () => {
    const section = makeDraftMergeSection();
    const next: KanbanItem[] = [
      {
        id: CURRENT_ITEM_ID,
        productId: PROJECT_ID,
        productName: "Test Product",
        stageNames: ["Testing"],
        status: "completed",
        text: "Updated product item",
        author: "Test Lead",
        priorityRank: 7,
        pausedReason: "Should clear",
      },
      {
        id: ACTIVITY_ITEM_ID,
        productId: "",
        productName: "",
        activityId: ACTIVITY_ID,
        activityName: "Ops rotation",
        stageNames: ["Ignored"],
        status: "blocked",
        text: "Updated activity item",
        author: "Test Lead",
        priorityRank: 4,
      },
      {
        id: "foreign-item",
        productId: PROJECT_ID,
        productName: "Test Product",
        status: "planned",
        text: "Foreign item",
        author: "Other Lead",
        priorityRank: null,
        foreign: true,
      },
    ];

    const result = mergeItemsDraft(section, "current", next);

    expect(result.items).toHaveLength(2);
    expect(
      result.items.find((item) => item.id === "foreign-item"),
    ).toBeUndefined();
    const productItem = result.items.find(
      (item) => item.id === CURRENT_ITEM_ID,
    );
    expect(productItem).toMatchObject({
      stableId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      projectId: PROJECT_ID,
      activityId: null,
      stageNames: ["Testing"],
      workflowStatus: "done",
      priorityRank: 7,
      pausedReason: null,
      text: "Updated product item",
    });
    const activityItem = result.items.find(
      (item) => item.id === ACTIVITY_ITEM_ID,
    );
    expect(activityItem).toMatchObject({
      stableId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      projectId: null,
      activityId: ACTIVITY_ID,
      stageNames: [],
      workflowStatus: "in_progress",
      priorityRank: 4,
    });
  });

  it("merges risks and decisions with activity-parent XOR fields and foreign rows stripped", () => {
    const section = makeDraftMergeSection();
    const risks: RiskEntry[] = [
      {
        id: RISK_ID,
        productId: "",
        productName: "",
        activityId: ACTIVITY_ID,
        activityName: "Ops rotation",
        stageNames: ["Ignored"],
        severity: "blocked",
        text: "Activity risk",
        impact: "Activity impact",
        mitigation: "Activity mitigation",
      },
      {
        id: "foreign-risk",
        productId: PROJECT_ID,
        productName: "Test Product",
        severity: "at-risk",
        text: "Foreign risk",
        impact: "Foreign impact",
        mitigation: "Foreign mitigation",
        foreign: true,
      },
    ];
    const decisions: DecisionEntry[] = [
      {
        id: DECISION_ID,
        productId: "",
        productName: "",
        activityId: ACTIVITY_ID,
        activityName: "Ops rotation",
        text: "Activity decision",
        owner: "New owner",
        impact: "New impact",
        deadline: "2026-07-09",
        stageNames: ["Ignored"],
      },
      {
        id: "foreign-decision",
        productId: PROJECT_ID,
        productName: "Test Product",
        text: "Foreign decision",
        owner: "Other",
        impact: "Other impact",
        deadline: null,
        foreign: true,
      },
    ];

    const riskResult = mergeRiskDraft(section, risks);
    const decisionResult = mergeDecisionDraft(section, decisions);

    expect(riskResult.risks).toHaveLength(1);
    expect(riskResult.risks[0]).toMatchObject({
      stableId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      projectId: null,
      activityId: ACTIVITY_ID,
      stageNames: [],
      risk: "Activity risk",
      severity: "blocked",
    });
    expect(decisionResult.decisions).toHaveLength(1);
    expect(decisionResult.decisions[0]).toMatchObject({
      stableId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      productId: null,
      activityId: ACTIVITY_ID,
      stageNames: [],
      text: "Activity decision",
      owner: "New owner",
      resolvedAt: new Date("2026-06-01T00:00:00Z"),
    });
    expect(decisionResult.decisions[0]?.deadline?.toISOString()).toBe(
      "2026-07-09T00:00:00.000Z",
    );
  });

  it("merges product and activity status updates without changing unrelated rows", () => {
    const section = makeDraftMergeSection();
    const products: Product[] = [
      {
        id: PROJECT_ID,
        name: "Test Product",
        overallStatus: "blocked",
        stages: [
          {
            stageName: "Development",
            status: "blocked",
            ownership: "mine",
            assignee: null,
          },
          {
            stageName: "Testing",
            status: "at-risk",
            ownership: "locked",
            assignee: "OL",
          },
        ],
      },
    ];

    const productResult = mergeProductDraft(section, products);
    const activityResult = mergeActivityStatusDraft(
      productResult,
      ACTIVITY_ID,
      "yellow",
    );

    expect(productResult.projects[0]?.trafficLight).toBe("red");
    expect(productResult.projects[0]?.ownedStages).toEqual([
      expect.objectContaining({ stageName: "Development", status: "red" }),
      expect.objectContaining({ stageName: "Testing", status: "green" }),
    ]);
    expect(activityResult.activities[0]).toMatchObject({
      activityId: ACTIVITY_ID,
      status: "yellow",
    });
  });

  it("patches an existing item by id so published-lineage identity survives move actions", () => {
    const section = makeDraftMergeSection();

    const result = patchDraftItem(section, CURRENT_ITEM_ID, {
      type: "next",
      workflowStatus: "planned",
    });

    expect(result.items).toHaveLength(section.items.length);
    expect(result.items[0]).toMatchObject({
      id: CURRENT_ITEM_ID,
      stableId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      type: "next",
      workflowStatus: "planned",
    });
  });
});
