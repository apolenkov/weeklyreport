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

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const OWNED_PRODUCT = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const SECOND_PRODUCT = "65064b76-3bec-428d-b2f6-7bf30476909a";
const OWNED_STAGE_ID = "6366e7ef-e694-454f-863a-7e112ebbc48f";
const SECOND_STAGE_ID = "71e9d6a6-7455-4864-8de9-a48b2f25b13f";
const OWNED_STAGE_NAME = "Development";
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

// OWNED empty stage covered by the author's own at-risk/blocked risk must
// floor product status via effectiveProjectStatus (not raw trafficLight).
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
    // Blocked-severity risk escalates as `blocked`.
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

  // Full scalar defaults for Prisma.ReportGetPayload fixtures.
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
