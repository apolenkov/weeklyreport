// How many unfinished risks and decisions the weekly report tells its reader
// the shown sections leave out (openspec: lead-incomplete-record-drafts).
import type {
  PublishedReportSnapshot,
  RecordOmission,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionReadModel } from "../../test-utils/report-section-fixtures.js";
import {
  buildLiveResult,
  buildPublishedReadModelFromSnapshot,
  type WeeklyReportRow,
} from "./weekly-report-read-model.js";

const PRODUCT_ID = "10900000-0000-4000-8000-000000000001";
const GROUP_ID = "10900000-0000-4000-8000-000000000002";
const section = makeReportSectionReadModel({ status: "submitted" });
const period = {
  periodStart: new Date("2026-06-01T00:00:00.000Z"),
  periodEnd: new Date("2026-06-07T00:00:00.000Z"),
  deadline: null,
};
const metadata = {
  periodState: "published",
  periodStatus: "published",
  archived: false,
  weekLabel: "Week 23",
} as const;
const progress = { submitted: 1, total: 1 };

const OMISSION: RecordOmission = {
  version: 1,
  buckets: [
    {
      kind: "risk",
      parentKind: "product",
      parentId: PRODUCT_ID,
      stageNames: ["Development"],
      count: 2,
    },
    {
      kind: "decision",
      parentKind: "product",
      parentId: PRODUCT_ID,
      stageNames: [],
      count: 1,
    },
  ],
};

function publishedModel(recordOmissions: readonly (RecordOmission | null)[]) {
  const snapshot = {
    reportId: section.reportId,
    ...period,
    sections: recordOmissions.map((recordOmission) => ({
      ...section,
      groupId: GROUP_ID,
      groupName: "Group",
      ...(recordOmission ? { recordOmission } : {}),
    })),
  } as unknown as PublishedReportSnapshot;
  return buildPublishedReadModelFromSnapshot(snapshot, metadata, progress);
}

const liveRecord = (impact: string | null) => ({
  projectId: PRODUCT_ID,
  productId: PRODUCT_ID,
  activityId: null,
  stageNames: ["Development"],
  impact,
  mitigation: "Second vendor",
});

function liveModel(sections: readonly object[]) {
  const report = {
    id: section.reportId,
    ...period,
    ...metadata,
    periodState: "open",
    periodStatus: "open",
    sections,
  } as unknown as WeeklyReportRow;
  return buildLiveResult(
    report,
    [{ ...section, groupId: null, groupName: null, canReview: false }],
    [],
    { crossGroup: [] as never, progress, activeDeadlineRuleId: null },
  ).readModel;
}

describe("weekly report omitted-record counts", () => {
  it("adds up the counts frozen with each shown published section", () => {
    const model = publishedModel([OMISSION, OMISSION]);

    expect(model.recordOmissions).toEqual({
      risks: 4,
      decisions: 2,
      unknown: false,
    });
    // Totals only: no bucket travels with a section.
    expect(model.leadSections[0]).not.toHaveProperty("recordOmission");
  });

  it("answers unknown when a shown section was frozen before counts existed", () => {
    expect(publishedModel([OMISSION, null]).recordOmissions).toEqual({
      risks: 2,
      decisions: 1,
      unknown: true,
    });
  });

  it("counts a live report's unfinished records from its scoped rows", () => {
    const model = liveModel([
      {
        risks: [liveRecord(null), liveRecord("Date slips")],
        decisions: [liveRecord(null)],
      },
      { risks: [], decisions: [liveRecord("Costs rise")] },
    ]);

    expect(model.recordOmissions).toEqual({
      risks: 1,
      decisions: 1,
      unknown: false,
    });
  });

  it("reports zero, not unknown, when nothing is left out", () => {
    expect(liveModel([]).recordOmissions).toEqual({
      risks: 0,
      decisions: 0,
      unknown: false,
    });
  });
});
