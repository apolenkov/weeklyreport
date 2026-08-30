import type { WeeklyReportReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  makeWeeklyReportFixture,
  type WeeklyReportFixture,
} from "../../../test-utils/report-section-fixtures";
import { mapWeeklyReport } from "./weekly-report";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_A = "22222222-2222-4222-8222-222222222222";
const SECTION_A = "44444444-4444-4444-8444-444444444444";
const AUTHOR_A = "66666666-6666-4666-8666-666666666666";
function baseReport(
  overrides: WeeklyReportFixture = {},
): WeeklyReportReadModel {
  return makeWeeklyReportFixture({
    reportId: REPORT_ID,
    ...overrides,
  });
}

describe("mapWeeklyReport", () => {
  it("returns empty portfolio and products for an empty report", () => {
    const result = mapWeeklyReport(baseReport());
    expect(result).toEqual({
      period: {
        id: REPORT_ID,
        reportId: REPORT_ID,
        periodStatus: "open",
        archived: false,
        weekLabel: "Week 16",
        dateRange: "Apr 14–20, 2026",
        isCurrent: true,
        periodStart: new Date("2026-04-14T00:00:00Z"),
      },
      portfolio: [],
      products: [],
      submissionLabel: "0/0 submitted",
      periodStatus: "open",
      submissionCount: 0,
      totalLeads: 0,
    });
  });

  it("maps a complete report through one stable output contract", () => {
    const report = baseReport({
      periodStatus: "reopened",
      weekLabel: null,
      submissionCount: 1,
      totalLeads: 2,
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "Core",
          worstStatus: null,
          stageCount: 1,
          leadNames: ["Alex Lead"],
          leadIds: ["fdbe9b32-8141-593c-9cad-f8f26def402f"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Alex Lead",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            {
              projectId: PROJECT_A,
              projectName: "Core",
              trafficLight: null,
            },
          ],
          items: [
            {
              id: "current-1",
              projectId: PROJECT_A,
              type: "current",
              text: "Ship release",
              tag: "delivery",
              workflowStatus: "in_progress",
              carriedOver: false,
              priorityRank: 2,
              stageNames: ["Build"],
            },
            {
              id: "next-1",
              projectId: PROJECT_A,
              type: "next",
              text: "Plan follow-up",
              tag: "planning",
              workflowStatus: "planned",
              carriedOver: false,
              stageNames: ["Planning"],
            },
          ],
          risks: [
            {
              id: "risk-1",
              projectId: PROJECT_A,
              risk: "Vendor delay",
              impact: "Release slips",
              mitigation: "Escalate",
              severity: "blocked",
              stageNames: ["Build"],
            },
          ],
          decisions: [
            {
              id: "decision-1",
              productId: PROJECT_A,
              text: "Approve launch",
              owner: "Head",
              impact: "Release",
            },
          ],
        },
      ],
      escalations: [
        {
          type: "blocked",
          productName: "Core",
          stageName: "Build",
          leadName: "Alex Lead",
          description: "Launch needs approval.",
        },
      ],
    });

    expect(mapWeeklyReport(report)).toEqual({
      period: {
        id: REPORT_ID,
        reportId: REPORT_ID,
        periodStatus: "reopened",
        archived: false,
        weekLabel: "Week 16",
        dateRange: "Apr 14–20, 2026",
        isCurrent: true,
        periodStart: new Date("2026-04-14T00:00:00Z"),
      },
      portfolio: [
        {
          id: PROJECT_A,
          initials: "CO",
          name: "Core",
          status: "empty",
          statusLabel: "No status · Alex Lead",
          leads: "Alex Lead",
          currentWeekCount: 1,
          nextWeekCount: 1,
          riskCount: 1,
        },
      ],
      products: [
        {
          id: PROJECT_A,
          authorIds: [AUTHOR_A],
          initials: "CO",
          name: "Core",
          status: "empty",
          statusLabel: "No status",
          leads: "Alex Lead",
          needsAttention: "Launch needs approval.",
          needsAttentionSeverity: "blocked",
          currentWeek: [
            {
              id: "current-1",
              stageLead: "Build · AL",
              stage: "Build",
              owner: "AL",
              text: "Ship release",
              status: "blocked",
              priorityRank: 2,
              comments: [],
              canReview: false,
            },
          ],
          nextWeek: [
            {
              id: "next-1",
              stageLead: "Planned",
              stage: "Planning",
              owner: "AL",
              text: "Plan follow-up",
              status: "planned",
              priorityRank: null,
              comments: [],
              canReview: false,
            },
          ],
          risks: [
            {
              id: "risk-1",
              badge: "Core · Build",
              stage: "Build",
              owner: "AL",
              severity: "blocked",
              text: "Vendor delay — Impact: Release slips — Mitigation: Escalate",
              problem: "Vendor delay",
              impact: "Release slips",
              mitigation: "Escalate",
              comments: [],
              canReview: false,
            },
          ],
          decisions: [
            {
              id: "decision-1",
              badge: "Core",
              owner: "AL",
              text: "Approve launch",
              comments: [],
              canReview: false,
            },
          ],
          priorities: [{ id: "current-1", rank: 2, text: "Ship release" }],
        },
      ],
      submissionLabel: "1/2 submitted",
      periodStatus: "reopened",
      submissionCount: 1,
      totalLeads: 2,
    });
  });

  it("surfaces reportId and periodStatus on the period object", () => {
    const result = mapWeeklyReport(baseReport({ periodStatus: "open" }));
    expect(result.period.reportId).toBe(REPORT_ID);
    expect(result.period.periodStatus).toBe("open");
  });

  it("reflects published periodStatus on the period object", () => {
    const result = mapWeeklyReport(baseReport({ periodStatus: "published" }));
    expect(result.period.periodStatus).toBe("published");
    expect(result.period.isCurrent).toBe(false);
  });

  it("reflects reopened periodStatus on the period object", () => {
    const result = mapWeeklyReport(baseReport({ periodStatus: "reopened" }));
    expect(result.period.periodStatus).toBe("reopened");
    expect(result.period.isCurrent).toBe(true);
  });
});
