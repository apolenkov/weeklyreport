import type { WeeklyReportReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  __testing,
  formatWeekRange,
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
  mapWeeklyReportLeadOverview,
} from "./weekly-report";
import type {
  WeeklyProductReport,
  WeeklyReportItem,
} from "./weekly-report-types";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_A = "22222222-2222-4222-8222-222222222222";
const PROJECT_B = "33333333-3333-4333-8333-333333333333";
const SECTION_A = "44444444-4444-4444-8444-444444444444";
const SECTION_B = "55555555-5555-4555-8555-555555555555";
const AUTHOR_A = "66666666-6666-4666-8666-666666666666";
const AUTHOR_B = "77777777-7777-4777-8777-777777777777";

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
    totalLeads: 0,
    hasActiveReminderRule: true,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
    ...overrides,
  };
}

describe("formatWeekRange", () => {
  it("formats a same-month range with en-dash", () => {
    expect(
      formatWeekRange(
        new Date("2026-04-14T00:00:00Z"),
        new Date("2026-04-20T00:00:00Z"),
      ),
    ).toBe("Apr 14–20, 2026");
  });

  it("formats a cross-month range with en-dash and second month name", () => {
    expect(
      formatWeekRange(
        new Date("2026-04-28T00:00:00Z"),
        new Date("2026-05-04T00:00:00Z"),
      ),
    ).toBe("Apr 28–May 4, 2026");
  });
});

describe("trafficToProductStatus", () => {
  const fn = __testing.trafficToProductStatus;
  it("green -> on-track, yellow -> at-risk, red -> blocked", () => {
    expect(fn("green")).toBe("on-track");
    expect(fn("yellow")).toBe("at-risk");
    expect(fn("red")).toBe("blocked");
  });

  it("null worstStatus collapses to on-track", () => {
    expect(fn(null)).toBe("on-track");
  });
});

describe("statusLabelFor", () => {
  const fn = __testing.statusLabelFor;
  it("joins lead names with ', ' and prefixes the status", () => {
    expect(fn("at-risk", ["Тимлид 1", "Maria K."])).toBe(
      "At Risk \u00B7 Тимлид 1, Maria K.",
    );
  });
  it('falls back to "unassigned" when no leads', () => {
    expect(fn("on-track", [])).toBe("On Track \u00B7 unassigned");
  });
});

describe("mapWeeklyReport", () => {
  it("returns empty portfolio and products for an empty report", () => {
    const result = mapWeeklyReport(baseReport());
    expect(result.portfolio).toEqual([]);
    expect(result.products).toEqual([]);
    expect(result.period.weekLabel).toBe("Week 16");
    expect(result.submissionLabel).toBe("0/0 submitted");
  });

  it("surfaces reportId and periodStatus on the period object (Phase 22, plan 22-05)", () => {
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
          leadNames: ["Тимлид 1", "Maria K."],
        },
        {
          productId: PROJECT_B,
          productName: "Mobile",
          worstStatus: "green",
          stageCount: 7,
          leadNames: ["Igor V."],
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
              stageIds: ["Dev", "Testing"],
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
    expect(crm?.leads).toBe("Тимлид 1 \u00B7 Maria K.");
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
    // stageLead carries the item's REAL stage tags (was hardcoded "Dev"
    // for every item before apply-status-palette).
    expect(expectDefined(crmReport?.currentWeek[0]).stageLead).toBe(
      "Dev+Testing \u00B7 Т1",
    );
    expect(expectDefined(crmReport?.nextWeek[0]).stageLead).toBe("Planned");
    expect(crmReport?.risks).toHaveLength(1);
    expect(expectDefined(crmReport?.risks[0]).severity).toBe("at-risk");
  });

  it("infers risk severity as blocked when project has any blocked item", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "red",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
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
            { projectId: PROJECT_A, projectName: "CRM", trafficLight: "red" },
          ],
          items: [
            {
              id: "i1",
              projectId: PROJECT_A,
              type: "current",
              text: "ETL fix",
              tag: "etl",
              workflowStatus: "blocked",
              carriedOver: false,
            },
          ],
          risks: [
            {
              id: "r1",
              projectId: PROJECT_A,
              risk: "OOM in ETL",
              impact: "Blocks release",
              mitigation: "Vendor patch",
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

  it("honors persisted risk severity when no blocked item exists", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "yellow",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
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

  it("W6 regression: a blocking risk does NOT floor product status — export status follows the traffic light", () => {
    // fix-report-surface-integrity W6 deviation guard. The head/PDF export
    // surface renders the product-level `worstStatus` (computed server-side from
    // the leads' traffic lights), and has NO stage grid. Risks color stage chips
    // on the LIVE lead form only; they must NOT floor the exported product status.
    // A product with a blocking risk in its section but a green traffic light
    // must still export as on-track — flooring here would be a behavior change
    // outside W6 (export status stays traffic-light-driven).
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          // Server aggregates worstStatus from traffic lights only (green here).
          worstStatus: "green",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
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
              stageIds: ["Dev"],
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

  it("W6 regression: a red traffic light exports blocked product status", () => {
    // The other direction of the same guard: a broken passthrough that dropped
    // the worstStatus would turn this red into on-track and flip the assertion.
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "red",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
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
        },
      ],
      escalations: [
        {
          type: "at_risk",
          productName: "CRM",
          stageName: "Dev",
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

  it("attaches a section's decisions and priorities to the section's first project", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "green",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
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
        },
        {
          productId: PROJECT_B,
          productName: "Billing",
          worstStatus: "yellow",
          stageCount: 7,
          leadNames: ["Тимлид 1"],
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
    const result = mapWeeklyReport(baseReport({ periodStatus: "published" }));
    expect(result.period.id).toBe(REPORT_ID);
    expect(result.period.dateRange).toBe("Apr 14–20, 2026");
    expect(result.period.isCurrent).toBe(false); // published periods aren't "current"
  });
});

// ---------------------------------------------------------------------------
// fix-product-name-resolution: badges resolve product names report-wide, not
// only from the owning section's projects list (regression for the
// "Unknown · <stage>" badges found during apply-status-palette acceptance).
// ---------------------------------------------------------------------------

describe("product name resolution (fix-product-name-resolution)", () => {
  it("resolves risk and decision badges for projects outside the author's section", () => {
    const report = baseReport({
      submissionCount: 1,
      totalLeads: 1,
      portfolioOverview: [
        {
          productId: PROJECT_B,
          productName: "Mobile",
          worstStatus: "green",
          stageCount: 7,
          leadNames: ["Igor V."],
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
          // The author's own section knows only PROJECT_A…
          projects: [
            {
              projectId: PROJECT_A,
              projectName: "CRM Platform",
              trafficLight: "yellow",
            },
          ],
          items: [],
          // …but files a risk and a decision against PROJECT_B.
          risks: [
            {
              id: "r-cross",
              projectId: PROJECT_B,
              risk: "Cross-project risk",
              impact: "Impact",
              mitigation: "Mitigation",
              stageIds: ["Analysis"],
            },
          ],
          decisions: [
            {
              id: "d-cross",
              text: "Cross-project decision",
              owner: "Owner",
              impact: "Impact",
              productId: PROJECT_B,
            },
          ],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const mobile = result.products.find((p) => p.id === PROJECT_B);

    expect(expectDefined(mobile?.risks[0]).badge).toBe("Mobile · Analysis");
    expect(expectDefined(mobile?.decisions[0]).badge).toBe("Mobile");
  });
});

// ---------------------------------------------------------------------------
// report-card-clarity: "by lead" slices each product to the viewing lead's OWN
// contribution. A product authored by two leads must NOT repeat the merged card
// under each — each lead's card shows only their own items.
// ---------------------------------------------------------------------------

describe("mapWeeklyReportLeadGroups (by-lead slice)", () => {
  it("a lead with two products gets two scoped cards", () => {
    const report = baseReport({
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
              projectId: PROJECT_A,
              type: "current",
              text: "CRM work",
              tag: "feature",
              workflowStatus: "in_progress",
              carriedOver: false,
            },
            {
              id: "i2",
              projectId: PROJECT_B,
              type: "current",
              text: "Billing work",
              tag: "feature",
              workflowStatus: "in_progress",
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
        },
      ],
    });

    const groups = mapWeeklyReportLeadGroups(report);
    expect(groups).toHaveLength(1);
    expect(expectDefined(groups[0]).products).toHaveLength(2);
  });

  it("a product with two contributing leads shows no cross-author mixing", () => {
    const report = baseReport({
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
            { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
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
            },
          ],
          risks: [],
          decisions: [],
        },
        {
          activities: [],
          reportSectionId: SECTION_B,
          reportId: REPORT_ID,
          authorId: AUTHOR_B,
          authorName: "Igor V.",
          version: 1,
          status: "draft",
          submittedAt: null,
          projects: [
            { projectId: PROJECT_A, projectName: "CRM", trafficLight: "green" },
          ],
          items: [
            {
              id: "i2",
              projectId: PROJECT_A,
              type: "current",
              text: "Mobile auth screen",
              tag: "auth",
              workflowStatus: "in_progress",
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
        },
      ],
    });

    const groups = mapWeeklyReportLeadGroups(report);
    expect(groups).toHaveLength(2);

    const groupA = expectDefined(groups.find((g) => g.id === AUTHOR_A));
    const cardA = expectDefined(
      groupA.products.find((p) => p.id === PROJECT_A),
    );
    expect(cardA.currentWeek.map((i) => i.text)).toEqual(["OAuth integration"]);

    const groupB = expectDefined(groups.find((g) => g.id === AUTHOR_B));
    const cardB = expectDefined(
      groupB.products.find((p) => p.id === PROJECT_A),
    );
    expect(cardB.currentWeek.map((i) => i.text)).toEqual([
      "Mobile auth screen",
    ]);
  });
});

// report-overview-scope-parity: the per-lead overview rows derived from the
// already-grouped lead data.
describe("mapWeeklyReportLeadOverview", () => {
  const item = (text: string): WeeklyReportItem =>
    ({ id: text, text, status: "in-progress" }) as WeeklyReportItem;

  function product(
    overrides: Partial<WeeklyProductReport> = {},
  ): WeeklyProductReport {
    return {
      id: "prod",
      authorIds: ["a"],
      initials: "PA",
      name: "Product",
      status: "on-track",
      statusLabel: "On Track",
      leads: "Lead",
      currentWeek: [],
      nextWeek: [],
      risks: [],
      decisions: [],
      priorities: [],
      ...overrides,
    };
  }

  function group(
    id: string,
    name: string,
    products: WeeklyProductReport[],
  ): { id: string; name: string; products: WeeklyProductReport[] } {
    return { id, name, products };
  }

  it("takes the worst status and sums the counts across a lead's products", () => {
    const rows = mapWeeklyReportLeadOverview([
      group("L1", "Lead One", [
        product({
          status: "on-track",
          currentWeek: [item("c1"), item("c2")],
          nextWeek: [item("n1")],
          risks: [],
        }),
        product({
          status: "blocked",
          currentWeek: [item("c3")],
          nextWeek: [],
          risks: [{ id: "r1" } as never],
        }),
      ]),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "L1",
      name: "Lead One",
      worstStatus: "blocked", // worst-of on-track + blocked
      currentCount: 3, // 2 + 1
      nextCount: 1, // 1 + 0
      riskCount: 1, // 0 + 1
    });
  });

  it("includes a lead whose only content is decisions / priorities / Needs-Attention (zero current/next/risk)", () => {
    const rows = mapWeeklyReportLeadOverview([
      group("D", "Decisions Only", [
        product({ status: "on-track", decisions: [{ id: "d1" } as never] }),
      ]),
      group("P", "Priorities Only", [
        product({
          status: "at-risk",
          priorities: [{ rank: 1, text: "P" }],
        }),
      ]),
      group("N", "Needs Attention Only", [
        product({ status: "blocked", needsAttention: "Escalated" }),
      ]),
    ]);

    // All three appear — membership comes from the upstream group filter, not
    // from the current/next/risk counts (which print 0 here).
    expect(rows.map((r) => r.name)).toEqual([
      "Needs Attention Only", // blocked → first
      "Priorities Only", // at-risk
      "Decisions Only", // on-track
    ]);
    expect(rows.every((r) => r.currentCount === 0 && r.riskCount === 0)).toBe(
      true,
    );
  });

  it("sorts worst-status-first with a lead-name tiebreak, deterministically across shuffled inputs", () => {
    const a = group("a", "Anna", [product({ status: "at-risk" })]);
    const b = group("b", "Boris", [product({ status: "blocked" })]);
    const c = group("c", "Clara", [product({ status: "at-risk" })]);
    const d = group("d", "Dmitri", [product({ status: "on-track" })]);

    const order1 = mapWeeklyReportLeadOverview([a, b, c, d]).map((r) => r.name);
    const order2 = mapWeeklyReportLeadOverview([d, c, b, a]).map((r) => r.name);

    // blocked first, then the two at-risk by name, then on-track.
    expect(order1).toEqual(["Boris", "Anna", "Clara", "Dmitri"]);
    expect(order2).toEqual(order1);
  });

  it("returns an empty array for no lead groups", () => {
    expect(mapWeeklyReportLeadOverview([])).toEqual([]);
  });
});
