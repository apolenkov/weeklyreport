import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined";
import {
  mergePlannedCarriedRows,
  persistCarriedRowsForSection,
} from "./carry-over-row-writes";

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

function sectionWithCleanedCarriedItem(): ReportSectionReadModel {
  return {
    ...sectionWithCarriedItem(),
    items: [
      {
        ...expectDefined(sectionWithCarriedItem().items[0]),
        stableId: "77777777-7777-4777-8777-777777777777",
        workflowStatus: "planned",
        pausedReason: null,
        nextStepText: null,
      },
    ],
  };
}

function sectionWithCarriedDecision({
  id = "88888888-8888-4888-8888-888888888888",
  stableId = "99999999-9999-4999-8999-999999999999",
  resolvedAt = null,
}: {
  readonly id?: string;
  readonly stableId?: string;
  readonly resolvedAt?: Date | null;
} = {}): ReportSectionReadModel {
  return {
    ...sectionWithCarriedItem(),
    items: [],
    decisions: [
      {
        id,
        stableId,
        productId: PROJECT_ID,
        text: "Carried decision",
        owner: "Lead",
        deadline: null,
        impact: "Needs a decision",
        resolvedAt,
        stageNames: ["Development"],
      },
    ],
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

  it("persists the clone's cleared pause and next-step fields", async () => {
    const itemCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      item: { createMany: itemCreateMany },
      decision: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const result = await persistCarriedRowsForSection(
      tx as never,
      sectionWithCleanedCarriedItem(),
    );

    expect(result).toEqual({ insertedItems: 1, insertedDecisions: 0 });
    expect(itemCreateMany).toHaveBeenCalledWith({
      data: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          stableId: "77777777-7777-4777-8777-777777777777",
          reportSectionId: SECTION_ID,
          projectId: PROJECT_ID,
          activityId: null,
          type: "current",
          text: "Carried item",
          tag: "feature",
          workflowStatus: "planned",
          carriedOver: true,
          priorityRank: null,
          pausedReason: null,
          nextStepText: null,
          stageNames: ["Development"],
        },
      ],
      skipDuplicates: true,
    });
  });

  it.each([
    {
      name: "item only",
      section: sectionWithCleanedCarriedItem(),
      itemCount: 1,
      decisionCount: 0,
    },
    {
      name: "decision only",
      section: sectionWithCarriedDecision(),
      itemCount: 0,
      decisionCount: 1,
    },
    {
      name: "items and decisions",
      section: {
        ...sectionWithCleanedCarriedItem(),
        decisions: sectionWithCarriedDecision().decisions,
      },
      itemCount: 1,
      decisionCount: 1,
    },
    {
      name: "rows skipped as duplicates",
      section: {
        ...sectionWithCleanedCarriedItem(),
        decisions: sectionWithCarriedDecision().decisions,
      },
      itemCount: 0,
      decisionCount: 0,
    },
  ])(
    "returns exact inserted counts for $name",
    async ({ section, itemCount, decisionCount }) => {
      const tx = {
        item: {
          createMany: vi.fn().mockResolvedValue({ count: itemCount }),
        },
        decision: {
          findMany: vi.fn().mockResolvedValue([]),
          createMany: vi.fn().mockResolvedValue({ count: decisionCount }),
        },
      };

      await expect(
        persistCarriedRowsForSection(tx as never, section),
      ).resolves.toEqual({
        insertedItems: itemCount,
        insertedDecisions: decisionCount,
      });
    },
  );
});

describe("mergePlannedCarriedRows", () => {
  it("keeps the current decision occurrence and resolved state by stable lineage", () => {
    const resolvedAt = new Date("2026-05-05T09:30:00.000Z");
    const current = sectionWithCarriedDecision({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      resolvedAt,
    });
    const planned = sectionWithCarriedDecision({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    const merged = mergePlannedCarriedRows(current, planned, [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        sourceReportId: REPORT_ID,
        targetReportId: REPORT_ID,
        sourceItemId: null,
        targetItemId: null,
        sourceDecisionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        targetDecisionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "completed",
        carriedAt: new Date("2026-05-04T09:30:00.000Z"),
      },
    ]);

    expect(merged.decisions).toEqual(current.decisions);
    expect(merged.decisions[0]).toMatchObject({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      resolvedAt,
    });
  });
});
