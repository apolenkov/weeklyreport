import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { filterSectionToSharedProducts } from "./lead-form-cross-author-scope";

const SHARED_PRODUCT_ID = "44444444-4444-4444-8444-444444444441";
const UNSHARED_PRODUCT_ID = "44444444-4444-4444-8444-444444444442";
const COMMENT = {
  id: "55555555-5555-4555-8555-555555555551",
  reviewerId: "66666666-6666-4666-8666-666666666661",
  reviewerName: "Private Reviewer",
  text: "Private feedback",
  createdAt: new Date("2026-04-06T12:00:00Z"),
};

function sectionWithComments(): ReportSectionReadModel {
  return {
    reportSectionId: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    authorId: "33333333-3333-4333-8333-333333333333",
    authorName: "Foreign Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [
      {
        projectId: SHARED_PRODUCT_ID,
        projectName: "Shared product",
        trafficLight: "green",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: null,
      },
      {
        projectId: UNSHARED_PRODUCT_ID,
        projectName: "Unshared product",
        trafficLight: "red",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
    referencedProjects: [
      { projectId: SHARED_PRODUCT_ID, projectName: "Shared product" },
      { projectId: UNSHARED_PRODUCT_ID, projectName: "Unshared product" },
    ],
    items: [
      {
        projectId: SHARED_PRODUCT_ID,
        type: "current",
        text: "Shared item",
        tag: "feature",
        workflowStatus: "paused",
        pausedReason: "Blocked on a confidential legal review",
        carriedOver: false,
        comments: [{ ...COMMENT }],
      },
      {
        projectId: UNSHARED_PRODUCT_ID,
        type: "current",
        text: "Unshared item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        comments: [{ ...COMMENT }],
      },
    ],
    risks: [
      {
        projectId: SHARED_PRODUCT_ID,
        risk: "Shared risk",
        impact: "Impact",
        mitigation: "Mitigation",
        severity: "at-risk",
        comments: [{ ...COMMENT }],
      },
      {
        projectId: UNSHARED_PRODUCT_ID,
        risk: "Unshared risk",
        impact: "Impact",
        mitigation: "Mitigation",
        severity: "blocked",
        comments: [{ ...COMMENT }],
      },
    ],
    decisions: [
      {
        productId: SHARED_PRODUCT_ID,
        text: "Shared decision",
        owner: "Owner",
        impact: "Impact",
        deadline: null,
        comments: [{ ...COMMENT }],
      },
      {
        productId: UNSHARED_PRODUCT_ID,
        text: "Unshared decision",
        owner: "Owner",
        impact: "Impact",
        deadline: null,
        comments: [{ ...COMMENT }],
      },
    ],
    activities: [
      {
        activityId: "77777777-7777-4777-8777-777777777771",
        activityName: "Sensitive activity",
        status: "red",
        note: "Sensitive note",
        linkedProducts: [],
        derivedStatus: null,
        alarmFloor: null,
      },
    ],
    reviews: [
      {
        reviewerId: COMMENT.reviewerId,
        reviewerName: COMMENT.reviewerName,
        verdict: "approved",
        judgedVersion: 1,
        isCurrent: true,
        createdAt: COMMENT.createdAt,
      },
    ],
  };
}

describe("filterSectionToSharedProducts", () => {
  it("omits comments from every retained product-scoped record", () => {
    const result = filterSectionToSharedProducts(
      sectionWithComments(),
      new Set([SHARED_PRODUCT_ID]),
    );
    const retainedRows = [
      ...result.items,
      ...result.risks,
      ...result.decisions,
    ];

    expect(retainedRows).toHaveLength(3);
    expect(retainedRows.every((row) => !("comments" in row))).toBe(true);
  });

  it("strips the author's pausedReason from every retained item", () => {
    const result = filterSectionToSharedProducts(
      sectionWithComments(),
      new Set([SHARED_PRODUCT_ID]),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items.every((row) => !("pausedReason" in row))).toBe(true);
  });

  it("keeps product scoping and referenced-project recomputation unchanged", () => {
    const result = filterSectionToSharedProducts(
      sectionWithComments(),
      new Set([SHARED_PRODUCT_ID]),
    );

    expect(result.items.map((row) => row.text)).toEqual(["Shared item"]);
    expect(result.risks.map((row) => row.risk)).toEqual(["Shared risk"]);
    expect(result.decisions.map((row) => row.text)).toEqual([
      "Shared decision",
    ]);
    expect(result.projects.map((row) => row.projectId)).toEqual([
      SHARED_PRODUCT_ID,
    ]);
    expect(result.referencedProjects).toEqual([
      { projectId: SHARED_PRODUCT_ID, projectName: "Shared product" },
    ]);
  });

  it("still empties activities and reviews", () => {
    const result = filterSectionToSharedProducts(
      sectionWithComments(),
      new Set([SHARED_PRODUCT_ID]),
    );

    expect(result.activities).toEqual([]);
    expect(result.reviews).toEqual([]);
  });
});
