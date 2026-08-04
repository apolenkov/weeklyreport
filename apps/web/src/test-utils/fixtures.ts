import type { ReportSectionReadModel } from "@customreport/shared";

import { makeReportSectionFixture } from "./report-section-fixtures";

export function createDemoSection(): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    authorId: "33333333-3333-4333-8333-333333333333",
    authorName: "Lead 1",
    projects: [
      {
        projectId: "44444444-4444-4444-8444-444444444444",
        projectName: "Project 1",
        trafficLight: null,
      },
    ],
    items: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        projectId: "44444444-4444-4444-8444-444444444444",
        type: "current",
        text: "Current week draft item",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
      },
    ],
  });
}
