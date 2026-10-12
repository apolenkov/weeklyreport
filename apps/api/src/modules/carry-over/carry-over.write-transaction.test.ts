import type {
  CarryOverExecution,
  CarryOverRecord,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { ReportSectionNotFoundError } from "../report-sections/index.js";
import { writeCarryOver } from "./carry-over.write-transaction";

const sourceReportId = "22222222-2222-4222-8222-222222222222";
const targetReportId = "55555555-5555-4555-8555-555555555555";
const projectId = "44444444-4444-4444-8444-444444444444";
const activityId = "66666666-6666-4666-8666-666666666666";
const detachedProjectId = "77777777-7777-4777-8777-777777777777";
const detachedActivityId = "88888888-8888-4888-8888-888888888888";
const ownerGroupId = "99999999-9999-4999-8999-999999999999";
const stageId = "12341234-1234-4234-8234-123412341234";
const sectionAId = "11111111-1111-4111-8111-111111111111";
const sectionBId = "11111111-1111-4111-8111-222222222222";

const execution: CarryOverExecution = {
  id: "aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sourceReportId,
  targetReportId,
  dedupeKey: `${sourceReportId}:${targetReportId}`,
  status: "completed",
  startedAt: new Date("2026-05-04T09:30:00.000Z"),
  completedAt: new Date("2026-05-04T09:30:00.000Z"),
  carriedItemCount: 1,
  carriedDecisionCount: 1,
};

const existingExecution = {
  id: "bbbb0000-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sourceReportId,
  targetReportId,
  dedupeKey: execution.dedupeKey,
  status: "completed",
  createdAt: new Date("2026-05-04T09:30:00.000Z"),
  updatedAt: new Date("2026-05-04T09:30:00.000Z"),
};

const editableReportLock = {
  id: targetReportId,
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

type Item = ReportSectionReadModel["items"][number];
type Decision = ReportSectionReadModel["decisions"][number];

function carriedItem({
  id = "cccc0000-cccc-4ccc-8ccc-cccccccccccc",
  stableId = "dddd0000-dddd-4ddd-8ddd-dddddddddddd",
  text = "Carried item",
}: {
  readonly id?: string;
  readonly stableId?: string;
  readonly text?: string;
} = {}): Item {
  return {
    id,
    stableId,
    projectId,
    type: "current",
    text,
    tag: "feature",
    workflowStatus: "planned",
    carriedOver: true,
    priorityRank: null,
    pausedReason: null,
    nextStepText: null,
    stageNames: ["Development"],
  };
}

function carriedDecision({
  id = "eeee0000-eeee-4eee-8eee-eeeeeeeeeeee",
  stableId = "ffff0000-ffff-4fff-8fff-ffffffffffff",
  text = "Carried decision",
  resolvedAt = null,
}: {
  readonly id?: string;
  readonly stableId?: string;
  readonly text?: string;
  readonly resolvedAt?: Date | null;
} = {}): Decision {
  return {
    id,
    stableId,
    productId: projectId,
    text,
    owner: "Lead",
    deadline: null,
    impact: "Needs a decision",
    resolvedAt,
    stageNames: ["Development"],
  };
}

function attachedProject(
  id: string = projectId,
): ReportSectionReadModel["projects"][number] {
  return {
    projectId: id,
    projectName: "Product",
    trafficLight: null,
    ownedStages: [],
    stageSet: [],
    ownerGroupId,
  };
}

function attachedActivity(
  id: string = activityId,
): ReportSectionReadModel["activities"][number] {
  return {
    activityId: id,
    activityName: "Activity",
    status: null,
    jiraAccounts: [],
    linkedProducts: [],
    derivedStatus: null,
    alarmFloor: null,
  };
}

function targetSection({
  id = sectionAId,
  version = 1,
  status = "draft",
  items = [],
  decisions = [],
  projects = [],
  activities = [],
}: {
  readonly id?: string;
  readonly version?: number;
  readonly status?: "draft" | "submitted";
  readonly items?: readonly Item[];
  readonly decisions?: readonly Decision[];
  readonly projects?: readonly ReportSectionReadModel["projects"][number][];
  readonly activities?: readonly ReportSectionReadModel["activities"][number][];
} = {}): ReportSectionReadModel {
  return {
    reportSectionId: id,
    reportId: targetReportId,
    authorId: "33333333-3333-4333-8333-333333333333",
    authorName: "Lead",
    authorRole: "lead",
    version,
    status,
    submittedAt:
      status === "submitted" ? new Date("2026-05-05T09:30:00.000Z") : null,
    late: false,
    projects,
    referencedProjects: [],
    items,
    risks: [],
    decisions,
    activities,
    reviews: [],
  };
}

function requireRowId(id: string | undefined): string {
  if (id === undefined) throw new Error("test row requires an id");
  return id;
}

function itemCarryRecord(
  item: Item,
  id = "27272727-2727-4727-8727-272727272727",
): CarryOverRecord {
  return {
    id,
    sourceReportId,
    targetReportId,
    sourceItemId: "28282828-2828-4828-8828-282828282828",
    targetItemId: requireRowId(item.id),
    sourceDecisionId: null,
    targetDecisionId: null,
    status: "completed",
    carriedAt: execution.completedAt,
  };
}

function decisionCarryRecord(
  decision: Decision,
  id = "29292929-2929-4929-8929-292929292929",
): CarryOverRecord {
  return {
    id,
    sourceReportId,
    targetReportId,
    sourceItemId: null,
    targetItemId: null,
    sourceDecisionId: "30303030-3030-4030-8030-303030303030",
    targetDecisionId: requireRowId(decision.id),
    status: "completed",
    carriedAt: execution.completedAt,
  };
}

function prismaSectionRow(section: ReportSectionReadModel) {
  return {
    id: section.reportSectionId,
    reportId: section.reportId,
    authorId: section.authorId,
    version: section.version,
    status: section.status,
    submittedAt: section.submittedAt,
    late: section.late,
    author: {
      id: section.authorId,
      name: section.authorName,
      role: section.authorRole,
      reportingGroupId: null,
      // Section projects derive from the author's stage assignments; one
      // assignment per attached product reproduces that relation.
      stageAssignments: section.projects.map((project) => ({
        projectId: project.projectId,
        stageId,
        stage: { name: "Development", sortOrder: 0 },
        project: {
          id: project.projectId,
          name: project.projectName,
          archived: false,
          stageAssignments: [
            { stageId, stage: { name: "Development", sortOrder: 0 } },
          ],
          groupProducts: [{ groupId: project.ownerGroupId ?? ownerGroupId }],
        },
      })),
    },
    projectStatuses: [],
    stageStatuses: [],
    activityStatuses: section.activities.map((activity) => ({
      activityId: activity.activityId,
      status: activity.status,
      note: activity.note ?? null,
      titleOverride: activity.titleOverride ?? null,
      activity: {
        name: activity.activityName,
        jiraAccounts: [...activity.jiraAccounts],
        activityProducts: activity.linkedProducts.map((link) => ({
          product: { id: link.productId, name: link.productName },
        })),
      },
    })),
    items: section.items.map((item) => ({
      id: requireRowId(item.id),
      stableId: requireRowId(item.stableId),
      reportSectionId: section.reportSectionId,
      projectId: item.projectId ?? null,
      activityId: item.activityId ?? null,
      type: item.type,
      text: item.text,
      tag: item.tag,
      workflowStatus: item.workflowStatus,
      carriedOver: item.carriedOver,
      priorityRank: item.priorityRank ?? null,
      pausedReason: item.pausedReason ?? null,
      nextStepText: item.nextStepText ?? null,
      resolution: item.resolution ?? null,
      stageNames: [...item.stageNames],
      project: item.projectId == null ? null : { name: "Product" },
      recordComments: [],
    })),
    risks: [],
    decisions: section.decisions.map((decision) => ({
      id: requireRowId(decision.id),
      stableId: requireRowId(decision.stableId),
      reportSectionId: section.reportSectionId,
      text: decision.text,
      owner: decision.owner,
      deadline: decision.deadline ?? null,
      impact: decision.impact,
      resolvedAt: decision.resolvedAt ?? null,
      stageNames: [...decision.stageNames],
      productId: decision.productId ?? null,
      activityId: decision.activityId ?? null,
      project: decision.productId == null ? null : { name: "Product" },
      recordComments: [],
    })),
    sectionReviews: [],
    itemOutcomeEvents: [],
  };
}

function createTransaction({
  currentSections,
  readbackSections = currentSections,
  existing = null,
  existingRecords = [],
  itemInsertCounts = [],
  decisionInsertCounts = [],
}: {
  readonly currentSections: readonly ReportSectionReadModel[];
  readonly readbackSections?: readonly ReportSectionReadModel[];
  readonly existing?: typeof existingExecution | null;
  readonly existingRecords?: readonly Record<string, unknown>[];
  readonly itemInsertCounts?: readonly number[];
  readonly decisionInsertCounts?: readonly number[];
}) {
  const itemCreateMany = vi.fn();
  for (const count of itemInsertCounts) {
    itemCreateMany.mockResolvedValueOnce({ count });
  }
  const decisionCreateMany = vi.fn();
  for (const count of decisionInsertCounts) {
    decisionCreateMany.mockResolvedValueOnce({ count });
  }

  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([editableReportLock])
      .mockResolvedValueOnce(
        currentSections.map((section) => ({ id: section.reportSectionId })),
      ),
    reportSection: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(currentSections.map(prismaSectionRow))
        .mockResolvedValue(readbackSections.map(prismaSectionRow)),
      update: vi.fn().mockResolvedValue({}),
    },
    carryOverExecution: {
      findFirst: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({}),
    },
    carryOverRecord: {
      findMany: vi.fn().mockResolvedValue(existingRecords),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    item: { createMany: itemCreateMany },
    decision: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: decisionCreateMany,
    },
  };
}

describe("writeCarryOver — replay of a completed execution", () => {
  it("returns only the winner's persisted rows before merging the loser plan", async () => {
    const resolvedAt = new Date("2026-05-05T09:30:00.000Z");
    const winnerDecision = carriedDecision({
      id: "10101010-1010-4010-8010-101010101010",
      text: "Winner persisted decision",
      resolvedAt,
    });
    const current = targetSection({ decisions: [winnerDecision] });
    const loserPlan = targetSection({
      items: [
        carriedItem({
          id: "20202020-2020-4020-8020-202020202020",
          stableId: "30303030-3030-4030-8030-303030303030",
          text: "Loser-only phantom item",
        }),
      ],
      decisions: [
        carriedDecision({
          id: "40404040-4040-4040-8040-404040404040",
          stableId: requireRowId(winnerDecision.stableId),
          text: "Loser clone of winner lineage",
        }),
      ],
    });
    const winnerRecord = {
      id: "50505050-5050-4050-8050-505050505050",
      executionId: existingExecution.id,
      sourceItemId: null,
      sourceDecisionId: "60606060-6060-4060-8060-606060606060",
      targetItemId: null,
      targetDecisionId: winnerDecision.id,
      recordType: "decision",
      createdAt: new Date("2026-05-04T09:30:00.000Z"),
    };
    const tx = createTransaction({
      currentSections: [current],
      existing: existingExecution,
      existingRecords: [winnerRecord],
    });

    const result = await writeCarryOver(
      tx as never,
      execution,
      [],
      [loserPlan],
    );

    expect(result.execution.id).toBe(existingExecution.id);
    expect(result.records.map((record) => record.id)).toEqual([
      winnerRecord.id,
    ]);
    expect(result.targetSection.items).toEqual([]);
    expect(result.targetSection.decisions).toEqual([
      expect.objectContaining({
        id: winnerDecision.id,
        text: winnerDecision.text,
        resolvedAt,
      }),
    ]);
    expect(tx.carryOverExecution.create).not.toHaveBeenCalled();
    expect(tx.item.createMany).not.toHaveBeenCalled();
    expect(tx.decision.createMany).not.toHaveBeenCalled();
    expect(tx.reportSection.update).not.toHaveBeenCalled();
  });

  it("keeps the submitted gate ahead of replay resolution", async () => {
    const tx = createTransaction({
      currentSections: [targetSection({ status: "submitted" })],
      existing: existingExecution,
    });

    await expect(
      writeCarryOver(tx as never, execution, [], [targetSection()]),
    ).rejects.toThrow(
      "Carry-over cannot overwrite a submitted target section.",
    );
    expect(tx.carryOverExecution.findFirst).not.toHaveBeenCalled();
    expect(tx.reportSection.update).not.toHaveBeenCalled();
  });
});

describe("writeCarryOver — fresh writes and section versions", () => {
  it("increments once for item and decision inserts and returns the readback", async () => {
    const item = carriedItem();
    const decision = carriedDecision();
    const current = targetSection({ projects: [attachedProject()] });
    const planned = targetSection({ items: [item], decisions: [decision] });
    const persisted = targetSection({
      version: 2,
      items: [item],
      decisions: [decision],
    });
    const tx = createTransaction({
      currentSections: [current],
      readbackSections: [persisted],
      itemInsertCounts: [1],
      decisionInsertCounts: [1],
    });

    const result = await writeCarryOver(
      tx as never,
      execution,
      [itemCarryRecord(item), decisionCarryRecord(decision)],
      [planned],
    );

    expect(tx.reportSection.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: sectionAId },
      data: { version: { increment: 1 } },
    });
    expect(tx.reportSection.findMany).toHaveBeenCalledTimes(2);
    expect(result.targetSection).toMatchObject({
      reportSectionId: sectionAId,
      version: 2,
      items: [{ id: item.id, stableId: item.stableId }],
      decisions: [{ id: decision.id, stableId: decision.stableId }],
    });
  });

  it("does not resurrect target rows deleted while carry-over waited for the section lock", async () => {
    const deletedPriorCarriedItem = carriedItem({
      id: "12121212-1212-4212-8212-121212121212",
      stableId: "13131313-1313-4313-8313-131313131313",
      text: "Prior carried item deleted by draft save",
    });
    const deletedDecision = carriedDecision({
      id: "14141414-1414-4414-8414-141414141414",
      stableId: "15151515-1515-4515-8515-151515151515",
      text: "Decision deleted by draft save",
    });
    const intendedItemClone = carriedItem({
      id: "16161616-1616-4616-8616-161616161616",
      stableId: "17171717-1717-4717-8717-171717171717",
      text: "New carried item",
    });
    const intendedDecisionClone = carriedDecision({
      id: "18181818-1818-4818-8818-181818181818",
      stableId: "19191919-1919-4919-8919-191919191919",
      text: "New carried decision",
    });
    const freshCurrentEdit: Item = {
      ...carriedItem({
        id: "20202020-2020-4020-8020-202020202020",
        stableId: "21212121-2121-4121-8121-212121212121",
        text: "Fresh edit committed before the carry-over lock",
      }),
      carriedOver: false,
    };
    const stalePlannedTarget = targetSection({
      version: 4,
      items: [deletedPriorCarriedItem, intendedItemClone],
      decisions: [deletedDecision, intendedDecisionClone],
    });
    const freshLockedTarget = targetSection({
      version: 5,
      items: [freshCurrentEdit],
      projects: [attachedProject()],
    });
    const persisted = targetSection({
      version: 6,
      items: [freshCurrentEdit, intendedItemClone],
      decisions: [intendedDecisionClone],
    });
    const records = [
      itemCarryRecord(
        intendedItemClone,
        "23232323-2323-4323-8323-232323232323",
      ),
      decisionCarryRecord(
        intendedDecisionClone,
        "25252525-2525-4525-8525-252525252525",
      ),
    ];
    const tx = createTransaction({
      currentSections: [freshLockedTarget],
      readbackSections: [persisted],
      itemInsertCounts: [1],
      decisionInsertCounts: [1],
    });

    const result = await writeCarryOver(tx as never, execution, records, [
      stalePlannedTarget,
    ]);

    expect(tx.item.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [
        expect.objectContaining({
          id: intendedItemClone.id,
          stableId: intendedItemClone.stableId,
        }),
      ],
      skipDuplicates: true,
    });
    expect(tx.decision.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [
        expect.objectContaining({
          id: intendedDecisionClone.id,
          stableId: intendedDecisionClone.stableId,
        }),
      ],
      skipDuplicates: true,
    });
    expect(result.targetSection).toMatchObject({
      version: 6,
      items: [
        { id: freshCurrentEdit.id, text: freshCurrentEdit.text },
        { id: intendedItemClone.id, text: intendedItemClone.text },
      ],
      decisions: [
        {
          id: intendedDecisionClone.id,
          text: intendedDecisionClone.text,
        },
      ],
    });
    expect(result.targetSection.items).not.toContainEqual(
      expect.objectContaining({ id: deletedPriorCarriedItem.id }),
    );
    expect(result.targetSection.decisions).not.toContainEqual(
      expect.objectContaining({ id: deletedDecision.id }),
    );
  });

  it("omits metadata for a clone deduplicated by a ResolvePlan winner", async () => {
    const plannedClone = carriedItem({
      id: "32323232-3232-4232-8232-323232323232",
      stableId: "33333333-3333-4333-8333-333333333334",
      text: "Carry-over clone planned before ResolvePlan",
    });
    const resolvedOccurrence: Item = {
      ...plannedClone,
      id: "34343434-3434-4434-8434-343434343434",
      text: "User resolved the prior plan first",
      workflowStatus: "in_progress",
      carriedOver: false,
    };
    const current = targetSection({
      version: 5,
      items: [resolvedOccurrence],
      projects: [attachedProject()],
    });
    const planned = targetSection({ version: 4, items: [plannedClone] });
    const plannedExecution = { ...execution, carriedDecisionCount: 0 };
    const record = itemCarryRecord(plannedClone);
    const tx = createTransaction({ currentSections: [current] });

    const result = await writeCarryOver(
      tx as never,
      plannedExecution,
      [record],
      [planned],
    );

    expect(result.execution).toMatchObject({
      id: plannedExecution.id,
      carriedItemCount: 0,
      carriedDecisionCount: 0,
    });
    expect(result.records).toEqual([]);
    expect(result.targetSection).toMatchObject({
      version: 5,
      items: [
        {
          id: resolvedOccurrence.id,
          stableId: resolvedOccurrence.stableId,
          text: resolvedOccurrence.text,
          carriedOver: false,
        },
      ],
    });
    expect(tx.item.createMany).not.toHaveBeenCalled();
    expect(tx.reportSection.update).not.toHaveBeenCalled();
    expect(tx.carryOverRecord.createMany).not.toHaveBeenCalled();

    const replayTx = createTransaction({
      currentSections: [current],
      existing: {
        ...existingExecution,
        id: plannedExecution.id,
        dedupeKey: plannedExecution.dedupeKey,
      },
      existingRecords: [],
    });
    const replay = await writeCarryOver(
      replayTx as never,
      plannedExecution,
      [record],
      [planned],
    );

    expect(replay.execution).toMatchObject({
      id: plannedExecution.id,
      carriedItemCount: 0,
      carriedDecisionCount: 0,
    });
    expect(replay.records).toEqual([]);
    expect(replay.targetSection.items).toEqual(result.targetSection.items);
    expect(replayTx.item.createMany).not.toHaveBeenCalled();
    expect(replayTx.reportSection.update).not.toHaveBeenCalled();
  });

  it("skips clones whose parents detached after planning but keeps attached siblings", async () => {
    const keptCurrentItem: Item = {
      ...carriedItem({
        id: "41414141-4141-4141-8141-414141414141",
        stableId: "42424242-4242-4242-8242-424242424242",
        text: "Pre-existing row on the detached product",
      }),
      projectId: detachedProjectId,
      carriedOver: false,
    };
    const attachedItem = carriedItem({
      id: "43434343-4343-4343-8343-434343434343",
      stableId: "45454545-4545-4545-8545-454545454545",
      text: "Clone on the still-attached product",
    });
    const detachedItemOnProduct: Item = {
      ...carriedItem({
        id: "46464646-4646-4646-8646-464646464646",
        stableId: "47474747-4747-4747-8747-474747474747",
        text: "Clone on the detached product",
      }),
      projectId: detachedProjectId,
    };
    const detachedItemOnActivity: Item = {
      ...carriedItem({
        id: "48484848-4848-4848-8848-484848484848",
        stableId: "49494949-4949-4949-8949-494949494949",
        text: "Clone on the detached activity",
      }),
      projectId: null,
      activityId: detachedActivityId,
      // Activities have no SDLC stage set; only product parents carry names.
      stageNames: [],
    };
    const detachedDecisionOnProduct: Decision = {
      ...carriedDecision({
        id: "51515151-5151-4151-8151-515151515151",
        stableId: "52525252-5252-4252-8252-525252525252",
        text: "Decision clone on the detached product",
      }),
      productId: detachedProjectId,
    };
    const detachedDecisionOnActivity: Decision = {
      ...carriedDecision({
        id: "53535353-5353-4353-8353-535353535353",
        stableId: "54545454-5454-4454-8454-545454545454",
        text: "Decision clone on the detached activity",
      }),
      productId: null,
      activityId: detachedActivityId,
      // Activities have no SDLC stage set; only product parents carry names.
      stageNames: [],
    };
    // The plan snapshot still shows every parent attached; the locked re-read
    // no longer holds detachedProjectId or detachedActivityId.
    const stalePlanned = targetSection({
      projects: [attachedProject(), attachedProject(detachedProjectId)],
      activities: [attachedActivity(detachedActivityId)],
      items: [attachedItem, detachedItemOnProduct, detachedItemOnActivity],
      decisions: [detachedDecisionOnProduct, detachedDecisionOnActivity],
    });
    const current = targetSection({
      projects: [attachedProject()],
      items: [keptCurrentItem],
    });
    const persisted = targetSection({
      version: 2,
      projects: [attachedProject()],
      items: [keptCurrentItem, attachedItem],
    });
    const attachedRecord = itemCarryRecord(
      attachedItem,
      "56565656-5656-4656-8656-565656565656",
    );
    const records = [
      attachedRecord,
      itemCarryRecord(
        detachedItemOnProduct,
        "57575757-5757-4757-8757-575757575757",
      ),
      itemCarryRecord(
        detachedItemOnActivity,
        "58585858-5858-4858-8858-585858585858",
      ),
      decisionCarryRecord(
        detachedDecisionOnProduct,
        "59595959-5959-4959-8959-595959595959",
      ),
      decisionCarryRecord(
        detachedDecisionOnActivity,
        "60606060-6060-4060-8060-606060606060",
      ),
    ];
    const tx = createTransaction({
      currentSections: [current],
      readbackSections: [persisted],
      itemInsertCounts: [1],
    });

    const result = await writeCarryOver(tx as never, execution, records, [
      stalePlanned,
    ]);

    expect(tx.item.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [expect.objectContaining({ id: attachedItem.id })],
      skipDuplicates: true,
    });
    expect(tx.decision.createMany).not.toHaveBeenCalled();
    expect(tx.carryOverRecord.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [
        expect.objectContaining({
          targetItemId: attachedItem.id,
          targetDecisionId: null,
          recordType: "item",
        }),
      ],
    });
    expect(result.execution).toMatchObject({
      carriedItemCount: 1,
      carriedDecisionCount: 0,
    });
    expect(result.records.map((record) => record.id)).toEqual([
      attachedRecord.id,
    ]);
    expect(result.targetSection.items.map((item) => item.id)).toEqual([
      keptCurrentItem.id,
      attachedItem.id,
    ]);
    expect(tx.reportSection.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: sectionAId },
      data: { version: { increment: 1 } },
    });
  });

  it("writes no rows, records, or revision when every planned parent detached", async () => {
    const detachedItem = carriedItem({
      id: "61616161-6161-4161-8161-616161616161",
      stableId: "62626262-6262-4262-8262-626262626262",
      text: "Clone on the detached product",
    });
    const detachedDecision = carriedDecision({
      id: "63636363-6363-4363-8363-636363636363",
      stableId: "64646464-6464-4464-8464-646464646464",
      text: "Decision clone on the detached product",
    });
    const stalePlanned = targetSection({
      projects: [attachedProject()],
      items: [detachedItem],
      decisions: [detachedDecision],
    });
    const current = targetSection();
    const tx = createTransaction({
      currentSections: [current],
      // Queued counts keep a removed membership guard failing on the no-write
      // assertions, not on an unstubbed createMany returning undefined.
      itemInsertCounts: [1],
      decisionInsertCounts: [1],
    });

    const result = await writeCarryOver(
      tx as never,
      execution,
      [
        itemCarryRecord(detachedItem, "65656565-6565-4656-8565-656565656565"),
        decisionCarryRecord(
          detachedDecision,
          "67676767-6767-4767-8767-676767676767",
        ),
      ],
      [stalePlanned],
    );

    expect(tx.item.createMany).not.toHaveBeenCalled();
    expect(tx.decision.createMany).not.toHaveBeenCalled();
    expect(tx.carryOverRecord.createMany).not.toHaveBeenCalled();
    expect(tx.reportSection.update).not.toHaveBeenCalled();
    expect(result.execution).toMatchObject({
      carriedItemCount: 0,
      carriedDecisionCount: 0,
    });
    expect(result.records).toEqual([]);
    expect(result.targetSection.items).toEqual([]);
    expect(result.targetSection.decisions).toEqual([]);
  });

  it("increments only matched sections with actual inserts", async () => {
    const sectionAItem = carriedItem();
    const sectionBItem = carriedItem({
      id: "70707070-7070-4070-8070-707070707070",
      stableId: "80808080-8080-4080-8080-808080808080",
    });
    const currentA = targetSection({
      id: sectionAId,
      projects: [attachedProject()],
    });
    const currentB = targetSection({
      id: sectionBId,
      projects: [attachedProject()],
    });
    const plannedA = targetSection({ id: sectionAId, items: [sectionAItem] });
    const plannedB = targetSection({ id: sectionBId, items: [sectionBItem] });
    const tx = createTransaction({
      currentSections: [currentA, currentB],
      readbackSections: [
        targetSection({ id: sectionAId, version: 2, items: [sectionAItem] }),
        currentB,
      ],
      itemInsertCounts: [1, 0],
    });

    await writeCarryOver(
      tx as never,
      execution,
      [
        itemCarryRecord(sectionAItem),
        itemCarryRecord(sectionBItem, "31313131-3131-4131-8131-313131313131"),
      ],
      [plannedA, plannedB],
    );

    expect(tx.reportSection.update).toHaveBeenCalledTimes(1);
    expect(tx.reportSection.update).toHaveBeenCalledWith({
      where: { id: sectionAId },
      data: { version: { increment: 1 } },
    });
  });

  it.each([
    {
      name: "empty plan",
      current: targetSection(),
      planned: targetSection(),
      records: [],
    },
    {
      name: "fully deduplicated plan",
      current: targetSection({
        items: [carriedItem()],
        projects: [attachedProject()],
      }),
      planned: targetSection({
        items: [carriedItem({ id: "90909090-9090-4090-8090-909090909090" })],
      }),
      records: [
        itemCarryRecord(
          carriedItem({ id: "90909090-9090-4090-8090-909090909090" }),
        ),
      ],
    },
  ])(
    "leaves the version unchanged for a $name",
    async ({ current, planned, records }) => {
      const tx = createTransaction({
        currentSections: [current],
        readbackSections: [current],
        itemInsertCounts: current.items.length === 0 ? [] : [0],
      });

      const result = await writeCarryOver(tx as never, execution, records, [
        planned,
      ]);

      expect(tx.reportSection.update).not.toHaveBeenCalled();
      expect(result.targetSection.version).toBe(current.version);
    },
  );
});

describe("writeCarryOver — scheduled dual-state interleaving", () => {
  it("rejects a legacy-looking target after archive/unarchive leaves periodState scheduled", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce([
        {
          ...editableReportLock,
          periodState: "scheduled",
        },
      ]),
      reportSection: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      carryOverExecution: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      carryOverRecord: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
      item: { createMany: vi.fn() },
      decision: { findMany: vi.fn(), createMany: vi.fn() },
    };

    await expect(
      writeCarryOver(tx as never, execution, [], [targetSection()]),
    ).rejects.toThrow("Carry-over target period is no longer editable.");
    expect(tx.reportSection.findMany).not.toHaveBeenCalled();
    expect(tx.carryOverExecution.create).not.toHaveBeenCalled();
    expect(tx.carryOverRecord.createMany).not.toHaveBeenCalled();
    expect(tx.item.createMany).not.toHaveBeenCalled();
    expect(tx.decision.createMany).not.toHaveBeenCalled();
    expect(tx.reportSection.update).not.toHaveBeenCalled();
  });
});

describe("writeCarryOver — empty locked target re-read", () => {
  it("throws ReportSectionNotFoundError and writes nothing when the planned targets vanished", async () => {
    const tx = createTransaction({ currentSections: [] });

    await expect(
      writeCarryOver(tx as never, execution, [], [targetSection()]),
    ).rejects.toBeInstanceOf(ReportSectionNotFoundError);

    expect(tx.carryOverExecution.findFirst).not.toHaveBeenCalled();
    expect(tx.carryOverExecution.create).not.toHaveBeenCalled();
    expect(tx.carryOverRecord.createMany).not.toHaveBeenCalled();
    expect(tx.item.createMany).not.toHaveBeenCalled();
    expect(tx.decision.createMany).not.toHaveBeenCalled();
    expect(tx.reportSection.update).not.toHaveBeenCalled();
  });
});
