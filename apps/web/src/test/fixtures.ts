import type { ReportSectionReadModel } from "@customreport/shared";

/**
 * Creates a demo section matching reportSectionReadModelSchema
 * for use in component tests. Replaces the deleted demo-section.ts.
 */
export function createDemoSection(): ReportSectionReadModel {
  return {
    reportSectionId: "11111111-1111-4111-8111-111111111111",
    reportId: "22222222-2222-4222-8222-222222222222",
    authorId: "33333333-3333-4333-8333-333333333333",
    authorName: "Lead 1",
    status: "draft",
    submittedAt: null,
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
    risks: [],
    decisions: [],
    priorities: [
      { rank: 1, text: "Priority 1" },
      { rank: 2, text: "Priority 2" },
      { rank: 3, text: "Priority 3" },
    ],
  };
}
