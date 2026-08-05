/**
 * Pure derivation tests for weekly-report-page-helpers.ts, focused on the
 * fixes to `buildAccordionModel`'s `draftCount`.
 */
import type { WeeklyReportReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { buildAccordionModel } from "./weekly-report-page-helpers";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const ACTIVITY_A = "44444444-4444-4444-8444-444444444444";
const SECTION_A = "55555555-5555-4555-8555-555555555555";

function baseReport(
  overrides: Partial<WeeklyReportReadModel> = {},
): WeeklyReportReadModel {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-14T00:00:00Z"),
    periodEnd: new Date("2026-04-20T00:00:00Z"),
    deadline: new Date("2026-04-17T15:00:00Z"),
    periodStatus: "open",
    weekLabel: "Week 16",
    submissionCount: 0,
    totalLeads: 1,
    hasActiveReminderRule: true,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
    ...overrides,
  };
}

describe("buildAccordionModel — draftCount includes activity-only drafts", () => {
  it("counts a draft section whose only content is a touched activity, with no draft product content", () => {
    const report = baseReport({
      portfolioOverview: [],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Alice",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [],
          items: [],
          risks: [],
          decisions: [],
          activities: [
            {
              activityId: ACTIVITY_A,
              activityName: "Jira triage duty",
              jiraAccounts: [],
              status: "red",
              derivedStatus: "red",
              linkedProducts: [],
              note: null,
            },
          ],
        },
      ],
    });

    const accordion = buildAccordionModel({
      reportData: report,
      scope: "product",
      submittedOnly: true,
      fullProducts: [],
      fullLeadGroups: [],
    });

    expect(accordion.draftCount).toBeGreaterThanOrEqual(1);
    expect(accordion.draftCount).toBe(1);
  });

  it("does not count a draft section with neither product nor activity content", () => {
    const report = baseReport({
      portfolioOverview: [],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Alice",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [],
          items: [],
          risks: [],
          decisions: [],
          activities: [
            {
              activityId: ACTIVITY_A,
              activityName: "Jira triage duty",
              jiraAccounts: [],
              // Seeded-but-untouched: green with no note and no owned records
              // is not evidence of lead input (activity-first-class).
              status: "green",
              derivedStatus: "green",
              linkedProducts: [],
              note: null,
            },
          ],
        },
      ],
    });

    const accordion = buildAccordionModel({
      reportData: report,
      scope: "product",
      submittedOnly: true,
      fullProducts: [],
      fullLeadGroups: [],
    });

    expect(accordion.draftCount).toBe(0);
  });

  it("still counts a draft section with draft product content and no activities (pre-existing behavior preserved)", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PRODUCT_A,
          productName: "Product Alpha",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Alice"],
        },
      ],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Alice",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [
            {
              projectId: PRODUCT_A,
              projectName: "Product Alpha",
              trafficLight: "green",
            },
          ],
          items: [
            {
              id: "item-1",
              projectId: PRODUCT_A,
              type: "current",
              text: "Draft work",
              tag: "Dev",
              workflowStatus: "in_progress",
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
          activities: [],
        },
      ],
    });

    const accordion = buildAccordionModel({
      reportData: report,
      scope: "product",
      submittedOnly: true,
      fullProducts: [],
      fullLeadGroups: [],
    });

    expect(accordion.draftCount).toBe(1);
  });
});
