import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { buildPrintActivityReports } from "./print-activity-projection";

const ACTIVITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("buildPrintActivityReports", () => {
  it("preserves frozen Activity records, authors, status, and priority exactly once", () => {
    const first = makeReportSectionFixture({
      reportSectionId: "11111111-1111-4111-8111-111111111111",
      authorId: "22222222-2222-4222-8222-222222222222",
      authorName: "Alex Morgan",
      activities: [
        {
          activityId: ACTIVITY_ID,
          activityName: "Support rotation",
          status: "yellow",
          derivedStatus: "yellow",
          linkedProducts: [],
        },
      ],
      items: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          activityId: ACTIVITY_ID,
          projectId: null,
          type: "next",
          text: "Cover the holiday shift",
          tag: "operations",
          workflowStatus: "postponed",
          carriedOver: false,
          priorityRank: 2,
        },
      ],
      risks: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          activityId: ACTIVITY_ID,
          projectId: null,
          risk: "Coverage gap",
          impact: "Slow response",
          mitigation: "Add backup",
          severity: "at-risk",
        },
      ],
    });
    const second = makeReportSectionFixture({
      reportSectionId: "55555555-5555-4555-8555-555555555555",
      authorId: "66666666-6666-4666-8666-666666666666",
      authorName: "Blair Chen",
      activities: [
        {
          activityId: ACTIVITY_ID,
          activityName: "Support rotation",
          status: "red",
          derivedStatus: "red",
          linkedProducts: [],
        },
      ],
      decisions: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          activityId: ACTIVITY_ID,
          productId: null,
          text: "Approve backup rotation",
          owner: "Operations",
          impact: "Restore coverage",
        },
      ],
    });

    const reports = buildPrintActivityReports([first, second]);

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      id: ACTIVITY_ID,
      name: "Support rotation",
      status: "blocked",
      contributors: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Alex Morgan",
          initials: "AM",
        },
        {
          id: "66666666-6666-4666-8666-666666666666",
          name: "Blair Chen",
          initials: "BC",
        },
      ],
    });
    expect(reports[0]?.nextWeek).toEqual([
      expect.objectContaining({
        id: "33333333-3333-4333-8333-333333333333",
        authorId: "22222222-2222-4222-8222-222222222222",
        authorName: "Alex Morgan",
        status: "postponed",
        priorityRank: 2,
      }),
    ]);
    expect(reports[0]?.risks.map((risk) => risk.id)).toEqual([
      "44444444-4444-4444-8444-444444444444",
    ]);
    expect(reports[0]?.decisions.map((decision) => decision.id)).toEqual([
      "77777777-7777-4777-8777-777777777777",
    ]);
  });

  it("retains a status-only Activity and its contributor", () => {
    const section = makeReportSectionFixture({
      authorId: "88888888-8888-4888-8888-888888888888",
      authorName: "Casey Diaz",
      activities: [
        {
          activityId: ACTIVITY_ID,
          activityName: "Release duty",
          status: "green",
          derivedStatus: "green",
          linkedProducts: [],
        },
      ],
    });

    expect(buildPrintActivityReports([section])).toEqual([
      expect.objectContaining({
        id: ACTIVITY_ID,
        name: "Release duty",
        status: "on-track",
        contributors: [
          expect.objectContaining({
            id: "88888888-8888-4888-8888-888888888888",
            name: "Casey Diaz",
          }),
        ],
        currentWeek: [],
        nextWeek: [],
        risks: [],
        decisions: [],
      }),
    ]);
  });
});
