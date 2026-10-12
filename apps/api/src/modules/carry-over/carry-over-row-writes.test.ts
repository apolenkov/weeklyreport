import type {
  CarryOverRecord,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
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
const ATTACHED_ACTIVITY_ID = "10101010-1010-4101-8101-101010101010";
const DETACHED_PROJECT_ID = "20202020-2020-4202-8202-202020202020";
const DETACHED_ACTIVITY_ID = "30303030-3030-4303-8303-303030303030";

type Item = ReportSectionReadModel["items"][number];
type Decision = ReportSectionReadModel["decisions"][number];

function attachedProject(
  projectId: string,
): ReportSectionReadModel["projects"][number] {
  return {
    projectId,
    projectName: "Product",
    trafficLight: null,
    ownedStages: [],
    stageSet: [],
    ownerGroupId: null,
  };
}

function attachedActivity(
  activityId: string,
): ReportSectionReadModel["activities"][number] {
  return {
    activityId,
    activityName: "Activity",
    status: null,
    jiraAccounts: [],
    linkedProducts: [],
    derivedStatus: null,
    alarmFloor: null,
  };
}

function carriedItemClone({
  id,
  stableId,
  parent,
}: {
  readonly id: string;
  readonly stableId: string;
  readonly parent:
    { readonly projectId: string } | { readonly activityId: string };
}): Item {
  return {
    id,
    stableId,
    ...parent,
    type: "current",
    text: "Planned carried item",
    tag: "feature",
    workflowStatus: "planned",
    carriedOver: true,
    // Only a product parent carries SDLC stage names; activities have none.
    stageNames: "activityId" in parent ? [] : ["Development"],
  };
}

function carriedDecisionClone({
  id,
  stableId,
  parent,
}: {
  readonly id: string;
  readonly stableId: string;
  readonly parent:
    { readonly productId: string } | { readonly activityId: string };
}): Decision {
  return {
    id,
    stableId,
    ...parent,
    text: "Planned carried decision",
    owner: "Lead",
    deadline: null,
    impact: "Needs a decision",
    resolvedAt: null,
    // Only a product parent carries SDLC stage names; activities have none.
    stageNames: "activityId" in parent ? [] : ["Development"],
  };
}

function itemCarryRecord(item: Item, id: string): CarryOverRecord {
  return {
    id,
    sourceReportId: REPORT_ID,
    targetReportId: REPORT_ID,
    sourceItemId: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1",
    targetItemId: expectDefined(item.id),
    sourceDecisionId: null,
    targetDecisionId: null,
    status: "completed",
    carriedAt: new Date("2026-05-04T09:30:00.000Z"),
  };
}

function decisionCarryRecord(decision: Decision, id: string): CarryOverRecord {
  return {
    id,
    sourceReportId: REPORT_ID,
    targetReportId: REPORT_ID,
    sourceItemId: null,
    targetItemId: null,
    sourceDecisionId: "f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2",
    targetDecisionId: expectDefined(decision.id),
    status: "completed",
    carriedAt: new Date("2026-05-04T09:30:00.000Z"),
  };
}

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
    const current: ReportSectionReadModel = {
      ...sectionWithCarriedDecision({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        resolvedAt,
      }),
      projects: [attachedProject(PROJECT_ID)],
    };
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

describe("mergePlannedCarriedRows — locked parent membership", () => {
  // A current row keeps its place even when its parent is not attached —
  // membership re-checks only the new planned clones.
  const current: ReportSectionReadModel = {
    ...sectionWithCarriedItem(),
    items: [
      {
        ...expectDefined(sectionWithCarriedItem().items[0]),
        id: "40404040-4040-4404-8404-404040404040",
        stableId: "50505050-5050-4505-8505-505050505050",
        projectId: DETACHED_PROJECT_ID,
        carriedOver: false,
      },
    ],
  };

  it.each([
    { name: "product", parent: { projectId: DETACHED_PROJECT_ID } },
    { name: "activity", parent: { activityId: DETACHED_ACTIVITY_ID } },
  ])(
    "drops a planned carried item on a detached $name after the locked re-read",
    ({ parent }) => {
      const clone = carriedItemClone({
        id: "c1000000-c100-4100-8100-c10000000001",
        stableId: "c1000000-c100-4100-8100-c10000000002",
        parent,
      });
      const merged = mergePlannedCarriedRows(
        current,
        { ...sectionWithCarriedItem(), items: [clone] },
        [itemCarryRecord(clone, "c1000000-c100-4100-8100-c10000000003")],
      );

      expect(merged.items).toEqual(current.items);
      expect(merged.decisions).toEqual(current.decisions);
    },
  );

  it.each([
    { name: "product", parent: { productId: DETACHED_PROJECT_ID } },
    { name: "activity", parent: { activityId: DETACHED_ACTIVITY_ID } },
  ])(
    "drops a planned unresolved decision on a detached $name after the locked re-read",
    ({ parent }) => {
      const clone = carriedDecisionClone({
        id: "c2000000-c200-4200-8200-c20000000001",
        stableId: "c2000000-c200-4200-8200-c20000000002",
        parent,
      });
      const merged = mergePlannedCarriedRows(
        current,
        { ...sectionWithCarriedItem(), items: [], decisions: [clone] },
        [decisionCarryRecord(clone, "c2000000-c200-4200-8200-c20000000003")],
      );

      expect(merged.items).toEqual(current.items);
      expect(merged.decisions).toEqual(current.decisions);
    },
  );

  it("still merges clones whose parents remain attached", () => {
    const attachedItem = carriedItemClone({
      id: "c5000000-c500-4500-8500-c50000000001",
      stableId: "c5000000-c500-4500-8500-c50000000002",
      parent: { projectId: PROJECT_ID },
    });
    const detachedItem = carriedItemClone({
      id: "c6000000-c600-4600-8600-c60000000001",
      stableId: "c6000000-c600-4600-8600-c60000000002",
      parent: { projectId: DETACHED_PROJECT_ID },
    });
    const attachedDecision = carriedDecisionClone({
      id: "c7000000-c700-4700-8700-c70000000001",
      stableId: "c7000000-c700-4700-8700-c70000000002",
      parent: { activityId: ATTACHED_ACTIVITY_ID },
    });
    const detachedDecision = carriedDecisionClone({
      id: "c8000000-c800-4800-8800-c80000000001",
      stableId: "c8000000-c800-4800-8800-c80000000002",
      parent: { activityId: DETACHED_ACTIVITY_ID },
    });
    const attachedCurrent: ReportSectionReadModel = {
      ...sectionWithCarriedItem(),
      items: [],
      projects: [attachedProject(PROJECT_ID)],
      activities: [attachedActivity(ATTACHED_ACTIVITY_ID)],
    };
    const planned: ReportSectionReadModel = {
      ...sectionWithCarriedItem(),
      items: [attachedItem, detachedItem],
      decisions: [attachedDecision, detachedDecision],
    };

    const merged = mergePlannedCarriedRows(attachedCurrent, planned, [
      itemCarryRecord(attachedItem, "c5000000-c500-4500-8500-c50000000003"),
      itemCarryRecord(detachedItem, "c6000000-c600-4600-8600-c60000000003"),
      decisionCarryRecord(
        attachedDecision,
        "c7000000-c700-4700-8700-c70000000003",
      ),
      decisionCarryRecord(
        detachedDecision,
        "c8000000-c800-4800-8800-c80000000003",
      ),
    ]);

    expect(merged.items).toEqual([attachedItem]);
    expect(merged.decisions).toEqual([attachedDecision]);
  });
});
