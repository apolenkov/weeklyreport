import type { MyHistoryEntry } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  buildLeadSlidePeriodOptions,
  resolveLeadSlideReportId,
} from "./lead-slide-periods";

const CURRENT_REPORT_ID = "11111111-1111-4111-8111-111111111111";
const PUBLISHED_REPORT_ID = "22222222-2222-4222-8222-222222222222";
const ARCHIVED_REPORT_ID = "33333333-3333-4333-8333-333333333333";

function historyEntry(
  reportId: string,
  periodStart: string,
  archived = false,
): MyHistoryEntry {
  return {
    sectionId: reportId.replaceAll("1", "4").replaceAll("2", "5"),
    reportId,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodStart),
    reportStatus: "published",
    sectionStatus: "submitted",
    archived,
    submittedAt: new Date(periodStart),
    publishedAt: new Date(periodStart),
  };
}

describe("lead slide periods", () => {
  it("builds newest-first period options with current and archived labels", () => {
    const options = buildLeadSlidePeriodOptions(
      [
        historyEntry(ARCHIVED_REPORT_ID, "2026-04-27T00:00:00.000Z", true),
        historyEntry(CURRENT_REPORT_ID, "2026-05-11T00:00:00.000Z"),
        historyEntry(PUBLISHED_REPORT_ID, "2026-05-04T00:00:00.000Z"),
      ],
      CURRENT_REPORT_ID,
    );

    expect(options.map((option) => option.reportId)).toEqual([
      CURRENT_REPORT_ID,
      PUBLISHED_REPORT_ID,
      ARCHIVED_REPORT_ID,
    ]);
    expect(options[0]?.label).toContain("(Current)");
    expect(options[2]?.label).toContain("(Archived)");
  });

  it("leaves a plain (non-current, non-archived) option's label without a suffix", () => {
    const options = buildLeadSlidePeriodOptions(
      [historyEntry(PUBLISHED_REPORT_ID, "2026-05-04T00:00:00.000Z")],
      CURRENT_REPORT_ID,
    );
    expect(options).toHaveLength(1);
    expect(options[0]?.label).not.toContain("(Current)");
    expect(options[0]?.label).not.toContain("(Archived)");
  });

  it("keeps an explicit requested id authoritative beyond the bounded options page", () => {
    const options = buildLeadSlidePeriodOptions(
      [
        historyEntry(ARCHIVED_REPORT_ID, "2026-04-27T00:00:00.000Z", true),
        historyEntry(PUBLISHED_REPORT_ID, "2026-05-04T00:00:00.000Z"),
      ],
      null,
    );

    expect(
      resolveLeadSlideReportId({
        options,
        requestedReportId: ARCHIVED_REPORT_ID,
        activeReportId: null,
      }),
    ).toBe(ARCHIVED_REPORT_ID);
    expect(
      resolveLeadSlideReportId({
        options,
        requestedReportId: "99999999-9999-4999-8999-999999999999",
        activeReportId: PUBLISHED_REPORT_ID,
      }),
    ).toBe("99999999-9999-4999-8999-999999999999");
    expect(
      resolveLeadSlideReportId({
        options,
        requestedReportId: null,
        activeReportId: null,
      }),
    ).toBe(PUBLISHED_REPORT_ID);
  });

  it("falls back to the newest option even when every option is archived", () => {
    const options = buildLeadSlidePeriodOptions(
      [
        historyEntry(ARCHIVED_REPORT_ID, "2026-04-27T00:00:00.000Z", true),
        historyEntry(PUBLISHED_REPORT_ID, "2026-05-04T00:00:00.000Z", true),
      ],
      null,
    );

    expect(
      resolveLeadSlideReportId({
        options,
        requestedReportId: null,
        activeReportId: null,
      }),
    ).toBe(PUBLISHED_REPORT_ID);
  });
});
