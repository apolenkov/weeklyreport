// The deep-link scroll target must stay aligned with the highlighted product.
import {
  type WeeklyReportReadModel,
  weeklyReportReadModelSchema,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  makeWeeklyReportFixture,
  type WeeklyReportFixture,
} from "../../../../test-utils/report-section-fixtures";
import { buildWeeklyReportPageView } from "./weekly-report-page-view";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_EMPTY = "33333333-3333-4333-8333-333333333333";
const PRODUCT_WITH_CONTENT = "44444444-4444-4444-8444-444444444444";
const SECTION_A = "55555555-5555-4555-8555-555555555555";

function baseReport(
  overrides: WeeklyReportFixture = {},
): WeeklyReportReadModel {
  return makeWeeklyReportFixture({
    reportId: REPORT_ID,
    submissionCount: 1,
    totalLeads: 1,
    ...overrides,
  });
}

describe("buildWeeklyReportPageView — authorId scroll target", () => {
  it("keeps a submitted empty section publishable", () => {
    const view = buildWeeklyReportPageView(
      baseReport({
        portfolioOverview: [],
        leadSections: [
          {
            reportSectionId: SECTION_A,
            authorId: AUTHOR_A,
            status: "submitted",
            submittedAt: new Date("2026-04-14T09:00:00Z"),
            projects: [],
            items: [],
            risks: [],
            decisions: [],
            activities: [],
          },
        ],
      }),
      {
        scope: "product",
        currentRole: "head",
        currentUserId: null,
        focusedAuthorId: null,
        submissionFilter: "submitted",
        onReviewMutated: vi.fn(),
      },
    );

    expect(view.canPublishReport).toBe(true);
    expect(view.showPublishHint).toBe(false);
  });

  it("resolves scrollTargetProductId to the SAME product as focusedProductId when the author's first authored product is empty and a later one has content", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PRODUCT_EMPTY,
          productName: "Empty Product",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Alice"],
          leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
        },
        {
          productId: PRODUCT_WITH_CONTENT,
          productName: "Content Product",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Alice"],
          leadIds: ["5ccd4f78-2a3d-58e4-889a-e9ad6be0b941"],
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
              stageNames: ["Development"],
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

  it.each(["product", "lead"] as const)(
    "selects from the rendered %s collection for a co-owner",
    (scope) => {
      const authorB = "22222222-2222-4222-8222-bbbbbbbbbbbb";
      const report = weeklyReportReadModelSchema.parse(
        baseReport({
          submissionCount: 2,
          totalLeads: 2,
          portfolioOverview: [
            {
              productId: PRODUCT_EMPTY,
              productName: "Alpha",
              worstStatus: "red",
              stageCount: 1,
              leadNames: ["Alice", "Bob"],
              leadIds: [AUTHOR_A, authorB],
            },
            {
              productId: PRODUCT_WITH_CONTENT,
              productName: "Beta",
              worstStatus: "green",
              stageCount: 1,
              leadNames: ["Bob"],
              leadIds: [authorB],
            },
          ],
          leadSections: [
            {
              reportSectionId: SECTION_A,
              authorId: AUTHOR_A,
              authorName: "Alice",
              status: "submitted",
              submittedAt: new Date("2026-04-14T09:00:00Z"),
              projects: [
                {
                  projectId: PRODUCT_EMPTY,
                  projectName: "Alpha",
                  trafficLight: "red",
                },
              ],
              items: [
                {
                  id: "33333333-3333-4333-8333-aaaaaaaaaa01",
                  projectId: PRODUCT_EMPTY,
                  type: "current",
                  text: "Alice work",
                  tag: "Dev",
                  workflowStatus: "in_progress",
                  carriedOver: false,
                },
              ],
            },
            {
              reportSectionId: "55555555-5555-4555-8555-bbbbbbbbbbbb",
              authorId: authorB,
              authorName: "Bob",
              status: "submitted",
              submittedAt: new Date("2026-04-14T09:00:00Z"),
              projects: [
                {
                  projectId: PRODUCT_EMPTY,
                  projectName: "Alpha",
                  trafficLight: "green",
                },
                {
                  projectId: PRODUCT_WITH_CONTENT,
                  projectName: "Beta",
                  trafficLight: "green",
                },
              ],
              items: [
                {
                  id: "33333333-3333-4333-8333-bbbbbbbbbbb1",
                  projectId: PRODUCT_WITH_CONTENT,
                  type: "current",
                  text: "Bob work",
                  tag: "Dev",
                  workflowStatus: "done",
                  carriedOver: false,
                },
              ],
            },
          ],
        }),
      );
      const view = buildWeeklyReportPageView(report, {
        scope,
        currentRole: "head",
        currentUserId: null,
        focusedAuthorId: authorB,
        submissionFilter: "submitted",
        onReviewMutated: vi.fn(),
      });
      const expected =
        scope === "product" ? PRODUCT_EMPTY : PRODUCT_WITH_CONTENT;
      expect(view.focusedProductId).toBe(expected);
      expect(view.scrollTargetProductId).toBe(expected);
    },
  );

  it.each(["product", "lead"] as const)(
    "does not target a hidden draft in %s scope and restores it with all",
    (scope) => {
      const report = weeklyReportReadModelSchema.parse(
        baseReport({
          submissionCount: 0,
          totalLeads: 1,
          portfolioOverview: [
            {
              productId: PRODUCT_WITH_CONTENT,
              productName: "Draft",
              worstStatus: "green",
              stageCount: 1,
              leadNames: ["Alice"],
              leadIds: [AUTHOR_A],
            },
          ],
          leadSections: [
            {
              reportSectionId: SECTION_A,
              authorId: AUTHOR_A,
              status: "draft",
              projects: [
                {
                  projectId: PRODUCT_WITH_CONTENT,
                  projectName: "Draft",
                  trafficLight: "green",
                },
              ],
              items: [
                {
                  id: "33333333-3333-4333-8333-aaaaaaaaaa01",
                  projectId: PRODUCT_WITH_CONTENT,
                  type: "current",
                  text: "Draft work",
                  tag: "Dev",
                  workflowStatus: "in_progress",
                  carriedOver: false,
                },
              ],
            },
          ],
        }),
      );
      const params = {
        scope,
        currentRole: "head" as const,
        currentUserId: null,
        focusedAuthorId: AUTHOR_A,
        onReviewMutated: vi.fn(),
      };
      const submitted = buildWeeklyReportPageView(report, {
        ...params,
        submissionFilter: "submitted",
      });
      expect(submitted.focusedProductId).toBeUndefined();
      expect(submitted.scrollTargetProductId).toBeUndefined();
      const all = buildWeeklyReportPageView(report, {
        ...params,
        submissionFilter: "all",
      });
      expect(all.focusedProductId).toBe(PRODUCT_WITH_CONTENT);
      expect(all.scrollTargetProductId).toBe(PRODUCT_WITH_CONTENT);
      const absent = buildWeeklyReportPageView(report, {
        ...params,
        focusedAuthorId: "22222222-2222-4222-8222-bbbbbbbbbbbb",
        submissionFilter: "all",
      });
      expect(absent.focusedProductId).toBeUndefined();
      expect(absent.scrollTargetProductId).toBeUndefined();
    },
  );

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
