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
        periodState: "open",
        periodStatus: "open",
        archived: false,
        weekLabel: "Week 16",
        dateRange: "Apr 14–20, 2026",
        isCurrent: false,
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
          leadNames: ["Иванов Алексей Петрович"],
          leadIds: ["fdbe9b32-8141-593c-9cad-f8f26def402f"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Иванов Алексей Петрович",
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
          productId: PROJECT_A,
          productName: "Core",
          stageName: "Build",
          authorId: AUTHOR_A,
          leadName: "Иванов Алексей Петрович",
          description: "Launch needs approval.",
        },
      ],
    });

    expect(mapWeeklyReport(report)).toEqual({
      period: {
        id: REPORT_ID,
        reportId: REPORT_ID,
        periodState: "open",
        periodStatus: "reopened",
        archived: false,
        weekLabel: "Week 16",
        dateRange: "Apr 14–20, 2026",
        isCurrent: false,
        periodStart: new Date("2026-04-14T00:00:00Z"),
      },
      portfolio: [
        {
          id: PROJECT_A,
          initials: "CO",
          name: "Core",
          hasContent: true,
          status: "empty",
          statusLabel: "No status · Иванов А.П.",
          leads: "Иванов А.П.",
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
          leads: "Иванов А.П.",
          needsAttention: "Launch needs approval.",
          needsAttentionSeverity: "blocked",
          currentWeek: [
            {
              id: "current-1",
              stageLead: "Build · ИА",
              stage: "Build",
              owner: "ИА",
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
              stageLead: "Planning · ИА",
              stage: "Planning",
              owner: "ИА",
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
              owner: "ИА",
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
              owner: "ИА",
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

  it("surfaces canonical lifecycle on the period object", () => {
    const result = mapWeeklyReport(
      baseReport({ periodState: "scheduled", periodStatus: "open" }),
    );
    expect(result.period.reportId).toBe(REPORT_ID);
    expect(result.period.periodState).toBe("scheduled");
    expect(result.period.periodStatus).toBe("open");
    expect(result.period.isCurrent).toBe(false);
  });

  it("reflects published periodStatus on the period object", () => {
    const result = mapWeeklyReport(
      baseReport({ periodState: "published", periodStatus: "published" }),
    );
    expect(result.period.periodStatus).toBe("published");
    expect(result.period.isCurrent).toBe(false);
  });

  it("does not invent current identity for a reopened standalone projection", () => {
    const result = mapWeeklyReport(baseReport({ periodStatus: "reopened" }));
    expect(result.period.periodStatus).toBe("reopened");
    expect(result.period.isCurrent).toBe(false);
  });

  it("orders overview tiles and sections alike: Blocked, At risk, On track, no updates, then name", () => {
    const overview = (
      productId: string,
      productName: string,
      worstStatus: "green" | "yellow" | "red" | null,
    ) => ({
      productId,
      productName,
      worstStatus,
      stageCount: 1,
      leadNames: [],
      leadIds: [],
    });
    const result = mapWeeklyReport(
      baseReport({
        portfolioOverview: [
          overview("a0000000-0000-4000-8000-000000000001", "Alpha", null),
          overview("a0000000-0000-4000-8000-000000000002", "Бета", "green"),
          overview("a0000000-0000-4000-8000-000000000003", "Gamma", "red"),
          overview("a0000000-0000-4000-8000-000000000004", "Альфа", "green"),
          overview("a0000000-0000-4000-8000-000000000005", "Delta", "yellow"),
        ],
      }),
    );
    const expected = ["Gamma", "Delta", "Альфа", "Бета", "Alpha"];
    expect(result.portfolio.map(({ name }) => name)).toEqual(expected);
    expect(result.products.map(({ name }) => name)).toEqual(expected);
  });
});
