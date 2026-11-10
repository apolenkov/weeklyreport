import type {
  RecordOmission,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type {
  ReportOccurrence,
  ResolvedSearchPlan,
} from "../domain/report-retrieval.types.js";
import {
  type AuthorizedReportRetrieval,
  authorizeReportOccurrences,
} from "./authorized-report-retrieval.js";
import { summarizeAssistantCoverage } from "./report-assistant.coverage.js";
import { basePlan } from "./report-assistant.test-support.js";
import type { ReportSearchAccessRepository } from "./report-search.repository.js";

const ACTOR_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const FOREIGN_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const REPORT_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const SHARED_PRODUCT_ID = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const UNSHARED_PRODUCT_ID = "eeb16c80-2f85-48a0-b838-d8096981ddba";
const ACTIVITY_ID = "65064b76-3bec-428d-b2f6-7bf30476909a";

function section(authorId: string): ReportSectionReadModel {
  return {
    reportSectionId: `${authorId.slice(0, 8)}-c4b2-473c-8a7b-15ecc52195c7`,
    reportId: REPORT_ID,
    authorId,
    authorName: authorId === ACTOR_ID ? "Own Lead" : "Foreign Lead",
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: null,
    late: false,
    projects: [
      {
        projectId: SHARED_PRODUCT_ID,
        projectName: "Shared Product",
        trafficLight: "green",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: null,
      },
      {
        projectId: UNSHARED_PRODUCT_ID,
        projectName: "Unshared Product",
        trafficLight: "red",
        ownedStages: [],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
    referencedProjects: [
      { projectId: SHARED_PRODUCT_ID, projectName: "Shared Product" },
      { projectId: UNSHARED_PRODUCT_ID, projectName: "Unshared Product" },
    ],
    items: [
      {
        projectId: SHARED_PRODUCT_ID,
        type: "current",
        text: "Shared item",
        tag: "work",
        workflowStatus: "paused",
        carriedOver: false,
        priorityRank: null,
        stageNames: ["Development"],
        pausedReason: "Private pause reason",
        comments: [],
      },
      {
        projectId: UNSHARED_PRODUCT_ID,
        type: "current",
        text: "Unshared item",
        tag: "work",
        workflowStatus: "in_progress",
        carriedOver: false,
        priorityRank: null,
        stageNames: ["Development"],
      },
      {
        activityId: ACTIVITY_ID,
        type: "current",
        text: "Private activity item",
        tag: "work",
        workflowStatus: "in_progress",
        carriedOver: false,
        priorityRank: null,
        stageNames: [],
      },
    ],
    risks: [],
    decisions: [],
    activities: [
      {
        activityId: ACTIVITY_ID,
        activityName: "Private Activity",
        status: "yellow",
        jiraAccounts: [],
        note: "Private activity note",
        linkedProducts: [],
        derivedStatus: null,
        alarmFloor: null,
      },
    ],
    reviews: [],
  };
}

function occurrence(
  sections: readonly ReportSectionReadModel[],
  recordOmissions?: ReportOccurrence["recordOmissions"],
): ReportOccurrence {
  return {
    reportId: REPORT_ID,
    periodId: REPORT_ID,
    periodLabel: "W32",
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    source: "snapshot",
    sections,
    ...(recordOmissions ? { recordOmissions } : {}),
  };
}

function accessRepository(
  ownSection: boolean,
  sharedProductIds: readonly string[],
): {
  readonly repository: ReportSearchAccessRepository;
  readonly getAuthorizationSnapshot: ReturnType<typeof vi.fn>;
} {
  const getAuthorizationSnapshot = vi
    .fn()
    .mockImplementation(
      (
        _actorId: string,
        reportIds: readonly string[],
        authorIds: readonly string[],
      ) => ({
        ownSectionReportIds: ownSection ? reportIds : [],
        sharedProductIdsByAuthor: new Map(
          authorIds.map((authorId) => [authorId, sharedProductIds]),
        ),
      }),
    );
  return {
    repository: { getAuthorizationSnapshot },
    getAuthorizationSnapshot,
  };
}

function foreignScope(result: AuthorizedReportRetrieval) {
  return result.sectionScopes.find((scope) => scope.authorId === FOREIGN_ID);
}

describe("authorizeReportOccurrences", () => {
  it("proves report access and lenses foreign sections before projection", async () => {
    const access = accessRepository(true, [SHARED_PRODUCT_ID]);
    const result = await authorizeReportOccurrences(
      access.repository,
      ACTOR_ID,
      [occurrence([section(ACTOR_ID), section(FOREIGN_ID)])],
    );

    expect(access.getAuthorizationSnapshot).toHaveBeenCalledOnce();
    expect(result.sectionScopes.map((scope) => scope.visibility)).toEqual([
      "own",
      "shared_products",
    ]);
    expect(foreignScope(result)?.section.items).toHaveLength(1);
    expect(foreignScope(result)?.section.items[0]).not.toHaveProperty(
      "pausedReason",
    );
    expect(foreignScope(result)?.section.activities).toEqual([]);
    expect(foreignScope(result)?.section.reviews).toEqual([]);
    expect(result.occurrences[0]?.sections).toHaveLength(2);
    expect(result.occurrences[0]?.sections[0]?.activities).toHaveLength(1);
  });

  it("exposes no foreign sections without an own section proof", async () => {
    const access = accessRepository(false, [SHARED_PRODUCT_ID]);
    const result = await authorizeReportOccurrences(
      access.repository,
      ACTOR_ID,
      [occurrence([section(FOREIGN_ID)])],
    );

    expect(result).toEqual({
      occurrences: [],
      sectionScopes: [],
    });
    expect(access.getAuthorizationSnapshot).toHaveBeenCalledOnce();
  });

  it("drops foreign sections when the current shared-product scope is empty", async () => {
    const access = accessRepository(true, []);
    const result = await authorizeReportOccurrences(
      access.repository,
      ACTOR_ID,
      [occurrence([section(ACTOR_ID), section(FOREIGN_ID)])],
    );

    expect(result.sectionScopes).toHaveLength(1);
    expect(result.sectionScopes[0]?.visibility).toBe("own");
  });
});

const coverage = (
  retrieval: AuthorizedReportRetrieval,
  overrides: Partial<ResolvedSearchPlan> = {},
) =>
  summarizeAssistantCoverage({
    plan: {
      ...basePlan,
      authors: { mode: "all_visible", references: [], includeSelf: true },
    },
    occurrences: retrieval.occurrences,
    sectionScopes: retrieval.sectionScopes,
    authorIds: retrieval.sectionScopes.map((scope) => scope.authorId),
    productIds: [],
    activityIds: [],
    stageIds: [],
    periodIds: [],
    ...overrides,
  });

const omission = (
  ...buckets: readonly (readonly [
    RecordOmission["buckets"][number]["kind"],
    string,
    number,
  ])[]
): RecordOmission => ({
  version: 1,
  buckets: buckets.map(([kind, parentId, count]) => ({
    kind,
    parentKind: "product",
    parentId,
    stageNames: ["Development"],
    count,
  })),
});

const sectionId = (authorId: string) => section(authorId).reportSectionId;

describe("authorizeReportOccurrences coverage", () => {
  it.each(["live", "snapshot"] as const)(
    "scopes %s buckets by subjects, stage union and readable Activity links",
    async (source) => {
      const own = section(ACTOR_ID);
      const linkedOwn = {
        ...own,
        activities: own.activities.map((activity) => ({
          ...activity,
          linkedProducts: [
            { productId: SHARED_PRODUCT_ID, productName: "Shared Product" },
          ],
        })),
      };
      const metadata: RecordOmission = {
        version: 1,
        buckets: [
          {
            kind: "risk",
            parentKind: "product",
            parentId: SHARED_PRODUCT_ID,
            stageNames: ["Development", "Testing"],
            count: 2,
          },
          {
            kind: "decision",
            parentKind: "product",
            parentId: UNSHARED_PRODUCT_ID,
            stageNames: ["Development"],
            count: 3,
          },
          {
            kind: "risk",
            parentKind: "activity",
            parentId: ACTIVITY_ID,
            stageNames: [],
            count: 5,
          },
        ],
      };
      const result = await authorizeReportOccurrences(
        accessRepository(true, [SHARED_PRODUCT_ID]).repository,
        ACTOR_ID,
        [
          {
            ...occurrence(
              [linkedOwn, section(FOREIGN_ID)],
              new Map([
                [sectionId(ACTOR_ID), metadata],
                [sectionId(FOREIGN_ID), metadata],
              ]),
            ),
            source,
          },
        ],
      );
      expect(coverage(result)).toEqual({
        risks: 9,
        decisions: 3,
        unknown: false,
      });
      expect(
        coverage(result, {
          authorIds: [ACTOR_ID],
          productIds: [SHARED_PRODUCT_ID],
          stageIds: ["Development", "Testing"],
        }),
      ).toEqual({ risks: 2, decisions: 0, unknown: false });
      expect(
        coverage(result, {
          authorIds: [FOREIGN_ID],
          productIds: [UNSHARED_PRODUCT_ID],
        }),
      ).toEqual({ risks: 0, decisions: 0, unknown: false });
      for (const [linkedActivityMode, risks] of [
        ["exclude", 4],
        ["include", 9],
        ["only", 5],
      ] as const) {
        expect(
          coverage(result, {
            productIds: [SHARED_PRODUCT_ID],
            plan: {
              ...basePlan,
              subjects: {
                ...basePlan.subjects,
                productReferences: ["Shared Product"],
                linkedActivityMode,
              },
            },
          }),
        ).toEqual({ risks, decisions: 0, unknown: false });
      }
      expect(coverage(result, { activityIds: [ACTIVITY_ID] })).toEqual({
        risks: 5,
        decisions: 0,
        unknown: false,
      });
      expect(
        coverage(result, {
          activityIds: [ACTIVITY_ID],
          stageIds: ["Development"],
        }),
      ).toEqual({ risks: 0, decisions: 0, unknown: false });
    },
  );

  it("keeps legacy unknown only inside the resolved authorized corpus", async () => {
    const result = await authorizeReportOccurrences(
      accessRepository(true, [SHARED_PRODUCT_ID]).repository,
      ACTOR_ID,
      [occurrence([section(ACTOR_ID), section(FOREIGN_ID)])],
    );
    const zero = { risks: 0, decisions: 0, unknown: false };
    expect(
      coverage(result, {
        authorIds: [FOREIGN_ID],
        productIds: [UNSHARED_PRODUCT_ID],
      }),
    ).toEqual(zero);
    expect(
      coverage(result, { authorIds: [], productIds: [SHARED_PRODUCT_ID] }),
    ).toEqual(zero);
    expect(coverage(result, { periodIds: ["not-a-selected-period"] })).toEqual(
      zero,
    );
    expect(
      coverage(result, { plan: { ...basePlan, recordKinds: ["item"] } }),
    ).toEqual(zero);
    expect(
      coverage(result, { authorIds: [FOREIGN_ID], activityIds: [ACTIVITY_ID] }),
    ).toEqual(zero);
    expect(
      coverage(result, {
        authorIds: [ACTOR_ID],
        stageIds: ["Development"],
        plan: {
          ...basePlan,
          subjects: { ...basePlan.subjects, parentKinds: ["activity"] },
        },
      }),
    ).toEqual(zero);
    expect(
      coverage(result, {
        authorIds: [FOREIGN_ID],
        productIds: [SHARED_PRODUCT_ID],
        stageIds: ["Development"],
      }),
    ).toEqual({ ...zero, unknown: true });
    expect(
      coverage(result, { authorIds: [ACTOR_ID], activityIds: [ACTIVITY_ID] }),
    ).toEqual({ ...zero, unknown: true });
  });

  it("counts an own section whole and a foreign one through its shared products", async () => {
    const result = await authorizeReportOccurrences(
      accessRepository(true, [SHARED_PRODUCT_ID]).repository,
      ACTOR_ID,
      [
        occurrence(
          [section(ACTOR_ID), section(FOREIGN_ID)],
          new Map([
            [sectionId(ACTOR_ID), omission(["risk", UNSHARED_PRODUCT_ID, 2])],
            [
              sectionId(FOREIGN_ID),
              omission(
                ["decision", SHARED_PRODUCT_ID, 1],
                ["risk", UNSHARED_PRODUCT_ID, 5],
              ),
            ],
          ]),
        ),
      ],
    );

    expect(coverage(result)).toEqual({
      risks: 2,
      decisions: 1,
      unknown: false,
    });
  });

  it("says unknown for a section frozen before the counts existed", async () => {
    const result = await authorizeReportOccurrences(
      accessRepository(true, [SHARED_PRODUCT_ID]).repository,
      ACTOR_ID,
      [
        occurrence(
          [section(ACTOR_ID), section(FOREIGN_ID)],
          new Map([
            [sectionId(ACTOR_ID), omission(["risk", SHARED_PRODUCT_ID, 1])],
          ]),
        ),
      ],
    );

    expect(coverage(result)).toEqual({ risks: 1, decisions: 0, unknown: true });
  });

  it("discloses nothing about sections the actor may not read", async () => {
    const result = await authorizeReportOccurrences(
      accessRepository(true, []).repository,
      ACTOR_ID,
      [
        occurrence(
          [section(ACTOR_ID), section(FOREIGN_ID)],
          new Map([
            [sectionId(ACTOR_ID), omission()],
            [sectionId(FOREIGN_ID), omission(["risk", SHARED_PRODUCT_ID, 4])],
          ]),
        ),
      ],
    );

    expect(coverage(result)).toEqual({
      risks: 0,
      decisions: 0,
      unknown: false,
    });
  });
});
