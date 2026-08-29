import type {
  CarryOverExecution,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { writeCarryOver } from "./carry-over.write-transaction";

const sourceReportId = "22222222-2222-4222-8222-222222222222";
const targetReportId = "55555555-5555-4555-8555-555555555555";
const projectId = "44444444-4444-4444-8444-444444444444";
const sectionId = "11111111-1111-4111-8111-111111111111";

const execution: CarryOverExecution = {
  id: "aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sourceReportId,
  targetReportId,
  dedupeKey: `${sourceReportId}:${targetReportId}`,
  status: "completed",
  startedAt: new Date("2026-05-04T09:30:00.000Z"),
  completedAt: new Date("2026-05-04T09:30:00.000Z"),
  carriedItemCount: 1,
  carriedDecisionCount: 0,
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

function targetSectionWithCarriedRow(): ReportSectionReadModel {
  return {
    reportSectionId: sectionId,
    reportId: targetReportId,
    authorId: "33333333-3333-4333-8333-333333333333",
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [],
    referencedProjects: [],
    // A carried row the previous run already persisted: replaying the
    // execution must NOT re-run this insert.
    items: [
      {
        id: "cccc0000-cccc-4ccc-8ccc-cccccccccccc",
        stableId: "dddd0000-dddd-4ddd-8ddd-dddddddddddd",
        projectId,
        type: "current",
        text: "Already persisted carried item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: true,
      },
    ],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
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
      name: section.authorName,
      role: section.authorRole,
      stageAssignments: [],
    },
    projectStatuses: [],
    stageStatuses: [],
    activityStatuses: [],
    items: [],
    risks: [],
    decisions: [],
    sectionReviews: [],
  };
}

// Replaying a recorded execution must stay read-only: the winner already
// persisted its carried rows, so no row write may re-run on a replay.
describe("writeCarryOver — replay of a completed execution", () => {
  it("does not re-execute row writes when the execution already exists", async () => {
    const itemCreateMany = vi.fn();
    const decisionCreateMany = vi.fn();
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ periodStatus: "open", archived: false }])
        .mockResolvedValueOnce([{ id: sectionId }]),
      reportSection: {
        findMany: vi
          .fn()
          .mockResolvedValue([prismaSectionRow(targetSectionWithCarriedRow())]),
      },
      carryOverExecution: {
        findFirst: vi.fn().mockResolvedValue(existingExecution),
      },
      carryOverRecord: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      item: { createMany: itemCreateMany },
      decision: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: decisionCreateMany,
      },
    };

    const result = await writeCarryOver(
      tx as never,
      execution,
      [],
      [targetSectionWithCarriedRow()],
    );

    expect(result.execution.id).toBe(existingExecution.id);
    expect(itemCreateMany).not.toHaveBeenCalled();
    expect(decisionCreateMany).not.toHaveBeenCalled();
  });

  it("still persists carried rows on the create path (fresh execution)", async () => {
    const itemCreateMany = vi.fn();
    const decisionCreateMany = vi.fn();
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ periodStatus: "open", archived: false }])
        .mockResolvedValueOnce([{ id: sectionId }]),
      reportSection: {
        findMany: vi
          .fn()
          .mockResolvedValue([prismaSectionRow(targetSectionWithCarriedRow())]),
      },
      carryOverExecution: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      carryOverRecord: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      item: { createMany: itemCreateMany },
      decision: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: decisionCreateMany,
      },
    };

    const result = await writeCarryOver(
      tx as never,
      execution,
      [],
      [targetSectionWithCarriedRow()],
    );

    expect(result.execution.id).toBe(execution.id);
    expect(itemCreateMany).toHaveBeenCalledExactlyOnceWith({
      data: [
        {
          id: "cccc0000-cccc-4ccc-8ccc-cccccccccccc",
          stableId: "dddd0000-dddd-4ddd-8ddd-dddddddddddd",
          reportSectionId: sectionId,
          projectId,
          activityId: null,
          type: "current",
          text: "Already persisted carried item",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: true,
          priorityRank: null,
          stageNames: [],
        },
      ],
      skipDuplicates: true,
    });
    expect(decisionCreateMany).not.toHaveBeenCalled();
  });
});
