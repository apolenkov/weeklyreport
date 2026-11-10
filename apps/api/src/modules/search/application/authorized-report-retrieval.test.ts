import type {
  RecordOmission,
  ReportSectionReadModel,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { ReportOccurrence } from "../domain/report-retrieval.types.js";
import {
  type AuthorizedReportRetrieval,
  authorizeReportOccurrences,
} from "./authorized-report-retrieval.js";
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
      coverage: { risks: 0, decisions: 0, unknown: false },
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

    expect(result.coverage).toEqual({ risks: 2, decisions: 1, unknown: false });
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

    expect(result.coverage).toEqual({ risks: 1, decisions: 0, unknown: true });
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

    expect(result.coverage).toEqual({ risks: 0, decisions: 0, unknown: false });
  });
});
