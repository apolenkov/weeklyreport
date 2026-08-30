import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { persistCarriedRowsForSection } from "./carry-over-row-writes";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

function sectionWithCarriedItem(): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [],
    referencedProjects: [],
    items: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        stableId: undefined,
        projectId: PROJECT_ID,
        type: "current",
        text: "Carried item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: true,
        stageNames: ["Development"],
      },
    ],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}

function sectionWithParentlessCarriedDecision(): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        stableId: "77777777-7777-4777-8777-777777777777",
        // No productId and no activityId — violates the DB XOR-parent CHECK.
        text: "Malformed decision",
        owner: "Lead",
        deadline: null,
        impact: "Has no parent",
        resolvedAt: null,
        stageNames: [],
      },
    ],
    activities: [],
    reviews: [],
  };
}

describe("persistCarriedRowsForSection", () => {
  it("fails before writing when a carried item has no stable lineage id", async () => {
    const createMany = vi.fn();
    const tx = {
      item: { createMany },
      decision: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await expect(
      persistCarriedRowsForSection(tx as never, sectionWithCarriedItem()),
    ).rejects.toThrow(
      "Cannot persist a carried item without its stable lineage id.",
    );
    expect(createMany).not.toHaveBeenCalled();
  });

  // The DB XOR-parent invariant forbids a decision with no parent — it cannot
  // persist, so carry-over must abort instead of silently dropping the record.
  it("fails loud instead of silently dropping a carried decision without a parent", async () => {
    const decisionCreateMany = vi.fn();
    const itemCreateMany = vi.fn();
    const tx = {
      item: { createMany: itemCreateMany },
      decision: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: decisionCreateMany,
      },
    };

    await expect(
      persistCarriedRowsForSection(
        tx as never,
        sectionWithParentlessCarriedDecision(),
      ),
    ).rejects.toThrow(
      "Cannot persist a carried decision without a product or activity parent.",
    );
    expect(itemCreateMany).not.toHaveBeenCalled();
    expect(decisionCreateMany).not.toHaveBeenCalled();
  });
});
