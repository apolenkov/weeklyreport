import {
  buildAssembledReportFromPrismaRow,
  computePortfolioOverviewFromReadSections,
  PublishedSnapshotIntegrityError,
  requirePublishedSnapshot,
  toPublishedSnapshotJson,
} from "@weeklyreport/report-persistence";
import {
  buildEscalationsFromReadSections,
  buildPortfolioProductsFromSnapshotSections,
} from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { publishedSnapshotFixture } from "../../../test-utils/prisma-test-helper";
import {
  AUTHOR_ID,
  makeSection,
  OWNED_PRODUCT,
  OWNED_STAGE_ID,
  OWNED_STAGE_NAME,
  REPORT_ID,
  SECOND_STAGE_ID,
  SECTION_ID,
} from "./__tests__/published-section-fixture";

const SECOND_PRODUCT = "65064b76-3bec-428d-b2f6-7bf30476909a";

// OWNED stage covered by the author's own at-risk/blocked risk must
// floor product status via effectiveProjectStatus (not raw trafficLight).
describe("buildPortfolioProductsFromSnapshotSections — own-risk floor", () => {
  it.each([null, "yellow"] as const)(
    "attributes only valued contributions when the second status is %s",
    (status) => {
      const secondAuthor = "7faa772b-dbd6-4a17-a4eb-85f006fcd0e1";
      const stageSet = [
        { stageId: OWNED_STAGE_ID, stageName: OWNED_STAGE_NAME, sortOrder: 0 },
      ];
      const sections = [
        makeSection({
          projects: [
            {
              projectId: OWNED_PRODUCT,
              projectName: "CRM Portal",
              trafficLight: null,
              ownedStages: [],
              stageSet,
            },
          ],
        }),
        makeSection({
          reportSectionId: "3b334e9c-d5c3-484d-9b8c-26fdd63206d8",
          authorId: secondAuthor,
          authorName: "Bob Lead",
          projects: [
            {
              projectId: OWNED_PRODUCT,
              projectName: "Other occurrence",
              trafficLight: status,
              ownedStages: [],
              stageSet,
            },
          ],
        }),
      ];
      expect(buildPortfolioProductsFromSnapshotSections(sections)).toEqual([
        {
          productId: OWNED_PRODUCT,
          productName: "CRM Portal",
          worstStatus: status,
          stageCount: 1,
          leadIds: status === null ? [] : [secondAuthor],
          leadNames: status === null ? [] : ["Bob Lead"],
        },
      ]);
    },
  );

  it("1.1 floors red for a blocked own risk on the owned stage", () => {
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
            stageNames: [OWNED_STAGE_NAME],
          },
        ],
      }),
    ]);

    expect(products[0]?.worstStatus).toBe("red");
  });

  it("1.2 floors yellow for an at-risk own risk on the owned stage", () => {
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
            stageNames: [OWNED_STAGE_NAME],
          },
        ],
      }),
    ]);

    expect(products[0]?.worstStatus).toBe("yellow");
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
            stageNames: [OWNED_STAGE_NAME],
          },
        ],
      }),
    ]);

    expect(products[0]?.worstStatus).toBe("red");
  });

  it("1.5 scopes a blocked own risk to its own product only", () => {
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
            stageNames: [OWNED_STAGE_NAME],
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

// Once the risk floor turns an owned stage red, `buildEscalationsFromReadSections`
// fires an `at_risk` "flagged red" escalation off the effective status, alongside
// the per-risk `blocked` escalation. Pin both so the pair stays deliberate.
describe("buildEscalationsFromReadSections — own-risk floor side effect", () => {
  it("emits at_risk + blocked for a blocked own risk on the owned stage", () => {
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
            stageNames: [OWNED_STAGE_NAME],
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

  it("does NOT fire at_risk when the product has no owned stages", () => {
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
            stageNames: [OWNED_STAGE_NAME],
          },
        ],
      }),
    ]);

    expect(escalations.filter((e) => e.type === "at_risk")).toHaveLength(0);
  });
});

// Published top-line portfolio totals (Shape B) come from the floored
// `trafficLight` of the mapped sections, NOT raw `projectStatuses`, so the
// top-line totals agree with the per-product cards in the same snapshot.
describe("buildAssembledReportFromPrismaRow — portfolio totals floor (Shape B)", () => {
  const STAGE_NAME = "Development";
  const AUTHOR_GROUP_ID = "abababab-abab-4aba-8aba-abababababab";
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
    email: "head@weeklyreport.local",
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
            reportingGroupId: AUTHOR_GROUP_ID,
            reportingGroup: {
              id: AUTHOR_GROUP_ID,
              name: "Finance Platforms",
            },
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
                  groupProducts: [
                    {
                      groupId: AUTHOR_GROUP_ID,
                    },
                  ],
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
          // submitted status), one own risk on the owned stage.
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
              stageNames: [STAGE_NAME],
              project: { name: "CRM Portal" },
              recordComments: [],
            },
          ],
          decisions: [],
          activityStatuses: [],
          sectionReviews: [],
          itemOutcomeEvents: [],
        },
      ],
    };
  }

  it("counts the product red (not green) for a blocked own risk", () => {
    const report = buildAssembledReportFromPrismaRow(reportRow("blocked"));

    expect(report.portfolioOverview.status).toBe("red");
    expect(report.portfolioOverview.totals).toMatchObject({ red: 1, green: 0 });
    expect(report.sections[0]).toMatchObject({
      groupId: AUTHOR_GROUP_ID,
      groupName: "Finance Platforms",
    });
  });

  it("counts the product yellow for an at-risk own risk", () => {
    const report = buildAssembledReportFromPrismaRow(reportRow("at-risk"));

    expect(report.portfolioOverview.status).toBe("yellow");
    expect(report.portfolioOverview.totals).toMatchObject({
      yellow: 1,
      green: 0,
    });
  });

  it("freezes the effective Activity title and note independently of live rows", () => {
    const row = reportRow("at-risk");
    const sourceSection = row.sections[0];
    if (!sourceSection) throw new Error("missing section fixture");
    const sourceActivity = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-status",
      reportSectionId: SECTION_ID,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
      activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "green" as const,
      titleOverride: "Weekly customer duty",
      note: "Frozen weekly context",
      activity: {
        name: "Catalogue customer duty",
        jiraAccounts: [],
        activityProducts: [],
      },
    };
    const report = buildAssembledReportFromPrismaRow({
      ...row,
      sections: [
        {
          ...sourceSection,
          activityStatuses: [sourceActivity],
        },
      ],
    });
    const snapshot = toPublishedSnapshotJson(report);

    sourceActivity.titleOverride = "Changed draft title";
    sourceActivity.note = "Changed draft note";
    sourceActivity.activity.name = "Renamed catalogue title";

    expect(
      requirePublishedSnapshot(snapshot, row.id).sections[0]?.activities,
    ).toMatchObject([
      {
        activityName: "Weekly customer duty",
        titleOverride: "Weekly customer duty",
        note: "Frozen weekly context",
      },
    ]);
  });

  it("keeps a legacy snapshot's stored Activity label without override metadata", () => {
    const snapshot = publishedSnapshotFixture({
      reportId: REPORT_ID,
      periodStart: new Date("2026-06-01T00:00:00Z"),
      periodEnd: new Date("2026-06-07T00:00:00Z"),
      publishedAt: new Date("2026-06-09T00:00:00Z"),
      sectionOwners: [
        {
          reportSectionId: SECTION_ID,
          authorId: AUTHOR_ID,
          authorName: "Alice Lead",
          groupId: AUTHOR_GROUP_ID,
          groupName: "Finance Platforms",
        },
      ],
    });
    const { sections } = snapshot as unknown as {
      sections: Record<string, unknown>[];
    };
    sections[0] = {
      ...sections[0],
      activities: [
        {
          activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          activityName: "Legacy frozen title",
          status: "green",
          note: "Legacy frozen note",
          jiraAccounts: [],
          linkedProducts: [],
          derivedStatus: "green",
          alarmFloor: null,
        },
      ],
    };

    expect(
      requirePublishedSnapshot(snapshot, REPORT_ID).sections[0]?.activities,
    ).toMatchObject([
      {
        activityName: "Legacy frozen title",
        note: "Legacy frozen note",
      },
    ]);
  });

  it("refuses to build a snapshot section without an author group anchor", () => {
    const row = reportRow("blocked");
    const section = row.sections[0];
    if (!section) throw new Error("missing section fixture");
    const malformed = {
      ...row,
      sections: [
        {
          ...section,
          author: {
            ...section.author,
            reportingGroupId: null,
            reportingGroup: null,
          },
        },
      ],
    };

    expect(() => buildAssembledReportFromPrismaRow(malformed)).toThrow(
      /has no consistent reporting-group ownership/,
    );
  });
});

describe("activity statuses do not roll up (stage-less, independent of product health)", () => {
  const RED_ACTIVITY = {
    activityId: "0e2f75a2-6f2f-4d51-8f5f-1b2c3d4e5f60",
    activityName: "Jira triage duty",
    jiraAccounts: [],
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

describe("requirePublishedSnapshot", () => {
  const snapshot = publishedSnapshotFixture({
    reportId: REPORT_ID,
    periodStart: "2026-04-06T00:00:00.000Z",
    periodEnd: "2026-04-12T23:59:59.999Z",
    publishedAt: "2026-04-13T10:00:00.000Z",
  });
  const groupId = "7a8b9c0d-1e2f-4345-8678-90abcdef1234";

  it("accepts a valid snapshot with the expected report identity", () => {
    expect(requirePublishedSnapshot(snapshot, REPORT_ID).reportId).toBe(
      REPORT_ID,
    );
  });

  it("fails closed for an absent snapshot", () => {
    expect(() => requirePublishedSnapshot(null, REPORT_ID)).toThrow(
      PublishedSnapshotIntegrityError,
    );
  });

  it("fails closed when snapshot identity does not match the row", () => {
    expect(() =>
      requirePublishedSnapshot(
        snapshot,
        "123e4567-e89b-42d3-a456-426614174000",
      ),
    ).toThrow(PublishedSnapshotIntegrityError);
  });

  it("fails closed when the stored document is not a publication", () => {
    expect(() =>
      requirePublishedSnapshot(
        { ...(snapshot as Record<string, unknown>), status: "draft" },
        REPORT_ID,
      ),
    ).toThrow(PublishedSnapshotIntegrityError);
  });

  it("fails closed when a section belongs to another report", () => {
    expect(() =>
      requirePublishedSnapshot(
        {
          ...(snapshot as Record<string, unknown>),
          sections: [
            makeSection({
              reportId: "123e4567-e89b-42d3-a456-426614174000",
            }),
          ],
        },
        REPORT_ID,
      ),
    ).toThrow(PublishedSnapshotIntegrityError);
  });

  it("fails closed when a section identity is duplicated", () => {
    const section = makeSection();
    expect(() =>
      requirePublishedSnapshot(
        {
          ...(snapshot as Record<string, unknown>),
          sections: [section, section],
        },
        REPORT_ID,
      ),
    ).toThrow(PublishedSnapshotIntegrityError);
  });

  it("fails closed when a frozen project omits its complete stage set", () => {
    const section = makeSection();
    const project = section.projects[0];
    if (!project) throw new Error("expected fixture project");
    const { stageSet, ...projectWithoutStageSet } = project;
    expect(stageSet).toEqual([]);

    expect(() =>
      requirePublishedSnapshot(
        {
          ...(snapshot as Record<string, unknown>),
          sections: [
            {
              ...section,
              groupId,
              groupName: "Snapshot Group",
              projects: [projectWithoutStageSet],
            },
          ],
        },
        REPORT_ID,
      ),
    ).toThrow(PublishedSnapshotIntegrityError);
  });

  it("accepts a frozen project with an explicit empty stage set", () => {
    const section = makeSection();

    expect(() =>
      requirePublishedSnapshot(
        {
          ...(snapshot as Record<string, unknown>),
          sections: [
            {
              ...section,
              groupId,
              groupName: "Snapshot Group",
            },
          ],
        },
        REPORT_ID,
      ),
    ).not.toThrow();
  });
});
