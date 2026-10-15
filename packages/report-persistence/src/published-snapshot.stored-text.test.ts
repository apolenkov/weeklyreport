import { buildPublishedProjections } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  buildAssembledReportFromPrismaRow,
  toPublishedSnapshotJson,
} from "./published-report-snapshot.js";
import { requirePublishedSnapshot } from "./published-snapshot.js";

type Row = Parameters<typeof buildAssembledReportFromPrismaRow>[0];

// TASK-503.108: text and a stage name that earlier write rules admitted and
// the current ones reject — U+2060 (reject-invisible-only-safe-text) and
// U+3164 HANGUL FILLER (the later invisible family). Publication, snapshot
// JSON, snapshot reads and projections must keep them exactly.
const LEGACY = "⁠";
const LATER_FAMILY = "ㅤ";
const groupId = "10800000-0000-4000-8000-000000000031";
const reportId = "10800000-0000-4000-8000-000000000032";
const productId = "10800000-0000-4000-8000-000000000033";
const product = { id: productId, name: "Product", archived: false };

const storedItem = {
  id: "10800000-0000-4000-8000-000000000034",
  stableId: "10800000-0000-4000-8000-000000000035",
  projectId: productId,
  project: product,
  activityId: null,
  type: "current",
  text: LEGACY,
  tag: LATER_FAMILY,
  workflowStatus: "in_progress",
  carriedOver: false,
  priorityRank: null,
  pausedReason: null,
  nextStepText: LEGACY,
  resolution: null,
  stageNames: [LEGACY],
  recordComments: [],
};
const storedRisk = {
  id: "10800000-0000-4000-8000-000000000036",
  stableId: "10800000-0000-4000-8000-000000000037",
  projectId: productId,
  project: product,
  activityId: null,
  risk: LATER_FAMILY,
  impact: LEGACY,
  mitigation: LEGACY,
  severity: "at-risk",
  stageNames: [LATER_FAMILY],
  recordComments: [],
};
const storedDecision = {
  id: "10800000-0000-4000-8000-000000000038",
  stableId: "10800000-0000-4000-8000-000000000039",
  productId,
  project: product,
  activityId: null,
  text: LEGACY,
  owner: LEGACY,
  deadline: null,
  impact: LATER_FAMILY,
  resolvedAt: null,
  stageNames: [LEGACY],
  recordComments: [],
};

const row = {
  id: reportId,
  periodStart: new Date("2026-09-21T00:00:00Z"),
  periodEnd: new Date("2026-09-27T00:00:00Z"),
  deadline: new Date("2026-09-28T00:00:00Z"),
  status: "published",
  publishedAt: new Date("2026-09-29T00:00:00Z"),
  publishedById: "10800000-0000-4000-8000-000000000040",
  publishedBy: { name: "Head" },
  sections: [
    {
      id: "10800000-0000-4000-8000-000000000041",
      reportId,
      authorId: "10800000-0000-4000-8000-000000000042",
      version: 1,
      status: "submitted",
      submittedAt: new Date("2026-09-28T10:00:00Z"),
      late: false,
      author: {
        name: "Lead",
        role: "lead",
        stageAssignments: [],
        reportingGroupId: groupId,
        reportingGroup: { id: groupId, name: "Group" },
      },
      items: [storedItem],
      risks: [storedRisk],
      decisions: [storedDecision],
      activityStatuses: [],
      itemOutcomeEvents: [],
      stageStatuses: [],
      projectStatuses: [],
      sectionReviews: [],
    },
  ],
} as unknown as Row;

describe("publication snapshot over stored text the write rule now rejects", () => {
  it("publishes, stores, reads back and projects the rows exactly", () => {
    const assembled = buildAssembledReportFromPrismaRow(row);
    const snapshot = requirePublishedSnapshot(
      toPublishedSnapshotJson(assembled),
      reportId,
    );

    const [section] = snapshot.sections;
    expect(section?.items[0]).toMatchObject({
      text: LEGACY,
      tag: LATER_FAMILY,
      nextStepText: LEGACY,
      stageNames: [LEGACY],
    });
    expect(section?.risks[0]).toMatchObject({
      risk: LATER_FAMILY,
      impact: LEGACY,
      mitigation: LEGACY,
      stageNames: [LATER_FAMILY],
    });
    expect(section?.decisions[0]).toMatchObject({
      text: LEGACY,
      owner: LEGACY,
      impact: LATER_FAMILY,
      stageNames: [LEGACY],
    });
    expect(
      buildPublishedProjections(snapshot).searchDocuments.map(
        (document) => document.recordId,
      ),
    ).toEqual(
      expect.arrayContaining([storedItem.id, storedRisk.id, storedDecision.id]),
    );
  });
});
