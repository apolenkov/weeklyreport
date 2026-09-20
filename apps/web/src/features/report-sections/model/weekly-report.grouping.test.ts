import type { WeeklyReportReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  makeWeeklyReportFixture,
  type WeeklyReportFixture,
} from "../../../test-utils/report-section-fixtures";
import { mapWeeklyReport } from "./weekly-report";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_A = "22222222-2222-4222-8222-222222222222";
const PROJECT_B = "33333333-3333-4333-8333-333333333333";
const SECTION_A = "44444444-4444-4444-8444-444444444444";
const SECTION_B = "55555555-5555-4555-8555-555555555555";
const AUTHOR_A = "66666666-6666-4666-8666-666666666666";
const AUTHOR_B = "77777777-7777-4777-8777-777777777777";

function baseReport(
  overrides: WeeklyReportFixture = {},
): WeeklyReportReadModel {
  return makeWeeklyReportFixture({
    reportId: REPORT_ID,
    ...overrides,
  });
}

describe("mapWeeklyReport — grouping, severity & escalation", () => {
  it("preserves a current result's next commitment and immutable outcome audit", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM Platform",
          worstStatus: "green",
          stageCount: 1,
          leadNames: ["Lead One"],
          leadIds: [AUTHOR_A],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Lead One",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            {
              projectId: PROJECT_A,
              projectName: "CRM Platform",
              trafficLight: "green",
            },
          ],
          items: [
            {
              id: "10000000-0000-4000-8000-000000000101",
              stableId: "10000000-0000-4000-8000-000000000102",
              projectId: PROJECT_A,
              type: "current",
              text: "Delivered API endpoints",
              tag: "delivery",
              workflowStatus: "in_progress",
              carriedOver: false,
              nextStepText: "Validate production metrics",
              outcomeHistory: [
                {
                  id: "10000000-0000-4000-8000-000000000103",
                  stableId: "10000000-0000-4000-8000-000000000102",
                  outcome: "continue",
                  reason: null,
                  actorId: AUTHOR_A,
                  actorName: "Lead One",
                  occurredAt: "2026-04-19T18:00:00.000Z",
                  beforeState: {
                    type: "next",
                    workflowStatus: "planned",
                    pausedReason: null,
                    nextStepText: null,
                    text: null,
                  },
                  afterState: {
                    type: "current",
                    workflowStatus: "in_progress",
                    pausedReason: null,
                    nextStepText: "Validate production metrics",
                    text: null,
                  },
                  reversesEventId: null,
                },
              ],
            },
          ],
          risks: [],
          decisions: [],
        },
      ],
    });

    const item = expectDefined(
      mapWeeklyReport(report).products[0]?.currentWeek[0],
    );

    expect(item.nextStepText).toBe("Validate production metrics");
    expect(item.outcomeHistory).toMatchObject([
      { outcome: "continue", actorName: "Lead One" },
    ]);
  });

  it("groups items by project across multiple lead sections", () => {
    const report = baseReport({
      submissionCount: 2,
      totalLeads: 2,
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM Platform",
          worstStatus: "yellow",
          stageCount: 7,
          leadNames: [
            "Иванов Василий Петрович",
            "Каштанова Мария Александровна",
          ],
          leadIds: [
            "695cfa6a-0dd8-50a5-84e5-06c474e139fd",
            "3ca366dd-180e-5668-be68-d0e0d1c65b9b",
          ],
        },
        {
          productId: PROJECT_B,
          productName: "Mobile",
          worstStatus: "green",
          stageCount: 7,
          leadNames: ["Igor V."],
          leadIds: ["0a9c3be4-fb24-5b94-8f7a-18b7c6d00776"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Тимлид 1",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            {
              projectId: PROJECT_A,
              projectName: "CRM Platform",
              trafficLight: "yellow",
            },
          ],
          items: [
            {
              id: "i1",
              projectId: PROJECT_A,
              type: "current",
              text: "OAuth integration",
              tag: "auth",
              workflowStatus: "in_progress",
              carriedOver: false,
              stageNames: ["Dev", "Testing"],
            },
            {
              id: "i2",
              projectId: PROJECT_A,
              type: "next",
              text: "SSO portal",
              tag: "sso",
              workflowStatus: "in_progress",
              carriedOver: false,
            },
          ],
          risks: [
            {
              id: "r1",
              projectId: PROJECT_A,
              risk: "OAuth slow",
              impact: "SSO slips",
              mitigation: "Vendor escalation",
              severity: "at-risk",
            },
          ],
          decisions: [],
        },
        {
          activities: [],
          reportSectionId: SECTION_B,
          reportId: REPORT_ID,
          authorId: AUTHOR_B,
          authorName: "Igor V.",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T17:00:00Z"),
          projects: [
            {
              projectId: PROJECT_B,
              projectName: "Mobile",
              trafficLight: "green",
            },
          ],
          items: [
            {
              id: "i3",
              projectId: PROJECT_B,
              type: "current",
              text: "Push notifications",
              tag: "notif",
              workflowStatus: "done",
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
        },
      ],
    });

    const result = mapWeeklyReport(report);

    expect(result.portfolio).toHaveLength(2);
    const crm = result.portfolio.find((p) => p.id === PROJECT_A);
    expect(crm?.status).toBe("at-risk");
    expect(crm?.leads).toBe("Иванов В.П. \u00B7 Каштанова М.А.");
    expect(crm?.currentWeekCount).toBe(1);
    expect(crm?.nextWeekCount).toBe(1);
    expect(crm?.riskCount).toBe(1);

    const mobile = result.portfolio.find((p) => p.id === PROJECT_B);
    expect(mobile?.status).toBe("on-track");
    expect(mobile?.currentWeekCount).toBe(1);

    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(crmReport?.currentWeek).toHaveLength(1);
    expect(expectDefined(crmReport?.currentWeek[0]).text).toBe(
      "OAuth integration",
    );
    // stageLead carries the item's REAL stage tags.
    expect(expectDefined(crmReport?.currentWeek[0]).stageLead).toBe(
      "Dev+Testing \u00B7 Т1",
    );
    expect(expectDefined(crmReport?.nextWeek[0]).stageLead).toBe(
      "Planning \u00B7 Т1",
    );
    expect(crmReport?.risks).toHaveLength(1);
    expect(expectDefined(crmReport?.risks[0]).severity).toBe("at-risk");
  });

  it("floors a covered in-progress item to at-risk on the head report", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "yellow",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
          leadIds: ["695cfa6a-0dd8-50a5-84e5-06c474e139fd"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Тимлид 1",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            {
              projectId: PROJECT_A,
              projectName: "CRM",
              trafficLight: "yellow",
            },
          ],
          items: [
            {
              id: "i1",
              projectId: PROJECT_A,
              type: "current",
              text: "OAuth integration",
              tag: "auth",
              workflowStatus: "in_progress",
              carriedOver: false,
              stageNames: ["Dev"],
            },
          ],
          risks: [
            {
              id: "r1",
              projectId: PROJECT_A,
              risk: "OAuth slow",
              impact: "SSO slips",
              mitigation: "Vendor escalation",
              severity: "at-risk",
              stageNames: ["Dev"],
            },
          ],
          decisions: [],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(expectDefined(crmReport?.currentWeek[0]).status).toBe("at-risk");
  });

  it("honors persisted risk severity when no blocked item exists", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "yellow",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
          leadIds: ["695cfa6a-0dd8-50a5-84e5-06c474e139fd"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Тимлид 1",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [
            {
              projectId: PROJECT_A,
              projectName: "CRM",
              trafficLight: "yellow",
            },
          ],
          items: [],
          risks: [
            {
              id: "r1",
              projectId: PROJECT_A,
              risk: "Vendor outage",
              impact: "Work is stopped",
              mitigation: "Escalate",
              severity: "blocked",
            },
          ],
          decisions: [],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(expectDefined(crmReport?.risks[0]).severity).toBe("blocked");
  });

  it("uses the supplied portfolio status when a section also has a blocking risk", () => {
    // This mapper projects the supplied portfolio status independently from
    // the section risk rows.
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "green",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
          leadIds: ["695cfa6a-0dd8-50a5-84e5-06c474e139fd"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Тимлид 1",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
          ],
          items: [],
          risks: [
            {
              id: "r1",
              projectId: PROJECT_A,
              risk: "Vendor outage",
              impact: "Work is stopped",
              mitigation: "Escalate",
              severity: "blocked",
              stageNames: ["Dev"],
            },
          ],
          decisions: [],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crm = result.products.find((p) => p.id === PROJECT_A);
    const crmPortfolio = result.portfolio.find((p) => p.id === PROJECT_A);
    // Product status is the floor-free traffic-light passthrough, not floored
    // by the blocking risk present on the same section.
    expect(crm?.status).toBe("on-track");
    expect(crm?.statusLabel).toBe("On Track");
    expect(crmPortfolio?.status).toBe("on-track");
    // The risk still surfaces as a blocked-severity row (chip-level data); only
    // the product STATUS stays unfloored.
    expect(expectDefined(crm?.risks[0]).severity).toBe("blocked");
  });

  it("a red traffic light exports blocked product status", () => {
    // Opposite direction: dropping worstStatus would turn red into on-track.
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "red",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
          leadIds: ["695cfa6a-0dd8-50a5-84e5-06c474e139fd"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Тимлид 1",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            { projectId: PROJECT_A, projectName: "CRM", trafficLight: "red" },
          ],
          items: [],
          risks: [],
          decisions: [],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crm = result.products.find((p) => p.id === PROJECT_A);
    expect(crm?.status).toBe("blocked");
    expect(crm?.statusLabel).toBe("Blocked");
  });

  it("attaches needsAttention from matching escalation", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "yellow",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
          leadIds: ["695cfa6a-0dd8-50a5-84e5-06c474e139fd"],
        },
      ],
      escalations: [
        {
          type: "at_risk",
          productId: PROJECT_A,
          productName: "CRM",
          stageName: "Dev",
          authorId: AUTHOR_A,
          leadName: "Тимлид 1",
          description: "OAuth slow due to vendor.",
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(crmReport?.needsAttention).toBe("OAuth slow due to vendor.");
    expect(crmReport?.needsAttentionSeverity).toBe("at-risk");
  });

  it("joins aggregate attention by product id when product names collide", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "Platform",
          worstStatus: "green",
          stageCount: 1,
          leadNames: [],
          leadIds: [],
        },
        {
          productId: PROJECT_B,
          productName: "Platform",
          worstStatus: "yellow",
          stageCount: 1,
          leadNames: ["Lead One"],
          leadIds: [AUTHOR_A],
        },
      ],
      escalations: [
        {
          type: "unresolved_risk",
          productId: PROJECT_B,
          productName: "Platform",
          stageName: "Testing",
          authorId: AUTHOR_A,
          leadName: "Lead One",
          description: "Second product only",
        },
      ],
    });

    const result = mapWeeklyReport(report);
    expect(
      result.products.find((product) => product.id === PROJECT_A),
    ).not.toHaveProperty("needsAttention");
    expect(
      result.products.find((product) => product.id === PROJECT_B)
        ?.needsAttention,
    ).toBe("Second product only");
  });

  it("attaches explicitly product-scoped decisions and priorities", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "green",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
          leadIds: ["695cfa6a-0dd8-50a5-84e5-06c474e139fd"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Тимлид 1",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
          ],
          items: [
            {
              id: "i1",
              projectId: PROJECT_A,
              type: "current",
              text: "Ship OAuth",
              tag: "feature",
              workflowStatus: "in_progress",
              carriedOver: false,
              priorityRank: 1,
            },
          ],
          risks: [],
          decisions: [
            {
              id: "d1",
              productId: PROJECT_A,
              text: "Approve Redis cluster",
              owner: "Head",
              impact: "Caching",
            },
          ],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(crmReport?.decisions).toHaveLength(1);
    expect(expectDefined(crmReport?.decisions[0]).text).toBe(
      "Approve Redis cluster",
    );
    expect(crmReport?.priorities).toHaveLength(1);
    expect(expectDefined(crmReport?.priorities[0]).text).toBe("Ship OAuth");
  });

  it("groups decisions and priorities by explicit productId when present", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "green",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
          leadIds: ["695cfa6a-0dd8-50a5-84e5-06c474e139fd"],
        },
        {
          productId: PROJECT_B,
          productName: "Billing",
          worstStatus: "yellow",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
          leadIds: ["695cfa6a-0dd8-50a5-84e5-06c474e139fd"],
        },
      ],
      leadSections: [
        {
          activities: [],
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Тимлид 1",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
            {
              projectId: PROJECT_B,
              projectName: "Billing",
              trafficLight: "yellow",
            },
          ],
          items: [
            {
              id: "i1",
              projectId: PROJECT_B,
              type: "current",
              text: "Stabilize Billing jobs",
              tag: "feature",
              workflowStatus: "in_progress",
              carriedOver: false,
              priorityRank: 1,
            },
          ],
          risks: [],
          decisions: [
            {
              id: "d1",
              text: "Approve Billing migration",
              owner: "Head",
              impact: "Payment rollout",
              productId: PROJECT_B,
            },
          ],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    const billingReport = result.products.find((p) => p.id === PROJECT_B);

    expect(crmReport?.decisions).toHaveLength(0);
    expect(crmReport?.priorities).toHaveLength(0);
    expect(billingReport?.decisions).toHaveLength(1);
    expect(expectDefined(billingReport?.decisions[0]).text).toBe(
      "Approve Billing migration",
    );
    expect(expectDefined(billingReport?.decisions[0]).badge).toBe("Billing");
    expect(billingReport?.priorities).toHaveLength(1);
    expect(expectDefined(billingReport?.priorities[0]).text).toBe(
      "Stabilize Billing jobs",
    );
  });

  it("preserves period info from the API", () => {
    const result = mapWeeklyReport(
      baseReport({ periodState: "published", periodStatus: "published" }),
    );
    expect(result.period.id).toBe(REPORT_ID);
    expect(result.period.dateRange).toBe("Apr 14–20, 2026");
    expect(result.period.isCurrent).toBe(false); // published periods aren't "current"
  });
});
