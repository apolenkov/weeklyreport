import type { WeeklyReportReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { formatPeriodRangeWithYear } from "../../../shared/lib/format/format-date";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  makeWeeklyReportFixture,
  type WeeklyReportFixture,
} from "../../../test-utils/report-section-fixtures";
import {
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
  mapWeeklyReportLeadOverview,
} from "./weekly-report";
import {
  statusLabelFor,
  trafficToProductStatus,
} from "./weekly-report-groupers";
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
  overrides: WeeklyReportFixture = {},
): WeeklyReportReadModel {
  return makeWeeklyReportFixture({
    reportId: REPORT_ID,
    ...overrides,
  });
}

describe("formatPeriodRangeWithYear", () => {
  it("formats a same-month range with en-dash", () => {
    expect(
      formatPeriodRangeWithYear(
        new Date("2026-04-14T00:00:00Z"),
        new Date("2026-04-20T00:00:00Z"),
      ),
    ).toBe("Apr 14–20, 2026");
  });

  it("formats a cross-month range with en-dash and second month name", () => {
    expect(
      formatPeriodRangeWithYear(
        new Date("2026-04-28T00:00:00Z"),
        new Date("2026-05-04T00:00:00Z"),
      ),
    ).toBe("Apr 28–May 4, 2026");
  });
});

describe("trafficToProductStatus", () => {
  it("green -> on-track, yellow -> at-risk, red -> blocked", () => {
    expect(trafficToProductStatus("green")).toBe("on-track");
    expect(trafficToProductStatus("yellow")).toBe("at-risk");
    expect(trafficToProductStatus("red")).toBe("blocked");
  });

  it("null worstStatus stays explicitly empty", () => {
    expect(trafficToProductStatus(null)).toBe("empty");
  });
});

describe("statusLabelFor", () => {
  it("joins lead names with ', ' and prefixes the status", () => {
    expect(
      statusLabelFor("at-risk", [
        "Иванов Василий Петрович",
        "Каштанова Мария Александровна",
      ]),
    ).toBe("At risk \u00B7 Иванов В.П., Каштанова М.А.");
  });
  it('falls back to "unassigned" when no leads', () => {
    expect(statusLabelFor("on-track", [])).toBe("On track \u00B7 unassigned");
  });

  it("shortens every product lead while preserving source names, ids, and order", () => {
    const leadNames = [
      "Иванов Василий Петрович",
      "Каштанова Мария Александровна",
    ] as const;
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: "CRM",
          worstStatus: "yellow",
          stageCount: 2,
          leadNames,
          leadIds: [AUTHOR_A, AUTHOR_B],
        },
      ],
      leadSections: [
        {
          authorId: AUTHOR_A,
          authorName: leadNames[0],
          projects: [
            {
              projectId: PROJECT_A,
              projectName: "CRM",
              trafficLight: "yellow",
            },
          ],
        },
        {
          authorId: AUTHOR_B,
          authorName: leadNames[1],
          projects: [
            {
              projectId: PROJECT_A,
              projectName: "CRM",
              trafficLight: "yellow",
            },
          ],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const product = expectDefined(result.products[0]);
    expect(product).toMatchObject({
      status: "at-risk",
      leads: "Иванов В.П. · Каштанова М.А.",
      authorIds: [AUTHOR_A, AUTHOR_B],
    });
    expect(report.portfolioOverview[0]?.leadNames).toEqual(leadNames);
  });
});

// Badges resolve product names report-wide, not only from the owning section's
// projects list (regression for "Unknown · <stage>" badges on cross-section
// references).

describe("product name resolution", () => {
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
              severity: "at-risk",
              stageNames: ["Analysis"],
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

describe("portfolio content presence", () => {
  it("inherits decision and true-empty presence from the detailed product", () => {
    const decisionOnly = mapWeeklyReport(
      baseReport({
        portfolioOverview: [
          {
            productId: PROJECT_A,
            productName: "CRM Platform",
            worstStatus: "green",
            stageCount: 1,
            leadNames: ["Lead One"],
            leadIds: [AUTHOR_A],
          },
          {
            productId: PROJECT_B,
            productName: "Mobile",
            worstStatus: null,
            stageCount: 0,
            leadNames: [],
            leadIds: [],
          },
        ],
        leadSections: [
          {
            authorId: AUTHOR_A,
            authorName: "Lead One",
            projects: [],
            items: [],
            risks: [],
            decisions: [
              {
                id: "decision-only",
                productId: PROJECT_A,
                text: "Approve fallback",
                owner: "Lead One",
                impact: "Keep service live",
              },
            ],
          },
        ],
      }),
    );

    expect(decisionOnly.portfolio).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: PROJECT_A, hasContent: true }),
        expect.objectContaining({ id: PROJECT_B, hasContent: false }),
      ]),
    );
  });
});

// "By lead" slices each product to the viewing lead's OWN contribution. A
// product authored by two leads must NOT repeat the merged card under each —
// each lead's card shows only their own items.

describe("mapWeeklyReportLeadGroups (by-lead slice)", () => {
  it("joins attention by stable author and product identities when names collide", () => {
    const sharedAuthorName = "Alex Lead";
    const sharedProductName = "Platform";
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: sharedProductName,
          worstStatus: "red",
          stageCount: 1,
          leadNames: [sharedAuthorName],
          leadIds: [AUTHOR_A],
        },
        {
          productId: PROJECT_B,
          productName: sharedProductName,
          worstStatus: "yellow",
          stageCount: 1,
          leadNames: [sharedAuthorName],
          leadIds: [AUTHOR_B],
        },
      ],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: sharedAuthorName,
          projects: [
            {
              projectId: PROJECT_A,
              projectName: sharedProductName,
              trafficLight: "red",
            },
          ],
        },
        {
          reportSectionId: SECTION_B,
          reportId: REPORT_ID,
          authorId: AUTHOR_B,
          authorName: sharedAuthorName,
          projects: [
            {
              projectId: PROJECT_B,
              projectName: sharedProductName,
              trafficLight: "yellow",
            },
          ],
        },
      ],
      escalations: [
        {
          type: "at_risk",
          productId: PROJECT_A,
          productName: sharedProductName,
          stageName: null,
          authorId: AUTHOR_A,
          leadName: sharedAuthorName,
          description: "First product attention",
        },
        {
          type: "unresolved_risk",
          productId: PROJECT_B,
          productName: sharedProductName,
          stageName: "Testing",
          authorId: AUTHOR_B,
          leadName: sharedAuthorName,
          description: "Second product attention",
        },
      ],
    });

    const groups = mapWeeklyReportLeadGroups(report);
    expect(
      groups.find((group) => group.id === AUTHOR_A)?.products[0]
        ?.needsAttention,
    ).toBe("First product attention");
    expect(
      groups.find((group) => group.id === AUTHOR_B)?.products[0]
        ?.needsAttention,
    ).toBe("Second product attention");
  });

  it("keeps referenced-only records under their own lead without cross-author mixing", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_B,
          productName: "Payments Gateway",
          worstStatus: "yellow",
          stageCount: 1,
          leadNames: ["Lead One", "Lead Two"],
          leadIds: [AUTHOR_A, AUTHOR_B],
        },
      ],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: "Lead One",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [],
          referencedProjects: [
            { projectId: PROJECT_B, projectName: "Stale referenced name" },
          ],
          items: [],
          risks: [
            {
              id: "risk-a",
              projectId: PROJECT_B,
              risk: "Vendor outage",
              impact: "Payments stop",
              mitigation: "Escalate vendor",
              severity: "blocked",
              stageNames: ["Planning"],
            },
          ],
          decisions: [],
        },
        {
          reportSectionId: SECTION_B,
          reportId: REPORT_ID,
          authorId: AUTHOR_B,
          authorName: "Lead Two",
          version: 1,
          status: "submitted",
          submittedAt: new Date("2026-04-19T18:00:00Z"),
          projects: [
            {
              projectId: PROJECT_B,
              projectName: "Payments Gateway",
              trafficLight: "yellow",
            },
          ],
          referencedProjects: [],
          items: [],
          risks: [],
          decisions: [
            {
              id: "decision-b",
              productId: PROJECT_B,
              text: "Approve fallback",
              owner: "Lead Two",
              impact: "Keep payments live",
              stageNames: ["Planning"],
            },
          ],
        },
      ],
    });

    const groups = mapWeeklyReportLeadGroups(report);
    const firstProduct = expectDefined(
      groups.find((group) => group.id === AUTHOR_A)?.products[0],
    );
    const secondProduct = expectDefined(
      groups.find((group) => group.id === AUTHOR_B)?.products[0],
    );

    expect(firstProduct).toMatchObject({
      id: PROJECT_B,
      name: "Payments Gateway",
      status: "empty",
    });
    expect(firstProduct.risks.map((risk) => risk.problem)).toEqual([
      "Vendor outage",
    ]);
    expect(firstProduct.decisions).toEqual([]);
    expect(secondProduct).toMatchObject({
      id: PROJECT_B,
      name: "Payments Gateway",
      status: "at-risk",
    });
    expect(secondProduct.risks).toEqual([]);
    expect(secondProduct.decisions.map((decision) => decision.text)).toEqual([
      "Approve fallback",
    ]);
  });

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

// Per-lead overview rows derived from the already-grouped lead data.
describe("mapWeeklyReportLeadOverview", () => {
  const item = (text: string): WeeklyReportItem => ({
    id: text,
    stageLead: "Planning · Lead",
    stage: "Planning",
    owner: "Lead",
    text,
    status: "in-progress",
  });

  function product(
    overrides: Partial<WeeklyProductReport> = {},
  ): WeeklyProductReport {
    return {
      id: "prod",
      authorIds: ["a"],
      initials: "PA",
      name: "Product",
      status: "on-track",
      statusLabel: "On track",
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
          risks: [
            {
              id: "r1",
              badge: "Product",
              stage: "",
              owner: "Lead",
              severity: "at-risk",
              text: "r",
              problem: "r",
              impact: "",
              mitigation: "",
            },
          ],
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
        product({
          status: "on-track",
          decisions: [{ id: "d1", badge: "Product", owner: "Lead", text: "d" }],
        }),
      ]),
      group("P", "Priorities Only", [
        product({
          status: "at-risk",
          priorities: [{ id: "priority-1", rank: 1, text: "P" }],
        }),
      ]),
      group("N", "Needs Attention Only", [
        product({
          status: "blocked",
          needsAttention: "Escalated",
          needsAttentionSeverity: "blocked",
        }),
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

  it("keeps an empty product status distinct from on-track in lead rollups", () => {
    const rows = mapWeeklyReportLeadOverview([
      group("empty", "Empty", [product({ status: "empty" })]),
      group("green", "Green", [product({ status: "on-track" })]),
    ]);

    expect(rows.map((row) => [row.name, row.worstStatus])).toEqual([
      ["Green", "on-track"],
      ["Empty", "empty"],
    ]);
  });

  it("returns an empty array for no lead groups", () => {
    expect(mapWeeklyReportLeadOverview([])).toEqual([]);
  });
});
