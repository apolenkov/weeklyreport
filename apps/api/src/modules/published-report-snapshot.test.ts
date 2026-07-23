import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  buildAssembledReportFromPrismaRow,
  buildPortfolioProductsFromSnapshotSections,
  computePortfolioOverviewFromReadSections,
} from "./published-report-snapshot";
import { buildEscalationsFromReadSections } from "./report-escalations";
import { buildPortfolioOverview } from "./weekly-report/weekly-report-portfolio";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const OWNED_PRODUCT = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const REFERENCED_PRODUCT = "eeb16c80-2f85-48a0-b838-d8096981ddba";
const SECOND_PRODUCT = "65064b76-3bec-428d-b2f6-7bf30476909a";
const OWNED_STAGE_ID = "6366e7ef-e694-454f-863a-7e112ebbc48f";
const SECOND_STAGE_ID = "71e9d6a6-7455-4864-8de9-a48b2f25b13f";
const OWNED_STAGE_NAME = "Development";
const SECOND_SECTION_ID = "3b334e9c-d5c3-484d-9b8c-26fdd63206d8";
const SECOND_AUTHOR_ID = "7faa772b-dbd6-4a17-a4eb-85f006fcd0e1";
const FIRST_STAGE = {
  stageId: OWNED_STAGE_ID,
  stageName: OWNED_STAGE_NAME,
  sortOrder: 0,
};
const SECOND_STAGE = {
  stageId: SECOND_STAGE_ID,
  stageName: "Testing",
  sortOrder: 1,
};
const CO_OWNED_STAGE_SET = [FIRST_STAGE, SECOND_STAGE];

function makeSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return reportSectionReadModelSchema.parse({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Alice Lead",
    version: 1,
    status: "submitted",
    submittedAt: null,
    projects: [
      {
        projectId: OWNED_PRODUCT,
        projectName: "CRM Portal",
        trafficLight: "green",
        ownedStages: [],
      },
    ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  });
}

/** Build two section occurrences of one cross-lead product. */
function makeCoOwnedProductSections(): ReportSectionReadModel[] {
  return [
    makeSection({
      authorName: "Alice Lead",
      projects: [
        {
          projectId: OWNED_PRODUCT,
          projectName: "CRM Portal",
          trafficLight: "green",
          ownedStages: [{ ...FIRST_STAGE, status: "green" }],
          stageSet: CO_OWNED_STAGE_SET,
        },
      ],
    }),
    makeSection({
      reportSectionId: SECOND_SECTION_ID,
      authorId: SECOND_AUTHOR_ID,
      authorName: "Bob Lead",
      projects: [
        {
          projectId: OWNED_PRODUCT,
          projectName: "CRM Portal",
          trafficLight: "red",
          ownedStages: [{ ...SECOND_STAGE, status: "red" }],
          stageSet: CO_OWNED_STAGE_SET,
        },
      ],
    }),
  ];
}

describe("published portfolio math for a co-owned product", () => {
  const sections = makeCoOwnedProductSections();

  it("counts the worst status once per distinct product", () => {
    const { totals } = computePortfolioOverviewFromReadSections(sections);
    const countedProducts = totals.green + totals.yellow + totals.red;

    expect(totals).toEqual({ green: 0, yellow: 0, red: 1 });
    expect(countedProducts).toBe(1);
  });

  it("counts the product-wide stage union", () => {
    const products = buildPortfolioProductsFromSnapshotSections(sections);

    expect(products[0]?.stageCount).toBe(2);
  });

  it("matches the live portfolio stage count for the same assignments", () => {
    const publishedProducts =
      buildPortfolioProductsFromSnapshotSections(sections);
    const liveProducts = buildPortfolioOverview(
      [
        {
          id: OWNED_PRODUCT,
          name: "CRM Portal",
          stageAssignments: CO_OWNED_STAGE_SET.map(({ stageId }) => ({
            id: stageId,
          })),
        },
      ],
      sections,
    );

    expect(publishedProducts[0]?.stageCount).toBe(liveProducts[0]?.stageCount);
  });
});

describe("buildEscalationsFromReadSections", () => {
  it("emits a blocked escalation from a blocked-severity risk (with its stage)", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "0e4f5947-bab4-4e24-a9f3-5cd3d0b1fb42",
            projectId: OWNED_PRODUCT,
            risk: "ETL pipeline blocked",
            impact: "High",
            mitigation: "Await vendor fix",
            severity: "blocked",
            stageIds: ["Development"],
          },
        ],
      }),
    ]);

    expect(escalations).toHaveLength(1);
    expect(escalations[0]).toMatchObject({
      type: "blocked",
      productName: "CRM Portal",
      stageName: "Development",
    });
  });

  it("joins multiple stage names for a multi-stage risk", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "0e4f5947-bab4-4e24-a9f3-5cd3d0b1fb42",
            projectId: OWNED_PRODUCT,
            risk: "Cross-stage regression",
            impact: "High",
            mitigation: "Backport",
            severity: "at-risk",
            stageIds: ["Development", "Testing"],
          },
        ],
      }),
    ]);

    const risk = escalations.find((e) => e.type === "unresolved_risk");
    expect(risk?.stageName).toBe("Development, Testing");
  });

  it("returns a null stage for a stage-less blocked risk", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "f57e03c5-ed65-4b82-8c58-74cb6f1931de",
            projectId: OWNED_PRODUCT,
            risk: "Legacy blocker",
            impact: "High",
            mitigation: "Escalated",
            severity: "blocked",
            stageIds: undefined,
          },
        ],
      }),
    ]);

    expect(escalations[0]?.type).toBe("blocked");
    expect(escalations[0]?.stageName).toBeNull();
  });

  it("record-status-derived-from-risk: a blocked-severity risk yields ONE escalation, never also unresolved_risk", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "aa514484-bbd6-4583-926f-dc20e922421b",
            projectId: OWNED_PRODUCT,
            risk: "Blocking dependency",
            impact: "High",
            mitigation: "Escalated",
            severity: "blocked",
            stageIds: ["Development"],
          },
        ],
      }),
    ]);

    expect(escalations).toHaveLength(1);
    expect(escalations[0]?.type).toBe("blocked");
    expect(escalations.some((e) => e.type === "unresolved_risk")).toBe(false);
  });

  it("record-status-derived-from-risk: an item's own workflowStatus is never an escalation source", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        items: [
          {
            id: "5b2fe575-86c3-422e-b7ed-5fe858cab7f7",
            projectId: OWNED_PRODUCT,
            type: "current",
            text: "In progress, no covering risk",
            tag: "infra",
            workflowStatus: "in_progress",
            carriedOver: false,
            priorityRank: null,
            stageIds: ["Development"],
          },
        ],
      }),
    ]);

    expect(escalations).toHaveLength(0);
  });

  it("resolves a product name referenced but not owned (never 'Unknown')", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        referencedProjects: [
          { projectId: REFERENCED_PRODUCT, projectName: "Shared Platform" },
        ],
        risks: [
          {
            id: "aa514484-bbd6-4583-926f-dc20e922421b",
            projectId: REFERENCED_PRODUCT,
            risk: "Dependency risk",
            impact: "Medium",
            mitigation: "Coordinate",
            severity: "at-risk",
            stageIds: ["Discovery"],
          },
        ],
      }),
    ]);

    const risk = escalations.find((e) => e.type === "unresolved_risk");
    expect(risk?.productName).toBe("Shared Platform");
    expect(risk?.productName).not.toBe("Unknown");
  });
});

// fix-flagged-red-escalation-dedup: a product co-owned by N (>= 2) leads and
// flagged red appears once in EACH co-owner's section, so the builder used to
// emit N identical "flagged red" `at_risk` rows. The dedupe collapses them to
// ONE per `projectId` (cross-section), while leaving per-record `blocked` items
// and `unresolved_risk` risks untouched. The single shared builder feeds both
// the live dashboard and the published snapshot, so this regression covers both.
describe("buildEscalationsFromReadSections — flagged-red dedupe", () => {
  const SECOND_SECTION_ID = "3b334e9c-d5c3-484d-9b8c-26fdd63206d8";

  function coOwnedRedSections(): ReportSectionReadModel[] {
    const redProject = {
      projectId: OWNED_PRODUCT,
      projectName: "CRM Portal",
      trafficLight: "red" as const,
      ownedStages: [],
    };
    return [
      makeSection({
        authorName: "Alice Lead",
        projects: [redProject],
        // The blocker is a blocked-severity risk, not a blocked item.
        risks: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            projectId: OWNED_PRODUCT,
            risk: "Alice blocker",
            impact: "High",
            mitigation: "Escalated",
            severity: "blocked",
            stageIds: ["Development"],
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            projectId: OWNED_PRODUCT,
            risk: "Alice risk",
            impact: "High",
            mitigation: "Mitigate",
            severity: "at-risk",
            stageIds: ["Development"],
          },
        ],
      }),
      makeSection({
        reportSectionId: SECOND_SECTION_ID,
        authorName: "Bob Lead",
        projects: [redProject],
        risks: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            projectId: OWNED_PRODUCT,
            risk: "Bob blocker",
            impact: "Medium",
            mitigation: "Escalated",
            severity: "blocked",
            stageIds: ["Testing"],
          },
          {
            id: "44444444-4444-4444-8444-444444444444",
            projectId: OWNED_PRODUCT,
            risk: "Bob risk",
            impact: "Medium",
            mitigation: "Mitigate",
            severity: "at-risk",
            stageIds: ["Testing"],
          },
        ],
      }),
    ];
  }

  it("collapses a co-owned flagged-red product to a single at_risk escalation", () => {
    const atRisk = buildEscalationsFromReadSections(
      coOwnedRedSections(),
    ).filter((e) => e.type === "at_risk");

    expect(atRisk).toHaveLength(1);
    expect(atRisk[0]).toMatchObject({
      productName: "CRM Portal",
      description: "Project CRM Portal is flagged red.",
    });
    // leadName is non-nullable and deterministically the first contributor.
    expect(atRisk[0]?.leadName).toBe("Alice Lead");
  });

  it("does not dedupe per-record blocked or unresolved risks", () => {
    const escalations = buildEscalationsFromReadSections(coOwnedRedSections());

    // Each lead's own blocked-severity risk and at-risk risk stays a distinct
    // row — only the product-level flagged-red signal collapses.
    expect(
      escalations.filter((e) => e.type === "blocked").map((e) => e.description),
    ).toEqual(["Alice blocker", "Bob blocker"]);
    expect(
      escalations
        .filter((e) => e.type === "unresolved_risk")
        .map((e) => e.description),
    ).toEqual(["Alice risk", "Bob risk"]);
  });

  it("emits one flagged-red per product regardless of call (live/snapshot parity)", () => {
    // Both surfaces call this same builder, so a second invocation on the same
    // read model must yield the identical single escalation — no leaked dedupe
    // state across calls.
    const first = buildEscalationsFromReadSections(coOwnedRedSections());
    const second = buildEscalationsFromReadSections(coOwnedRedSections());

    expect(first.filter((e) => e.type === "at_risk")).toHaveLength(1);
    expect(second).toEqual(first);
  });
});

// fix-published-empty-stage-risk-floor: an OWNED stage with no submitted
// status (raw `status: null`) covered by the section author's OWN at-risk /
// blocked risk must floor the product status. Today
// `buildPortfolioProductsFromSnapshotSections` reads only the raw
// `trafficLight` (the stale green fallback) and never folds `section.risks`,
// so these cases fail until the read-layer floor lands.
describe("buildPortfolioProductsFromSnapshotSections — own-risk floor", () => {
  it("1.1 floors red for a covers-all blocked own risk on an empty stage", () => {
    const products = buildPortfolioProductsFromSnapshotSections([
      makeSection({
        projects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "green",
            ownedStages: [
              {
                stageId: OWNED_STAGE_ID,
                stageName: OWNED_STAGE_NAME,
                sortOrder: 0,
                status: null,
              },
            ],
          },
        ],
        risks: [
          {
            id: "0aa1b1c2-d3e4-45f6-8a90-1b2c3d4e5f60",
            projectId: OWNED_PRODUCT,
            risk: "Vendor outage",
            impact: "High",
            mitigation: "Failover",
            severity: "blocked",
            stageIds: [],
          },
        ],
      }),
    ]);

    expect(products[0]?.worstStatus).toBe("red");
  });

  it("1.2 floors yellow for a covers-all at-risk own risk on an empty stage", () => {
    const products = buildPortfolioProductsFromSnapshotSections([
      makeSection({
        projects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "green",
            ownedStages: [
              {
                stageId: OWNED_STAGE_ID,
                stageName: OWNED_STAGE_NAME,
                sortOrder: 0,
                status: null,
              },
            ],
          },
        ],
        risks: [
          {
            id: "1bb2c2d3-e4f5-46a7-9b01-2c3d4e5f6071",
            projectId: OWNED_PRODUCT,
            risk: "Schedule slip",
            impact: "Medium",
            mitigation: "Re-plan",
            severity: "at-risk",
            stageIds: [],
          },
        ],
      }),
    ]);

    expect(products[0]?.worstStatus).toBe("yellow");
  });

  it("1.3 floors yellow for a stage-named at-risk own risk on that empty stage", () => {
    const products = buildPortfolioProductsFromSnapshotSections([
      makeSection({
        projects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "green",
            ownedStages: [
              {
                stageId: OWNED_STAGE_ID,
                stageName: OWNED_STAGE_NAME,
                sortOrder: 0,
                status: null,
              },
            ],
          },
        ],
        risks: [
          {
            id: "2cc3d3e4-f506-4718-ac12-3d4e5f607182",
            projectId: OWNED_PRODUCT,
            risk: "Flaky integration",
            impact: "Medium",
            mitigation: "Stabilise",
            severity: "at-risk",
            stageIds: [OWNED_STAGE_NAME],
          },
        ],
      }),
    ]);

    expect(products[0]?.worstStatus).toBe("yellow");
  });

  it("floors Development red for a published snapshot risk named Dev", () => {
    const products = buildPortfolioProductsFromSnapshotSections([
      makeSection({
        projects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "green",
            ownedStages: [
              {
                stageId: OWNED_STAGE_ID,
                stageName: OWNED_STAGE_NAME,
                sortOrder: 0,
                status: null,
              },
            ],
          },
        ],
        risks: [
          {
            id: "9ee5f506-1728-493a-8e34-5f60718293a4",
            projectId: OWNED_PRODUCT,
            risk: "Legacy release blocker",
            impact: "High",
            mitigation: "Fix before release",
            severity: "blocked",
            stageIds: ["Dev"],
          },
        ],
      }),
    ]);

    expect(products[0]?.worstStatus).toBe("red");
  });

  it("1.4 keeps red when a stage is already red and the own risk is milder", () => {
    const products = buildPortfolioProductsFromSnapshotSections([
      makeSection({
        projects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "red",
            ownedStages: [
              {
                stageId: OWNED_STAGE_ID,
                stageName: OWNED_STAGE_NAME,
                sortOrder: 0,
                status: "red",
              },
            ],
          },
        ],
        risks: [
          {
            id: "3dd4e4f5-0617-4829-bd23-4e5f60718293",
            projectId: OWNED_PRODUCT,
            risk: "Minor concern",
            impact: "Low",
            mitigation: "Monitor",
            severity: "at-risk",
            stageIds: [],
          },
        ],
      }),
    ]);

    expect(products[0]?.worstStatus).toBe("red");
  });

  it("1.5 scopes a covers-all blocked own risk to its own product only", () => {
    const products = buildPortfolioProductsFromSnapshotSections([
      makeSection({
        projects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "green",
            ownedStages: [
              {
                stageId: OWNED_STAGE_ID,
                stageName: OWNED_STAGE_NAME,
                sortOrder: 0,
                status: null,
              },
            ],
          },
          {
            projectId: SECOND_PRODUCT,
            projectName: "Billing Service",
            trafficLight: "green",
            ownedStages: [
              {
                stageId: SECOND_STAGE_ID,
                stageName: OWNED_STAGE_NAME,
                sortOrder: 0,
                status: null,
              },
            ],
          },
        ],
        risks: [
          {
            id: "162a4afd-e02f-4109-bbc0-2515723246bd",
            projectId: OWNED_PRODUCT,
            risk: "Critical defect",
            impact: "High",
            mitigation: "Hotfix",
            severity: "blocked",
            stageIds: [],
          },
        ],
      }),
    ]);

    const productA = products.find((p) => p.productId === OWNED_PRODUCT);
    const productB = products.find((p) => p.productId === SECOND_PRODUCT);
    expect(productA?.worstStatus).toBe("red");
    expect(productB?.worstStatus).toBe("green");
  });
});

// Once the risk floor turns an empty stage red, `buildEscalationsFromReadSections`
// fires an `at_risk` "flagged red" escalation off the effective status, alongside
// the existing per-risk `unresolved_risk`. Pin both so the pair stays deliberate.
describe("buildEscalationsFromReadSections — own-risk floor side effect", () => {
  it("emits at_risk + blocked for a covers-all blocked own risk on an empty stage", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        projects: [
          {
            projectId: OWNED_PRODUCT,
            projectName: "CRM Portal",
            trafficLight: "green",
            ownedStages: [
              {
                stageId: OWNED_STAGE_ID,
                stageName: OWNED_STAGE_NAME,
                sortOrder: 0,
                status: null,
              },
            ],
          },
        ],
        risks: [
          {
            id: "698863f9-98a7-4cd7-857a-a26e714a82b2",
            projectId: OWNED_PRODUCT,
            risk: "Vendor outage",
            impact: "High",
            mitigation: "Failover",
            severity: "blocked",
            stageIds: [],
          },
        ],
      }),
    ]);

    expect(escalations.filter((e) => e.type === "at_risk")).toMatchObject([
      { productName: "CRM Portal", stageName: null },
    ]);
    // record-status-derived-from-risk: the blocked-severity risk itself now
    // escalates as `blocked` (previously `unresolved_risk`).
    expect(escalations.filter((e) => e.type === "blocked")).toMatchObject([
      { productName: "CRM Portal" },
    ]);
  });

  it("does NOT fire at_risk when the product has no owned stages (covers-all has nothing to floor)", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "bf68ca41-95a9-4a50-a2b2-7f1dc07a65dc",
            projectId: OWNED_PRODUCT,
            risk: "Schedule slip",
            impact: "Medium",
            mitigation: "Re-plan",
            severity: "blocked",
            stageIds: [],
          },
        ],
      }),
    ]);

    expect(escalations.filter((e) => e.type === "at_risk")).toHaveLength(0);
  });
});

// Published top-line portfolio totals (Shape B) are computed from the floored
// `trafficLight` of the mapped sections, NOT raw `projectStatuses`. An owned
// stage with no submitted status covered by a covers-all own risk floors the
// portfolio status AND the per-product count, so the top-line totals agree with
// the per-product cards inside the same snapshot. The PDF top-line re-route
// lives in a separate `toAssembledReport` and is pinned by its own test in
// pdf-export.prisma-repository.test.ts.
describe("buildAssembledReportFromPrismaRow — portfolio totals floor (Shape B)", () => {
  const STAGE_NAME = "Development";
  const FIXED_TIMESTAMP = new Date("2026-01-01T00:00:00.000Z");

  // `buildAssembledReportFromPrismaRow` now
  // takes the generated `Prisma.ReportGetPayload`, which carries every base
  // scalar column (not just the ones this test reads) — these defaults keep
  // the fixture honest without repeating them at every call site.
  function fullProject(name: string) {
    return {
      id: OWNED_PRODUCT,
      name,
      archived: false,
      leadId: AUTHOR_ID,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };
  }

  const fullPublishedBy = {
    id: AUTHOR_ID,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    email: "head@customreport.local",
    name: "Head",
    lastName: "Head",
    firstName: "Head",
    middleName: null,
    position: null,
    role: "head" as const,
    samlId: "head-saml-id",
    reportingGroupId: null,
    notificationOptOut: false,
    isActive: true,
  };

  function reportRow(severity: "blocked" | "at-risk") {
    return {
      id: REPORT_ID,
      periodStart: new Date("2026-06-01T00:00:00Z"),
      periodEnd: new Date("2026-06-07T00:00:00Z"),
      deadline: new Date("2026-06-08T00:00:00Z"),
      status: "published" as const,
      publishedAt: new Date("2026-06-09T00:00:00Z"),
      publishedById: AUTHOR_ID,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
      periodStatus: "published" as const,
      reopenedAt: null,
      weekLabel: null,
      archived: false,
      autoPublished: false,
      autoArchived: false,
      periodState: "published" as const,
      publishedSnapshot: null,
      publishedBy: fullPublishedBy,
      sections: [
        {
          id: SECTION_ID,
          reportId: REPORT_ID,
          authorId: AUTHOR_ID,
          status: "submitted" as const,
          submittedAt: null,
          late: false,
          version: 1,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
          revokedAt: null,
          revokedBy: null,
          author: {
            name: "Alice Lead",
            role: "lead" as const,
            id: AUTHOR_ID,
            reportingGroupId: null,
            stageAssignments: [
              {
                id: `${OWNED_STAGE_ID}-assignment`,
                userId: AUTHOR_ID,
                stageId: OWNED_STAGE_ID,
                projectId: OWNED_PRODUCT,
                createdAt: FIXED_TIMESTAMP,
                project: {
                  ...fullProject("CRM Portal"),
                  stageAssignments: [],
                  lead: { reportingGroupId: null },
                },
                stage: {
                  id: OWNED_STAGE_ID,
                  name: STAGE_NAME,
                  sortOrder: 4,
                  createdAt: FIXED_TIMESTAMP,
                },
              },
            ],
          },
          // Stale green ProjectStatus, no StageStatus row (owned stage has no
          // submitted status), one covers-all own risk.
          projectStatuses: [
            {
              id: `${OWNED_PRODUCT}-status`,
              reportSectionId: SECTION_ID,
              createdAt: FIXED_TIMESTAMP,
              updatedAt: FIXED_TIMESTAMP,
              projectId: OWNED_PRODUCT,
              status: "green" as const,
              project: fullProject("CRM Portal"),
            },
          ],
          stageStatuses: [],
          items: [],
          risks: [
            {
              id: "e421b0e4-caac-4218-9f40-d062f523b86b",
              stableId: "e421b0e4-caac-4218-9f40-d062f523b86b",
              reportSectionId: SECTION_ID,
              activityId: null,
              createdAt: FIXED_TIMESTAMP,
              updatedAt: FIXED_TIMESTAMP,
              projectId: OWNED_PRODUCT,
              risk: "Vendor outage",
              impact: "High",
              mitigation: "Failover",
              severity,
              stageNames: [],
              project: { name: "CRM Portal" },
              recordComments: [],
            },
          ],
          decisions: [],
          activityStatuses: [],
          sectionReviews: [],
        },
      ],
    };
  }

  it("counts the product red (not green) for a covers-all blocked own risk", () => {
    const report = buildAssembledReportFromPrismaRow(reportRow("blocked"));

    expect(report.portfolioOverview.status).toBe("red");
    expect(report.portfolioOverview.totals).toMatchObject({ red: 1, green: 0 });
  });

  it("counts the product yellow for a covers-all at-risk own risk", () => {
    const report = buildAssembledReportFromPrismaRow(reportRow("at-risk"));

    expect(report.portfolioOverview.status).toBe("yellow");
    expect(report.portfolioOverview.totals).toMatchObject({
      yellow: 1,
      green: 0,
    });
  });
});

describe("activity statuses do not roll up (stage-less, independent of product health)", () => {
  const RED_ACTIVITY = {
    activityId: "0e2f75a2-6f2f-4d51-8f5f-1b2c3d4e5f60",
    activityName: "Jira triage duty",
    status: "red" as const,
    linkedProducts: [],
    derivedStatus: "red" as const,
  };

  it("a blocked activity changes neither portfolio totals nor product health", () => {
    const withoutActivity = makeSection();
    const withBlockedActivity = makeSection({ activities: [RED_ACTIVITY] });

    expect(
      computePortfolioOverviewFromReadSections([withBlockedActivity]),
    ).toEqual(computePortfolioOverviewFromReadSections([withoutActivity]));

    const products = buildPortfolioProductsFromSnapshotSections([
      withBlockedActivity,
    ]);
    expect(products[0]?.worstStatus).toBe("green");
  });

  it("a blocked activity contributes no escalation", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({ activities: [RED_ACTIVITY] }),
    ]);
    expect(escalations).toEqual([]);
  });
});
