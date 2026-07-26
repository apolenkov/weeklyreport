/**
 * Pure view-model derivation tests for `buildWeeklyReportPageView`: the
 * authorId deep-link scroll target must always resolve to the same product
 * as the highlighted accordion panel.
 */
import type { WeeklyReportReadModel } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { buildWeeklyReportPageView } from "./weekly-report-page-view";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_EMPTY = "33333333-3333-4333-8333-333333333333";
const PRODUCT_WITH_CONTENT = "44444444-4444-4444-8444-444444444444";
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
    archived: false,
    weekLabel: "Week 16",
    submissionCount: 1,
    totalLeads: 1,
    hasActiveReminderRule: true,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
    ...overrides,
  };
}

describe("buildWeeklyReportPageView — authorId scroll target", () => {
  it("resolves scrollTargetProductId to the SAME product as focusedProductId when the author's first authored product is empty and a later one has content", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PRODUCT_EMPTY,
          productName: "Empty Product",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Alice"],
        },
        {
          productId: PRODUCT_WITH_CONTENT,
          productName: "Content Product",
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
          status: "submitted",
          submittedAt: new Date("2026-04-14T09:00:00Z"),
          projects: [
            {
              projectId: PRODUCT_EMPTY,
              projectName: "Empty Product",
              trafficLight: "green",
            },
            {
              projectId: PRODUCT_WITH_CONTENT,
              projectName: "Content Product",
              trafficLight: "green",
            },
          ],
          items: [
            {
              id: "item-1",
              projectId: PRODUCT_WITH_CONTENT,
              type: "current",
              text: "Shipped the thing",
              tag: "Dev",
              workflowStatus: "done",
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
          activities: [],
        },
      ],
    });

    const view = buildWeeklyReportPageView(report, {
      scope: "product",
      currentRole: null,
      currentUserId: null,
      focusedAuthorId: AUTHOR_A,
      submissionFilter: "all",
      onReviewMutated: vi.fn(),
    });

    expect(view.focusedProductId).toBe(PRODUCT_WITH_CONTENT);
    expect(view.scrollTargetProductId).toBe(PRODUCT_WITH_CONTENT);
    expect(view.scrollTargetProductId).not.toBe(PRODUCT_EMPTY);
  });

  it("leaves both focus fields undefined when no authorId is given", () => {
    const report = baseReport();
    const view = buildWeeklyReportPageView(report, {
      scope: "product",
      currentRole: null,
      currentUserId: null,
      focusedAuthorId: null,
      submissionFilter: "all",
      onReviewMutated: vi.fn(),
    });

    expect(view.focusedProductId).toBeUndefined();
    expect(view.scrollTargetProductId).toBeUndefined();
  });
});
