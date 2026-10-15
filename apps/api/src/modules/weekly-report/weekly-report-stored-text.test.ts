import type {
  PublishedReportSnapshot,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionReadModel } from "../../test-utils/report-section-fixtures.js";
import {
  buildLiveResult,
  buildPublishedReadModelFromSnapshot,
  type WeeklyReportRow,
} from "./weekly-report-read-model.js";

// TASK-503.108: U+2060 alone passed the earlier write rule; the current write
// rule rejects it. Reading a stored row must not re-apply the write rule.
const LEGACY = "⁠";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000005";
const GROUP_ID = "10800000-0000-4000-8000-000000000010";

const item: ReportSectionReadModel["items"][number] = {
  id: "10800000-0000-4000-8000-000000000011",
  stableId: "10800000-0000-4000-8000-000000000012",
  projectId: null,
  activityId: ACTIVITY_ID,
  stageNames: [],
  type: "current",
  text: LEGACY,
  tag: "general",
  workflowStatus: "in_progress",
  carriedOver: false,
  pausedReason: null,
  nextStepText: LEGACY,
};
const risk: ReportSectionReadModel["risks"][number] = {
  id: "10800000-0000-4000-8000-000000000013",
  stableId: "10800000-0000-4000-8000-000000000014",
  projectId: null,
  activityId: ACTIVITY_ID,
  stageNames: [],
  risk: LEGACY,
  impact: "Visible impact",
  mitigation: LEGACY,
  severity: "at-risk",
};
const decision: ReportSectionReadModel["decisions"][number] = {
  id: "10800000-0000-4000-8000-000000000015",
  stableId: "10800000-0000-4000-8000-000000000016",
  productId: null,
  activityId: ACTIVITY_ID,
  stageNames: [],
  text: LEGACY,
  owner: "Test Lead",
  impact: LEGACY,
};
const storedSection = makeReportSectionReadModel({
  status: "submitted",
  items: [item],
  risks: [risk],
  decisions: [decision],
});

const metadata = {
  periodState: "published",
  periodStatus: "published",
  archived: false,
  weekLabel: "Week 23",
} as const;
const period = {
  periodStart: new Date("2026-06-01T00:00:00.000Z"),
  periodEnd: new Date("2026-06-07T00:00:00.000Z"),
  deadline: null,
};
const progress = { submitted: 1, total: 1 };

function expectStoredRows(sections: readonly ReportSectionReadModel[]) {
  const [section] = sections;
  expect(section?.items).toEqual([item]);
  expect(section?.risks).toEqual([risk]);
  expect(section?.decisions).toEqual([decision]);
}

describe("weekly read model over stored text the write rule now rejects", () => {
  it("returns frozen snapshot rows exactly", () => {
    const snapshot = {
      reportId: storedSection.reportId,
      ...period,
      sections: [{ ...storedSection, groupId: GROUP_ID, groupName: "Group" }],
    } as unknown as PublishedReportSnapshot;

    const model = buildPublishedReadModelFromSnapshot(
      snapshot,
      metadata,
      progress,
    );

    expectStoredRows(model.leadSections);
  });

  it("returns live section rows exactly", () => {
    const report = {
      id: storedSection.reportId,
      ...period,
      ...metadata,
      periodState: "open",
      periodStatus: "open",
    } as unknown as WeeklyReportRow;

    const { readModel } = buildLiveResult(
      report,
      [{ ...storedSection, groupId: null, groupName: null, canReview: false }],
      [],
      { crossGroup: [] as never, progress, activeDeadlineRuleId: null },
    );

    expectStoredRows(readModel.leadSections);
  });
});
