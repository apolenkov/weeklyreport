import { publishedReportSnapshotSchema } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { publishedSnapshotFixture } from "../../../test-utils/prisma-test-helper.js";
import {
  getCrossAuthorContentRead,
  getCrossAuthorsRead,
  getSharedNonArchivedProductIdsForReportRead,
} from "./lead-form-cross-author.reads.js";

const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_AUTHOR_ID = "33333333-3333-4333-8333-444444444444";
const SHARED_PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const UNSHARED_PROJECT_ID = "44444444-4444-4444-8444-555555555555";
const BUILD_STAGE_ID = "55555555-5555-4555-8555-555555555551";
const TEST_STAGE_ID = "55555555-5555-4555-8555-555555555552";
const GROUP_ID = "66666666-6666-4666-8666-666666666661";
const VIEWER_SECTION_ID = "77777777-7777-4777-8777-777777777771";
const FOREIGN_SECTION_ID = "77777777-7777-4777-8777-777777777772";

describe("lead-form cross-author atomic reads", () => {
  it("denies a lead with no own section before loading foreign data", async () => {
    const reportSectionFindUnique = vi.fn().mockResolvedValue(null);
    const stageAssignmentFindMany = vi.fn().mockResolvedValue([]);
    const { prisma, transactionOptions } = prismaReader({
      reportSectionFindUnique,
      stageAssignmentFindMany,
    });

    const rows = await getCrossAuthorsRead(prisma, REPORT_ID, USER_ID, "lead");

    expect(rows).toEqual([]);
    expect(reportSectionFindUnique).toHaveBeenCalledWith({
      where: { reportId_authorId: { reportId: REPORT_ID, authorId: USER_ID } },
      select: { id: true },
    });
    expect(stageAssignmentFindMany).not.toHaveBeenCalled();
    expect(transactionOptions()).toEqual({ isolationLevel: "RepeatableRead" });
  });

  it("does not grant a head content access without co-ownership", async () => {
    const reportSectionFindUnique = vi
      .fn()
      .mockResolvedValue({ id: "section" });
    const stageAssignmentFindMany = vi.fn().mockResolvedValue([]);
    const { prisma, transactionOptions } = prismaReader({
      reportSectionFindUnique,
      stageAssignmentFindMany,
    });

    const result = await getCrossAuthorContentRead(prisma, REPORT_ID, USER_ID);

    expect(result).toEqual({ coOwnsShared: false, rows: [] });
    expect(reportSectionFindUnique).toHaveBeenCalledWith({
      where: { reportId_authorId: { reportId: REPORT_ID, authorId: USER_ID } },
      select: { id: true },
    });
    expect(stageAssignmentFindMany).toHaveBeenCalledTimes(1);
    expect(transactionOptions()).toEqual({ isolationLevel: "RepeatableRead" });
  });

  it("serves published cross-author rows from the frozen snapshot without live reads", async () => {
    const reportSectionFindUnique = vi.fn();
    const stageAssignmentFindMany = vi.fn();
    const { prisma, transactionOptions } = prismaReader({
      reportSectionFindUnique,
      stageAssignmentFindMany,
      report: {
        periodStatus: "published",
        publishedSnapshot: frozenCrossAuthorSnapshot(),
      },
    });

    const rows = await getCrossAuthorsRead(prisma, REPORT_ID, USER_ID, "lead");

    // only the frozen shared-product row; the author's unshared product stays hidden
    expect(rows).toEqual([
      {
        projectId: SHARED_PROJECT_ID,
        projectName: "Shared Alpha",
        authorId: OTHER_AUTHOR_ID,
        authorInitials: "FL",
        authorShortName: "Foreign L.",
        stageNames: ["Build"],
        stages: [{ stageName: "Build", status: "green" }],
      },
    ]);
    // the published branch never touches the live own-section gate or stage
    // assignments — even for a lead
    expect(reportSectionFindUnique).not.toHaveBeenCalled();
    expect(stageAssignmentFindMany).not.toHaveBeenCalled();
    expect(transactionOptions()).toEqual({ isolationLevel: "RepeatableRead" });
  });

  it("dispatches the report-scoped shared-product read to the frozen snapshot inside RepeatableRead", async () => {
    const stageAssignmentFindMany = vi.fn();
    const { prisma, transactionOptions } = prismaReader({
      reportSectionFindUnique: vi.fn(),
      stageAssignmentFindMany,
      report: {
        periodStatus: "published",
        publishedSnapshot: frozenCrossAuthorSnapshot(),
      },
    });

    const productIds = await getSharedNonArchivedProductIdsForReportRead(
      prisma,
      REPORT_ID,
      USER_ID,
      OTHER_AUTHOR_ID,
    );

    expect(productIds).toEqual([SHARED_PROJECT_ID]);
    // frozen dispatch: co-ownership comes from the snapshot, not live assignments
    expect(stageAssignmentFindMany).not.toHaveBeenCalled();
    expect(transactionOptions()).toEqual({ isolationLevel: "RepeatableRead" });
  });
});

// A valid frozen snapshot: the viewer and the foreign author co-own
// SHARED_PROJECT_ID through owned stages; UNSHARED_PROJECT_ID is the author's
// alone. Passes requirePublishedSnapshot's schema + integrity checks.
function frozenCrossAuthorSnapshot() {
  const snapshot = publishedReportSnapshotSchema.parse(
    publishedSnapshotFixture({
      reportId: REPORT_ID,
      periodStart: "2026-04-07",
      periodEnd: "2026-04-13",
      publishedAt: "2026-04-14T10:00:00.000Z",
      sectionOwners: [
        {
          reportSectionId: VIEWER_SECTION_ID,
          authorId: USER_ID,
          authorName: "Viewer Lead",
          groupId: GROUP_ID,
          groupName: "Group A",
        },
        {
          reportSectionId: FOREIGN_SECTION_ID,
          authorId: OTHER_AUTHOR_ID,
          authorName: "Foreign Lead",
          groupId: GROUP_ID,
          groupName: "Group A",
        },
      ],
    }),
  );
  const sharedProject = {
    projectId: SHARED_PROJECT_ID,
    projectName: "Shared Alpha",
    trafficLight: "green",
    ownedStages: [
      {
        stageId: BUILD_STAGE_ID,
        stageName: "Build",
        sortOrder: 0,
        status: "green",
      },
    ],
    stageSet: [{ stageId: BUILD_STAGE_ID, stageName: "Build", sortOrder: 0 }],
    ownerGroupId: GROUP_ID,
  };
  return {
    ...snapshot,
    sections: snapshot.sections.map((section) => ({
      ...section,
      projects:
        section.authorId === USER_ID
          ? [sharedProject]
          : [
              sharedProject,
              {
                projectId: UNSHARED_PROJECT_ID,
                projectName: "Secret Beta",
                trafficLight: "red",
                ownedStages: [
                  {
                    stageId: TEST_STAGE_ID,
                    stageName: "Test",
                    sortOrder: 0,
                    status: "red",
                  },
                ],
                stageSet: [
                  { stageId: TEST_STAGE_ID, stageName: "Test", sortOrder: 0 },
                ],
                ownerGroupId: GROUP_ID,
              },
            ],
    })),
  };
}

function prismaReader(overrides: {
  reportSectionFindUnique: ReturnType<typeof vi.fn>;
  stageAssignmentFindMany: ReturnType<typeof vi.fn>;
  report?: { periodStatus: string; publishedSnapshot: unknown };
}) {
  const reportFindUnique = vi
    .fn()
    .mockResolvedValue(
      overrides.report ?? { periodStatus: "open", publishedSnapshot: null },
    );
  let transactionOptions: unknown;
  const tx = {
    report: { findUnique: reportFindUnique },
    reportSection: { findUnique: overrides.reportSectionFindUnique },
    stageAssignment: { findMany: overrides.stageAssignmentFindMany },
  };
  const prisma = {
    $transaction: async (
      operation: (client: typeof tx) => Promise<unknown>,
      options: unknown,
    ) => {
      transactionOptions = options;
      return operation(tx);
    },
  } as never;
  return { prisma, transactionOptions: () => transactionOptions };
}
