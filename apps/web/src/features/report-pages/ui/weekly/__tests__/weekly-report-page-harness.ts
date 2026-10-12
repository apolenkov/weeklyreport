import type { WeeklyReportReadModel } from "@weeklyreport/shared";

import {
  makeWeeklyReportFixture,
  type WeeklyReportFixture,
} from "../../../../../test-utils/report-section-fixtures";

export const REPORT_ID = "11111111-1111-4111-8111-111111111111";
export const AUTHOR_ID_A = "11111111-1111-4111-8111-aaaaaaaaaaaa";
export const PRODUCT_ID_A = "11111111-1111-4111-8111-cccccccccccc";
export const PRODUCT_ID_B = "11111111-1111-4111-8111-dddddddddddd";

export function makeWeeklyReportData(
  periodStatus: "open" | "published" | "reopened",
  overrides: WeeklyReportFixture = {},
): WeeklyReportReadModel {
  return makeWeeklyReportFixture({
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    periodState: periodStatus === "published" ? "published" : "open",
    periodStatus,
    archived: false,
    weekLabel: "Week 16",
    submissionCount: 4,
    totalLeads: 6,
    portfolioOverview: [
      {
        productId: PRODUCT_ID_A,
        productName: "Product Alpha",
        worstStatus: "green",
        stageCount: 1,
        leadNames: ["Alice"],
        leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
      },
    ],
    leadSections: [
      {
        reportSectionId: "22222222-2222-4222-8222-aaaaaaaaaaa1",
        reportId: REPORT_ID,
        authorId: AUTHOR_ID_A,
        authorName: "Alice",
        status: "submitted",
        submittedAt: new Date("2026-04-14T09:00:00Z"),
        projects: [
          {
            projectId: PRODUCT_ID_A,
            projectName: "Product Alpha",
            trafficLight: "green",
          },
        ],
        items: [
          {
            id: "33333333-3333-4333-8333-aaaaaaaaaa01",
            projectId: PRODUCT_ID_A,
            type: "current",
            text: "Done task A",
            tag: "Dev",
            workflowStatus: "done",
            stageNames: ["Development"],
            carriedOver: false,
          },
        ],
        risks: [],
        decisions: [],
        activities: [],
      },
    ],
    escalations: [],
    ...overrides,
  });
}

export type WeeklyReportData = ReturnType<typeof makeWeeklyReportData>;
