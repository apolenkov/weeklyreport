import { publishedReportSnapshotSchema } from "@customreport/shared";
import { buildPortfolioProductsFromSnapshotSections } from "@customreport/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrintProductSection } from "../../../app/print/[reportId]/print-product-section";
import {
  makeReportSectionFixture,
  makeWeeklyReportFixture,
} from "../../../test-utils/report-section-fixtures";
import { mapWeeklyReport } from "./weekly-report";

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const SECTION_ID = "10000000-0000-4000-8000-000000000002";
const AUTHOR_ID = "10000000-0000-4000-8000-000000000003";
const PRODUCT_ID = "10000000-0000-4000-8000-000000000004";
const GROUP_ID = "10000000-0000-4000-8000-000000000005";

describe("frozen referenced Product projection", () => {
  it("carries referenced-only item, risk, and decision through Product print", () => {
    const section = makeReportSectionFixture({
      reportSectionId: SECTION_ID,
      reportId: REPORT_ID,
      authorId: AUTHOR_ID,
      authorName: "Archive Lead",
      status: "submitted",
      submittedAt: new Date("2026-04-17T12:00:00.000Z"),
      projects: [],
      referencedProjects: [
        { projectId: PRODUCT_ID, projectName: "Retired Product" },
      ],
      items: [
        {
          id: "10000000-0000-4000-8000-000000000006",
          stableId: "10000000-0000-4000-8000-000000000007",
          projectId: PRODUCT_ID,
          type: "current",
          text: "Preserved shipped milestone",
          tag: "delivery",
          workflowStatus: "done",
          carriedOver: false,
          stageNames: ["Planning"],
        },
      ],
      risks: [
        {
          id: "10000000-0000-4000-8000-000000000008",
          stableId: "10000000-0000-4000-8000-000000000009",
          projectId: PRODUCT_ID,
          risk: "Preserved dependency risk",
          impact: "Delivery could slip",
          mitigation: "Keep the fallback ready",
          severity: "at-risk",
          stageNames: ["Planning"],
        },
      ],
      decisions: [
        {
          id: "10000000-0000-4000-8000-000000000010",
          stableId: "10000000-0000-4000-8000-000000000011",
          productId: PRODUCT_ID,
          text: "Preserved architecture decision",
          owner: "Archive Lead",
          impact: "Keep the frozen delivery path",
          stageNames: ["Planning"],
        },
      ],
    });
    const snapshot = publishedReportSnapshotSchema.parse({
      reportId: REPORT_ID,
      periodStart: new Date("2026-04-14T00:00:00.000Z"),
      periodEnd: new Date("2026-04-20T00:00:00.000Z"),
      deadline: new Date("2026-04-17T15:00:00.000Z"),
      status: "published",
      publishedAt: new Date("2026-04-17T15:00:00.000Z"),
      publishedById: AUTHOR_ID,
      publishedByName: "Archive Lead",
      portfolioOverview: {
        status: "green",
        totals: { green: 0, yellow: 0, red: 0 },
      },
      sections: [{ ...section, groupId: GROUP_ID, groupName: "Archive" }],
    });
    const portfolioOverview = buildPortfolioProductsFromSnapshotSections(
      snapshot.sections,
    );

    expect(portfolioOverview).toEqual([
      {
        productId: PRODUCT_ID,
        productName: "Retired Product",
        worstStatus: null,
        stageCount: 0,
        leadIds: [],
        leadNames: [],
      },
    ]);

    const view = mapWeeklyReport(
      makeWeeklyReportFixture({
        reportId: snapshot.reportId,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        deadline: snapshot.deadline,
        periodStatus: "published",
        submissionCount: 1,
        totalLeads: 1,
        portfolioOverview,
        leadSections: snapshot.sections,
      }),
    );
    const product = view.products[0];
    if (!product) throw new Error("expected frozen referenced Product");

    expect(view.portfolio).toEqual([
      expect.objectContaining({
        id: PRODUCT_ID,
        name: "Retired Product",
        status: "empty",
        hasContent: true,
      }),
    ]);
    expect(product.currentWeek.map(({ text }) => text)).toEqual([
      "Preserved shipped milestone",
    ]);
    expect(product.risks.map(({ problem }) => problem)).toEqual([
      "Preserved dependency risk",
    ]);
    expect(product.decisions.map(({ text }) => text)).toEqual([
      "Preserved architecture decision",
    ]);

    const printMarkup = renderToStaticMarkup(
      createElement(PrintProductSection, { report: product }),
    );
    expect(printMarkup).toContain("Retired Product");
    expect(printMarkup).toContain("Preserved shipped milestone");
    expect(printMarkup).toContain("Preserved dependency risk");
    expect(printMarkup).toContain("Preserved architecture decision");
  });
});
