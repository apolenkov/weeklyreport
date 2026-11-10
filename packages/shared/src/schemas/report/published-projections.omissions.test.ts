// The frozen section scope row carries how many unfinished risks and decisions
// its section left out (openspec: lead-incomplete-record-drafts, task 4.2).
import { describe, expect, it } from "vitest";

import type { RecordOmission } from "../report-sections/record-omission.schema.js";
import { buildPublishedProjections } from "./published-projections.js";

const REPORT_ID = "40000000-0000-4000-8000-000000000001";
const PROJECT_ID = "40000000-0000-4000-8000-000000000002";

function snapshotWith(recordOmission?: RecordOmission) {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-08-24T00:00:00.000Z"),
    periodEnd: new Date("2026-08-30T23:59:59.999Z"),
    deadline: new Date("2026-08-28T12:00:00.000Z"),
    status: "published" as const,
    publishedAt: new Date("2026-08-24T12:00:00.000Z"),
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green" as const,
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [
      {
        reportSectionId: "40000000-0000-4000-8000-000000000003",
        reportId: REPORT_ID,
        authorId: "40000000-0000-4000-8000-000000000004",
        authorName: "Lead",
        authorRole: "lead" as const,
        version: 1,
        status: "submitted" as const,
        submittedAt: new Date("2026-08-24T12:00:00.000Z"),
        late: false,
        projects: [],
        referencedProjects: [],
        items: [],
        risks: [],
        decisions: [],
        activities: [],
        reviews: [],
        groupId: "40000000-0000-4000-8000-000000000005",
        groupName: "Group",
        ...(recordOmission ? { recordOmission } : {}),
      },
    ],
  };
}

function totalsFor(recordOmission?: RecordOmission) {
  const [scope] = buildPublishedProjections(
    snapshotWith(recordOmission),
  ).sectionScopes;
  return [scope?.omittedRisks, scope?.omittedDecisions];
}

describe("buildPublishedProjections omission totals", () => {
  it("freezes the totals of a section whose only content was left out", () => {
    const totals = totalsFor({
      version: 1,
      buckets: [
        {
          kind: "risk",
          parentKind: "product",
          parentId: PROJECT_ID,
          stageNames: ["Development"],
          count: 2,
        },
        {
          kind: "decision",
          parentKind: "product",
          parentId: PROJECT_ID,
          stageNames: ["Development"],
          count: 1,
        },
      ],
    });

    expect(totals).toEqual([2, 1]);
  });

  it("freezes a known zero for a counted section with nothing left out", () => {
    expect(totalsFor({ version: 1, buckets: [] })).toEqual([0, 0]);
  });

  it("freezes unknown, never zero, for a section without omission metadata", () => {
    expect(totalsFor()).toEqual([null, null]);
  });
});
