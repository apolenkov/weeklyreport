import type { TrafficLightStatus } from "@customreport/shared";

// The weekly-report page suite is split across four files by concern. The
// `vi.mock` calls cannot be shared (vitest hoists them per module), but this
// fixture is a plain factory and is shared from here so the four stay in step.

export const REPORT_ID = "11111111-1111-4111-8111-111111111111";
export const AUTHOR_ID_A = "11111111-1111-4111-8111-aaaaaaaaaaaa";
export const PRODUCT_ID_A = "11111111-1111-4111-8111-cccccccccccc";
export const PRODUCT_ID_B = "11111111-1111-4111-8111-dddddddddddd";
export function makeWeeklyReportData(
  periodStatus: "open" | "published" | "reopened",
  overrides?: {
    readonly portfolioOverview?: {
      readonly productId: string;
      readonly productName: string;
      readonly worstStatus: TrafficLightStatus | "empty";
      readonly stageCount: number;
      readonly leadNames: string[];
    }[];
    readonly leadSections?: {
      readonly reportSectionId: string;
      readonly reportId: string;
      readonly authorId: string;
      readonly authorName: string;
      readonly status: "submitted" | "draft" | "locked";
      readonly submittedAt: Date | null;
      readonly projects: { projectId: string; projectName: string }[];
      readonly items: {
        readonly id: string;
        readonly projectId: string;
        readonly type: "current" | "next";
        readonly text: string;
        readonly tag: string;
        readonly workflowStatus:
          "in_progress" | "done" | "blocked" | "canceled" | "not_started";
        readonly carriedOver: boolean;
        readonly completed: boolean;
      }[];
      readonly risks: never[];
      readonly decisions: never[];
      readonly priorities: never[];
      readonly activities?: {
        readonly activityId: string;
        readonly activityName: string;
        readonly status: TrafficLightStatus | null;
        readonly note?: string | null;
      }[];
    }[];
  },
) {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    periodStatus,
    archived: false,
    weekLabel: "Week 16",
    submissionCount: 4,
    totalLeads: 6,
    portfolioOverview: overrides?.portfolioOverview ?? [
      {
        productId: PRODUCT_ID_A,
        productName: "Product Alpha",
        worstStatus: "green",
        stageCount: 1,
        leadNames: ["Alice"],
      },
    ],
    leadSections: overrides?.leadSections ?? [
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
            carriedOver: false,
            completed: true,
          },
        ],
        risks: [],
        decisions: [],
        priorities: [],
      },
    ],
    escalations: [],
  };
}
